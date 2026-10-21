const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const HOUR_MS = 60 * 60 * 1000;
let limiter;

beforeEach(() => {
  process.env.LATCH_LIMIT_PER_SERVER_PER_HOUR = '2';
  process.env.LATCH_LIMIT_GLOBAL_PER_DAY = '3';
  mock.timers.enable({ apis: ['Date'], now: 0 });
  delete require.cache[require.resolve('../src/utils/latchLimiter')];
  limiter = require('../src/utils/latchLimiter');
});

afterEach(() => mock.timers.reset());

test('a server is limited per hour, and others are unaffected', () => {
  assert.equal(limiter.acquire('server-a'), null);
  assert.equal(limiter.acquire('server-a'), null);
  assert.match(limiter.acquire('server-a'), /server's hourly/);
  assert.equal(limiter.acquire('server-b'), null);
});

test('the hourly window slides', () => {
  process.env.LATCH_LIMIT_GLOBAL_PER_DAY = '10';
  limiter.acquire('server-a');
  mock.timers.tick(HOUR_MS / 2);
  limiter.acquire('server-a');
  mock.timers.tick(HOUR_MS / 2);
  assert.equal(limiter.acquire('server-a'), null);
  assert.match(limiter.acquire('server-a'), /server's hourly/);
});

test('the daily limit applies across every server', () => {
  limiter.acquire('server-a');
  limiter.acquire('server-b');
  limiter.acquire('server-c');
  assert.match(limiter.acquire('server-d'), /daily/);
  mock.timers.tick(24 * HOUR_MS);
  assert.equal(limiter.acquire('server-d'), null);
});

test('refused requests do not use up the limit', () => {
  limiter.acquire('server-a');
  limiter.acquire('server-a');
  limiter.acquire('server-a');
  assert.equal(limiter.acquire('server-b'), null);
});
