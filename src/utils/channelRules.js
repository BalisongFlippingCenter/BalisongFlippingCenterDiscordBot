const guildSettings = require('./guildSettings');

const POINTERS = {
  latch: channelId => `Latch lives in <#${channelId}> on this server.`,
  games: channelId => `Games go in <#${channelId}> on this server.`
};

function wrongChannel(kind, { guildId, channelId, channel }) {
  if (!guildId) return null;
  const allowed = guildSettings.get(guildId)?.[`${kind}_channel_id`];
  const effectiveChannelId = channel?.isThread() ? channel.parentId : channelId;
  return allowed && allowed !== effectiveChannelId ? POINTERS[kind](allowed) : null;
}

module.exports = { wrongChannel };
