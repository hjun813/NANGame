import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONFIG } from '@shared/constants';
import type { Vec3 } from '@shared/types';

const ARENA_HALF_SIZE = 10;
const WALL_HALF_THICKNESS = 0.15;
const WALL_HALF_HEIGHT = 0.5;
const FIGHTER_CAPSULE_HALF_HEIGHT = 0.5;

export interface PhysicsCharacter {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

/**
 * TV-PHY-001 검증용 최소 Rapier 월드.
 * 게임 규칙은 소유하지 않고 충돌 가능한 이동량만 계산한다.
 */
export class PhysicsWorld {
  private readonly world: RAPIER.World;
  private readonly controller: RAPIER.KinematicCharacterController;
  public lastCollisionCount = 0;

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.controller = this.world.createCharacterController(0.01);
    this.controller.setSlideEnabled(true);
    this.createArenaColliders();
  }

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    return new PhysicsWorld();
  }

  private createArenaColliders() {
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARENA_HALF_SIZE, 0.1, ARENA_HALF_SIZE)
        .setTranslation(0, -0.1, 0),
    );

    const wallLength = ARENA_HALF_SIZE;
    const wallCenter = ARENA_HALF_SIZE;
    const walls = [
      RAPIER.ColliderDesc.cuboid(wallLength, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS)
        .setTranslation(0, WALL_HALF_HEIGHT, -wallCenter),
      RAPIER.ColliderDesc.cuboid(wallLength, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS)
        .setTranslation(0, WALL_HALF_HEIGHT, wallCenter),
      RAPIER.ColliderDesc.cuboid(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, wallLength)
        .setTranslation(-wallCenter, WALL_HALF_HEIGHT, 0),
      RAPIER.ColliderDesc.cuboid(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, wallLength)
        .setTranslation(wallCenter, WALL_HALF_HEIGHT, 0),
    ];
    walls.forEach((wall) => this.world.createCollider(wall));
  }

  createCharacter(position: Vec3): PhysicsCharacter {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        position.y,
        position.z,
      ),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(
        FIGHTER_CAPSULE_HALF_HEIGHT,
        GAME_CONFIG.FIGHTER_RADIUS,
      ),
      body,
    );
    return { body, collider };
  }

  beginStep() {
    this.lastCollisionCount = 0;
  }

  moveCharacter(character: PhysicsCharacter, target: Vec3): number {
    const current = character.body.translation();
    this.controller.computeColliderMovement(character.collider, {
      x: target.x - current.x,
      y: target.y - current.y,
      z: target.z - current.z,
    });
    const movement = this.controller.computedMovement();
    const collisions = this.controller.numComputedCollisions();
    character.body.setNextKinematicTranslation({
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    });
    return collisions;
  }

  step(dt: number) {
    this.world.timestep = dt;
    this.world.step();
  }

  readPosition(character: PhysicsCharacter): Vec3 {
    const position = character.body.translation();
    return { x: position.x, y: position.y, z: position.z };
  }

  dispose() {
    this.controller.free();
    this.world.free();
  }
}
