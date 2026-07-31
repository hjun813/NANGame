import { Client, Room } from 'colyseus';
import {
  applyHealthDamage,
  createHealthFighter,
  evaluateTeamHealth,
} from 'linked-fighters-shared';
import {
  EVENTS,
  FighterSlot,
  MatchResult,
  Team,
} from 'linked-fighters-shared';
import type { HealthFighterState } from 'linked-fighters-shared';
import type {
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
  private revision = 0;
  private resetRevision = 0;

  onCreate() {
    this.onMessage(
      EVENTS.COMBAT_DAMAGE,
      (_client, message: unknown) => this.handleDamage(message),
    );
    this.onMessage(EVENTS.COMBAT_RESET, () => {
      this.fighters = this.createInitialFighters();
      this.positions = this.createInitialPositions();
      this.resetRevision++;
      this.revision++;
      this.broadcastState();
    });
    this.onMessage(EVENTS.COMBAT_POSITION, (client, message: unknown) => {
      this.handlePosition(client, message);
    });
    this.onMessage(EVENTS.COMBAT_REQUEST_STATE, (client) => {
      this.sendAssignment(client);
      client.send(EVENTS.COMBAT_STATE, this.createStateMessage());
    });
  }

  onJoin(client: Client) {
    const usedSlots = new Set(this.assignments.values());
    const slot = usedSlots.has(FighterSlot.LEFT)
      ? FighterSlot.RIGHT
      : FighterSlot.LEFT;
    this.assignments.set(client.sessionId, slot);
    this.sendAssignment(client);
    client.send(EVENTS.COMBAT_STATE, this.createStateMessage());
  }

  onLeave(client: Client) {
    const slot = this.assignments.get(client.sessionId);
    if (slot) this.positionSequences.delete(slot);
    this.assignments.delete(client.sessionId);
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

  private handleDamage(message: unknown) {
    if (!this.isDamageMessage(message)) return;
    if (evaluateTeamHealth(this.fighters).result !== MatchResult.PLAYING) return;

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
      resetRevision: this.resetRevision,
      fighters: this.fighters.map((fighter) => ({
        ...fighter,
        position: { ...this.positions[fighter.id] },
      })),
      playerLinkState: evaluation.playerLinkState,
      enemyLinkState: evaluation.enemyLinkState,
      result: evaluation.result,
    };
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
}
