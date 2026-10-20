const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('latch-reset')
    .setDescription('Make Latch forget your conversation in this channel.'),

  async execute(interaction) {
    const sessionId = `discord-${interaction.channelId}-${interaction.user.id}`;
    const response = await fetch(`${process.env.BFC_API_BASE_URL}/ai/chat/session/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'X-Client-Id': 'discord',
        'X-Client-Key': process.env.AI_CLIENT_KEY_DISCORD
      }
    });

    if (!response.ok) {
      console.error(`Latch reset failed with ${response.status}:`, await response.text());
      await interaction.reply({ content: "⚠️ Couldn't reset Latch right now. Try again in a moment.", ephemeral: true });
      return;
    }

    await interaction.reply({ content: '🧹 Latch has forgotten your conversation in this channel — your next question starts fresh.', ephemeral: true });
  }
};
