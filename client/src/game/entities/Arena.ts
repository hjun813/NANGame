import * as THREE from 'three';
import { GAME_CONFIG } from '@shared/constants';
import { FighterState, LinkState, LinkTensionState } from '@shared/enums';
import { correctLinkedMovement, vec3Distance } from '@shared/linkCorrection';
import { AttackStateMachine } from '@shared/combat';
import type { Vec3 } from '@shared/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { PhysicsCharacter } from '../physics/PhysicsWorld';

const ARENA_SIZE = 10; // 경기장 반폭 (m)
const HITBOX_RADIUS = 0.4;
const HITBOX_OFFSET = GAME_CONFIG.ATTACK_RANGE - HITBOX_RADIUS;

/**
 * 캡슐 형태 파이터 (Three.js BoxGeometry 임시 표현)
 * Sprint 0 — 그레이박스
 */
class Fighter {
  id: string;
  mesh: THREE.Mesh;
  hitbox: THREE.Mesh | null;
  position: Vec3;
  prevPosition: Vec3; // 보간용 이전 위치
  physicsCharacter: PhysicsCharacter;
  attack = new AttackStateMachine();
  hp: number = GAME_CONFIG.FIGHTER_MAX_HP;
  knockbackVelocity: Vec3 = { x: 0, y: 0, z: 0 };
  hitStunRemaining = 0;

  constructor(
    id: string,
    color: number,
    startX: number,
    physics: PhysicsWorld,
    hasAttackHitbox = false,
  ) {
    this.id = id;
    const geo = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.position = { x: startX, y: 0.9, z: 0 };
    this.prevPosition = { ...this.position };
    this.physicsCharacter = physics.createCharacter(this.position);
    this.mesh.position.set(startX, 0.9, 0);

    if (hasAttackHitbox) {
      const hitboxMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.45,
        wireframe: true,
      });
      this.hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(HITBOX_RADIUS, 12, 8),
        hitboxMaterial,
      );
      this.hitbox.visible = false;
    } else {
      this.hitbox = null;
    }
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
  public maxObservedLinkDistance = 0;
  public linkViolationFrames = 0;
  public linkCorrectionFrames = 0;
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
    this.fighterA = new Fighter('player-left', 0x4fc3f7, -0.9, physics, true);
    this.fighterB = new Fighter('player-right', 0x81c784, 0.9, physics, true);
    this.enemyA = new Fighter('enemy-left', 0xef5350, -3, physics);
    this.enemyB = new Fighter('enemy-right', 0xff7043, 3, physics);
    [this.fighterA, this.fighterB, this.enemyA, this.enemyB].forEach(f => scene.add(f.mesh));
    scene.add(this.fighterA.hitbox!, this.fighterB.hitbox!);

    // ── 링크 시각화 선 ───────────────────
    const linkGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    const linkMat = new THREE.LineBasicMaterial({ color: 0xffd54f, linewidth: 2 });
    this.linkLine = new THREE.Line(linkGeo, linkMat);
    // 매 프레임 이동하는 선의 오래된 bounding sphere로 인한 오검출을 방지한다.
    this.linkLine.frustumCulled = false;
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
  fixedUpdate(
    inputA: { x: number; z: number },
    inputB: { x: number; z: number },
    attackA: boolean,
    attackB: boolean,
    dt: number,
  ) {
    const speed = GAME_CONFIG.FIGHTER_MOVE_SPEED;
    const maxDist = GAME_CONFIG.LINK_NORMAL_MAX_DIST;

    // 저장
    const fighters = [this.fighterA, this.fighterB, this.enemyA, this.enemyB];
    fighters.forEach((fighter) => {
      fighter.prevPosition = { ...fighter.position };
    });

    if (attackA) this.fighterA.attack.tryStart();
    if (attackB) this.fighterB.attack.tryStart();
    this.fighterA.attack.update(dt);
    this.fighterB.attack.update(dt);

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
    if (result.wasConstrained) this.linkCorrectionFrames++;

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
    const moveKnockedFighter = (fighter: Fighter) => {
      if (fighter.hitStunRemaining <= 0) return 0;

      fighter.hitStunRemaining = Math.max(0, fighter.hitStunRemaining - dt);
      const target = {
        x: fighter.position.x + fighter.knockbackVelocity.x * dt,
        y: fighter.position.y,
        z: fighter.position.z + fighter.knockbackVelocity.z * dt,
      };
      return this.physics.moveCharacter(fighter.physicsCharacter, target);
    };
    const enemyCollisions =
      moveKnockedFighter(this.enemyA) + moveKnockedFighter(this.enemyB);
    this.physics.lastCollisionCount =
      collisionsA + collisionsB + enemyCollisions;
    this.physics.step(dt);
    this.physicsCollisionCount = this.physics.lastCollisionCount;
    this.fighterA.position = this.physics.readPosition(this.fighterA.physicsCharacter);
    this.fighterB.position = this.physics.readPosition(this.fighterB.physicsCharacter);
    this.enemyA.position = this.physics.readPosition(this.enemyA.physicsCharacter);
    this.enemyB.position = this.physics.readPosition(this.enemyB.physicsCharacter);

    this.resolveAttack(this.fighterA, -1);
    this.resolveAttack(this.fighterB, 1);

    // 링크 상태와 별개로 거리 기반 장력 상태 판정
    this.linkDistance = vec3Distance(this.fighterA.position, this.fighterB.position);
    this.maxObservedLinkDistance = Math.max(
      this.maxObservedLinkDistance,
      this.linkDistance,
    );
    if (this.linkDistance > maxDist + 0.001) {
      this.linkViolationFrames++;
    }
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
    this.enemyA.interpolate(alpha);
    this.enemyB.interpolate(alpha);
    this.updateHitbox(this.fighterA, -1);
    this.updateHitbox(this.fighterB, 1);

    // 링크 선 업데이트
    const positions = this.linkLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    positions.setXYZ(
      0,
      this.fighterA.mesh.position.x,
      this.fighterA.mesh.position.y,
      this.fighterA.mesh.position.z,
    );
    positions.setXYZ(
      1,
      this.fighterB.mesh.position.x,
      this.fighterB.mesh.position.y,
      this.fighterB.mesh.position.z,
    );
    positions.needsUpdate = true;
  }

  private resolveAttack(attacker: Fighter, directionX: -1 | 1) {
    if (attacker.attack.state !== FighterState.ATTACK_ACTIVE) return;

    const hitboxCenter = {
      x: attacker.position.x + directionX * HITBOX_OFFSET,
      y: attacker.position.y,
      z: attacker.position.z,
    };
    for (const target of [this.enemyA, this.enemyB]) {
      const distance = vec3Distance(hitboxCenter, target.position);
      const intersects = distance <= HITBOX_RADIUS + GAME_CONFIG.FIGHTER_RADIUS;
      if (!intersects || !attacker.attack.registerHit(target.id)) continue;

      target.hp = Math.max(0, target.hp - GAME_CONFIG.ATTACK_DAMAGE);
      target.knockbackVelocity = {
        x: directionX * GAME_CONFIG.KNOCKBACK_FORCE,
        y: 0,
        z: 0,
      };
      target.hitStunRemaining = GAME_CONFIG.STUN_DURATION;
    }
  }

  private updateHitbox(fighter: Fighter, directionX: -1 | 1) {
    if (!fighter.hitbox) return;
    fighter.hitbox.visible = fighter.attack.state === FighterState.ATTACK_ACTIVE;
    fighter.hitbox.position.set(
      fighter.mesh.position.x + directionX * HITBOX_OFFSET,
      fighter.mesh.position.y,
      fighter.mesh.position.z,
    );
  }

  dispose() {
    this.physics.dispose();
  }
}
