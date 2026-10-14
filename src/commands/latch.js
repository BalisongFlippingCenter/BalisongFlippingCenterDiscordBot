const { SlashCommandBuilder } = require('discord.js');
const askLatch = require('../utils/askLatch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('latch')
    .setDescription('Ask Latch, the Balisong Flipping Center AI, a question.')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('What do you want to ask?')
        .setRequired(true)
        .setMaxLength(1500)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    await interaction.deferReply();

    await askLatch({
      sessionId: `discord-${interaction.channelId}-${interaction.user.id}`,
      question,
      firstMessage: { edit: content => interaction.editReply(content) },
      sendFollowUp: content => interaction.followUp(content)
    });
  }
};
