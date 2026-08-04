import * as THREE from 'three';
import { FighterSlot, FighterState, Team } from '@shared/enums';
import { getFallbackAttackAnchorOffset, isCharacterMoving } from '@shared/character';
import type { Vec3 } from '@shared/types';
import { CharacterAnimationController } from './CharacterAnimationController';
import { getCharacterAssetConfig } from './characterConfig';
import type { CharacterAssetConfig } from './characterConfig';

export interface CharacterViewOptions {
  fighterId: string;
  team: Team;
  slot: FighterSlot;
  color: number;
}

export class CharacterView {
  readonly root = new THREE.Group();
  private readonly visualRoot = new THREE.Group();
  private readonly fallback: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  private readonly fallbackColor: THREE.Color;
  private readonly fallbackAttackAnchor = new THREE.Group();
  private readonly fallbackLinkAnchor = new THREE.Group();
  private readonly config: CharacterAssetConfig;
  private readonly animation: CharacterAnimationController;
  private readonly ownedModelMaterials = new Set<THREE.Material>();
  private model: THREE.Group | null = null;
  private attackBone: THREE.Object3D | null = null;
  private linkBone: THREE.Object3D | null = null;
  private previousPosition: Vec3 | null = null;
  private facingY = 0;
  private disposed = false;

  constructor(private readonly options: CharacterViewOptions) {
    this.root.name = `fighter-root:${options.fighterId}`;
    this.config = getCharacterAssetConfig(options.fighterId);
    this.animation = new CharacterAnimationController(options.slot, this.config);
    this.fallbackColor = new THREE.Color(options.color);
    this.fallback = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 1, 4, 8),
      new THREE.MeshStandardMaterial({ color: options.color }),
    );
    this.fallback.castShadow = true;
    this.fallback.receiveShadow = true;
    this.visualRoot.add(this.fallback);
    this.root.add(this.visualRoot);

    const attackOffset = getFallbackAttackAnchorOffset(
      options.slot,
      this.config.attackAnchorDistance,
    );
    this.fallbackAttackAnchor.position.set(attackOffset.x, attackOffset.y, attackOffset.z);
    this.fallbackLinkAnchor.position.set(
      this.config.linkAnchorOffset.x,
      this.config.linkAnchorOffset.y,
      this.config.linkAnchorOffset.z,
    );
    this.root.add(this.fallbackAttackAnchor, this.fallbackLinkAnchor);

    if (this.config.modelUrl) void this.attachModel(this.config.modelUrl);
  }

  setTransform(position: Vec3, state: FighterState, attackId: number, deltaTime: number) {
    const moving = this.previousPosition
      ? isCharacterMoving(
          this.previousPosition,
          position,
          deltaTime,
          this.config.moveAnimationThreshold,
        )
      : false;
    if (this.previousPosition && moving && state !== FighterState.DOWN) {
      this.setFacingDirection(
        position.x - this.previousPosition.x,
        position.z - this.previousPosition.z,
        deltaTime,
      );
    }
    this.previousPosition = { ...position };
    this.root.position.set(position.x, position.y, position.z);
    this.animation.update(state, moving, attackId, deltaTime);
    this.applyVisualPose(state);
    this.resetModelRootTransform();
  }

  setFacingDirection(x: number, z: number, deltaTime: number) {
    if (Math.hypot(x, z) <= Number.EPSILON) return;
    const target = Math.atan2(x, z);
    const difference = Math.atan2(Math.sin(target - this.facingY), Math.cos(target - this.facingY));
    this.facingY += difference * Math.min(1, Math.max(0, deltaTime) * 12);
    this.root.rotation.y = this.facingY;
  }

  setAttackDirection(x: number, z: number, deltaTime: number) {
    if (Math.hypot(x, z) <= Number.EPSILON) return;
    const sideSign = this.options.slot === FighterSlot.LEFT ? -1 : 1;
    const target = Math.atan2(-z * sideSign, x * sideSign);
    const difference = Math.atan2(Math.sin(target - this.facingY), Math.cos(target - this.facingY));
    this.facingY += difference * Math.min(1, Math.max(0, deltaTime) * 20);
    this.root.rotation.y = this.facingY;
  }

  getLinkAnchorWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return (this.linkBone ?? this.fallbackLinkAnchor).getWorldPosition(target);
  }

  getAttackAnchorWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return (this.attackBone ?? this.fallbackAttackAnchor).getWorldPosition(target);
  }

  reset() {
    this.previousPosition = null;
    this.facingY = 0;
    this.root.rotation.set(0, 0, 0);
    this.visualRoot.rotation.set(0, this.config.rotationOffsetY, 0);
    this.fallback.material.color.copy(this.fallbackColor);
    this.animation.reset();
    this.resetModelRootTransform();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.animation.dispose();
    this.root.removeFromParent();
    this.fallback.geometry.dispose();
    this.fallback.material.dispose();
    this.ownedModelMaterials.forEach((material) => material.dispose());
    this.ownedModelMaterials.clear();
    this.model = null;
    this.attackBone = null;
    this.linkBone = null;
  }

  private async attachModel(url: string) {
    const { loadCharacterModel } = await import('./CharacterModelLoader');
    const loaded = await loadCharacterModel(url);
    if (!loaded || this.disposed) return;
    this.model = loaded.scene;
    this.cloneAndTintMaterials(this.model);
    this.model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const attackBoneName = this.options.slot === FighterSlot.LEFT
      ? this.config.bones.leftHand
      : this.config.bones.rightHand;
    this.attackBone = attackBoneName ? this.model.getObjectByName(attackBoneName) ?? null : null;
    this.linkBone = this.config.bones.linkAnchor
      ? this.model.getObjectByName(this.config.bones.linkAnchor) ?? null
      : null;
    this.visualRoot.add(this.model);
    this.fallback.visible = false;
    this.animation.setAsset(this.model, loaded.animations);
    this.resetModelRootTransform();
  }

  private cloneAndTintMaterials(root: THREE.Object3D) {
    const tint = new THREE.Color(this.options.color);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const source = Array.isArray(object.material) ? object.material : [object.material];
      const materials = source.map((material) => {
        const owned = material.clone();
        this.ownedModelMaterials.add(owned);
        if ('color' in owned && owned.color instanceof THREE.Color) {
          owned.color.lerp(tint, 0.22);
        }
        return owned;
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
  }

  private applyVisualPose(state: FighterState) {
    const downWithoutClip = state === FighterState.DOWN &&
      !this.animation.hasClip(this.config.animations.down);
    const attacking = state === FighterState.ATTACK_WINDUP ||
      state === FighterState.ATTACK_ACTIVE ||
      state === FighterState.ATTACK_RECOVERY;
    const attackClip = this.options.slot === FighterSlot.LEFT
      ? this.config.animations.attackLeft
      : this.config.animations.attackRight;
    const attackWithoutClip = attacking && !this.animation.hasClip(attackClip);
    this.visualRoot.rotation.z = downWithoutClip
      ? (this.options.slot === FighterSlot.LEFT ? Math.PI / 2 : -Math.PI / 2)
      : attackWithoutClip
        ? (this.options.slot === FighterSlot.LEFT ? 0.16 : -0.16)
        : 0;
    this.visualRoot.rotation.y = this.config.rotationOffsetY;
    this.fallback.material.color.copy(
      state === FighterState.DOWN ? new THREE.Color(0x555555) : this.fallbackColor,
    );
  }

  private resetModelRootTransform() {
    if (!this.model) return;
    this.model.position.set(
      this.config.positionOffset.x,
      this.config.positionOffset.y,
      this.config.positionOffset.z,
    );
    this.model.scale.setScalar(this.config.scale);
    // scene root에 포함된 root motion이 FighterRoot의 물리 위치를 변경하지 못하게 한다.
    this.model.rotation.set(0, 0, 0);
  }
}
