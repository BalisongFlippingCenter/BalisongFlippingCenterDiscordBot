const { SlashCommandBuilder } = require('discord.js');
const askLatch = require('../utils/askLatch');
const askLatchInThread = require('../utils/latchThread');
const latchLimiter = require('../utils/latchLimiter');
const { canStartThread } = require('../utils/threads');
const { wrongChannel } = require('../utils/channelRules');
const latchFeedback = require('../utils/latchFeedback');

const NO_PINGS = { parse: [] };

async function ask(interaction, question) {
  const pointer = wrongChannel('latch', interaction);
  if (pointer) {
    await interaction.reply({ content: pointer, ephemeral: true });
    return;
  }

  const limitReached = latchLimiter.acquire(interaction.guildId ?? `user-${interaction.user.id}`);
  if (limitReached) {
    await interaction.reply({ content: limitReached, ephemeral: true });
    return;
  }

  if (canStartThread(interaction.channel, interaction.appPermissions)) {
    const quoted = question.length > 300 ? `${question.slice(0, 299)}…` : question;
    const response = await interaction.reply({ content: `💬 <@${interaction.user.id}> asked Latch:\n> ${quoted.replace(/\n/g, '\n> ')}`, allowedMentions: NO_PINGS, withResponse: true });
    await askLatchInThread({ starterMessage: response.resource.message, userId: interaction.user.id, question });
    return;
  }

  await interaction.deferReply();
  await askLatch({
    sessionId: `discord-${interaction.channelId}-${interaction.user.id}`,
    question,
    firstMessage: { edit: content => interaction.editReply(content) },
    sendFollowUp: content => interaction.followUp(content)
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('latch')
    .setDescription('Ask Latch, the balisong AI, anything about balisongs.')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('What do you want to ask?')
        .setRequired(true)
        .setMaxLength(1500)
    ),

  ask,

  async execute(interaction) {
    await ask(interaction, interaction.options.getString('question'));
  },

  async button(interaction) {
    const [, rating, answerId] = interaction.customId.split(':');
    const saved = latchFeedback.rate(Number(answerId), interaction.user.id, rating === 'up' ? 1 : -1);
    const thanks = rating === 'up' ? 'Thanks — glad it helped! 👍' : 'Thanks — this helps make Latch better. 👎';
    await interaction.reply({ content: saved ? thanks : 'This answer is too old to rate.', ephemeral: true });
  }
};
