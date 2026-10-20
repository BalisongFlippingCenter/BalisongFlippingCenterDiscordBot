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
        '`/compare knife1:... knife2:...` — two balisongs side by side',
        '`/recommend` — find knives by budget, pivot, and handle material',
        '`/learn topic:...` — quick explainers on balisong basics',
        '`/trick info|random` — look up a trick, or get a random one to work on',
        '`/trick-of-the-day` — the same trick for everyone today; post your landing',
        '`/combo level:...` — a random combo for your skill level; land it and upload your clip to prove it',
        '`/balidare combo|video user:...` — dare someone to land a combo or match your clip; they answer with a video',
        '`/bali` — a game of B.A.L.I.: miss a trick, earn a letter',
        '`/quiz` — a quick balisong quiz for the channel: 5 questions, 20 seconds each, with a leaderboard',
        '-# **Admins:** limit any command to specific channels or roles in *Server Settings → Integrations → Balisong Flipping Center Bot* — e.g. games in one channel, Latch in another. Latch answers and B.A.L.I. games open their own threads to keep chats tidy.'
      ].join('\n\n'))
      .setFooter({ text: 'Powered by Balisong Flipping Center' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
