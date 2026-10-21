const logUsage = require('../utils/usageLog');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    logUsage('server_joined', { guild: guild.id, members: guild.memberCount, servers: guild.client.guilds.cache.size });
  }
};
