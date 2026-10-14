const { SlashCommandBuilder } = require('discord.js');
const askLatch = require('../utils/askLatch');
const latchLimiter = require('../utils/latchLimiter');

const LIMIT_REACHED = "⏳ Latch has hit this server's hourly question limit — try again a bit later.";

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

  LIMIT_REACHED,

  async execute(interaction) {
    if (!latchLimiter.tryAcquire(interaction.guildId ?? `user-${interaction.user.id}`)) {
      await interaction.reply({ content: LIMIT_REACHED, ephemeral: true });
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
