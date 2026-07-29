import * as THREE from 'three';
import { GAME_CONFIG } from '@shared/constants';
import { LinkState, LinkTensionState } from '@shared/enums';
import { correctLinkedMovement, vec3Distance } from '@shared/linkCorrection';
import type { Vec3 } from '@shared/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { PhysicsCharacter } from '../physics/PhysicsWorld';

const ARENA_SIZE = 10; // 경기장 반폭 (m)

/**
 * 캡슐 형태 파이터 (Three.js BoxGeometry 임시 표현)
 * Sprint 0 — 그레이박스
 */
class Fighter {
  mesh: THREE.Mesh;
  position: Vec3;
  prevPosition: Vec3; // 보간용 이전 위치
  physicsCharacter: PhysicsCharacter;

  constructor(color: number, startX: number, physics: PhysicsWorld) {
    const geo = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.position = { x: startX, y: 0.9, z: 0 };
    this.prevPosition = { ...this.position };
    this.physicsCharacter = physics.createCharacter(this.position);
    this.mesh.position.set(startX, 0.9, 0);
  }

  /** 렌더 프레임 보간 (alpha: 0~1) */
  interpolate(alpha: number) {
    this.mesh.position.set(
      THREE.MathUtils.lerp(this.prevPosition.x, this.position.x, alpha),
      THREE.MathUtils.lerp(this.prevPosition.y, this.position.y, alpha),
      THREE.MathUtils.lerp(this.prevPosition.z, this.position.z, alpha),
    );
  }
}

/**
 * 경기장 + 파이터 4개 + 링크 시각화
 * Sprint 0 그레이박스 엔티티
 */
export class Arena {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  fighterA: Fighter; // 플레이어 팀 — 왼팔 (WASD)
  fighterB: Fighter; // 플레이어 팀 — 오른팔 (방향키)
  enemyA: Fighter;   // AI 팀 자리 표시
  enemyB: Fighter;   // AI 팀 자리 표시

  private linkLine: THREE.Line;
  public linkState: LinkState = LinkState.ARM_LOCK;
  public linkTensionState: LinkTensionState = LinkTensionState.RELAXED;
  public linkDistance = 0;
  public physicsCollisionCount = 0;

  private constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;

    // ── 바닥 ──────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE * 2, ARENA_SIZE * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d2d44 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── 경계 그리드 ────────────────────────
    const grid = new THREE.GridHelper(ARENA_SIZE * 2, 20, 0x444466, 0x333355);
    scene.add(grid);

    // ── 벽 (4면) ──────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a5c, transparent: true, opacity: 0.5 });
    [[0, 0.5, -ARENA_SIZE], [0, 0.5, ARENA_SIZE], [-ARENA_SIZE, 0.5, 0], [ARENA_SIZE, 0.5, 0]].forEach(([x, y, z], i) => {
      const isNS = i < 2;
      const geo = new THREE.BoxGeometry(isNS ? ARENA_SIZE * 2 : 0.3, 1, isNS ? 0.3 : ARENA_SIZE * 2);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.set(x, y, z);
      scene.add(wall);
    });

    // ── 파이터 ────────────────────────────
    this.fighterA = new Fighter(0x4fc3f7, -0.9, physics); // 파란 — 플레이어A
    this.fighterB = new Fighter(0x81c784, 0.9, physics);  // 초록 — 플레이어B
    this.enemyA = new Fighter(0xef5350, -3, physics);     // 빨간 — 적A
    this.enemyB = new Fighter(0xff7043, 3, physics);      // 주황 — 적B
    [this.fighterA, this.fighterB, this.enemyA, this.enemyB].forEach(f => scene.add(f.mesh));

    // ── 링크 시각화 선 ───────────────────
    const linkGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    const linkMat = new THREE.LineBasicMaterial({ color: 0xffd54f, linewidth: 2 });
    this.linkLine = new THREE.Line(linkGeo, linkMat);
    scene.add(this.linkLine);
  }

  static async create(scene: THREE.Scene): Promise<Arena> {
    const physics = await PhysicsWorld.create();
    return new Arena(scene, physics);
  }

  /**
   * 고정 타임스텝 업데이트
   * @param inputA  플레이어A 입력 {x, z}
   * @param inputB  플레이어B 입력 {x, z}
   * @param dt      고정 dt (1/60)
   */
  fixedUpdate(inputA: { x: number; z: number }, inputB: { x: number; z: number }, dt: number) {
    const speed = GAME_CONFIG.FIGHTER_MOVE_SPEED;
    const maxDist = GAME_CONFIG.LINK_NORMAL_MAX_DIST;

    // 저장
    this.fighterA.prevPosition = { ...this.fighterA.position };
    this.fighterB.prevPosition = { ...this.fighterB.position };

    const movementDelta = (input: { x: number; z: number }): Vec3 => {
      const length = Math.hypot(input.x, input.z);
      const scale = length > 1 ? 1 / length : 1;
      return {
        x: input.x * scale * speed * dt,
        y: 0,
        z: input.z * scale * speed * dt,
      };
    };
    const deltaA = movementDelta(inputA);
    const deltaB = movementDelta(inputB);

    // 링크 보정 (순수 함수)
    const result = correctLinkedMovement(
      this.fighterA.position,
      this.fighterB.position,
      deltaA,
      deltaB,
      maxDist
    );

    // Rapier character controller가 벽/바닥/다른 캡슐과 충돌 가능한 이동량을 계산한다.
    this.physics.beginStep();
    const collisionsA = this.physics.moveCharacter(
      this.fighterA.physicsCharacter,
      result.positionA,
    );
    const collisionsB = this.physics.moveCharacter(
      this.fighterB.physicsCharacter,
      result.positionB,
    );
    this.physics.lastCollisionCount = collisionsA + collisionsB;
    this.physics.step(dt);
    this.physicsCollisionCount = this.physics.lastCollisionCount;
    this.fighterA.position = this.physics.readPosition(this.fighterA.physicsCharacter);
    this.fighterB.position = this.physics.readPosition(this.fighterB.physicsCharacter);

    // 링크 상태와 별개로 거리 기반 장력 상태 판정
    this.linkDistance = vec3Distance(this.fighterA.position, this.fighterB.position);
    const distanceRatio = this.linkDistance / maxDist;
    if (result.wasConstrained) {
      this.linkTensionState = LinkTensionState.CORRECTING;
    } else if (distanceRatio >= 0.9) {
      this.linkTensionState = LinkTensionState.LIMIT;
    } else if (distanceRatio >= 0.7) {
      this.linkTensionState = LinkTensionState.TENSION;
    } else {
      this.linkTensionState = LinkTensionState.RELAXED;
    }

    // 링크 선 색상 갱신
    const mat = this.linkLine.material as THREE.LineBasicMaterial;
    const isUnderTension = this.linkTensionState !== LinkTensionState.RELAXED;
    mat.color.setHex(isUnderTension ? 0xff5252 : 0xffd54f);
  }

  /** 렌더 프레임마다 링크 선 + 보간 적용 */
  render(alpha: number) {
    this.fighterA.interpolate(alpha);
    this.fighterB.interpolate(alpha);

    // 링크 선 업데이트
    const pts = [
      new THREE.Vector3(this.fighterA.mesh.position.x, this.fighterA.mesh.position.y, this.fighterA.mesh.position.z),
      new THREE.Vector3(this.fighterB.mesh.position.x, this.fighterB.mesh.position.y, this.fighterB.mesh.position.z),
    ];
    this.linkLine.geometry.setFromPoints(pts);
  }

  dispose() {
    this.physics.dispose();
  }
}
