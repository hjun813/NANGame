import { GAME_CONFIG } from './constants';
import { FighterState } from './enums';

/**
 * 클라이언트와 향후 권한형 서버에서 재사용할 기본 공격 상태 머신.
 * 렌더링과 물리 판정은 소유하지 않는다.
 */
export class AttackStateMachine {
  state = FighterState.NORMAL;
  attackId = 0;
  private remaining = 0;
  private readonly hitTargets = new Set<string>();

  tryStart(): boolean {
    if (this.state !== FighterState.NORMAL) return false;

    this.state = FighterState.ATTACK_WINDUP;
    this.remaining = GAME_CONFIG.ATTACK_WINDUP;
    this.attackId++;
    this.hitTargets.clear();
    return true;
  }

  update(dt: number) {
    if (
      this.state !== FighterState.ATTACK_WINDUP &&
      this.state !== FighterState.ATTACK_ACTIVE &&
      this.state !== FighterState.ATTACK_RECOVERY
    ) {
      return;
    }

    this.remaining -= dt;
    while (this.remaining <= 0 && this.state !== FighterState.NORMAL) {
      const overflow = -this.remaining;
      if (this.state === FighterState.ATTACK_WINDUP) {
        this.state = FighterState.ATTACK_ACTIVE;
        this.remaining = GAME_CONFIG.ATTACK_ACTIVE - overflow;
      } else if (this.state === FighterState.ATTACK_ACTIVE) {
        this.state = FighterState.ATTACK_RECOVERY;
        this.remaining = GAME_CONFIG.ATTACK_RECOVERY - overflow;
      } else {
        this.state = FighterState.NORMAL;
        this.remaining = 0;
      }
    }
  }

  registerHit(targetId: string): boolean {
    if (this.state !== FighterState.ATTACK_ACTIVE || this.hitTargets.has(targetId)) {
      return false;
    }
    this.hitTargets.add(targetId);
    return true;
  }
}
