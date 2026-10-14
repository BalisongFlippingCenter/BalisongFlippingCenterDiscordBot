const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bfcApi = require('../utils/bfcApi');

const EMBED_COLOR = 0x5865F2;
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

function describeVariant(variant) {
  const detail = variant.type === 'TRAINER'
    ? (variant.trainerBlade === 'FALSE_EDGE' ? 'false edge' : null)
    : formatEnum(variant.bladeMaterial);
  return `${variant.label}${detail ? ` · ${detail}` : ''} — ${formatPrice(variant.msrp)}`;
}

function buildKnifeEmbed(knife) {
  const versions = [...knife.versions].sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
  const current = versions.find(version => !version.discontinued) ?? versions[0];
  const description = current.description ?? knife.description ?? '';

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`${knife.name} — ${knife.makerName}`)
    .setURL(bfcApi.siteUrl(`/product-world/knife/${knife.slug}`))
    .setDescription(description.length > 600 ? `${description.slice(0, 597)}…` : description || null)
    .addFields(
      { name: 'Version', value: `${current.versionLabel}${current.releaseYear ? ` (${current.releaseYear})` : ''}${current.discontinued ? ' — discontinued' : ''}`, inline: true },
      { name: 'Length / Weight', value: `${current.overallLength}" / ${current.weight} oz`, inline: true },
      { name: 'Pivot', value: formatEnum(current.pivotSystem) ?? '—', inline: true },
      { name: 'Pins', value: formatEnum(current.pinSystem) ?? '—', inline: true },
      { name: 'Latch', value: formatEnum(current.latchType) ?? '—', inline: true },
      { name: 'Handles', value: [formatEnum(current.handleConstruction), formatEnum(current.handleMaterial), formatEnum(current.handleFinish)].filter(Boolean).join(', ') || '—', inline: true },
      { name: 'Variants', value: current.variants.map(describeVariant).join('\n') || '—' }
    )
    .setFooter({ text: 'Specs from the Balisong Flipping Center catalog' });

  const otherVersions = versions.filter(version => version !== current);
  if (otherVersions.length) {
    embed.addFields({
      name: 'Other versions',
      value: otherVersions.map(v => `${v.versionLabel}${v.releaseYear ? ` (${v.releaseYear})` : ''}${v.discontinued ? ' — discontinued' : ''}`).join('\n')
    });
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('knife')
    .setDescription('Look up a balisong\'s specs, versions, and pricing.')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Knife name, e.g. Krake Raken')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const knives = await bfcApi.searchKnives(interaction.options.getFocused());
    await interaction.respond(
      knives.slice(0, 25).map(knife => ({ name: `${knife.name} — ${knife.makerName}`.slice(0, 100), value: knife.slug }))
    );
  },

  async execute(interaction) {
    const input = interaction.options.getString('name');
    await interaction.deferReply();

    let knife = await bfcApi.getKnife(input);
    if (!knife) {
      const [match] = await bfcApi.searchKnives(input);
      knife = match && await bfcApi.getKnife(match.slug);
    }
    if (!knife) {
      await interaction.editReply(`Couldn't find **${input}** in the catalog. Try \`/latch\` — it can search the web too.`);
      return;
    }

    await interaction.editReply({ embeds: [buildKnifeEmbed(knife)] });
  }
};
