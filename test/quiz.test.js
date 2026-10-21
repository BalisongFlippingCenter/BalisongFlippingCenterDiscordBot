const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildQuestion, shuffle } = require('../src/commands/quiz');

const knife = (slug, makerName, weight = 5) => ({ slug, name: slug, makerName, versions: [{ weight, overallLength: 9 }] });
const knives = [knife('a', 'Squid'), knife('b', 'BRS'), knife('c', 'Glidr'), knife('d', 'Krake'), knife('e', 'Squid')];

test('shuffle keeps every item and leaves the input untouched', () => {
  const input = [1, 2, 3, 4, 5];
  const output = shuffle(input);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual([...output].sort(), input);
});

test('the right answer lands on each letter about equally often', () => {
  const counts = [0, 0, 0, 0];
  const runs = 8000;
  for (let i = 0; i < runs; i++) counts[buildQuestion('maker', knives[0], {}, knives).answerIndex]++;
  for (const count of counts) assert.ok(Math.abs(count / runs - 0.25) < 0.03, `answer position counts ${counts}`);
});

test('choices are distinct and include the answer exactly once', () => {
  for (let i = 0; i < 200; i++) {
    const { choices, answerIndex } = buildQuestion('maker', knives[0], {}, knives);
    assert.equal(new Set(choices).size, choices.length);
    assert.equal(choices[answerIndex], 'Squid');
    assert.equal(choices.filter(choice => choice === 'Squid').length, 1);
  }
});

test('a question with no possible wrong answers is skipped', () => {
  const sameMaker = [knife('a', 'Squid'), knife('b', 'Squid')];
  assert.equal(buildQuestion('maker', sameMaker[0], {}, sameMaker), null);
});

test('numeric questions offer nearby positive values', () => {
  const { choices, answerIndex } = buildQuestion('weight', knife('a', 'Squid', 0.9), {}, knives);
  assert.equal(choices[answerIndex], '0.9 oz');
  assert.ok(choices.every(choice => parseFloat(choice) > 0));
});
