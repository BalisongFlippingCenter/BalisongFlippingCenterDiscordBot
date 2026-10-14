const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const pendingSubmissions = require('../utils/pendingSubmissions');
const startBugReport = require('../utils/startBugReport');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // Slash command trigger
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }

    // Button click → prompt for image first
    if (interaction.isButton() && interaction.customId === 'openSubmitModal') {
      await startBugReport(interaction);
    }

    // Button click → open text modal (after image has been uploaded)
    if (interaction.isButton() && interaction.customId === 'openTextModal') {
      const pending = pendingSubmissions.get(interaction.user.id);

      if (!pending || pending.stage !== 'awaitingText') {
        await interaction.reply({ content: '❌ No image found. Please start over.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('submissionModal')
        .setTitle('Submit Bug/Issue');

      const textInput = new TextInputBuilder()
        .setCustomId('submissionText')
        .setLabel('Describe the bug or issue you found')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(textInput));
      await interaction.showModal(modal);

      // Delete the button message to keep channel clean
      await interaction.message.delete().catch(() => {});
    }

    // Modal submitted → bundle text + image and post
    if (interaction.isModalSubmit() && interaction.customId === 'submissionModal') {
      const text = interaction.fields.getTextInputValue('submissionText');
      const pending = pendingSubmissions.get(interaction.user.id);

      if (!pending?.image) {
        await interaction.reply({ content: '❌ Something went wrong. Please start over.', ephemeral: true });
        return;
      }

      pendingSubmissions.delete(interaction.user.id);

      const submissionsChannel = interaction.guild.channels.cache.get(process.env.BUG_SUBMISSIONS_CHANNEL_ID);
      if (!submissionsChannel) return;

      await submissionsChannel.send({
        content: `**New bug report from ${interaction.user.tag}**\n\n${text}`,
        files: [pending.image],
        allowedMentions: { parse: [] }
      });

      await interaction.reply({ content: '✅ Bug report received — thanks!', ephemeral: true });
    }
  }
};
