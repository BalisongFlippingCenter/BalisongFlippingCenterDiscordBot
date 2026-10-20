const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bfcApi = require('../utils/bfcApi');

const MAX_RESULTS = 10;
const HANDLE_GROUPS = {
  titanium: { label: 'Titanium', keywords: ['titanium'] },
  aluminium: { label: 'Aluminium (any grade)', keywords: ['aluminium'] },
  g10: { label: 'G10', keywords: ['g 10', 'g10'] },
  plastic: { label: 'Plastic (any type)', keywords: ['plastic', 'cpvc', 'acetal', 'ultem', 'hdpe'] },
  steel: { label: 'Steel', keywords: ['steel'] },
  carbon: { label: 'Carbon fiber', keywords: ['carbon'] },
  brass: { label: 'Brass / Copper', keywords: ['brass', 'copper'] }
};

const lowestPrice = knife => Number(knife.priceRangeSummary.match(/\$([\d,.]+)/)?.[1].replace(/,/g, '') ?? Infinity);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recommend')
    .setDescription('Find balisongs in the catalog that match what you want.')
    .addNumberOption(option => option.setName('budget').setDescription('Max price in USD').setMinValue(1))
    .addStringOption(option =>
      option.setName('pivot').setDescription('Pivot system')
        .addChoices({ name: 'Bearings', value: 'BEARINGS' }, { name: 'Bushings', value: 'BUSHINGS' }, { name: 'Washers', value: 'WASHERS' })
    )
    .addStringOption(option =>
      option.setName('handle').setDescription('Handle material')
        .addChoices(...Object.entries(HANDLE_GROUPS).map(([value, group]) => ({ name: group.label, value })))
    ),

  async execute(interaction) {
    const budget = interaction.options.getNumber('budget');
    const pivot = interaction.options.getString('pivot');
    const handle = HANDLE_GROUPS[interaction.options.getString('handle')];
    await interaction.deferReply();

    const knives = (await bfcApi.filterKnives({ maxPrice: budget, pivotSystem: pivot }))
      .filter(knife => !handle || handle.keywords.some(word => knife.handleMaterialSummary?.toLowerCase().includes(word)))
      .sort((a, b) => lowestPrice(a) - lowestPrice(b));

    const filters = [
      budget && `under $${budget}`,
      pivot && pivot.toLowerCase(),
      handle && `${handle.label.toLowerCase()} handles`
    ].filter(Boolean);

    if (!knives.length) {
      await interaction.editReply(`Nothing in the catalog matches ${filters.join(', ')} yet — try loosening ${filters.length > 1 ? 'one of those' : 'that'}, or ask \`/latch\` to search the web.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(filters.length ? `Balisongs ${filters.join(', ')}` : 'Balisongs in the catalog')
      .setDescription(knives.slice(0, MAX_RESULTS)
        .map(knife => `[**${knife.name}**](${bfcApi.siteUrl(`/product-world/knife/${knife.slug}`)}) — ${knife.makerName} · ${knife.priceRangeSummary} · ${knife.handleMaterialSummary}`)
        .join('\n'))
      .setFooter({ text: `${knives.length > MAX_RESULTS ? `Showing the ${MAX_RESULTS} cheapest of ${knives.length} matches · ` : ''}From the Balisong Flipping Center catalog` });
    await interaction.editReply({ embeds: [embed] });
  }
};
