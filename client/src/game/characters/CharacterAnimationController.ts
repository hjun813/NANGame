import * as THREE from 'three';
import { FighterSlot, FighterState } from '@shared/enums';
import {
  resolveCharacterAnimationState,
  selectAttackClipName,
  shouldRestartAttackAnimation,
} from '@shared/character';
import { GAME_CONFIG } from '@shared/constants';
import type { CharacterAnimationState } from '@shared/character';
import type { CharacterAssetConfig } from './characterConfig';

const ATTACK_DURATION = GAME_CONFIG.ATTACK_WINDUP
  + GAME_CONFIG.ATTACK_ACTIVE
  + GAME_CONFIG.ATTACK_RECOVERY;

export class CharacterAnimationController {
  private mixer: THREE.AnimationMixer | null = null;
  private clips: THREE.AnimationClip[] = [];
  private action: THREE.AnimationAction | null = null;
  private animationState: CharacterAnimationState = 'IDLE';
  private lastAttackId = -1;

  constructor(
    private readonly slot: FighterSlot,
    private readonly config: CharacterAssetConfig,
  ) {}

  setAsset(root: THREE.Object3D, clips: readonly THREE.AnimationClip[]) {
    this.disposeMixer();
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = [...clips];
    this.animationState = 'IDLE';
    this.playNamed(this.config.animations.idle, true, true);
  }

  update(state: FighterState, isMoving: boolean, attackId: number, deltaTime: number) {
    const next = resolveCharacterAnimationState(state, isMoving);
    const restartAttack = shouldRestartAttackAnimation(this.lastAttackId, attackId, next);
    if (restartAttack) this.lastAttackId = attackId;

    if (next !== this.animationState || restartAttack) {
      this.animationState = next;
      if (next === 'ATTACK') {
        const clipName = selectAttackClipName(this.slot, this.config.animations);
        this.playNamed(clipName, false, true, ATTACK_DURATION);
      } else if (next === 'DOWN') {
        this.playNamed(this.config.animations.down, false, true);
      } else if (next === 'MOVE') {
        this.playNamed(this.config.animations.move, true);
      } else {
        this.playNamed(this.config.animations.idle, true);
      }
    }
    this.mixer?.update(Math.max(0, deltaTime));
  }

  hasClip(name: string | undefined): boolean {
    return !!name && !!THREE.AnimationClip.findByName(this.clips, name);
  }

  reset() {
    this.lastAttackId = -1;
    this.animationState = 'IDLE';
    this.mixer?.stopAllAction();
    this.playNamed(this.config.animations.idle, true, true);
  }

  dispose() {
    this.disposeMixer();
    this.clips = [];
    this.action = null;
  }

  private playNamed(
    name: string | undefined,
    loop: boolean,
    restart = false,
    targetDuration?: number,
  ) {
    if (!this.mixer || !name) {
      this.action?.fadeOut(0.08);
      this.action = null;
      return;
    }
    const clip = THREE.AnimationClip.findByName(this.clips, name);
    if (!clip) {
      this.action?.fadeOut(0.08);
      this.action = null;
      return;
    }
    const next = this.mixer.clipAction(clip);
    if (this.action !== next) this.action?.fadeOut(0.08);
    next.enabled = true;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.timeScale = targetDuration && targetDuration > 0
      ? clip.duration / targetDuration
      : 1;
    if (restart || this.action !== next) next.reset();
    next.fadeIn(0.08).play();
    this.action = next;
  }

  private disposeMixer() {
    if (!this.mixer) return;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.mixer = null;
  }
}
