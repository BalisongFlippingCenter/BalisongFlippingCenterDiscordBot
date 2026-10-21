const { wrongChannel } = require('../utils/channelRules');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    const isComponent = interaction.isButton() || interaction.isModalSubmit();
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete() && !isComponent) return;

    const commandName = isComponent ? interaction.customId.split(':')[0] : interaction.commandName;
    const command = interaction.client.commands.get(commandName);
    if (!command) return;

    try {
      const pointer = interaction.isChatInputCommand() && command.channelRule && wrongChannel(command.channelRule, interaction);
      if (pointer) {
        await interaction.reply({ content: pointer, ephemeral: true });
        return;
      }

      if (interaction.isAutocomplete()) {
        await command.autocomplete(interaction);
      } else if (interaction.isButton()) {
        await command.button(interaction);
      } else if (interaction.isModalSubmit()) {
        await command.modalSubmit(interaction);
      } else {
        await command.execute(interaction);
      }
    } catch (error) {
      console.error(`/${commandName} failed:`, error);
      if (interaction.isAutocomplete()) return;
      const reply = { content: '⚠️ Something went wrong running that command. Try again in a moment.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  }
};
