import { Client, Room } from 'colyseus';
import {
  applyHealthDamage,
  AttackStateMachine,
  createHealthFighter,
  evaluateTeamHealth,
  evaluateTimeLimitResult,
  GAME_CONFIG,
  isBasicAttackHit,
} from 'linked-fighters-shared';
import {
  EVENTS,
  FighterSlot,
  GameState,
  MatchResult,
  Team,
} from 'linked-fighters-shared';
import type { HealthFighterState } from 'linked-fighters-shared';
import type {
  CombatAttackMessage,
  CombatDamageMessage,
  CombatPositionMessage,
  CombatStateSnapshot,
  Vec3,
} from 'linked-fighters-shared';

/**
 * 체력/다운/승패의 서버 권한형 최소 구현.
 * 한 메시지의 hits를 전부 적용한 뒤 결과를 평가하여 같은 tick 동시 다운을 보존한다.
 */
export class CombatRoom extends Room {
  maxClients = 2;
  private fighters = this.createInitialFighters();
  private positions = this.createInitialPositions();
  private readonly assignments = new Map<string, FighterSlot>();
  private readonly positionSequences = new Map<FighterSlot, number>();
  private readonly attackSequences = new Map<FighterSlot, number>();
  private attacks = this.createAttackMachines();
  private revision = 0;
  private resetRevision = 0;
  private gameState = GameState.WAITING;
  private countdownRemaining = 0;
  private timeRemaining: number = GAME_CONFIG.MATCH_DURATION;
  private matchResult = MatchResult.PLAYING;

  onCreate() {
    // COMBAT_DAMAGE는 그레이박스 수동 테스트 전용이다.
    // 실제 F/L 공격은 COMBAT_ATTACK에서 대상과 피해량을 서버가 결정한다.
    this.onMessage(
      EVENTS.COMBAT_DAMAGE,
      (_client, message: unknown) => this.handleDamage(message),
    );
    this.onMessage(EVENTS.COMBAT_RESET, () => {
      this.resetMatchData();
      if (this.assignments.size === this.maxClients) {
        this.startCountdown();
      }
      this.broadcastState();
    });
    this.onMessage(EVENTS.COMBAT_POSITION, (client, message: unknown) => {
      this.handlePosition(client, message);
    });
    this.onMessage(EVENTS.COMBAT_ATTACK, (client, message: unknown) => {
      this.handleAttack(client, message);
    });
    this.onMessage(EVENTS.COMBAT_REQUEST_STATE, (client) => {
      this.sendAssignment(client);
      client.send(EVENTS.COMBAT_STATE, this.createStateMessage());
    });
    this.setSimulationInterval((deltaTime) => {
      this.updateMatch(Math.min(deltaTime / 1000, 0.1));
    }, 1000 / GAME_CONFIG.SERVER_TICK_RATE);
  }

  onJoin(client: Client) {
    const usedSlots = new Set(this.assignments.values());
    const slot = usedSlots.has(FighterSlot.LEFT)
      ? FighterSlot.RIGHT
      : FighterSlot.LEFT;
    this.assignments.set(client.sessionId, slot);
    this.sendAssignment(client);
    if (this.assignments.size === this.maxClients) {
      this.startCountdown();
    }
    this.broadcastState();
  }

  onLeave(client: Client) {
    const slot = this.assignments.get(client.sessionId);
    if (slot) this.positionSequences.delete(slot);
    if (slot) this.attackSequences.delete(slot);
    this.assignments.delete(client.sessionId);
    this.resetMatchData();
    this.gameState = GameState.WAITING;
    this.countdownRemaining = 0;
    this.broadcastState();
  }

  private sendAssignment(client: Client) {
    const slot = this.assignments.get(client.sessionId);
    if (!slot) return;
    client.send(EVENTS.COMBAT_ASSIGNMENT, {
      fighterId: slot === FighterSlot.LEFT ? 'player-left' : 'player-right',
      slot,
    });
  }

  private handlePosition(client: Client, message: unknown) {
    if (this.gameState !== GameState.PLAYING) return;
    const slot = this.assignments.get(client.sessionId);
    if (!slot || !this.isPositionMessage(message)) return;
    const previousSequence = this.positionSequences.get(slot) ?? -1;
    if (message.sequence <= previousSequence) return;
    const fighterId = slot === FighterSlot.LEFT ? 'player-left' : 'player-right';
    const current = this.positions[fighterId];
    const proposed = message.position;
    const distance = Math.hypot(proposed.x - current.x, proposed.z - current.z);
    // 프레임 드롭은 허용하되 순간이동과 경기장 이탈은 거부한다.
    if (distance > 1 || Math.abs(proposed.x) > 9.5 || Math.abs(proposed.z) > 9.5) return;
    this.positionSequences.set(slot, message.sequence);
    this.positions[fighterId] = { x: proposed.x, y: 0.9, z: proposed.z };
    this.revision++;
    this.broadcastState();
  }

  private isPositionMessage(message: unknown): message is CombatPositionMessage {
    if (!message || typeof message !== 'object') return false;
    const candidate = message as Partial<CombatPositionMessage>;
    const position = candidate.position;
    return Number.isSafeInteger(candidate.sequence) && !!position &&
      Number.isFinite(position.x) && Number.isFinite(position.y) &&
      Number.isFinite(position.z);
  }

  private handleAttack(client: Client, message: unknown) {
    if (this.gameState !== GameState.PLAYING) return;
    const slot = this.assignments.get(client.sessionId);
    if (!slot || !this.isAttackMessage(message)) return;
    const attackerId = slot === FighterSlot.LEFT ? 'player-left' : 'player-right';
    if (message.attackerId !== attackerId) return;
    const previousSequence = this.attackSequences.get(slot) ?? -1;
    if (message.sequence <= previousSequence) return;
    this.attackSequences.set(slot, message.sequence);
    if (this.matchResult !== MatchResult.PLAYING) return;
    const fighter = this.fighters.find((candidate) => candidate.id === attackerId);
    const attack = this.attacks[attackerId];
    if (!fighter || fighter.state === 'DOWN' || !attack.tryStart()) return;
    fighter.state = attack.state;
    this.revision++;
    this.broadcastState();
  }

  private isAttackMessage(message: unknown): message is CombatAttackMessage {
    if (!message || typeof message !== 'object') return false;
    const candidate = message as Partial<CombatAttackMessage>;
    return Number.isSafeInteger(candidate.sequence) &&
      typeof candidate.attackerId === 'string';
  }

  private updateMatch(dt: number) {
    if (this.gameState === GameState.COUNTDOWN) {
      this.countdownRemaining = Math.max(0, this.countdownRemaining - dt);
      if (this.countdownRemaining === 0) {
        if (this.assignments.size !== this.maxClients) {
          this.gameState = GameState.WAITING;
        } else {
          this.gameState = GameState.PLAYING;
        }
      }
      this.revision++;
      this.broadcastState();
      return;
    }

    if (this.gameState !== GameState.PLAYING) return;

    this.updateAttacks(dt);
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining === 0) {
      this.finishMatch(evaluateTimeLimitResult(this.fighters));
    }
    this.revision++;
    this.broadcastState();
  }

  private updateAttacks(dt: number): boolean {
    let stateChanged = false;
    for (const attackerId of ['player-left', 'player-right']) {
      const fighter = this.fighters.find((candidate) => candidate.id === attackerId);
      const attack = this.attacks[attackerId];
      if (!fighter || fighter.state === 'DOWN') continue;
      const previousState = attack.state;
      attack.update(dt);
      fighter.state = attack.state;
      if (attack.state !== previousState) stateChanged = true;
      if (previousState !== 'ATTACK_ACTIVE' && attack.state === 'ATTACK_ACTIVE') {
        if (this.resolveServerAttack(attackerId, attack)) stateChanged = true;
      }
    }
    const result = evaluateTeamHealth(this.fighters).result;
    if (result !== MatchResult.PLAYING) {
      this.finishMatch(result);
      stateChanged = true;
    }
    return stateChanged;
  }

  private resolveServerAttack(attackerId: string, attack: AttackStateMachine): boolean {
    const directionX: -1 | 1 = attackerId === 'player-left' ? -1 : 1;
    let changed = false;
    for (const target of this.fighters.filter((fighter) => fighter.team === Team.AI)) {
      if (
        target.state === 'DOWN' ||
        !isBasicAttackHit(
          this.positions[attackerId],
          this.positions[target.id],
          directionX,
        ) ||
        !attack.registerHit(target.id)
      ) continue;
      const index = this.fighters.findIndex((fighter) => fighter.id === target.id);
      const result = applyHealthDamage(this.fighters[index], GAME_CONFIG.ATTACK_DAMAGE);
      if (!result.applied) continue;
      this.fighters[index] = result.fighter;
      changed = true;
    }
    return changed;
  }

  private handleDamage(message: unknown) {
    if (this.gameState !== GameState.PLAYING) return;
    if (!this.isDamageMessage(message)) return;
    if (this.matchResult !== MatchResult.PLAYING) return;

    let changed = false;
    for (const hit of message.hits) {
      const index = this.fighters.findIndex(
        (fighter) => fighter.id === hit.fighterId,
      );
      if (index < 0) continue;

      const result = applyHealthDamage(this.fighters[index], hit.damage);
      if (!result.applied) continue;
      this.fighters[index] = result.fighter;
      changed = true;
    }

    if (!changed) return;
    const result = evaluateTeamHealth(this.fighters).result;
    if (result !== MatchResult.PLAYING) this.finishMatch(result);
    this.revision++;
    this.broadcastState();
  }

  private isDamageMessage(message: unknown): message is CombatDamageMessage {
    if (!message || typeof message !== 'object') return false;
    const hits = (message as { hits?: unknown }).hits;
    return Array.isArray(hits) && hits.length > 0 && hits.length <= 4 &&
      hits.every((hit: unknown) => {
        if (!hit || typeof hit !== 'object') return false;
        const candidate = hit as Partial<CombatDamageMessage['hits'][number]>;
        return typeof candidate.fighterId === 'string' &&
          typeof candidate.damage === 'number' &&
          Number.isFinite(candidate.damage) &&
          candidate.damage > 0;
      });
  }

  private broadcastState() {
    this.broadcast(EVENTS.COMBAT_STATE, this.createStateMessage());
  }

  private createStateMessage(): CombatStateSnapshot {
    const evaluation = evaluateTeamHealth(this.fighters);
    return {
      revision: this.revision,
      gameState: this.gameState,
      countdownRemaining: this.countdownRemaining,
      timeRemaining: this.timeRemaining,
      resetRevision: this.resetRevision,
      fighters: this.fighters.map((fighter) => ({
        ...fighter,
        attackId: this.attacks[fighter.id]?.attackId ?? 0,
        position: { ...this.positions[fighter.id] },
      })),
      playerLinkState: evaluation.playerLinkState,
      enemyLinkState: evaluation.enemyLinkState,
      result: this.matchResult,
    };
  }

  private startCountdown() {
    this.gameState = GameState.COUNTDOWN;
    this.countdownRemaining = GAME_CONFIG.COUNTDOWN_DURATION;
    this.timeRemaining = GAME_CONFIG.MATCH_DURATION;
    this.matchResult = MatchResult.PLAYING;
    this.revision++;
  }

  private finishMatch(result: MatchResult) {
    if (result === MatchResult.PLAYING) return;
    this.matchResult = result;
    this.gameState = GameState.FINISHED;
    for (const fighter of this.fighters) {
      if (fighter.state === 'DOWN') continue;
      const attack = this.attacks[fighter.id];
      attack?.cancel();
      if (attack) fighter.state = attack.state;
    }
  }

  private resetMatchData() {
    this.fighters = this.createInitialFighters();
    this.positions = this.createInitialPositions();
    this.attacks = this.createAttackMachines();
    this.positionSequences.clear();
    this.attackSequences.clear();
    this.matchResult = MatchResult.PLAYING;
    this.timeRemaining = GAME_CONFIG.MATCH_DURATION;
    this.countdownRemaining = 0;
    this.resetRevision++;
    this.revision++;
  }

  private createInitialFighters(): HealthFighterState[] {
    return [
      createHealthFighter('player-left', Team.PLAYER, FighterSlot.LEFT),
      createHealthFighter('player-right', Team.PLAYER, FighterSlot.RIGHT),
      createHealthFighter('enemy-left', Team.AI, FighterSlot.LEFT),
      createHealthFighter('enemy-right', Team.AI, FighterSlot.RIGHT),
    ];
  }

  private createInitialPositions(): Record<string, Vec3> {
    return {
      'player-left': { x: -1, y: 0.9, z: 0 },
      'player-right': { x: 1, y: 0.9, z: 0 },
      'enemy-left': { x: -3, y: 0.9, z: 0 },
      'enemy-right': { x: 3, y: 0.9, z: 0 },
    };
  }

  private createAttackMachines(): Record<string, AttackStateMachine> {
    return {
      'player-left': new AttackStateMachine(),
      'player-right': new AttackStateMachine(),
    };
  }
}
