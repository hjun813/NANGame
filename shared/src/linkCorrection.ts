import type { Vec3 } from './types';

export interface LinkCorrectionResult {
  positionA: Vec3;
  positionB: Vec3;
  wasConstrained: boolean; // 제한이 실제로 발생했는지
  distance: number;        // 보정 후 실제 거리
}

/**
 * 두 캐릭터의 예상 이동 위치를 링크 거리 제한에 맞게 보정한다.
 *
 * - Three.js / Rapier 객체에 의존하지 않는 순수 함수
 * - 클라이언트와 서버(Colyseus)에서 동일한 계산을 재사용 가능
 *
 * @param posA         캐릭터 A의 현재 위치
 * @param posB         캐릭터 B의 현재 위치
 * @param desiredDeltaA 이번 프레임 A의 희망 이동량
 * @param desiredDeltaB 이번 프레임 B의 희망 이동량
 * @param maxDistance  링크 최대 허용 거리 (m)
 */
export function correctLinkedMovement(
  posA: Vec3,
  posB: Vec3,
  desiredDeltaA: Vec3,
  desiredDeltaB: Vec3,
  maxDistance: number
): LinkCorrectionResult {
  const EPSILON = 0.001;

  // 1. 예상 이동 후 위치 계산
  const nextA: Vec3 = {
    x: posA.x + desiredDeltaA.x,
    y: posA.y + desiredDeltaA.y,
    z: posA.z + desiredDeltaA.z,
  };
  const nextB: Vec3 = {
    x: posB.x + desiredDeltaB.x,
    y: posB.y + desiredDeltaB.y,
    z: posB.z + desiredDeltaB.z,
  };

  // 2. 예상 거리 계산
  const dx = nextB.x - nextA.x;
  const dy = nextB.y - nextA.y;
  const dz = nextB.z - nextA.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // 3. 최대 거리 이내면 보정 없이 반환
  if (distance <= maxDistance + EPSILON) {
    return { positionA: nextA, positionB: nextB, wasConstrained: false, distance };
  }

  // 4. 초과 시 중점 기준으로 각자 maxDistance/2 씩 당겨옴
  const midX = (nextA.x + nextB.x) / 2;
  const midY = (nextA.y + nextB.y) / 2;
  const midZ = (nextA.z + nextB.z) / 2;

  const halfMax = maxDistance / 2;
  const invDist = 1 / distance;

  const correctedA: Vec3 = {
    x: midX - (dx * invDist * halfMax),
    y: midY - (dy * invDist * halfMax),
    z: midZ - (dz * invDist * halfMax),
  };
  const correctedB: Vec3 = {
    x: midX + (dx * invDist * halfMax),
    y: midY + (dy * invDist * halfMax),
    z: midZ + (dz * invDist * halfMax),
  };

  return {
    positionA: correctedA,
    positionB: correctedB,
    wasConstrained: true,
    distance: maxDistance,
  };
}

/** 두 Vec3 사이 거리 */
export function vec3Distance(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** 입력 두 벡터의 방향 유사도 (-1 ~ 1, 1에 가까울수록 같은 방향) */
export function inputSimilarity(a: Vec3, b: Vec3): number {
  const lenA = Math.sqrt(a.x * a.x + a.z * a.z);
  const lenB = Math.sqrt(b.x * b.x + b.z * b.z);
  if (lenA < 0.001 || lenB < 0.001) return 0;
  return (a.x * b.x + a.z * b.z) / (lenA * lenB);
}
