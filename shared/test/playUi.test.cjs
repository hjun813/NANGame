const test = require('node:test');
const assert = require('node:assert/strict');
const ui = require('../dist/playUi.js');
const { FighterSlot, FighterState, GameState, MatchResult } = require('../dist/enums.js');

test('HP is clamped and converted to percent', () => {
  assert.equal(ui.hpPercent(88, 100), 88);
  assert.equal(ui.hpPercent(-5, 100), 0);
  assert.equal(ui.hpPercent(120, 100), 100);
});
test('time uses MM:SS and clamps negatives', () => {
  assert.equal(ui.formatMatchTime(180), '03:00');
  assert.equal(ui.formatMatchTime(179.2), '03:00');
  assert.equal(ui.formatMatchTime(8), '00:08');
  assert.equal(ui.formatMatchTime(-1), '00:00');
});
test('game state messages are mapped safely', () => {
  assert.match(ui.gameStateMessage(GameState.WAITING), /기다리는/);
  assert.equal(ui.gameStateMessage(GameState.COUNTDOWN, 2.1), '3');
  assert.equal(ui.gameStateMessage(GameState.PLAYING), null);
  assert.match(ui.gameStateMessage('UNKNOWN'), /확인 중/);
});
test('results are mapped', () => {
  assert.equal(ui.resultCopy(MatchResult.PLAYER_WIN).title, '승리');
  assert.equal(ui.resultCopy(MatchResult.PLAYER_LOSE).title, '패배');
  assert.equal(ui.resultCopy(MatchResult.DRAW).title, '무승부');
  assert.equal(ui.resultCopy('UNKNOWN').title, '경기 종료');
});
test('DOWN relies on authoritative fighter state', () => {
  assert.equal(ui.isDown(FighterState.DOWN), true);
  assert.equal(ui.isDown(FighterState.NORMAL), false);
});
test('slot guide reflects actual input mapping', () => {
  assert.deepEqual(ui.slotGuide(FighterSlot.LEFT), { label: '왼쪽 파이터', movement: 'WASD', attack: 'F' });
  assert.deepEqual(ui.slotGuide(FighterSlot.RIGHT), { label: '오른쪽 파이터', movement: '방향키', attack: 'L' });
  assert.equal(ui.slotGuide(null).label, '캐릭터 배정 중');
});
test('rematch UI follows authoritative ready states', () => {
  assert.equal(ui.rematchUiState(false, false).buttonLabel, '재경기 요청');
  assert.match(ui.rematchUiState(true, false).message, /기다리는 중/);
  assert.equal(ui.rematchUiState(true, false).alreadyRequested, true);
  assert.match(ui.rematchUiState(false, true).message, /상대방이/);
});
