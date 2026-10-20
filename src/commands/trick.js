const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { allMovesOf, playableMoves, findTrick, searchTricks, levelChoices } = require('../utils/comboGenerator');
const { ask } = require('./latch');

const capitalize = word => word[0].toUpperCase() + word.slice(1);
const pick = list => list[Math.floor(Math.random() * list.length)];

function askLatchButton(trick, variant) {
  return new ButtonBuilder()
    .setCustomId(`trick:latch:${trick.name}:${variant ?? ''}`)
    .setLabel('Ask Latch how')
    .setEmoji('🤖')
    .setStyle(ButtonStyle.Primary);
}

function trickReply(trick, variant = null) {
  const variantsByLevel = new Map();
  for (const move of allMovesOf(trick).filter(move => move.variant)) {
    variantsByLevel.set(move.level, [...(variantsByLevel.get(move.level) ?? []), move.variant]);
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${trick.name}${variant ? ` (${variant})` : ''}`)
    .addFields(
      { name: 'Level', value: capitalize(trick.level), inline: true },
      { name: 'Used as', value: trick.roles.map(capitalize).join(' · '), inline: true }
    );
  if (variantsByLevel.size) {
    embed.addFields({ name: 'Variants', value: [...variantsByLevel].map(([level, names]) => `${names.join(', ')} · ${level}`).join('\n') });
  }
  if (trick.aliases?.length) embed.addFields({ name: 'Also called', value: trick.aliases.join(', ') });

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(askLatchButton(trick, variant))] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trick')
    .setDescription('Look up balisong tricks.')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Level, variants, and other names for a trick.')
        .addStringOption(option => option.setName('name').setDescription('Trick name, e.g. Zero G Chaplin').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub =>
      sub.setName('random')
        .setDescription('A random trick to work on.')
        .addStringOption(option => option.setName('level').setDescription('Only tricks at this level').addChoices(...levelChoices))
    ),

  askLatchButton,

  async autocomplete(interaction) {
    await interaction.respond(searchTricks(interaction.options.getFocused()).slice(0, 25).map(trick => ({ name: trick.name, value: trick.name })));
  },

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'random') {
      const level = interaction.options.getString('level');
      const move = pick(playableMoves().filter(move => !level || move.level === level));
      await interaction.reply(trickReply(move.trick, move.variant));
      return;
    }

    const input = interaction.options.getString('name');
    const trick = findTrick(input);
    if (!trick) {
      await interaction.reply({ content: `Couldn't find a trick called **${input}**. Try \`/latch\` — it can search the web too.`, ephemeral: true });
      return;
    }
    await interaction.reply(trickReply(trick));
  },

  async button(interaction) {
    const [, , name, variant] = interaction.customId.split(':');
    await ask(interaction, `How do I do the ${name}${variant ? ` (${variant} variant)` : ''} balisong trick? Walk me through it step by step.`);
  }
};
