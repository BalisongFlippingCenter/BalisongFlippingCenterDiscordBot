const { dailyCard } = require('../commands/trick-of-the-day');
const guildSettings = require('./guildSettings');
const logUsage = require('./usageLog');

const CHECK_INTERVAL_MS = 60 * 1000;
const UNKNOWN_CHANNEL = 10003;

async function postDue(client, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  for (const settings of guildSettings.dueTrickOfTheDayPosts(date, now.getUTCHours())) {
    if (!client.guilds.cache.has(settings.guild_id)) {
      guildSettings.forget(settings.guild_id);
      continue;
    }

    guildSettings.update(settings.guild_id, { totd_last_posted: date });
    try {
      const channel = await client.channels.fetch(settings.totd_channel_id);
      await channel.send(dailyCard(settings.totd_level, date));
      logUsage('totd_posted', { guild: settings.guild_id, result: 'ok' });
    } catch (error) {
      if (error.code === UNKNOWN_CHANNEL) guildSettings.update(settings.guild_id, { totd_channel_id: null });
      console.error(`Trick of the day post failed for server ${settings.guild_id}:`, error.message);
      logUsage('totd_posted', { guild: settings.guild_id, result: 'error', code: error.code });
    }
  }
}

function start(client) {
  const check = () => postDue(client).catch(error => console.error('Trick of the day check failed:', error));
  check();
  setInterval(check, CHECK_INTERVAL_MS);
}

module.exports = { start, postDue };
