const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FighterSlot,
  FighterState,
  Team,
  getCharacterIdentity,
  getFallbackAttackAnchorOffset,
  getCharacterVisualMode,
  isCharacterMoving,
  resolveCharacterAnimationState,
  selectAttackClipName,
  selectOutwardAttackBoneName,
  shouldRestartAttackAnimation,
} = require('../dist');

test('fighter ID determines team and attack side', () => {
  assert.deepEqual(getCharacterIdentity('player-left'), { team: Team.PLAYER, slot: FighterSlot.LEFT });
  assert.deepEqual(getCharacterIdentity('enemy-right'), { team: Team.AI, slot: FighterSlot.RIGHT });
  assert.equal(getCharacterIdentity('unknown'), null);
});

test('DOWN and attack states have priority over movement', () => {
  assert.equal(resolveCharacterAnimationState(FighterState.DOWN, true), 'DOWN');
  assert.equal(resolveCharacterAnimationState(FighterState.ATTACK_ACTIVE, true), 'ATTACK');
  assert.equal(resolveCharacterAnimationState(FighterState.NORMAL, true), 'MOVE');
  assert.equal(resolveCharacterAnimationState(FighterState.NORMAL, false), 'IDLE');
});

test('attack clip never falls back to the opposite arm', () => {
  const clips = { attackLeft: 'Punch_L', attackRight: 'Punch_R' };
  assert.equal(selectAttackClipName(FighterSlot.LEFT, clips), 'Punch_L');
  assert.equal(selectAttackClipName(FighterSlot.RIGHT, clips), 'Punch_R');
  assert.equal(selectAttackClipName(FighterSlot.LEFT, { attackRight: 'Punch_R' }), undefined);
});

test('movement uses speed and a stable threshold', () => {
  assert.equal(isCharacterMoving({ x: 0, z: 0 }, { x: 0.001, z: 0 }, 1 / 60, 0.1), false);
  assert.equal(isCharacterMoving({ x: 0, z: 0 }, { x: 0.1, z: 0 }, 1 / 60, 0.1), true);
});

test('attack animation restarts only for a newer attack id', () => {
  assert.equal(shouldRestartAttackAnimation(3, 3, 'ATTACK'), false);
  assert.equal(shouldRestartAttackAnimation(3, 4, 'ATTACK'), true);
  assert.equal(shouldRestartAttackAnimation(3, 4, 'IDLE'), false);
});

test('fallback attack anchors preserve left and right sides', () => {
  assert.deepEqual(getFallbackAttackAnchorOffset(FighterSlot.LEFT, 0.8), { x: -0.8, y: 0, z: 0 });
  assert.deepEqual(getFallbackAttackAnchorOffset(FighterSlot.RIGHT, 0.8), { x: 0.8, y: 0, z: 0 });
});

test('outward attack anchor uses the bone located on the slot attack side', () => {
  const bones = { leftHand: 'LeftHand', rightHand: 'RightHand' };
  assert.equal(selectOutwardAttackBoneName(FighterSlot.LEFT, bones), 'RightHand');
  assert.equal(selectOutwardAttackBoneName(FighterSlot.RIGHT, bones), 'LeftHand');
  assert.equal(selectOutwardAttackBoneName(FighterSlot.LEFT, { leftHand: 'LeftHand' }), undefined);
});

test('missing URLs and failed model loads select the fallback', () => {
  assert.equal(getCharacterVisualMode(undefined, true), 'FALLBACK');
  assert.equal(getCharacterVisualMode('/fighter.glb', false), 'FALLBACK');
  assert.equal(getCharacterVisualMode('/fighter.glb', true), 'MODEL');
});
