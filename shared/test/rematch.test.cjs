const test = require('node:test');
const assert = require('node:assert/strict');
const { FighterSlot, GameState } = require('../dist/enums.js');
const { createRematchReady, registerRematchRequest } = require('../dist/rematch.js');

test('FINISHED가 아니면 재경기 요청을 무시한다', () => {
  const result = registerRematchRequest(createRematchReady(), FighterSlot.LEFT, GameState.PLAYING);
  assert.equal(result.accepted, false);
  assert.deepEqual(result.ready, createRematchReady());
});
test('유효한 슬롯이 없으면 요청을 무시한다', () => {
  assert.equal(registerRematchRequest(createRematchReady(), null, GameState.FINISHED).accepted, false);
});
test('첫 요청은 해당 슬롯만 준비시키고 중복 요청은 무시한다', () => {
  const first = registerRematchRequest(createRematchReady(), FighterSlot.LEFT, GameState.FINISHED);
  assert.equal(first.ready[FighterSlot.LEFT], true);
  assert.equal(first.allReady, false);
  assert.equal(registerRematchRequest(first.ready, FighterSlot.LEFT, GameState.FINISHED).accepted, false);
});
test('양쪽 요청이 모이면 allReady가 된다', () => {
  const first = registerRematchRequest(createRematchReady(), FighterSlot.LEFT, GameState.FINISHED);
  const second = registerRematchRequest(first.ready, FighterSlot.RIGHT, GameState.FINISHED);
  assert.equal(second.accepted, true);
  assert.equal(second.allReady, true);
});
