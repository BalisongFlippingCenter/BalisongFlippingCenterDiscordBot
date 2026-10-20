const tricks = require('../content/tricks');

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const MID_COUNTS = { beginner: [1, 2], intermediate: [2, 3], advanced: [3, 4] };
const ATTEMPTS = 20;

const rankOf = level => LEVELS.indexOf(level);
const pick = list => list[Math.floor(Math.random() * list.length)];

function movesAt(trick, rank) {
  return (trick.variants ?? [null])
    .map(variant => {
      const [name, level] = variant?.split(':') ?? [];
      return { trick, variant: name ?? null, level: level ?? trick.level };
    })
    .filter(move => rankOf(move.level) <= rank);
}

function draw(role, rank, used) {
  const candidates = tricks.filter(trick =>
    trick.roles.includes(role) && !used.has(trick.name) && !used.has(trick.family) && movesAt(trick, rank).length);
  if (!candidates.length) return null;

  const trick = pick(candidates);
  used.add(trick.name);
  if (trick.family) used.add(trick.family);
  return pick(movesAt(trick, rank));
}

function generateCombo(level) {
  const rank = rankOf(level);
  const [min, max] = MID_COUNTS[level];
  let combo;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const used = new Set();
    const midCount = min + Math.floor(Math.random() * (max - min + 1));
    combo = [
      draw('opener', rank, used),
      ...Array.from({ length: midCount }, () => draw('mid', rank, used)),
      draw('closer', rank, used)
    ].filter(Boolean);
    if (combo.some(move => move.level === level)) break;
  }
  return combo;
}

function formatCombo(combo) {
  return combo
    .map((move, i) => `${i + 1}. **${move.trick.name}**${move.variant ? ` (${move.variant})` : ''} · ${move.level}`)
    .join('\n') + '\n-# Hit these tricks in order — add any transitions you need to link them.';
}

const levelChoices = Object.keys(MID_COUNTS).map(level => ({ name: level[0].toUpperCase() + level.slice(1), value: level }));

module.exports = { generateCombo, formatCombo, levelChoices };
