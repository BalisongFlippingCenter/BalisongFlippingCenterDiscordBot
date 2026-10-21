const guildSettings = require('../utils/guildSettings');
const logUsage = require('../utils/usageLog');

module.exports = {
  name: 'guildDelete',
  async execute(guild) {
    if (!guild.available) return;
    guildSettings.forget(guild.id);
    logUsage('server_left', { guild: guild.id, servers: guild.client.guilds.cache.size });
  }
};
