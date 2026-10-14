const askLatch = require('../utils/askLatch');
const latchLimiter = require('../utils/latchLimiter');
const { LIMIT_REACHED } = require('../commands/latch');

const NO_PINGS = { parse: [] };

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.mentions.users.has(message.client.user.id)) return;

    const question = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!question) {
      await message.reply({ content: 'Ask me anything about balisongs — or try `/help`.', allowedMentions: NO_PINGS });
      return;
    }

    if (!latchLimiter.tryAcquire(message.guildId ?? `user-${message.author.id}`)) {
      await message.reply({ content: LIMIT_REACHED, allowedMentions: NO_PINGS });
      return;
    }

    await message.channel.sendTyping();
    const firstMessage = await message.reply({ content: '…', allowedMentions: NO_PINGS });
    await askLatch({
      sessionId: `discord-${message.channelId}-${message.author.id}`,
      question,
      firstMessage,
      sendFollowUp: content => message.channel.send(content)
    });
  }
};
