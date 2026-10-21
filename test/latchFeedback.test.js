process.env.DB_PATH = ':memory:';

const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const latchFeedback = require('../src/utils/latchFeedback');
const askLatch = require('../src/utils/askLatch');

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => db.exec('DELETE FROM latch_feedback; DELETE FROM latch_answers;'));
afterEach(() => mock.restoreAll());

function fakeMessage() {
  const edits = [];
  return { edits, edit: async payload => edits.push(payload) };
}

test('each person gets one vote per answer, and can change it', () => {
  const id = latchFeedback.recordAnswer('s1', 'q', 'a');
  latchFeedback.rate(id, 'u1', 1);
  latchFeedback.rate(id, 'u2', 1);
  latchFeedback.rate(id, 'u1', -1);
  const [rated] = latchFeedback.ratedAnswers();
  assert.equal(rated.up, 1);
  assert.equal(rated.down, 1);
});

test('rating an answer that no longer exists is refused', () => {
  assert.equal(latchFeedback.rate(999, 'u1', 1), false);
});

test('unrated answers are pruned after 30 days, rated ones are kept', () => {
  const old = new Date(Date.now() - 31 * DAY_MS);
  const rated = latchFeedback.recordAnswer('s1', 'rated', 'a', old);
  latchFeedback.recordAnswer('s1', 'unrated', 'a', old);
  latchFeedback.rate(rated, 'u1', -1);
  latchFeedback.recordAnswer('s1', 'new', 'a');
  const questions = db.prepare('SELECT question FROM latch_answers ORDER BY id').all().map(row => row.question);
  assert.deepEqual(questions, ['rated', 'new']);
});

test('rated answers come back worst first', () => {
  const good = latchFeedback.recordAnswer('s1', 'good', 'a');
  const bad = latchFeedback.recordAnswer('s1', 'bad', 'a');
  latchFeedback.rate(good, 'u1', 1);
  latchFeedback.rate(bad, 'u1', -1);
  assert.deepEqual(latchFeedback.ratedAnswers().map(answer => answer.question), ['bad', 'good']);
});

test('a finished answer is stored and gets rating buttons', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('Use a **washer** pivot.'));
  const message = fakeMessage();
  await askLatch({ sessionId: 's1', question: 'pivot?', firstMessage: message, sendFollowUp: null });

  const last = message.edits.at(-1);
  assert.equal(last.content, 'Use a **washer** pivot.');
  const [up, down] = last.components[0].toJSON().components;
  const [stored] = db.prepare('SELECT * FROM latch_answers').all();
  assert.equal(up.custom_id, `latch:up:${stored.id}`);
  assert.equal(down.custom_id, `latch:down:${stored.id}`);
  assert.equal(stored.question, 'pivot?');
});

test('a long answer gets its buttons on the last message only', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(`${'a'.repeat(1990)}\n${'b'.repeat(50)}`));
  const first = fakeMessage();
  const followUp = fakeMessage();
  await askLatch({ sessionId: 's1', question: 'q', firstMessage: first, sendFollowUp: async () => followUp });

  assert.ok(first.edits.every(edit => !edit.components));
  assert.ok(followUp.edits.at(-1).components);
});

test('failed answers get no buttons and are not stored', async () => {
  mock.method(console, 'error', () => {});
  mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 500 }));
  const message = fakeMessage();
  await askLatch({ sessionId: 's1', question: 'q', firstMessage: message, sendFollowUp: null });

  assert.ok(message.edits.every(edit => !edit.components));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM latch_answers').get().n, 0);
});
