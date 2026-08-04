import { FighterSlot, Team } from '@shared/enums';
import type { Vec3 } from '@shared/types';
import { GAME_CONFIG } from '@shared/constants';

export interface CharacterAssetConfig {
  modelUrl?: string;
  scale: number;
  positionOffset: Vec3;
  rotationOffsetY: number;
  animations: {
    idle?: string;
    move?: string;
    attackLeft?: string;
    attackRight?: string;
    down?: string;
  };
  bones: {
    leftHand?: string;
    rightHand?: string;
    linkAnchor?: string;
  };
  linkAnchorOffset: Vec3;
  attackAnchorDistance: number;
  moveAnimationThreshold: number;
}

const assetTestEnabled = import.meta.env.VITE_ENABLE_CHARACTER_ASSET_TEST === 'true';
const assetTestFighter = import.meta.env.VITE_CHARACTER_ASSET_TEST_FIGHTER || 'player-left';

const baseConfig: CharacterAssetConfig = {
  scale: 1,
  // Fighter root는 Rapier 캡슐 중심(y=0.9), GLB의 발 기준 원점은 지면(y=0)에 둔다.
  positionOffset: { x: 0, y: -0.9, z: 0 },
  rotationOffsetY: 0,
  animations: {
    idle: 'Idle',
    move: 'Walk',
    attackLeft: 'Punch_Left',
    attackRight: 'Punch_Right',
    down: 'Down',
  },
  bones: {
    leftHand: 'LeftHand',
    rightHand: 'RightHand',
    linkAnchor: 'Spine2',
  },
  linkAnchorOffset: { x: 0, y: 0.25, z: 0 },
  attackAnchorDistance: GAME_CONFIG.ATTACK_RANGE - 0.4,
  moveAnimationThreshold: 0.12,
};

export function getCharacterAssetConfig(fighterId: string): CharacterAssetConfig {
  return {
    ...baseConfig,
    modelUrl: assetTestEnabled && fighterId === assetTestFighter
      ? '/assets/characters/fighter-test.glb'
      : undefined,
    positionOffset: { ...baseConfig.positionOffset },
    animations: { ...baseConfig.animations },
    bones: { ...baseConfig.bones },
    linkAnchorOffset: { ...baseConfig.linkAnchorOffset },
  };
}

export function getCharacterColor(team: Team, slot: FighterSlot): number {
  if (team === Team.PLAYER) {
    return slot === FighterSlot.LEFT ? 0x4fc3f7 : 0x81c784;
  }
  return slot === FighterSlot.LEFT ? 0xef5350 : 0xff7043;
}
