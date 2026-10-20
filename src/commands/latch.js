const { SlashCommandBuilder } = require('discord.js');
const askLatch = require('../utils/askLatch');
const latchLimiter = require('../utils/latchLimiter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('latch')
    .setDescription('Ask Latch, the balisong AI, anything about balisongs.')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('What do you want to ask?')
        .setRequired(true)
        .setMaxLength(1500)
    ),

  async execute(interaction) {
    const limitReached = latchLimiter.acquire(interaction.guildId ?? `user-${interaction.user.id}`);
    if (limitReached) {
      await interaction.reply({ content: limitReached, ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await askLatch({
      sessionId: `discord-${interaction.channelId}-${interaction.user.id}`,
      question: interaction.options.getString('question'),
      firstMessage: { edit: content => interaction.editReply(content) },
      sendFollowUp: content => interaction.followUp(content)
    });
  }
};
