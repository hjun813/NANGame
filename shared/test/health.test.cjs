const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyHealthDamage,
  createHealthFighter,
  evaluateTeamHealth,
} = require('../dist/health.js');
const {
  FighterSlot,
  FighterState,
  LinkState,
  MatchResult,
  Team,
} = require('../dist/enums.js');

const fighter = (id, team, slot) => createHealthFighter(id, team, slot);

test('피해는 HP를 0 미만으로 내리지 않고 체력 0에서 DOWN으로 전환한다', () => {
  const initial = fighter('player-left', Team.PLAYER, FighterSlot.LEFT);
  const result = applyHealthDamage(initial, 999);

  assert.equal(result.applied, true);
  assert.equal(result.becameDown, true);
  assert.equal(result.fighter.hp, 0);
  assert.equal(result.fighter.state, FighterState.DOWN);
});

test('다운 파이터의 추가 피격은 무시한다', () => {
  const initial = fighter('player-left', Team.PLAYER, FighterSlot.LEFT);
  const down = applyHealthDamage(initial, 100).fighter;
  const repeated = applyHealthDamage(down, 12);

  assert.equal(repeated.applied, false);
  assert.deepEqual(repeated.fighter, down);
});

test('한 명 다운은 DOWN_DRAG, 두 명 다운은 팀 패배다', () => {
  const fighters = [
    applyHealthDamage(fighter('pa', Team.PLAYER, FighterSlot.LEFT), 100).fighter,
    fighter('pb', Team.PLAYER, FighterSlot.RIGHT),
    fighter('ea', Team.AI, FighterSlot.LEFT),
    fighter('eb', Team.AI, FighterSlot.RIGHT),
  ];
  assert.equal(evaluateTeamHealth(fighters).playerLinkState, LinkState.DOWN_DRAG);

  fighters[1] = applyHealthDamage(fighters[1], 100).fighter;
  const evaluation = evaluateTeamHealth(fighters);
  assert.equal(evaluation.playerLinkState, LinkState.BOTH_DOWN);
  assert.equal(evaluation.result, MatchResult.PLAYER_LOSE);
});

test('같은 판정 시점에 양 팀이 모두 다운이면 무승부다', () => {
  const fighters = [
    fighter('pa', Team.PLAYER, FighterSlot.LEFT),
    fighter('pb', Team.PLAYER, FighterSlot.RIGHT),
    fighter('ea', Team.AI, FighterSlot.LEFT),
    fighter('eb', Team.AI, FighterSlot.RIGHT),
  ].map((item) => applyHealthDamage(item, 100).fighter);

  assert.equal(evaluateTeamHealth(fighters).result, MatchResult.DRAW);
});
