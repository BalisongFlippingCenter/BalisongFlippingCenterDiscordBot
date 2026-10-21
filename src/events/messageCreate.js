const askLatch = require('../utils/askLatch');
const askLatchInThread = require('../utils/latchThread');
const latchLimiter = require('../utils/latchLimiter');
const { canStartThread } = require('../utils/threads');
const { wrongChannel } = require('../utils/channelRules');

const NO_PINGS = { parse: [] };

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.mentions.users.has(message.client.user.id)) return;
    if (wrongChannel('latch', message)) return;

    const question = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!question) {
      await message.reply({ content: 'Ask me anything about balisongs — or try `/help`.', allowedMentions: NO_PINGS });
      return;
    }

    const limitReached = latchLimiter.acquire(message.guildId ?? `user-${message.author.id}`);
    if (limitReached) {
      await message.reply({ content: limitReached, allowedMentions: NO_PINGS });
      return;
    }

    if (canStartThread(message.channel, message.guild && message.channel.permissionsFor(message.guild.members.me))) {
      await askLatchInThread({ starterMessage: message, userId: message.author.id, question });
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
