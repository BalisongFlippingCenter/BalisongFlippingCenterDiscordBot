process.env.DB_PATH = ':memory:';

const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const interactionCreate = require('../src/events/interactionCreate');
const askLatch = require('../src/utils/askLatch');

let logged;
beforeEach(() => {
  logged = [];
  mock.method(console, 'log', line => logged.push(JSON.parse(line)));
  mock.method(console, 'error', () => {});
});
afterEach(() => mock.restoreAll());

function slashCommand(execute, extra = {}) {
  return {
    commandName: 'quiz',
    guildId: 'g1',
    options: { getSubcommand: () => null },
    client: { commands: new Map([['quiz', { execute }]]) },
    isButton: () => false,
    isModalSubmit: () => false,
    isAutocomplete: () => false,
    isChatInputCommand: () => true,
    reply: async () => {},
    ...extra
  };
}

test('every slash command logs one usage line with its result', async () => {
  await interactionCreate.execute(slashCommand(async () => {}));
  await interactionCreate.execute(slashCommand(async () => { throw new Error('boom'); }));

  assert.deepEqual(logged.map(({ event, name, guild, result }) => ({ event, name, guild, result })), [
    { event: 'command', name: 'quiz', guild: 'g1', result: 'ok' },
    { event: 'command', name: 'quiz', guild: 'g1', result: 'error' }
  ]);
  assert.equal(typeof logged[0].ms, 'number');
});

test('buttons log their action, and DMs log as dm', async () => {
  const interaction = slashCommand(null, {
    customId: 'quiz:answer:0:2',
    guildId: null,
    isButton: () => true,
    isChatInputCommand: () => false,
    client: { commands: new Map([['quiz', { button: async () => {} }]]) }
  });
  await interactionCreate.execute(interaction);
  assert.deepEqual(logged[0], { ...logged[0], event: 'button', name: 'quiz', action: 'answer', guild: 'dm', result: 'ok' });
});

test('Latch calls log their status and outcome', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('busy', { status: 429 }));
  await askLatch({ sessionId: 's1', question: 'q', firstMessage: { edit: async () => {} }, sendFollowUp: null });
  assert.deepEqual(logged[0], { ...logged[0], event: 'latch', status: 429, result: 'error', chars: 0 });
});
