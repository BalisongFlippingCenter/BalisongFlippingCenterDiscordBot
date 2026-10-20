const { ChannelType, PermissionFlagsBits } = require('discord.js');

const THREADABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const THREAD_PERMISSIONS = [PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads];

function canStartThread(channel, botPermissions) {
  return THREADABLE_CHANNELS.includes(channel?.type) && Boolean(botPermissions?.has(THREAD_PERMISSIONS));
}

function threadName(text) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 90 ? `${oneLine.slice(0, 89)}…` : oneLine;
}

module.exports = { canStartThread, threadName };
