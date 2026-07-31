import * as THREE from 'three';
import { GAME_CONFIG } from '@shared/constants';
import {
  FighterSlot,
  FighterState,
  LinkState,
  LinkTensionState,
  MatchResult,
  Team,
} from '@shared/enums';
import { applyHealthDamage, evaluateTeamHealth } from '@shared/health';
import type { CombatStateSnapshot } from '@shared/health';
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
  private readonly initialPosition: Vec3;
  private readonly initialColor: number;
  readonly team: Team;
  readonly slot: FighterSlot;

  constructor(
    id: string,
    color: number,
    startX: number,
    physics: PhysicsWorld,
    team: Team,
    slot: FighterSlot,
    hasAttackHitbox = false,
  ) {
    this.id = id;
    this.team = team;
    this.slot = slot;
    this.initialColor = color;
    const geo = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.position = { x: startX, y: 0.9, z: 0 };
    this.initialPosition = { ...this.position };
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

  get state(): FighterState {
    return this.attack.state;
  }

  get isDown(): boolean {
    return this.state === FighterState.DOWN;
  }

  /** 이미 다운된 파이터의 추가 피격은 무시한다. */
  takeDamage(damage: number): boolean {
    if (this.isDown || damage <= 0) return false;

    const result = applyHealthDamage({
      id: this.id,
      team: this.team,
      slot: this.slot,
      hp: this.hp,
      state: this.state,
    }, damage);
    if (!result.applied) return false;

    this.hp = result.fighter.hp;
    if (result.becameDown) {
      this.attack.forceDown();
      this.hitStunRemaining = 0;
      this.knockbackVelocity = { x: 0, y: 0, z: 0 };
      if (this.hitbox) this.hitbox.visible = false;
      (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x555555);
    }
    return true;
  }

  reset(physics: PhysicsWorld) {
    this.hp = GAME_CONFIG.FIGHTER_MAX_HP;
    this.attack.reset();
    this.hitStunRemaining = 0;
    this.knockbackVelocity = { x: 0, y: 0, z: 0 };
    this.position = { ...this.initialPosition };
    this.prevPosition = { ...this.initialPosition };
    physics.teleportCharacter(this.physicsCharacter, this.initialPosition);
    this.mesh.position.set(
      this.initialPosition.x,
      this.initialPosition.y,
      this.initialPosition.z,
    );
    (this.mesh.material as THREE.MeshStandardMaterial)
      .color.setHex(this.initialColor);
    if (this.hitbox) this.hitbox.visible = false;
  }

  syncHealth(hp: number, state: FighterState) {
    this.hp = Math.max(0, hp);
    if (state === FighterState.DOWN && !this.isDown) {
      this.attack.forceDown();
      this.hitStunRemaining = 0;
      this.knockbackVelocity = { x: 0, y: 0, z: 0 };
      if (this.hitbox) this.hitbox.visible = false;
      (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x555555);
    } else if (state !== FighterState.DOWN && this.isDown) {
      this.attack.reset();
      (this.mesh.material as THREE.MeshStandardMaterial)
        .color.setHex(this.initialColor);
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
  public enemyLinkState: LinkState = LinkState.ARM_LOCK;
  public matchResult: MatchResult = MatchResult.PLAYING;
  private serverResetRevision: number | null = null;
  private damageDispatcher:
    ((fighterId: string, damage: number) => boolean) | null = null;

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
    this.fighterA = new Fighter(
      'player-left', 0x4fc3f7, -0.9, physics, Team.PLAYER, FighterSlot.LEFT, true,
    );
    this.fighterB = new Fighter(
      'player-right', 0x81c784, 0.9, physics, Team.PLAYER, FighterSlot.RIGHT, true,
    );
    this.enemyA = new Fighter(
      'enemy-left', 0xef5350, -3, physics, Team.AI, FighterSlot.LEFT,
    );
    this.enemyB = new Fighter(
      'enemy-right', 0xff7043, 3, physics, Team.AI, FighterSlot.RIGHT,
    );
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
    const matchFinished = this.matchResult !== MatchResult.PLAYING;
    const playerDownCount = Number(this.fighterA.isDown) + Number(this.fighterB.isDown);
    const isDragging = playerDownCount === 1;
    const speed = GAME_CONFIG.FIGHTER_MOVE_SPEED *
      (isDragging ? GAME_CONFIG.DOWN_MOVE_PENALTY : 1);
    const maxDist = isDragging
      ? GAME_CONFIG.DOWN_DRAG_MAX_DIST
      : GAME_CONFIG.LINK_NORMAL_MAX_DIST;

    // 저장
    const fighters = [this.fighterA, this.fighterB, this.enemyA, this.enemyB];
    fighters.forEach((fighter) => {
      fighter.prevPosition = { ...fighter.position };
    });

    if (!matchFinished && attackA && !this.fighterA.isDown) this.fighterA.attack.tryStart();
    if (!matchFinished && attackB && !this.fighterB.isDown) this.fighterB.attack.tryStart();
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
    const stoppedInput = { x: 0, z: 0 };
    const deltaA = movementDelta(
      matchFinished || this.fighterA.isDown ? stoppedInput : inputA,
    );
    const deltaB = movementDelta(
      matchFinished || this.fighterB.isDown ? stoppedInput : inputB,
    );

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

    if (!matchFinished) {
      this.resolveAttack(this.fighterA, -1);
      this.resolveAttack(this.fighterB, 1);
      // 한 fixed tick의 모든 피해를 반영한 뒤 판정하여 동시 다운을 보존한다.
      this.updateDownAndMatchState();
    }

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
    if (attacker.isDown || attacker.attack.state !== FighterState.ATTACK_ACTIVE) return;

    const hitboxCenter = {
      x: attacker.position.x + directionX * HITBOX_OFFSET,
      y: attacker.position.y,
      z: attacker.position.z,
    };
    for (const target of [this.enemyA, this.enemyB]) {
      if (target.isDown) continue;
      const distance = vec3Distance(hitboxCenter, target.position);
      const intersects = distance <= HITBOX_RADIUS + GAME_CONFIG.FIGHTER_RADIUS;
      if (!intersects || !attacker.attack.registerHit(target.id)) continue;

      const sentToAuthority = this.damageDispatcher?.(
        target.id,
        GAME_CONFIG.ATTACK_DAMAGE,
      ) ?? false;
      if (!sentToAuthority) target.takeDamage(GAME_CONFIG.ATTACK_DAMAGE);
      if (target.hp <= GAME_CONFIG.ATTACK_DAMAGE) continue;
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
    fighter.hitbox.visible =
      !fighter.isDown &&
      this.matchResult === MatchResult.PLAYING &&
      fighter.attack.state === FighterState.ATTACK_ACTIVE;
    fighter.hitbox.position.set(
      fighter.mesh.position.x + directionX * HITBOX_OFFSET,
      fighter.mesh.position.y,
      fighter.mesh.position.z,
    );
  }

  /**
   * 그레이박스 및 인수 테스트에서 피해를 동일한 규칙으로 주입한다.
   * 실제 공격 판정도 Fighter.takeDamage를 통해 같은 경로를 사용한다.
   */
  applyDamage(
    fighter: Fighter,
    damage: number,
    deferMatchEvaluation = false,
  ): boolean {
    if (this.matchResult !== MatchResult.PLAYING) return false;
    const applied = fighter.takeDamage(damage);
    if (!deferMatchEvaluation) this.updateDownAndMatchState();
    return applied;
  }

  /** 같은 tick 피해를 모두 defer한 뒤 한 번 호출하면 동시 다운을 판정할 수 있다. */
  evaluateMatchState() {
    this.updateDownAndMatchState();
  }

  setDamageDispatcher(
    dispatcher: ((fighterId: string, damage: number) => boolean) | null,
  ) {
    this.damageDispatcher = dispatcher;
  }

  applyAuthoritativeState(snapshot: CombatStateSnapshot, ownedFighterId?: string) {
    const serverResetChanged = snapshot.resetRevision !== undefined &&
      snapshot.resetRevision !== this.serverResetRevision;
    if (serverResetChanged) {
      this.resetMatch();
      this.serverResetRevision = snapshot.resetRevision!;
    }
    const byId = new Map(snapshot.fighters.map((fighter) => [fighter.id, fighter]));
    [this.fighterA, this.fighterB, this.enemyA, this.enemyB].forEach((fighter) => {
      const authoritative = byId.get(fighter.id);
      if (authoritative) {
        fighter.syncHealth(authoritative.hp, authoritative.state);
        // 소유 캐릭터는 기존 Rapier 충돌 결과를 유지하고 원격 캐릭터만 따라간다.
        if (
          authoritative.position &&
          (serverResetChanged || fighter.id !== ownedFighterId)
        ) {
          fighter.prevPosition = { ...fighter.position };
          fighter.position = { ...authoritative.position };
          this.physics.teleportCharacter(fighter.physicsCharacter, authoritative.position);
        }
      }
    });
    this.linkState = snapshot.playerLinkState;
    this.enemyLinkState = snapshot.enemyLinkState;
    this.matchResult = snapshot.result;
    if (this.matchResult !== MatchResult.PLAYING) {
      [this.fighterA, this.fighterB, this.enemyA, this.enemyB]
        .forEach((fighter) => fighter.attack.cancel());
    }
  }

  getFighterPosition(fighterId: string): Vec3 | null {
    const fighter = [this.fighterA, this.fighterB]
      .find((candidate) => candidate.id === fighterId);
    return fighter ? { ...fighter.position } : null;
  }

  /** 그레이박스 반복 검증을 위해 경기 상태와 물리 위치를 초기 상태로 복구한다. */
  resetMatch() {
    [this.fighterA, this.fighterB, this.enemyA, this.enemyB]
      .forEach((fighter) => fighter.reset(this.physics));
    this.linkState = LinkState.ARM_LOCK;
    this.enemyLinkState = LinkState.ARM_LOCK;
    this.linkTensionState = LinkTensionState.RELAXED;
    this.linkDistance = GAME_CONFIG.LINK_NORMAL_MAX_DIST;
    this.maxObservedLinkDistance = 0;
    this.linkViolationFrames = 0;
    this.linkCorrectionFrames = 0;
    this.physicsCollisionCount = 0;
    this.matchResult = MatchResult.PLAYING;
  }

  private updateDownAndMatchState() {
    const evaluation = evaluateTeamHealth(
      [this.fighterA, this.fighterB, this.enemyA, this.enemyB].map((fighter) => ({
        id: fighter.id,
        team: fighter.team,
        slot: fighter.slot,
        hp: fighter.hp,
        state: fighter.state,
      })),
    );
    this.linkState = evaluation.playerLinkState;
    this.enemyLinkState = evaluation.enemyLinkState;
    this.matchResult = evaluation.result;

    if (this.matchResult !== MatchResult.PLAYING) {
      [this.fighterA, this.fighterB, this.enemyA, this.enemyB]
        .forEach((fighter) => fighter.attack.cancel());
    }
  }

  dispose() {
    this.physics.dispose();
  }
}
