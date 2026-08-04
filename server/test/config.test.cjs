const test = require('node:test');
const assert = require('node:assert/strict');
const { isOriginAllowed, isSpikeRoomEnabled, parseAllowedOrigins } = require('../dist/config.js');

test('origin parser trims, normalizes, removes blanks and duplicates', () => {
  assert.deepEqual(
    parseAllowedOrigins(' https://a.example.com/, ,https://b.example.com,https://a.example.com '),
    ['https://a.example.com', 'https://b.example.com'],
  );
});

test('development has local defaults while production fails closed', () => {
  assert.deepEqual(parseAllowedOrigins('', 'development'), [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  assert.deepEqual(parseAllowedOrigins('', 'production'), []);
});

test('origin matching is exact after trailing-slash normalization', () => {
  const allowed = ['https://game.example.com'];
  assert.equal(isOriginAllowed('https://game.example.com/', allowed, 'production'), true);
  assert.equal(isOriginAllowed('https://evil.example.com', allowed, 'production'), false);
  assert.equal(isOriginAllowed(undefined, allowed, 'production'), false);
});

test('spike room is opt-in and cannot be enabled in production', () => {
  assert.equal(isSpikeRoomEnabled({}), false);
  assert.equal(isSpikeRoomEnabled({ NODE_ENV: 'development', ENABLE_SPIKE_ROOM: 'true' }), true);
  assert.equal(isSpikeRoomEnabled({ NODE_ENV: 'production', ENABLE_SPIKE_ROOM: 'true' }), false);
});
