const bfcApi = require('./bfcApi');

const SPECIAL_NAMES = {
  AEB_L: 'AEB-L',
  AUS_10: 'AUS-10',
  G_10: 'G10',
  G_10_TITANIUM: 'G10 / Titanium',
  G_10_ALUMINIUM: 'G10 / Aluminium',
  MAGNACUT: 'MagnaCut',
  CPVC: 'CPVC',
  HDPE: 'HDPE'
};

function formatEnum(value) {
  if (!value || value === 'UNKNOWN') return null;
  if (SPECIAL_NAMES[value]) return SPECIAL_NAMES[value];
  return value.replace(/^STEEL_/, '').split('_')
    .map(word => /\d/.test(word) ? word : word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function formatPrice(msrp) {
  return msrp.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: msrp % 1 ? 2 : 0 });
}

function sortedVersions(knife) {
  return [...knife.versions].sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
}

function currentVersion(knife) {
  const versions = sortedVersions(knife);
  return versions.find(version => !version.discontinued) ?? versions[0];
}

async function findKnife(input) {
  const knife = await bfcApi.getKnife(input);
  if (knife) return knife;
  const [match] = await bfcApi.searchKnives(input);
  return match ? bfcApi.getKnife(match.slug) : null;
}

async function respondWithKnives(interaction) {
  const knives = await bfcApi.searchKnives(interaction.options.getFocused());
  await interaction.respond(
    knives.slice(0, 25).map(knife => ({ name: `${knife.name} — ${knife.makerName}`.slice(0, 100), value: knife.slug }))
  );
}

module.exports = { formatEnum, formatPrice, sortedVersions, currentVersion, findKnife, respondWithKnives };
