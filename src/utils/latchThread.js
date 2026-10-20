const askLatch = require('./askLatch');
const { threadName } = require('./threads');

const NO_PINGS = { parse: [] };
const LATCH_THREAD_ARCHIVE_MINUTES = 1440;

module.exports = async ({ starterMessage, userId, question }) => {
  const thread = await starterMessage.startThread({ name: threadName(question), autoArchiveDuration: LATCH_THREAD_ARCHIVE_MINUTES });
  await thread.members.add(userId);
  const firstMessage = await thread.send({ content: '…', allowedMentions: NO_PINGS });
  await askLatch({
    sessionId: `discord-${thread.id}-${userId}`,
    question,
    firstMessage,
    sendFollowUp: content => thread.send(content)
  });
  await thread.send({ content: '-# Mention me in this thread to follow up — I remember the conversation here.', allowedMentions: NO_PINGS });
};
