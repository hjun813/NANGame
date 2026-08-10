import { clampToArena } from './ai';
import { GAME_CONFIG } from './constants';
import type { Vec3 } from './types';

export interface AILinkConstraintOptions {
  firstDown?: boolean; secondDown?: boolean;
  minDistance?: number; maxDistance?: number;
  maxCorrection?: number; downDragMaxCorrection?: number; arenaLimit?: number;
}

const EPSILON = 1e-6;
const distance = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.z - a.z);
function axis(a: Vec3, b: Vec3) {
  const length = distance(a, b);
  return length <= EPSILON ? { x: 1, z: 0, length: 0 } : {
    x: (b.x - a.x) / length, z: (b.z - a.z) / length, length,
  };
}

/** 독립적으로 계산한 두 AI의 desired position에 거리 제약만 적용한다. */
export function applyAILinkConstraint(
  firstCurrent: Vec3, secondCurrent: Vec3,
  firstDesired: Vec3, secondDesired: Vec3,
  options: AILinkConstraintOptions = {},
) {
  const targetDistance = GAME_CONFIG.AI_LINK_TARGET_DISTANCE;
  const tolerance = GAME_CONFIG.AI_LINK_DISTANCE_TOLERANCE;
  const min = options.minDistance ?? targetDistance - tolerance;
  const max = options.maxDistance ?? targetDistance + tolerance;
  const limit = options.arenaLimit ?? GAME_CONFIG.ARENA_POSITION_LIMIT;
  let first = clampToArena(firstDesired, limit);
  let second = clampToArena(secondDesired, limit);
  let link = axis(first, second);
  let wasConstrained = false;

  if (link.length < min) {
    const missing = min - link.length;
    const correctionCap = options.maxCorrection ?? GAME_CONFIG.AI_LINK_MAX_CORRECTION_PER_TICK;
    const firstDown = options.firstDown ?? false;
    const secondDown = options.secondDown ?? false;
    const firstStep = firstDown && !secondDown ? 0 : Math.min(secondDown && !firstDown ? missing : missing / 2, correctionCap);
    const secondStep = secondDown && !firstDown ? 0 : Math.min(firstDown && !secondDown ? missing : missing / 2, correctionCap);
    first = clampToArena({ ...first, x: first.x - link.x * firstStep, z: first.z - link.z * firstStep }, limit);
    second = clampToArena({ ...second, x: second.x + link.x * secondStep, z: second.z + link.z * secondStep }, limit);
    link = axis(first, second);
    wasConstrained = true;
  }

  if (link.length > max) {
    const excess = link.length - max;
    const firstDown = options.firstDown ?? false;
    const secondDown = options.secondDown ?? false;
    if (firstDown !== secondDown) {
      const drag = Math.min(excess, options.downDragMaxCorrection ?? GAME_CONFIG.AI_DOWN_DRAG_MAX_CORRECTION_PER_TICK);
      if (firstDown) first = { ...first, x: first.x + link.x * drag, z: first.z + link.z * drag };
      else second = { ...second, x: second.x - link.x * drag, z: second.z - link.z * drag };
      const remainder = Math.min(
        excess - drag,
        options.maxCorrection ?? GAME_CONFIG.AI_LINK_MAX_CORRECTION_PER_TICK,
      );
      if (firstDown) second = { ...second, x: second.x - link.x * remainder, z: second.z - link.z * remainder };
      else first = { ...first, x: first.x + link.x * remainder, z: first.z + link.z * remainder };
    } else {
      let firstWeight = distance(firstCurrent, first) > EPSILON ? 1 : 0;
      let secondWeight = distance(secondCurrent, second) > EPSILON ? 1 : 0;
      if (!firstWeight && !secondWeight) { firstWeight = 1; secondWeight = 1; }
      const total = firstWeight + secondWeight;
      const capped = Math.min(excess, options.maxCorrection ?? GAME_CONFIG.AI_LINK_MAX_CORRECTION_PER_TICK);
      first = { ...first, x: first.x + link.x * capped * firstWeight / total, z: first.z + link.z * capped * firstWeight / total };
      second = { ...second, x: second.x - link.x * capped * secondWeight / total, z: second.z - link.z * capped * secondWeight / total };
    }
    first = clampToArena(first, limit);
    second = clampToArena(second, limit);
    wasConstrained = true;
  }
  return { firstPosition: first, secondPosition: second, distance: distance(first, second), wasConstrained };
}
