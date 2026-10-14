const pendingSubmissions = require('./pendingSubmissions');

module.exports = async (interaction) => {
  pendingSubmissions.set(interaction.user.id, {
    stage: 'awaitingImage',
    channelId: interaction.channelId,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  await interaction.reply({
    content: '📎 Please upload a screenshot of the bug in this channel to continue your report.',
    ephemeral: true
  });
};
