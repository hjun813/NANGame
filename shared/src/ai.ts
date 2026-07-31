import { GAME_CONFIG } from './constants';
import { AIState, FighterState, GameState } from './enums';
import type { Vec3 } from './types';

const DISTANCE_EPSILON = 1e-6;

export interface AIStateSnapshot {
  id: string;
  state: AIState;
  targetId: string | null;
  position: Vec3;
}

export interface AIRetreatStep {
  position: Vec3;
  remainingTime: number;
}

export interface AITargetCandidate {
  id: string;
  state: FighterState;
  position: Vec3;
}

export interface AIStepOptions {
  gameState: GameState;
  fighterState: FighterState;
  deltaTime: number;
  moveSpeed?: number;
  attackDistance?: number;
  arenaLimit?: number;
}

function distanceSquared(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/** 거리가 같으면 ID 오름차순으로 결정해 모든 서버 실행에서 같은 결과를 낸다. */
export function selectNearestLivingTarget(
  aiPosition: Vec3,
  candidates: readonly AITargetCandidate[],
): AITargetCandidate | null {
  const living = candidates
    .filter((candidate) => candidate.state !== FighterState.DOWN)
    .map((candidate) => ({ candidate, distance: distanceSquared(aiPosition, candidate.position) }))
    .sort((a, b) => a.distance - b.distance ||
      (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0));
  return living[0]?.candidate ?? null;
}

export function clampToArena(position: Vec3, limit: number): Vec3 {
  return {
    x: Math.max(-limit, Math.min(limit, position.x)),
    y: position.y,
    z: Math.max(-limit, Math.min(limit, position.z)),
  };
}

export function canStartAIAttack(
  aiPosition: Vec3,
  fighterState: FighterState,
  target: AITargetCandidate | null,
  gameState: GameState,
  attackState: FighterState,
  attackDistance = GAME_CONFIG.ATTACK_RANGE,
): boolean {
  if (
    gameState !== GameState.PLAYING ||
    fighterState === FighterState.DOWN ||
    attackState !== FighterState.NORMAL ||
    !target ||
    target.state === FighterState.DOWN
  ) return false;
  return Math.sqrt(distanceSquared(aiPosition, target.position)) <=
    attackDistance + DISTANCE_EPSILON;
}

export function attackStateToAIState(state: FighterState): AIState | null {
  if (state === FighterState.ATTACK_WINDUP) return AIState.WINDUP;
  if (state === FighterState.ATTACK_ACTIVE) return AIState.ACTIVE;
  if (state === FighterState.ATTACK_RECOVERY) return AIState.RECOVERY;
  return null;
}

export function getAIAttackArm(aiId: string): 'LEFT' | 'RIGHT' {
  return aiId === 'enemy-left' ? 'LEFT' : 'RIGHT';
}

/** 링크 파트너 반대쪽 반원만 해당 AI 팔의 공격 가능 영역으로 사용한다. */
export function isTargetInAIAttackArc(
  aiPosition: Vec3,
  partnerPosition: Vec3,
  targetPosition: Vec3,
  minimumDot = 0,
): boolean {
  const outwardX = aiPosition.x - partnerPosition.x;
  const outwardZ = aiPosition.z - partnerPosition.z;
  const targetX = targetPosition.x - aiPosition.x;
  const targetZ = targetPosition.z - aiPosition.z;
  const outwardLength = Math.hypot(outwardX, outwardZ);
  const targetLength = Math.hypot(targetX, targetZ);
  if (outwardLength <= DISTANCE_EPSILON || targetLength <= DISTANCE_EPSILON) return false;
  return (outwardX * targetX + outwardZ * targetZ) /
    (outwardLength * targetLength) >= minimumDot;
}

/** 공격 불가능한 반대편에서는 링크 반경 위의 공격 가능한 위치로 서서히 재배치한다. */
export function stepAIReposition(
  ai: AIStateSnapshot,
  partnerPosition: Vec3,
  targetPosition: Vec3,
  deltaTime: number,
  moveSpeed = GAME_CONFIG.AI_MOVE_SPEED,
): AIStateSnapshot {
  const radialX = targetPosition.x - partnerPosition.x;
  const radialZ = targetPosition.z - partnerPosition.z;
  const radialLength = Math.hypot(radialX, radialZ);
  const fallback = ai.id === 'enemy-left' ? -1 : 1;
  const nx = radialLength > DISTANCE_EPSILON ? radialX / radialLength : fallback;
  const nz = radialLength > DISTANCE_EPSILON ? radialZ / radialLength : 0;
  const goal = {
    x: partnerPosition.x + nx * GAME_CONFIG.AI_LINK_TARGET_DISTANCE,
    y: ai.position.y,
    z: partnerPosition.z + nz * GAME_CONFIG.AI_LINK_TARGET_DISTANCE,
  };
  const dx = goal.x - ai.position.x;
  const dz = goal.z - ai.position.z;
  const length = Math.hypot(dx, dz);
  const step = Math.min(length, moveSpeed * Math.max(0, deltaTime));
  return {
    ...ai,
    state: AIState.REPOSITION,
    position: clampToArena({
      x: ai.position.x + (length > 0 ? dx / length * step : 0),
      y: ai.position.y,
      z: ai.position.z + (length > 0 ? dz / length * step : 0),
    }, GAME_CONFIG.ARENA_POSITION_LIMIT),
  };
}

/** 마지막 공격 대상의 반대 방향. 동일 좌표는 AI ID로 결정적인 X축 방향을 선택한다. */
export function createRetreatDirection(
  aiId: string,
  aiPosition: Vec3,
  targetPosition: Vec3,
): Vec3 {
  let x = aiPosition.x - targetPosition.x;
  let z = aiPosition.z - targetPosition.z;
  const length = Math.hypot(x, z);
  if (length <= DISTANCE_EPSILON) {
    x = aiId < 'enemy-right' ? -1 : 1;
    z = 0;
    return { x, y: 0, z };
  }
  return { x: x / length, y: 0, z: z / length };
}

export function stepAIRetreat(
  position: Vec3,
  direction: Vec3,
  remainingTime: number,
  deltaTime: number,
  speed = GAME_CONFIG.AI_RETREAT_SPEED,
  arenaLimit = GAME_CONFIG.ARENA_POSITION_LIMIT,
): AIRetreatStep {
  const dt = Number.isFinite(deltaTime)
    ? Math.min(Math.max(0, deltaTime), Math.max(0, remainingTime))
    : 0;
  return {
    position: clampToArena({
      x: position.x + direction.x * speed * dt,
      y: position.y,
      z: position.z + direction.z * speed * dt,
    }, arenaLimit),
    remainingTime: Math.max(0, remainingTime - dt),
  };
}

/** 한 서버 tick의 타깃 선택과 접근 이동. 공격이나 피해는 처리하지 않는다. */
export function stepAI(
  ai: AIStateSnapshot,
  candidates: readonly AITargetCandidate[],
  options: AIStepOptions,
): AIStateSnapshot {
  if (
    options.gameState !== GameState.PLAYING ||
    options.fighterState === FighterState.DOWN
  ) {
    return { ...ai, state: AIState.IDLE, targetId: null, position: { ...ai.position } };
  }

  const target = selectNearestLivingTarget(ai.position, candidates);
  if (!target) {
    return { ...ai, state: AIState.IDLE, targetId: null, position: { ...ai.position } };
  }

  const attackDistance = options.attackDistance ?? GAME_CONFIG.ATTACK_RANGE;
  const dx = target.position.x - ai.position.x;
  const dz = target.position.z - ai.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= attackDistance + DISTANCE_EPSILON) {
    return {
      ...ai,
      state: AIState.ATTACK_READY,
      targetId: target.id,
      position: { ...ai.position },
    };
  }

  const safeDeltaTime = Number.isFinite(options.deltaTime)
    ? Math.max(0, options.deltaTime)
    : 0;
  const moveSpeed = options.moveSpeed ?? GAME_CONFIG.AI_MOVE_SPEED;
  const moveDistance = Math.min(moveSpeed * safeDeltaTime, distance - attackDistance);
  const scale = distance > 0 ? moveDistance / distance : 0;
  const nextPosition = clampToArena({
    x: ai.position.x + dx * scale,
    y: ai.position.y,
    z: ai.position.z + dz * scale,
  }, options.arenaLimit ?? GAME_CONFIG.ARENA_POSITION_LIMIT);

  return {
    ...ai,
    state: distance - moveDistance <= attackDistance + DISTANCE_EPSILON
      ? AIState.ATTACK_READY
      : AIState.APPROACH,
    targetId: target.id,
    position: nextPosition,
  };
}

export interface AISeparationOptions {
  minimumDistance?: number;
  maxStep?: number;
  arenaLimit?: number;
  movableA?: boolean;
  movableB?: boolean;
}

/** 단순 원형 분리 보정. 정확히 겹친 경우 ID 순서로 X축 방향을 결정한다. */
export function separateAIStates(
  aiA: AIStateSnapshot,
  aiB: AIStateSnapshot,
  options: AISeparationOptions = {},
): [AIStateSnapshot, AIStateSnapshot] {
  const movableA = options.movableA ?? true;
  const movableB = options.movableB ?? true;
  if (!movableA && !movableB) return [aiA, aiB];

  const minimumDistance = options.minimumDistance ?? GAME_CONFIG.AI_MIN_SEPARATION;
  const maxStep = options.maxStep ?? GAME_CONFIG.AI_SEPARATION_MAX_STEP;
  let dx = aiB.position.x - aiA.position.x;
  let dz = aiB.position.z - aiA.position.z;
  let distance = Math.hypot(dx, dz);
  if (distance >= minimumDistance) return [aiA, aiB];

  const overlap = minimumDistance - distance;
  if (distance === 0) {
    dx = aiA.id < aiB.id ? 1 : -1;
    dz = 0;
    distance = 1;
  }
  const nx = dx / distance;
  const nz = dz / distance;
  const movableCount = Number(movableA) + Number(movableB);
  const correction = Math.min(overlap / movableCount, maxStep);
  const limit = options.arenaLimit ?? GAME_CONFIG.ARENA_POSITION_LIMIT;

  const positionA = movableA
    ? clampToArena({
      x: aiA.position.x - nx * correction,
      y: aiA.position.y,
      z: aiA.position.z - nz * correction,
    }, limit)
    : aiA.position;
  const positionB = movableB
    ? clampToArena({
      x: aiB.position.x + nx * correction,
      y: aiB.position.y,
      z: aiB.position.z + nz * correction,
    }, limit)
    : aiB.position;

  return [
    { ...aiA, position: { ...positionA } },
    { ...aiB, position: { ...positionB } },
  ];
}
