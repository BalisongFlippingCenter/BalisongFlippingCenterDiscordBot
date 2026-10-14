const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const learnTopics = require('../content/learnTopics');
const bfcApi = require('../utils/bfcApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('learn')
    .setDescription('Quick explainers on balisong basics.')
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('What do you want to learn about?')
        .setRequired(true)
        .addChoices(...learnTopics.map(topic => ({ name: topic.name, value: topic.value })))
    ),

  async execute(interaction) {
    const topic = learnTopics.find(t => t.value === interaction.options.getString('topic'));
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(topic.name)
      .setDescription(topic.body.join('\n\n'));

    if (topic.learnSlug) {
      embed.setURL(bfcApi.siteUrl(`/learn/${topic.learnSlug}`))
        .setFooter({ text: 'Click the title for the full guide on Balisong Flipping Center' });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
