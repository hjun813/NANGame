import { GAME_CONFIG } from './constants';
import { FighterState } from './enums';
import type { Vec3 } from './types';

const HITBOX_RADIUS = 0.4;

/** 서버와 클라이언트가 공유하는 기본 공격 구체 적중 판정. */
export function isBasicAttackHit(
  attackerPosition: Vec3,
  targetPosition: Vec3,
  direction: -1 | 1 | Pick<Vec3, 'x' | 'z'>,
): boolean {
  const hitboxOffset = GAME_CONFIG.ATTACK_RANGE - HITBOX_RADIUS;
  const rawX = typeof direction === 'number' ? direction : direction.x;
  const rawZ = typeof direction === 'number' ? 0 : direction.z;
  const length = Math.hypot(rawX, rawZ);
  const directionX = length > 0 ? rawX / length : 1;
  const directionZ = length > 0 ? rawZ / length : 0;
  const dx = targetPosition.x -
    (attackerPosition.x + directionX * hitboxOffset);
  const dz = targetPosition.z -
    (attackerPosition.z + directionZ * hitboxOffset);
  return Math.hypot(dx, dz) <= HITBOX_RADIUS + GAME_CONFIG.FIGHTER_RADIUS;
}

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

  /** 체력 0 전환 시 진행 중인 공격을 즉시 취소한다. */
  forceDown() {
    this.state = FighterState.DOWN;
    this.remaining = 0;
    this.hitTargets.clear();
  }

  /** 경기 종료처럼 외부 규칙이 전투를 중단할 때 정상 대기 상태로 되돌린다. */
  cancel() {
    if (this.state === FighterState.DOWN) return;
    this.state = FighterState.NORMAL;
    this.remaining = 0;
    this.hitTargets.clear();
  }

  /** 재경기/그레이박스 초기화 시 DOWN을 포함한 모든 상태를 초기화한다. */
  reset() {
    this.state = FighterState.NORMAL;
    this.attackId = 0;
    this.remaining = 0;
    this.hitTargets.clear();
  }

  /** 권한 서버의 상태를 클라이언트 표시용 머신에 반영한다. */
  syncState(state: FighterState, attackId = this.attackId) {
    if (state === FighterState.DOWN) {
      this.forceDown();
      return;
    }
    this.state = state;
    this.attackId = Math.max(this.attackId, attackId);
    this.remaining = state === FighterState.ATTACK_WINDUP
      ? GAME_CONFIG.ATTACK_WINDUP
      : state === FighterState.ATTACK_ACTIVE
        ? GAME_CONFIG.ATTACK_ACTIVE
        : state === FighterState.ATTACK_RECOVERY
          ? GAME_CONFIG.ATTACK_RECOVERY
          : 0;
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
