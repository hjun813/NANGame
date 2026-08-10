const test = require('node:test');
const assert = require('node:assert/strict');
const { AttackStateMachine, isBasicAttackHit } = require('../dist/combat.js');
const { FighterState } = require('../dist/enums.js');

const DT = 1 / 60;

function advanceUntil(machine, expectedState) {
  for (let step = 0; step < 120; step++) {
    machine.update(DT);
    if (machine.state === expectedState) return;
  }
  assert.fail(`state did not reach ${expectedState}`);
}

test('공격이 WINDUP, ACTIVE, RECOVERY, NORMAL 순서로 전환된다', () => {
  const attack = new AttackStateMachine();
  assert.equal(attack.tryStart(), true);
  assert.equal(attack.state, FighterState.ATTACK_WINDUP);
  advanceUntil(attack, FighterState.ATTACK_ACTIVE);
  advanceUntil(attack, FighterState.ATTACK_RECOVERY);
  advanceUntil(attack, FighterState.NORMAL);
});

test('다운 전환은 진행 중인 공격을 즉시 취소하고 재공격을 차단한다', () => {
  const attack = new AttackStateMachine();
  attack.tryStart();
  advanceUntil(attack, FighterState.ATTACK_ACTIVE);

  attack.forceDown();

  assert.equal(attack.state, FighterState.DOWN);
  assert.equal(attack.tryStart(), false);
  attack.update(10);
  assert.equal(attack.state, FighterState.DOWN);
});

test('한 공격은 같은 대상에게 한 번만 적중한다', () => {
  const attack = new AttackStateMachine();
  attack.tryStart();
  advanceUntil(attack, FighterState.ATTACK_ACTIVE);

  assert.equal(attack.registerHit('enemy-a'), true);
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(attack.registerHit('enemy-a'), false);
  }
  assert.equal(attack.registerHit('enemy-b'), true);
});

test('공격 진행 중 재입력은 무시하고 종료 후 다시 공격할 수 있다', () => {
  const attack = new AttackStateMachine();
  assert.equal(attack.tryStart(), true);
  assert.equal(attack.tryStart(), false);
  advanceUntil(attack, FighterState.NORMAL);
  assert.equal(attack.tryStart(), true);
});

test('공격 100회에서 각 공격은 같은 대상에게 한 번만 적중한다', () => {
  const attack = new AttackStateMachine();

  for (let attackCount = 0; attackCount < 100; attackCount++) {
    assert.equal(attack.tryStart(), true);
    advanceUntil(attack, FighterState.ATTACK_ACTIVE);
    assert.equal(attack.registerHit('training-enemy'), true);
    assert.equal(attack.registerHit('training-enemy'), false);
    advanceUntil(attack, FighterState.NORMAL);
  }

  assert.equal(attack.attackId, 100);
});

test('기본 공격은 공격 방향과 구체 사거리 안의 대상만 적중한다', () => {
  const attacker = { x: -1.8, y: 0.9, z: 0 };
  assert.equal(isBasicAttackHit(attacker, { x: -3, y: 0.9, z: 0 }, -1), true);
  assert.equal(isBasicAttackHit(attacker, { x: 0, y: 0.9, z: 0 }, -1), false);
  assert.equal(isBasicAttackHit(attacker, { x: -3, y: 0.9, z: 2 }, -1), false);
});

test('기본 공격은 XZ 평면의 임의 방향에서 서버 위치로 적중을 판정한다', () => {
  const attacker = { x: 0, y: 0.9, z: 0 };
  assert.equal(isBasicAttackHit(
    attacker,
    { x: 0, y: 0.9, z: 1.2 },
    { x: 0, z: 1 },
  ), true);
  assert.equal(isBasicAttackHit(
    attacker,
    { x: 2, y: 0.9, z: 0 },
    { x: 0, z: 1 },
  ), false);
});

test('서버 공격 상태와 attackId를 클라이언트 표시 머신에 동기화한다', () => {
  const attack = new AttackStateMachine();
  attack.syncState(FighterState.ATTACK_ACTIVE, 7);
  assert.equal(attack.state, FighterState.ATTACK_ACTIVE);
  assert.equal(attack.attackId, 7);
  attack.syncState(FighterState.DOWN, 7);
  assert.equal(attack.state, FighterState.DOWN);
});

test('경기 reset은 클라이언트 공격 세대도 0으로 초기화한다', () => {
  const attack = new AttackStateMachine();
  attack.syncState(FighterState.ATTACK_RECOVERY, 7);
  attack.reset();
  assert.equal(attack.state, FighterState.NORMAL);
  assert.equal(attack.attackId, 0);
});
