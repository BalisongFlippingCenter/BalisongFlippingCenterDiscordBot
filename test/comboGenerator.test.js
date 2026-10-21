const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateCombo, playableMoves, findTrick, searchTricks, levelChoices } = require('../src/utils/comboGenerator');

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const rankOf = level => LEVELS.indexOf(level);

for (const { value: level } of levelChoices) {
  test(`${level} combos open, close, stay at or below the level, and include a move at it`, () => {
    for (let i = 0; i < 200; i++) {
      const combo = generateCombo(level);
      assert.ok(combo[0].trick.roles.includes('opener'));
      assert.ok(combo.at(-1).trick.roles.includes('closer'));
      for (const move of combo.slice(1, -1)) assert.ok(move.trick.roles.includes('mid'));
      assert.ok(combo.every(move => rankOf(move.level) <= rankOf(level)));
      assert.ok(combo.some(move => move.level === level));
    }
  });

  test(`${level} combos never repeat a trick or a trick family`, () => {
    for (let i = 0; i < 200; i++) {
      const combo = generateCombo(level);
      assert.equal(new Set(combo.map(move => move.trick.name)).size, combo.length);
      const families = combo.map(move => move.trick.family).filter(Boolean);
      assert.equal(new Set(families).size, families.length);
    }
  });
}

test('variant level overrides apply to the variant, not the whole trick', () => {
  const chaplinMoves = playableMoves().filter(move => move.trick.name === 'Chaplin');
  assert.equal(chaplinMoves.find(move => move.variant === 'index').level, 'beginner');
  assert.equal(chaplinMoves.find(move => move.variant === 'ring').level, 'intermediate');
});

test('playable moves leave out levels that cannot be selected', () => {
  const selectable = levelChoices.map(choice => choice.value);
  assert.ok(playableMoves().every(move => selectable.includes(move.level)));
});

test('findTrick prefers exact names and aliases over partial matches', () => {
  assert.equal(findTrick('chaplin').name, 'Chaplin');
  assert.equal(findTrick('DR').name, 'Double Rollout');
  assert.equal(findTrick('  zero g chap ').name, 'Zero G Chaplin');
  assert.equal(findTrick('not a real trick'), undefined);
});

test('searchTricks matches aliases', () => {
  assert.ok(searchTricks('basic aerial').some(trick => trick.name === 'Aerial'));
});
