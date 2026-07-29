const test = require('node:test');
const assert = require('node:assert/strict');
const { AttackStateMachine } = require('../dist/combat.js');
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
