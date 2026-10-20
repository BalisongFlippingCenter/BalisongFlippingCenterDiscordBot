const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bfcApi = require('../utils/bfcApi');
const { formatEnum, currentVersion, findKnife, respondWithKnives } = require('../utils/catalogFormat');

function specColumn(knife) {
  const current = currentVersion(knife);
  const lines = [
    `[View in catalog](${bfcApi.siteUrl(`/product-world/knife/${knife.slug}`)})`,
    `**Version:** ${current.versionLabel}${current.releaseYear ? ` (${current.releaseYear})` : ''}`,
    `**Price:** ${knife.priceRangeSummary}`,
    `**Length:** ${current.overallLength}"`,
    `**Weight:** ${current.weight} oz`,
    `**Pivot:** ${formatEnum(current.pivotSystem) ?? '—'}`,
    `**Pins:** ${formatEnum(current.pinSystem) ?? '—'}`,
    `**Latch:** ${formatEnum(current.latchType) ?? '—'}`,
    `**Handles:** ${[formatEnum(current.handleConstruction), formatEnum(current.handleMaterial)].filter(Boolean).join(', ') || '—'}`
  ];
  return { name: `${knife.name} — ${knife.makerName}`.slice(0, 256), value: lines.join('\n'), inline: true };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Compare two balisongs side by side.')
    .addStringOption(option => option.setName('knife1').setDescription('First knife').setRequired(true).setAutocomplete(true))
    .addStringOption(option => option.setName('knife2').setDescription('Second knife').setRequired(true).setAutocomplete(true)),

  autocomplete: respondWithKnives,

  async execute(interaction) {
    const inputs = [interaction.options.getString('knife1'), interaction.options.getString('knife2')];
    await interaction.deferReply();

    const knives = await Promise.all(inputs.map(findKnife));
    const missing = inputs.filter((_, i) => !knives[i]);
    if (missing.length) {
      await interaction.editReply(`Couldn't find ${missing.map(name => `**${name}**`).join(' or ')} in the catalog.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${knives[0].name} vs ${knives[1].name}`)
      .addFields(specColumn(knives[0]), specColumn(knives[1]))
      .setFooter({ text: 'Current versions · specs from the Balisong Flipping Center catalog' });
    await interaction.editReply({ embeds: [embed] });
  }
};
