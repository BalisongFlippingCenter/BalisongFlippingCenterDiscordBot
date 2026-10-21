const guildSettings = require('../utils/guildSettings');

module.exports = {
  name: 'guildDelete',
  async execute(guild) {
    if (guild.available) guildSettings.forget(guild.id);
  }
};
