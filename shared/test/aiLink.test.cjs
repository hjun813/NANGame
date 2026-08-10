const test = require('node:test');
const assert = require('node:assert/strict');
const { applyAILinkConstraint } = require('../dist/aiLink.js');

const p = (x, z = 0) => ({ x, y: 0.9, z });
test('링크 범위 안에서는 두 AI의 독립 이동을 보존한다', () => {
  const result = applyAILinkConstraint(p(-0.9), p(0.9), p(-0.8, 0.1), p(1, 0.1));
  assert.equal(result.wasConstrained, false);
  assert.deepEqual(result.firstPosition, p(-0.8, 0.1));
  assert.deepEqual(result.secondPosition, p(1, 0.1));
});
test('같은 방향, 반대 방향, 한쪽 이동을 허용한다', () => {
  for (const [a, b] of [[p(-0.9, 1), p(0.9, 1)], [p(-0.95), p(0.95)], [p(-0.9), p(0.9, 0.1)]]) {
    const result = applyAILinkConstraint(p(-0.9), p(0.9), a, b);
    assert.ok(Number.isFinite(result.firstPosition.x));
    assert.equal(result.wasConstrained, false);
  }
});
test('최대 거리 밖으로 멀어지는 이동만 제한한다', () => {
  const result = applyAILinkConstraint(p(-0.9), p(0.9), p(-1.1), p(1.1));
  assert.ok(result.distance < 2.2);
});
test('링크 축에 수직인 이동은 유지된다', () => {
  const result = applyAILinkConstraint(p(-0.9), p(0.9), p(-0.9, 0.08), p(0.9, 0.08));
  assert.equal(result.firstPosition.z, 0.08);
  assert.equal(result.secondPosition.z, 0.08);
});
test('최소 거리와 동일 좌표를 NaN 없이 분리한다', () => {
  const result = applyAILinkConstraint(p(0), p(0), p(0), p(0));
  assert.ok(result.distance > 0);
  assert.ok(Number.isFinite(result.firstPosition.x) && Number.isFinite(result.secondPosition.x));
});
test('DOWN AI는 정지하고 최대 거리에서 제한적으로 끌려온다', () => {
  const result = applyAILinkConstraint(p(-0.9), p(0.9), p(-0.9), p(1.08), { firstDown: true });
  assert.ok(result.firstPosition.x > -0.9);
  assert.ok(result.firstPosition.x <= -0.8 + 1e-6);
  assert.ok(result.distance < 1.98);
});
test('목표 거리 밖에서는 tick 상한으로 점진 복원한다', () => {
  let first = p(-2);
  let second = p(2);
  for (let tick = 0; tick < 12; tick++) {
    const result = applyAILinkConstraint(first, second, first, second);
    first = result.firstPosition;
    second = result.secondPosition;
  }
  assert.ok(Math.hypot(second.x - first.x, second.z - first.z) <= 1.95 + 1e-6);
});
test('경기장 경계를 벗어나지 않는다', () => {
  const result = applyAILinkConstraint(p(9), p(9), p(20), p(20));
  assert.ok(Math.abs(result.firstPosition.x) <= 9.5);
  assert.ok(Math.abs(result.secondPosition.x) <= 9.5);
});
