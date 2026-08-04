const test = require('node:test');
const assert = require('node:assert/strict');
const { getCombatServerUrl } = require('../dist/networkConfig.js');

const development = { pageProtocol: 'http:', pageHost: 'localhost:5173', isDevelopment: true };
const production = { pageProtocol: 'https:', pageHost: 'game.example.com', isDevelopment: false };

test('development uses the local server when no URL is configured', () => {
  assert.equal(getCombatServerUrl('', development), 'ws://localhost:2567');
});

test('production uses and normalizes the configured server URL', () => {
  assert.equal(
    getCombatServerUrl('https://server.example.com/', production),
    'wss://server.example.com',
  );
});

test('HTTPS pages upgrade ws to wss and remove a trailing slash', () => {
  assert.equal(
    getCombatServerUrl('ws://server.example.com/', production),
    'wss://server.example.com',
  );
});

test('invalid or empty production URLs fall back to the current secure origin', () => {
  assert.equal(getCombatServerUrl('not a url', production), 'wss://game.example.com');
  assert.equal(getCombatServerUrl(' ', production), 'wss://game.example.com');
});
