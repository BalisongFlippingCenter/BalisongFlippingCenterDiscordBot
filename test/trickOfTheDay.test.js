const { test } = require('node:test');
const assert = require('node:assert/strict');
const { todaysMove } = require('../src/commands/trick-of-the-day');
const { playableMoves, levelChoices } = require('../src/utils/comboGenerator');

const moveKey = move => `${move.trick.name}:${move.variant}`;
const dayString = day => new Date(day * 86400000).toISOString().slice(0, 10);

for (const level of [null, ...levelChoices.map(choice => choice.value)]) {
  test(`every ${level ?? 'any-level'} move appears once per cycle before any repeats`, () => {
    const pool = playableMoves().filter(move => !level || move.level === level);
    const firstDayOfCycle = Math.ceil(20000 / pool.length) * pool.length;
    const seen = new Set();
    for (let day = firstDayOfCycle; day < firstDayOfCycle + pool.length; day++) {
      seen.add(moveKey(todaysMove(level, dayString(day))));
    }
    assert.equal(seen.size, pool.length);
  });
}

test('the same day and level always give the same move', () => {
  assert.equal(moveKey(todaysMove('beginner', '2026-10-21')), moveKey(todaysMove('beginner', '2026-10-21')));
});

test('a level filter only returns moves at that level', () => {
  for (let day = 20000; day < 20060; day++) {
    assert.equal(todaysMove('advanced', dayString(day)).level, 'advanced');
  }
});
