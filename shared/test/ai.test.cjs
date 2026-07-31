const test = require('node:test');
const assert = require('node:assert/strict');
const {
  attackStateToAIState,
  canStartAIAttack,
  clampToArena,
  createRetreatDirection,
  getAIAttackArm,
  isTargetInAIAttackArc,
  selectNearestLivingTarget,
  separateAIStates,
  stepAIRetreat,
  stepAI,
  stepAIReposition,
} = require('../dist/ai.js');

test('AI ID는 고정된 LEFT/RIGHT 공격 팔을 결정한다', () => {
  assert.equal(getAIAttackArm('enemy-left'), 'LEFT');
  assert.equal(getAIAttackArm('enemy-right'), 'RIGHT');
});

test('링크 파트너 반대쪽 대상만 공격 가능하다', () => {
  assert.equal(isTargetInAIAttackArc(position(-0.9), position(0.9), position(-1.5)), true);
  assert.equal(isTargetInAIAttackArc(position(-0.9), position(0.9), position(0)), false);
  assert.equal(isTargetInAIAttackArc(position(0.9), position(-0.9), position(1.5)), true);
});

test('회전된 링크에서도 바깥쪽 공격 영역을 계산한다', () => {
  assert.equal(isTargetInAIAttackArc(position(0, -0.9), position(0, 0.9), position(0, -1.5)), true);
});

test('공격 불가능한 위치에서는 링크 반경을 따라 REPOSITION한다', () => {
  const moved = stepAIReposition(ai('enemy-left', -0.9), position(0.9), position(0), 1 / 30);
  assert.equal(moved.state, AIState.REPOSITION);
  assert.ok(Number.isFinite(moved.position.x) && Number.isFinite(moved.position.z));
});
const { AIState, FighterState, GameState } = require('../dist/enums.js');

const position = (x, z = 0) => ({ x, y: 0.9, z });
const ai = (id = 'enemy-left', x = 0, z = 0) => ({
  id,
  state: AIState.IDLE,
  targetId: null,
  position: position(x, z),
});
const player = (id, x, state = FighterState.NORMAL, z = 0) => ({
  id,
  state,
  position: position(x, z),
});
const playingOptions = {
  gameState: GameState.PLAYING,
  fighterState: FighterState.NORMAL,
  deltaTime: 1 / 60,
};

test('생존 플레이어 중 가장 가까운 대상을 선택한다', () => {
  const target = selectNearestLivingTarget(position(0), [
    player('player-left', 5),
    player('player-right', 2),
  ]);
  assert.equal(target.id, 'player-right');
});

test('DOWN 플레이어는 타깃 후보에서 제외한다', () => {
  const target = selectNearestLivingTarget(position(0), [
    player('player-left', 1, FighterState.DOWN),
    player('player-right', 3),
  ]);
  assert.equal(target.id, 'player-right');
});

test('같은 거리에서는 ID 오름차순으로 타깃을 결정한다', () => {
  const target = selectNearestLivingTarget(position(0), [
    player('player-right', 2),
    player('player-left', -2),
  ]);
  assert.equal(target.id, 'player-left');
});

test('유효한 타깃이 없으면 IDLE이고 targetId를 제거한다', () => {
  const result = stepAI({ ...ai(), targetId: 'old-target' }, [], playingOptions);
  assert.equal(result.state, AIState.IDLE);
  assert.equal(result.targetId, null);
});

test('공격 사거리 밖이면 APPROACH로 전환한다', () => {
  const result = stepAI(ai(), [player('player-left', 5)], playingOptions);
  assert.equal(result.state, AIState.APPROACH);
  assert.equal(result.targetId, 'player-left');
});

test('공격 사거리 안이면 ATTACK_READY로 멈춘다', () => {
  const initial = ai();
  const result = stepAI(initial, [player('player-left', 1)], playingOptions);
  assert.equal(result.state, AIState.ATTACK_READY);
  assert.deepEqual(result.position, initial.position);
});

test('사거리 경계의 부동소수점 오차에서 APPROACH에 고착되지 않는다', () => {
  const result = stepAI(ai('enemy-left', -2.2), [player('player-left', -1)], {
    ...playingOptions,
    deltaTime: 1 / 60,
  });
  assert.equal(result.state, AIState.ATTACK_READY);
});

test('이동 거리는 속도와 delta time에 비례한다', () => {
  const result = stepAI(ai(), [player('player-left', 10)], {
    ...playingOptions,
    deltaTime: 0.2,
    moveSpeed: 2.5,
  });
  assert.ok(Math.abs(result.position.x - 0.5) < 1e-9);
});

test('AI 위치를 경기장 경계 안으로 제한한다', () => {
  const result = stepAI(ai('enemy-left', 9.4), [player('player-left', 20)], {
    ...playingOptions,
    deltaTime: 1,
    arenaLimit: 9.5,
  });
  assert.equal(result.position.x, 9.5);
  assert.deepEqual(clampToArena(position(-20, 20), 9.5), position(-9.5, 9.5));
});

test('겹친 두 AI를 제한된 보정량으로 최소 거리까지 분리한다', () => {
  let left = ai('enemy-left', 0);
  let right = ai('enemy-right', 0.1);
  for (let tick = 0; tick < 20; tick++) {
    [left, right] = separateAIStates(left, right, {
      minimumDistance: 0.9,
      maxStep: 0.05,
    });
  }
  assert.ok(Math.hypot(
    right.position.x - left.position.x,
    right.position.z - left.position.z,
  ) >= 0.9 - 1e-9);
});

test('두 AI가 정확히 같은 좌표여도 NaN 없이 결정적으로 분리한다', () => {
  const [left, right] = separateAIStates(
    ai('enemy-left'),
    ai('enemy-right'),
  );
  assert.ok(Number.isFinite(left.position.x));
  assert.ok(Number.isFinite(right.position.x));
  assert.ok(left.position.x < right.position.x);
});

test('PLAYING이 아니면 AI가 이동하지 않는다', () => {
  const initial = ai();
  const result = stepAI(initial, [player('player-left', 5)], {
    ...playingOptions,
    gameState: GameState.COUNTDOWN,
  });
  assert.equal(result.state, AIState.IDLE);
  assert.deepEqual(result.position, initial.position);
});

test('DOWN AI는 PLAYING 중에도 이동하지 않는다', () => {
  const initial = ai();
  const result = stepAI(initial, [player('player-left', 5)], {
    ...playingOptions,
    fighterState: FighterState.DOWN,
  });
  assert.equal(result.state, AIState.IDLE);
  assert.deepEqual(result.position, initial.position);
});

test('PLAYING, 생존 AI, 정상 공격 상태, 사거리 안 타깃에서만 공격을 시작한다', () => {
  const target = player('player-left', 1);
  assert.equal(canStartAIAttack(
    position(0), FighterState.NORMAL, target,
    GameState.PLAYING, FighterState.NORMAL,
  ), true);
  assert.equal(canStartAIAttack(
    position(0), FighterState.NORMAL, target,
    GameState.COUNTDOWN, FighterState.NORMAL,
  ), false);
  assert.equal(canStartAIAttack(
    position(0), FighterState.DOWN, target,
    GameState.PLAYING, FighterState.NORMAL,
  ), false);
  assert.equal(canStartAIAttack(
    position(0), FighterState.NORMAL, null,
    GameState.PLAYING, FighterState.NORMAL,
  ), false);
  assert.equal(canStartAIAttack(
    position(0), FighterState.NORMAL, player('player-left', 3),
    GameState.PLAYING, FighterState.NORMAL,
  ), false);
  assert.equal(canStartAIAttack(
    position(0), FighterState.NORMAL, target,
    GameState.PLAYING, FighterState.ATTACK_RECOVERY,
  ), false);
});

test('공격 머신 상태를 AI WINDUP, ACTIVE, RECOVERY 상태로 변환한다', () => {
  assert.equal(attackStateToAIState(FighterState.ATTACK_WINDUP), AIState.WINDUP);
  assert.equal(attackStateToAIState(FighterState.ATTACK_ACTIVE), AIState.ACTIVE);
  assert.equal(attackStateToAIState(FighterState.ATTACK_RECOVERY), AIState.RECOVERY);
  assert.equal(attackStateToAIState(FighterState.NORMAL), null);
});

test('후퇴 방향은 마지막 타깃의 반대 방향이다', () => {
  assert.deepEqual(
    createRetreatDirection('enemy-left', position(0), position(1)),
    { x: -1, y: 0, z: 0 },
  );
});

test('동일 좌표 후퇴 방향도 결정적이고 NaN이 아니다', () => {
  const left = createRetreatDirection('enemy-left', position(0), position(0));
  const right = createRetreatDirection('enemy-right', position(0), position(0));
  assert.deepEqual(left, { x: -1, y: 0, z: 0 });
  assert.deepEqual(right, { x: 1, y: 0, z: 0 });
});

test('후퇴는 delta time에 따라 이동하고 경기장 경계를 넘지 않는다', () => {
  const moved = stepAIRetreat(
    position(0), { x: -1, y: 0, z: 0 }, 0.35, 0.1, 3, 9.5,
  );
  assert.ok(Math.abs(moved.position.x + 0.3) < 1e-9);
  assert.ok(Math.abs(moved.remainingTime - 0.25) < 1e-9);

  const clamped = stepAIRetreat(
    position(9.45), { x: 1, y: 0, z: 0 }, 0.35, 0.1, 3, 9.5,
  );
  assert.equal(clamped.position.x, 9.5);
});
