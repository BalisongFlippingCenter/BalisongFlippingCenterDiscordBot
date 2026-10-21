const { test } = require('node:test');
const assert = require('node:assert/strict');
const { problemWith, apply } = require('../src/commands/bali');

function startedGame(...ids) {
  const game = { hostId: ids[0], players: [{ id: ids[0], letters: 0 }], phase: 'lobby' };
  for (const id of ids.slice(1)) apply(game, 'join', id);
  apply(game, 'start', ids[0]);
  return game;
}

function act(game, action, userId) {
  const problem = problemWith(game, action, userId);
  assert.equal(problem, null, problem);
  apply(game, action, userId);
}

test('only the host can start, and only with two or more players', () => {
  const game = { hostId: 'host', players: [{ id: 'host', letters: 0 }], phase: 'lobby' };
  assert.match(problemWith(game, 'start', 'host'), /at least 2/);
  apply(game, 'join', 'p2');
  assert.match(problemWith(game, 'start', 'p2'), /Only the host/);
  assert.equal(problemWith(game, 'start', 'host'), null);
});

test('a missed trick earns a letter and the setter moves on', () => {
  const game = startedGame('host', 'p2', 'p3');
  act(game, 'roll', 'host');
  act(game, 'landed', 'p2');
  act(game, 'missed', 'p3');
  assert.equal(game.players.find(p => p.id === 'p3').letters, 1);
  assert.equal(game.phase, 'setting');
  assert.equal(game.players[game.setter].id, 'p2');
});

test('the setter cannot answer their own trick and nobody answers twice', () => {
  const game = startedGame('host', 'p2', 'p3');
  act(game, 'roll', 'host');
  assert.match(problemWith(game, 'landed', 'host'), /You set this one/);
  act(game, 'landed', 'p2');
  assert.match(problemWith(game, 'missed', 'p2'), /already answered/);
});

test('spelling B-A-L-I knocks a player out and the last one standing wins', () => {
  const game = startedGame('host', 'p2');
  for (let round = 0; round < 4; round++) {
    const setter = game.players[game.setter].id;
    act(game, 'roll', setter);
    act(game, setter === 'host' ? 'missed' : 'landed', setter === 'host' ? 'p2' : 'host');
  }
  assert.equal(game.players.find(p => p.id === 'p2').letters, 2);
  while (game.phase !== 'over') {
    const setter = game.players[game.setter].id;
    act(game, 'roll', setter);
    act(game, 'missed', setter === 'host' ? 'p2' : 'host');
  }
  assert.ok(game.winner);
  assert.ok(game.players.some(p => p.letters >= 4));
});

test('skipping the rest counts pending players as missed', () => {
  const game = startedGame('host', 'p2', 'p3');
  act(game, 'roll', 'host');
  act(game, 'landed', 'p2');
  act(game, 'skip', 'host');
  assert.equal(game.players.find(p => p.id === 'p3').letters, 1);
  assert.equal(game.players.find(p => p.id === 'p2').letters, 0);
});

test('setters who are out get skipped', () => {
  const game = startedGame('host', 'p2', 'p3');
  game.players[1].letters = 4;
  act(game, 'roll', 'host');
  act(game, 'landed', 'p3');
  assert.equal(game.players[game.setter].id, 'p3');
});

test('shutdown marks active games as ended by a restart', async () => {
  const bali = require('../src/commands/bali');
  const edits = [];
  const interaction = {
    user: { id: 'host', displayName: 'Host' },
    channel: null,
    reply: async () => ({ resource: { message: { id: 'card-1' } } }),
    editReply: async card => edits.push(JSON.stringify(card))
  };
  await bali.execute(interaction);
  await bali.shutdown();
  assert.equal(edits.length, 1);
  assert.match(edits[0], /bot restarted/);
});
