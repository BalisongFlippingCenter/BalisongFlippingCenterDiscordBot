const tricks = require('../content/tricks');

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const MID_COUNTS = { beginner: [1, 2], intermediate: [2, 3], advanced: [3, 4], expert: [4, 5] };

const pick = list => list[Math.floor(Math.random() * list.length)];

function generateCombo(level) {
  const rank = LEVELS.indexOf(level);
  const pool = tricks.filter(trick => LEVELS.indexOf(trick.level) <= rank);
  const openers = pool.filter(trick => trick.role === 'opener');
  const closers = pool.filter(trick => trick.role === 'closer');
  const mids = pool.filter(trick => trick.role !== 'opener' && trick.role !== 'closer');

  const [min, max] = MID_COUNTS[level];
  const midCount = min + Math.floor(Math.random() * (max - min + 1));
  const middle = [...mids].sort(() => Math.random() - 0.5).slice(0, midCount);

  const unusedAtLevel = mids.filter(trick => trick.level === level && !middle.includes(trick));
  if (!middle.some(trick => trick.level === level) && unusedAtLevel.length) {
    middle[Math.floor(Math.random() * middle.length)] = pick(unusedAtLevel);
  }

  return [openers.length && pick(openers), ...middle, closers.length && pick(closers)].filter(Boolean);
}

function formatCombo(combo) {
  return combo.map((trick, i) => `${i + 1}. **${trick.name}** · ${trick.level}`).join('\n');
}

const levelChoices = LEVELS.map(level => ({ name: level[0].toUpperCase() + level.slice(1), value: level }));

module.exports = { generateCombo, formatCombo, levelChoices };
