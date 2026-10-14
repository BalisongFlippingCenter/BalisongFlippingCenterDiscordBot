const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = async (client) => {
  const channel = await client.channels.fetch(process.env.BUG_REPORTS_CHANNEL_ID);
  if (!channel) return console.error('Submit channel not found');

  // Clear old messages so there's never a duplicate button
  const messages = await channel.messages.fetch({ limit: 10 });
  await channel.bulkDelete(messages);

  const embed = new EmbedBuilder()
    .setTitle('📬 Submit Your Bug/Issue')
    .setDescription('Click the button below so submit your bug/issue then add your images!')
    .setColor(0x5865F2);

  const button = new ButtonBuilder()
    .setCustomId('openSubmitModal')
    .setLabel('Start Submit')
    .setStyle(ButtonStyle.Primary);

  await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  });

  console.log('Submit message posted.');
};