const test = require('node:test');
const assert = require('node:assert/strict');

const { CombatRoom, isDebugCombatCommandEnabled } = require('../dist/rooms/CombatRoom.js');
const {
  EVENTS,
  FighterState,
  GameState,
  MatchResult,
} = require('linked-fighters-shared');

function createClient(sessionId) {
  const sent = [];
  return {
    sessionId,
    sent,
    send(event, payload) {
      sent.push({ event, payload });
    },
  };
}

function createHarness() {
  const room = new CombatRoom();
  room.autoDispose = false;
  room.setPatchRate(null);
  room.clock.stop();
  const handlers = new Map();
  const broadcasts = [];
  let simulate = null;

  room.onMessage = (event, handler) => {
    handlers.set(event, handler);
    return room;
  };
  room.setSimulationInterval = (handler) => {
    simulate = handler;
    return room;
  };
  room.broadcast = (event, payload) => {
    broadcasts.push({ event, payload });
  };
  room.onCreate();

  return {
    room,
    handlers,
    broadcasts,
    clientA: createClient('client-a'),
    clientB: createClient('client-b'),
    tick(milliseconds = 100) {
      assert.ok(simulate, 'simulation callback must be registered');
      simulate(milliseconds);
    },
    snapshot() {
      const entry = broadcasts.findLast(({ event }) => event === EVENTS.COMBAT_STATE);
      assert.ok(entry, 'combat state must have been broadcast');
      return entry.payload;
    },
  };
}

function advanceToPlaying(harness) {
  harness.room.onJoin(harness.clientA);
  harness.room.onJoin(harness.clientB);
  for (let index = 0; index < 30; index += 1) harness.tick();
  assert.equal(harness.snapshot().gameState, GameState.PLAYING);
}

test('debug damage command is disabled by default and always disabled in production', () => {
  assert.equal(isDebugCombatCommandEnabled({}), false);
  assert.equal(isDebugCombatCommandEnabled({ ENABLE_DEBUG_COMBAT_COMMANDS: 'true' }), true);
  assert.equal(isDebugCombatCommandEnabled({
    NODE_ENV: 'production',
    ENABLE_DEBUG_COMBAT_COMMANDS: 'true',
  }), false);

  const previous = process.env.ENABLE_DEBUG_COMBAT_COMMANDS;
  delete process.env.ENABLE_DEBUG_COMBAT_COMMANDS;
  const harness = createHarness();
  assert.equal(harness.handlers.has(EVENTS.COMBAT_DAMAGE), false);
  if (previous === undefined) delete process.env.ENABLE_DEBUG_COMBAT_COMMANDS;
  else process.env.ENABLE_DEBUG_COMBAT_COMMANDS = previous;
});

test('room waits for two players and rejects gameplay messages before PLAYING', () => {
  const harness = createHarness();
  harness.room.onJoin(harness.clientA);
  assert.equal(harness.snapshot().gameState, GameState.WAITING);

  harness.room.onJoin(harness.clientB);
  const countdown = harness.snapshot();
  assert.equal(countdown.gameState, GameState.COUNTDOWN);
  const leftBefore = countdown.fighters.find(({ id }) => id === 'player-left');

  harness.handlers.get(EVENTS.COMBAT_POSITION)(harness.clientA, {
    sequence: 1,
    resetRevision: countdown.resetRevision,
    position: { x: -2, y: 0.9, z: 0 },
  });
  harness.handlers.get(EVENTS.COMBAT_ATTACK)(harness.clientA, {
    sequence: 1,
    resetRevision: countdown.resetRevision,
    attackerId: 'player-left',
  });
  const after = harness.snapshot().fighters.find(({ id }) => id === 'player-left');
  assert.deepEqual(after.position, leftBefore.position);
  assert.equal(after.state, FighterState.NORMAL);
});

test('stale generations are rejected and repeated rematch consensus never leaks state', () => {
  const harness = createHarness();
  advanceToPlaying(harness);
  const playing = harness.snapshot();
  const initialAttackId = playing.fighters.find(({ id }) => id === 'player-left').attackId;

  harness.handlers.get(EVENTS.COMBAT_ATTACK)(harness.clientA, {
    sequence: 1,
    resetRevision: playing.resetRevision - 1,
    attackerId: 'player-left',
  });
  assert.equal(
    harness.snapshot().fighters.find(({ id }) => id === 'player-left').attackId,
    initialAttackId,
  );

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    harness.room.finishMatch(MatchResult.PLAYER_LOSE);
    harness.room.broadcastState();
    harness.handlers.get(EVENTS.COMBAT_REMATCH)(harness.clientA);
    assert.equal(harness.snapshot().gameState, GameState.FINISHED);
    harness.handlers.get(EVENTS.COMBAT_REMATCH)(harness.clientB);

    const restarted = harness.snapshot();
    assert.equal(restarted.gameState, GameState.COUNTDOWN);
    assert.equal(restarted.resetRevision, playing.resetRevision + cycle);
    assert.equal(restarted.result, MatchResult.PLAYING);
    assert.ok(restarted.fighters.every(({ hp, state }) => hp === 100 && state === FighterState.NORMAL));
    assert.ok(restarted.aiStates.every(({ state, targetId }) => state === 'IDLE' && targetId === null));
    for (let index = 0; index < 30; index += 1) harness.tick();
    assert.equal(harness.snapshot().gameState, GameState.PLAYING);
  }
});

test('same damage batch preserves DRAW and leaving returns the survivor to WAITING', () => {
  const harness = createHarness();
  advanceToPlaying(harness);

  const evaluation = harness.room.applyPendingDamage([
    { fighterId: 'player-left', damage: 100 },
    { fighterId: 'player-right', damage: 100 },
    { fighterId: 'enemy-left', damage: 100 },
    { fighterId: 'enemy-right', damage: 100 },
  ]);
  assert.equal(evaluation.result, MatchResult.DRAW);

  harness.room.onLeave(harness.clientB);
  const waiting = harness.snapshot();
  assert.equal(waiting.gameState, GameState.WAITING);
  assert.equal(waiting.result, MatchResult.PLAYING);
  assert.ok(waiting.fighters.every(({ hp, state }) => hp === 100 && state === FighterState.NORMAL));
});
