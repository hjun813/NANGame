import { Client, Room } from 'colyseus';
import {
  applyDamageBatch,
  AttackStateMachine,
  attackStateToAIState,
  canStartAIAttack,
  createRetreatDirection,
  createHealthFighter,
  evaluateTeamHealth,
  evaluateTimeLimitResult,
  GAME_CONFIG,
  isBasicAttackHit,
  isTargetInAIAttackArc,
  applyAILinkConstraint,
  createRematchReady,
  registerRematchRequest,
  stepAIRetreat,
  stepAI,
  stepAIReposition,
} from 'linked-fighters-shared';
import {
  AIState,
  EVENTS,
  FighterSlot,
  FighterState,
  GameState,
  MatchResult,
  Team,
} from 'linked-fighters-shared';
import type { AIStateSnapshot, HealthFighterState, RematchReady } from 'linked-fighters-shared';
import type {
  CombatAttackMessage,
  CombatDamageMessage,
  CombatPositionMessage,
  CombatStateSnapshot,
  Vec3,
} from 'linked-fighters-shared';

interface AIRetreatRuntime {
  direction: Vec3;
  remainingTime: number;
}

/**
 * 체력/다운/승패의 서버 권한형 최소 구현.
 * 한 메시지의 hits를 전부 적용한 뒤 결과를 평가하여 같은 tick 동시 다운을 보존한다.
 */
export class CombatRoom extends Room {
  maxClients = 2;
  private fighters = this.createInitialFighters();
  private positions = this.createInitialPositions();
  private aiStates = this.createInitialAIStates();
  private readonly assignments = new Map<string, FighterSlot>();
  private readonly positionSequences = new Map<FighterSlot, number>();
  private readonly attackSequences = new Map<FighterSlot, number>();
  private attacks = this.createAttackMachines();
  private aiRetreats = this.createInitialAIRetreats();
  private revision = 0;
  private resetRevision = 0;
  private gameState = GameState.WAITING;
  private countdownRemaining = 0;
  private timeRemaining: number = GAME_CONFIG.MATCH_DURATION;
  private matchResult = MatchResult.PLAYING;
  private rematchReady: RematchReady = createRematchReady();

  onCreate() {
    // COMBAT_DAMAGE는 그레이박스 수동 테스트 전용이다.
    // 실제 F/L 공격은 COMBAT_ATTACK에서 대상과 피해량을 서버가 결정한다.
    this.onMessage(
      EVENTS.COMBAT_DAMAGE,
      (_client, message: unknown) => this.handleDamage(message),
    );
    this.onMessage(EVENTS.COMBAT_RESET, () => undefined);
    this.onMessage(EVENTS.COMBAT_REMATCH, (client) => {
      this.handleRematchRequest(client);
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

  private handleRematchRequest(client: Client) {
    const slot = this.assignments.get(client.sessionId) ?? null;
    const request = registerRematchRequest(this.rematchReady, slot, this.gameState);
    if (!request.accepted) return;
    this.rematchReady = request.ready;
    if (request.allReady && this.assignments.size === this.maxClients) {
      this.resetMatchData();
      this.startCountdown();
    } else {
      this.revision++;
    }
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
    if (message.resetRevision !== this.resetRevision) return;
    const current = this.positions[fighterId];
    const proposed = message.position;
    const distance = Math.hypot(proposed.x - current.x, proposed.z - current.z);
    // 프레임 드롭은 허용하되 순간이동과 경기장 이탈은 거부한다.
    if (
      distance > 1 ||
      Math.abs(proposed.x) > GAME_CONFIG.ARENA_POSITION_LIMIT ||
      Math.abs(proposed.z) > GAME_CONFIG.ARENA_POSITION_LIMIT
    ) return;
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
    if (message.resetRevision !== this.resetRevision) return;
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

    const pendingDamage: CombatDamageMessage['hits'] = [];
    this.updatePlayerAttacks(dt, pendingDamage);
    this.updateAI(dt, pendingDamage);
    const evaluation = this.applyPendingDamage(pendingDamage);
    if (evaluation.result !== MatchResult.PLAYING) {
      this.finishMatch(evaluation.result);
    }
    if (this.gameState === GameState.PLAYING) {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining === 0) {
        this.finishMatch(evaluateTimeLimitResult(this.fighters));
      }
    }
    this.revision++;
    this.broadcastState();
  }

  private updatePlayerAttacks(
    dt: number,
    pendingDamage: CombatDamageMessage['hits'],
  ) {
    for (const attackerId of ['player-left', 'player-right']) {
      const fighter = this.fighters.find((candidate) => candidate.id === attackerId);
      const attack = this.attacks[attackerId];
      if (!fighter || fighter.state === 'DOWN') continue;
      attack.update(dt);
      fighter.state = attack.state;
      if (attack.state === FighterState.ATTACK_ACTIVE) {
        this.collectPlayerAttackHits(attackerId, attack, pendingDamage);
      }
    }
  }

  private updateAI(
    dt: number,
    pendingDamage: CombatDamageMessage['hits'],
  ) {
    const playerCandidates = this.fighters
      .filter((fighter) => fighter.team === Team.PLAYER)
      .map((fighter) => ({
        id: fighter.id,
        state: fighter.state,
        position: this.positions[fighter.id],
      }));
    const stepped = this.aiStates.map((ai) => {
      const fighter = this.fighters.find((candidate) => candidate.id === ai.id);
      const attack = this.attacks[ai.id];
      const retreat = this.aiRetreats[ai.id];
      if (!fighter || fighter.state === FighterState.DOWN) {
        attack.forceDown();
        retreat.remainingTime = 0;
        return { ...ai, state: AIState.IDLE, targetId: null };
      }

      if (ai.state === AIState.RETREAT && retreat.remainingTime > 0) {
        const result = stepAIRetreat(
          ai.position,
          retreat.direction,
          retreat.remainingTime,
          dt,
        );
        retreat.remainingTime = result.remainingTime;
        fighter.state = FighterState.NORMAL;
        return {
          ...ai,
          state: result.remainingTime > 0 ? AIState.RETREAT : AIState.APPROACH,
          targetId: result.remainingTime > 0 ? ai.targetId : null,
          position: result.position,
        };
      }

      const currentTarget = playerCandidates.find(
        (candidate) => candidate.id === ai.targetId,
      ) ?? null;
      if (
        attack.state !== FighterState.NORMAL &&
        (!currentTarget || currentTarget.state === FighterState.DOWN)
      ) {
        attack.cancel();
        fighter.state = FighterState.NORMAL;
      }

      if (attack.state !== FighterState.NORMAL) {
        const target = currentTarget!;
        const previousAttackState = attack.state;
        attack.update(dt);
        fighter.state = attack.state;
        if (
          previousAttackState === FighterState.ATTACK_RECOVERY &&
          (attack.state as FighterState) === FighterState.NORMAL
        ) {
          retreat.direction = createRetreatDirection(
            ai.id,
            ai.position,
            target.position,
          );
          retreat.remainingTime = GAME_CONFIG.AI_RETREAT_DURATION;
          return { ...ai, state: AIState.RETREAT, targetId: target.id };
        }
        return {
          ...ai,
          state: attackStateToAIState(attack.state) ?? AIState.APPROACH,
          targetId: target.id,
        };
      }

      const moved = stepAI(ai, playerCandidates, {
        gameState: this.gameState,
        fighterState: fighter.state,
        deltaTime: dt,
      });
      const target = playerCandidates.find(
        (candidate) => candidate.id === moved.targetId,
      ) ?? null;
      const partner = this.aiStates.find((candidate) => candidate.id !== ai.id)!;
      if (
        moved.state === AIState.ATTACK_READY &&
        canStartAIAttack(
          moved.position,
          fighter.state,
          target,
          this.gameState,
          attack.state,
        ) && isTargetInAIAttackArc(moved.position, partner.position, target!.position) &&
        attack.tryStart()
      ) {
        fighter.state = attack.state;
        return { ...moved, state: AIState.WINDUP };
      }
      if (
        moved.state === AIState.ATTACK_READY && target &&
        !isTargetInAIAttackArc(moved.position, partner.position, target.position)
      ) {
        fighter.state = FighterState.NORMAL;
        return stepAIReposition(moved, partner.position, target.position, dt);
      }
      fighter.state = FighterState.NORMAL;
      return moved;
    });
    const fighterA = this.fighters.find((fighter) => fighter.id === stepped[0].id);
    const fighterB = this.fighters.find((fighter) => fighter.id === stepped[1].id);
    const bothDown = fighterA?.state === FighterState.DOWN && fighterB?.state === FighterState.DOWN;
    if (bothDown) {
      this.aiStates = stepped;
    } else {
      const linked = applyAILinkConstraint(
        this.aiStates[0].position,
        this.aiStates[1].position,
        stepped[0].position,
        stepped[1].position,
        {
          firstDown: fighterA?.state === FighterState.DOWN,
          secondDown: fighterB?.state === FighterState.DOWN,
        },
      );
      this.aiStates = [
        { ...stepped[0], position: linked.firstPosition },
        { ...stepped[1], position: linked.secondPosition },
      ];
    }
    for (const ai of this.aiStates) {
      this.positions[ai.id] = { ...ai.position };
    }
    this.collectAIAttackHits(playerCandidates, pendingDamage);
  }

  private collectAIAttackHits(
    playerCandidates: Array<{ id: string; state: FighterState; position: Vec3 }>,
    pendingDamage: CombatDamageMessage['hits'],
  ) {
    for (const ai of this.aiStates) {
      const attack = this.attacks[ai.id];
      const target = playerCandidates.find((candidate) => candidate.id === ai.targetId);
      const partner = this.aiStates.find((candidate) => candidate.id !== ai.id);
      if (!target || target.state === FighterState.DOWN || attack.state !== FighterState.ATTACK_ACTIVE) continue;
      if (
        partner && isTargetInAIAttackArc(ai.position, partner.position, target.position) &&
        isBasicAttackHit(ai.position, target.position, {
          x: ai.position.x - partner.position.x,
          z: ai.position.z - partner.position.z,
        }) && attack.registerHit(target.id)
      ) {
        pendingDamage.push({ fighterId: target.id, damage: GAME_CONFIG.ATTACK_DAMAGE });
      }
    }
  }

  private collectPlayerAttackHits(
    attackerId: string,
    attack: AttackStateMachine,
    pendingDamage: CombatDamageMessage['hits'],
  ) {
    const directionX: -1 | 1 = attackerId === 'player-left' ? -1 : 1;
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
      pendingDamage.push({
        fighterId: target.id,
        damage: GAME_CONFIG.ATTACK_DAMAGE,
      });
    }
  }

  private handleDamage(message: unknown) {
    if (this.gameState !== GameState.PLAYING) return;
    if (!this.isDamageMessage(message)) return;
    if (this.matchResult !== MatchResult.PLAYING) return;

    const evaluation = this.applyPendingDamage(message.hits);
    if (evaluation.appliedTargetIds.length === 0) return;
    if (evaluation.result !== MatchResult.PLAYING) {
      this.finishMatch(evaluation.result);
    }
    this.revision++;
    this.broadcastState();
  }

  private applyPendingDamage(hits: CombatDamageMessage['hits']) {
    const previousStates = new Map(
      this.fighters.map((fighter) => [fighter.id, fighter.state]),
    );
    const batch = applyDamageBatch(this.fighters, hits);
    this.fighters = batch.fighters;
    for (const fighter of this.fighters) {
      if (
        previousStates.get(fighter.id) !== FighterState.DOWN &&
        fighter.state === FighterState.DOWN
      ) {
        this.attacks[fighter.id]?.forceDown();
        const ai = this.aiStates.find((candidate) => candidate.id === fighter.id);
        if (ai) {
          ai.state = AIState.IDLE;
          ai.targetId = null;
          this.aiRetreats[ai.id].remainingTime = 0;
        }
      }
    }
    return { ...batch.evaluation, appliedTargetIds: batch.appliedTargetIds };
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
      aiStates: this.aiStates.map((ai) => ({
        ...ai,
        position: { ...ai.position },
      })),
      rematchReady: { ...this.rematchReady },
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
    this.aiStates = this.aiStates.map((ai) => ({
      ...ai,
      state: AIState.IDLE,
      targetId: null,
    }));
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
    this.aiStates = this.createInitialAIStates();
    this.attacks = this.createAttackMachines();
    this.aiRetreats = this.createInitialAIRetreats();
    this.positionSequences.clear();
    this.attackSequences.clear();
    this.matchResult = MatchResult.PLAYING;
    this.timeRemaining = GAME_CONFIG.MATCH_DURATION;
    this.countdownRemaining = 0;
    this.rematchReady = createRematchReady();
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
      'player-left': { x: -0.9, y: 0.9, z: 0 },
      'player-right': { x: 0.9, y: 0.9, z: 0 },
      'enemy-left': { x: -0.9, y: 0.9, z: -3 },
      'enemy-right': { x: 0.9, y: 0.9, z: -3 },
    };
  }

  private createInitialAIStates(): AIStateSnapshot[] {
    return ['enemy-left', 'enemy-right'].map((id) => ({
      id,
      state: AIState.IDLE,
      targetId: null,
      position: { ...this.positions[id] },
    }));
  }

  private createAttackMachines(): Record<string, AttackStateMachine> {
    return {
      'player-left': new AttackStateMachine(),
      'player-right': new AttackStateMachine(),
      'enemy-left': new AttackStateMachine(),
      'enemy-right': new AttackStateMachine(),
    };
  }

  private createInitialAIRetreats(): Record<string, AIRetreatRuntime> {
    return {
      'enemy-left': {
        direction: { x: -1, y: 0, z: 0 },
        remainingTime: 0,
      },
      'enemy-right': {
        direction: { x: 1, y: 0, z: 0 },
        remainingTime: 0,
      },
    };
  }
}
