const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bfcApi = require('../utils/bfcApi');

const EMBED_COLOR = 0x5865F2;

function buildMakerEmbed(maker) {
  const facts = [maker.country, maker.foundedYear && `Founded ${maker.foundedYear}`].filter(Boolean).join(' · ');
  const links = [
    maker.officialSiteUrl && `[Website](${maker.officialSiteUrl})`,
    maker.instagramUrl && `[Instagram](${maker.instagramUrl})`,
    maker.youtubeUrl && `[YouTube](${maker.youtubeUrl})`
  ].filter(Boolean).join(' · ');

  const knifeLines = maker.knives.map(knife =>
    `**${knife.name}** — ${knife.priceRangeSummary}`
  );
  let knivesValue = '';
  for (const [i, line] of knifeLines.entries()) {
    const remaining = knifeLines.length - i;
    if (knivesValue.length + line.length + 30 > 1024) {
      knivesValue += `…and ${remaining} more`;
      break;
    }
    knivesValue += `${line}\n`;
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(maker.name)
    .setURL(bfcApi.siteUrl(`/product-world/maker/${maker.slug}`))
    .setDescription([facts, maker.knownFor].filter(Boolean).join('\n\n') || null)
    .setFooter({ text: 'From the Balisong Flipping Center catalog' });

  if (knivesValue) embed.addFields({ name: `Knives (${maker.knives.length})`, value: knivesValue });
  if (links) embed.addFields({ name: 'Links', value: links });
  return embed;
}

function matchesQuery(maker, query) {
  const needle = query.toLowerCase();
  return maker.name.toLowerCase().includes(needle) || maker.slug.includes(needle);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maker')
    .setDescription('Look up a balisong maker and their knives.')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Maker name, e.g. Squid Industries')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const query = interaction.options.getFocused();
    const makers = await bfcApi.listMakers();
    await interaction.respond(
      makers.filter(maker => matchesQuery(maker, query)).slice(0, 25).map(maker => ({ name: maker.name, value: maker.slug }))
    );
  },

  async execute(interaction) {
    const input = interaction.options.getString('name');
    await interaction.deferReply();

    let maker = await bfcApi.getMaker(input);
    if (!maker) {
      const match = (await bfcApi.listMakers()).find(m => matchesQuery(m, input));
      maker = match && await bfcApi.getMaker(match.slug);
    }
    if (!maker) {
      await interaction.editReply(`Couldn't find **${input}** in the catalog. Try \`/latch\` — it can search the web too.`);
      return;
    }

    await interaction.editReply({ embeds: [buildMakerEmbed(maker)] });
  }
};
