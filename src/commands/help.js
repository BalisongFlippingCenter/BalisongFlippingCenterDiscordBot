const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('What this bot can do.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Balisong Bot')
      .setDescription([
        '**Ask Latch** — the balisong AI. Use `/latch question:...` or just @mention me with your question. Latch knows the knife catalog and can search the web for newer info. It remembers your conversation in each channel for a while, so follow-ups work. Use `/latch-reset` to start over.',
        '`/knife name:...` — specs, versions, and pricing for a balisong',
        '`/maker name:...` — a maker and their knives',
        '`/learn topic:...` — quick explainers on balisong basics'
      ].join('\n\n'))
      .setFooter({ text: 'Powered by Balisong Flipping Center' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
