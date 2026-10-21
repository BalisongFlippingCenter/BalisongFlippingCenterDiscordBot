const { wrongChannel } = require('../utils/channelRules');
const logUsage = require('../utils/usageLog');

function usageEvent(interaction) {
  if (interaction.isButton()) return 'button';
  if (interaction.isModalSubmit()) return 'modal';
  return 'command';
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    const isComponent = interaction.isButton() || interaction.isModalSubmit();
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete() && !isComponent) return;

    const commandName = isComponent ? interaction.customId.split(':')[0] : interaction.commandName;
    const command = interaction.client.commands.get(commandName);
    if (!command) return;

    const started = Date.now();
    let result = 'ok';
    try {
      const pointer = interaction.isChatInputCommand() && command.channelRule && wrongChannel(command.channelRule, interaction);
      if (pointer) {
        result = 'wrong_channel';
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
      result = 'error';
      console.error(`/${commandName} failed:`, error);
      if (interaction.isAutocomplete()) return;
      const reply = { content: '⚠️ Something went wrong running that command. Try again in a moment.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    } finally {
      if (!interaction.isAutocomplete()) {
        logUsage(usageEvent(interaction), {
          name: commandName,
          action: isComponent ? interaction.customId.split(':')[1] : interaction.options.getSubcommand(false) ?? undefined,
          guild: interaction.guildId ?? 'dm',
          ms: Date.now() - started,
          result
        });
      }
    }
  }
};
