const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pendingSubmissions = require('../utils/pendingSubmissions');
const askLatch = require('../utils/askLatch');

async function handleBugReportImage(message, pending) {
  if (Date.now() > pending.expiresAt) {
    pendingSubmissions.delete(message.author.id);
    return;
  }

  const image = message.attachments.find(a => a.contentType?.startsWith('image/'));
  if (!image) return;

  // Download before deleting — Discord stops serving attachments of deleted messages
  const response = await fetch(image.url);
  const imageData = Buffer.from(await response.arrayBuffer());

  await message.delete().catch(() => {});

  pendingSubmissions.set(message.author.id, {
    stage: 'awaitingText',
    image: { attachment: imageData, name: image.name },
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  // A modal needs an interaction, so send a button that opens it
  await message.channel.send({
    content: `<@${message.author.id}> Image received! Click below to describe the bug.`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('openTextModal')
          .setLabel('Add Description')
          .setStyle(ButtonStyle.Success)
      )
    ]
  });
}

async function handleLatchQuestion(message) {
  const question = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!question) {
    await message.reply({ content: 'Ask me anything about balisongs or Balisong Flipping Center!', allowedMentions: { parse: [] } });
    return;
  }

  await message.channel.sendTyping();
  const firstMessage = await message.reply({ content: '…', allowedMentions: { parse: [] } });

  await askLatch({
    sessionId: `discord-${message.channelId}-${message.author.id}`,
    question,
    firstMessage,
    sendFollowUp: content => message.channel.send(content)
  });
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    const pending = pendingSubmissions.get(message.author.id);
    if (pending?.stage === 'awaitingImage' && pending.channelId === message.channelId) {
      await handleBugReportImage(message, pending);
      return;
    }

    const isLatchChannel = message.channelId === process.env.LATCH_CHANNEL_ID;
    const mentionsBot = message.mentions.users.has(message.client.user.id);
    if (isLatchChannel || mentionsBot) {
      await handleLatchQuestion(message);
    }
  }
};
