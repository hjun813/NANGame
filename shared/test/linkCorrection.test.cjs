const test = require('node:test');
const assert = require('node:assert/strict');
const {
  correctLinkedMovement,
  vec3Distance,
} = require('../dist/linkCorrection.js');

const MAX_DISTANCE = 1.8;
const ZERO = { x: 0, y: 0, z: 0 };

test('허용 거리 안에서는 두 이동을 그대로 반영한다', () => {
  const result = correctLinkedMovement(
    { x: -0.5, y: 0, z: 0 },
    { x: 0.5, y: 0, z: 0 },
    { x: 0, y: 0, z: 0.1 },
    { x: 0, y: 0, z: 0.1 },
    MAX_DISTANCE,
  );

  assert.equal(result.wasConstrained, false);
  assert.deepEqual(result.positionA, { x: -0.5, y: 0, z: 0.1 });
  assert.deepEqual(result.positionB, { x: 0.5, y: 0, z: 0.1 });
});

test('반대 방향으로 계속 입력해도 최대 거리를 넘거나 불안정해지지 않는다', () => {
  let positionA = { x: -0.9, y: 0, z: 0 };
  let positionB = { x: 0.9, y: 0, z: 0 };
  const outwardA = { x: -5 / 60, y: 0, z: 0 };
  const outwardB = { x: 5 / 60, y: 0, z: 0 };

  for (let step = 0; step < 30 * 60; step++) {
    const result = correctLinkedMovement(
      positionA,
      positionB,
      outwardA,
      outwardB,
      MAX_DISTANCE,
    );
    positionA = result.positionA;
    positionB = result.positionB;
    assert.ok(Number.isFinite(positionA.x) && Number.isFinite(positionB.x));
    assert.ok(vec3Distance(positionA, positionB) <= MAX_DISTANCE + 0.001);
  }
});

test('한 명만 바깥으로 이동해도 양쪽을 보정하고 중점을 보존한다', () => {
  const positionA = { x: -0.9, y: 0, z: 0 };
  const positionB = { x: 0.9, y: 0, z: 0 };
  const result = correctLinkedMovement(
    positionA,
    positionB,
    ZERO,
    { x: 0.1, y: 0, z: 0 },
    MAX_DISTANCE,
  );

  assert.equal(result.wasConstrained, true);
  assert.ok(result.positionA.x > positionA.x);
  assert.ok(result.positionB.x > positionB.x);
  assert.ok(Math.abs((result.positionA.x + result.positionB.x) / 2 - 0.05) < 1e-9);
  assert.ok(vec3Distance(result.positionA, result.positionB) <= MAX_DISTANCE + 0.001);
});
