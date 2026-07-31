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
  CombatStateSnapshot,
} from 'linked-fighters-shared';

/**
 * 체력/다운/승패의 서버 권한형 최소 구현.
 * 한 메시지의 hits를 전부 적용한 뒤 결과를 평가하여 같은 tick 동시 다운을 보존한다.
 */
export class CombatRoom extends Room {
  maxClients = 2;
  private fighters = this.createInitialFighters();
  private revision = 0;

  onCreate() {
    this.onMessage(
      EVENTS.COMBAT_DAMAGE,
      (_client, message: unknown) => this.handleDamage(message),
    );
    this.onMessage(EVENTS.COMBAT_RESET, () => {
      this.fighters = this.createInitialFighters();
      this.revision++;
      this.broadcastState();
    });
    this.onMessage(EVENTS.COMBAT_REQUEST_STATE, (client) => {
      client.send(EVENTS.COMBAT_STATE, this.createStateMessage());
    });
  }

  onJoin(client: Client) {
    client.send(EVENTS.COMBAT_STATE, this.createStateMessage());
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
      fighters: this.fighters.map((fighter) => ({ ...fighter })),
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
}
