import { FighterSlot, FighterState, Team } from './enums';
import type { Vec3 } from './types';

export type CharacterAnimationState = 'IDLE' | 'MOVE' | 'ATTACK' | 'DOWN';

export interface CharacterIdentity {
  team: Team;
  slot: FighterSlot;
}

export function getCharacterIdentity(fighterId: string): CharacterIdentity | null {
  const team = fighterId.startsWith('player-')
    ? Team.PLAYER
    : fighterId.startsWith('enemy-') ? Team.AI : null;
  const slot = fighterId.endsWith('-left')
    ? FighterSlot.LEFT
    : fighterId.endsWith('-right') ? FighterSlot.RIGHT : null;
  return team && slot ? { team, slot } : null;
}

export function resolveCharacterAnimationState(
  fighterState: FighterState,
  isMoving: boolean,
): CharacterAnimationState {
  if (fighterState === FighterState.DOWN) return 'DOWN';
  if (
    fighterState === FighterState.ATTACK_WINDUP ||
    fighterState === FighterState.ATTACK_ACTIVE ||
    fighterState === FighterState.ATTACK_RECOVERY
  ) return 'ATTACK';
  return isMoving ? 'MOVE' : 'IDLE';
}

export function selectAttackClipName(
  slot: FighterSlot,
  animations: { attackLeft?: string; attackRight?: string },
): string | undefined {
  return slot === FighterSlot.LEFT ? animations.attackLeft : animations.attackRight;
}

export function isCharacterMoving(
  previous: Pick<Vec3, 'x' | 'z'>,
  current: Pick<Vec3, 'x' | 'z'>,
  deltaTime: number,
  speedThreshold: number,
): boolean {
  if (deltaTime <= 0 || speedThreshold < 0) return false;
  return Math.hypot(current.x - previous.x, current.z - previous.z) / deltaTime > speedThreshold;
}

export function shouldRestartAttackAnimation(
  previousAttackId: number,
  nextAttackId: number,
  animationState: CharacterAnimationState,
): boolean {
  return animationState === 'ATTACK' && nextAttackId > previousAttackId;
}

export function getFallbackAttackAnchorOffset(
  slot: FighterSlot,
  distance: number,
): Vec3 {
  return {
    x: slot === FighterSlot.LEFT ? -Math.abs(distance) : Math.abs(distance),
    y: 0,
    z: 0,
  };
}

export function getCharacterVisualMode(
  modelUrl: string | undefined,
  loadSucceeded: boolean,
): 'MODEL' | 'FALLBACK' {
  return modelUrl?.trim() && loadSucceeded ? 'MODEL' : 'FALLBACK';
}
