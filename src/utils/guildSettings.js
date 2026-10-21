const db = require('../db');

function get(guildId) {
  return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) ?? null;
}

function update(guildId, fields) {
  const columns = Object.keys(fields);
  db.prepare(`
    INSERT INTO guild_settings (guild_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})
    ON CONFLICT (guild_id) DO UPDATE SET ${columns.map(column => `${column} = excluded.${column}`).join(', ')}
  `).run(guildId, ...Object.values(fields));
}

function forget(guildId) {
  db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId);
}

function dueTrickOfTheDayPosts(date, hour) {
  return db.prepare(`
    SELECT * FROM guild_settings
    WHERE totd_channel_id IS NOT NULL AND totd_hour <= ? AND (totd_last_posted IS NULL OR totd_last_posted < ?)
  `).all(hour, date);
}

module.exports = { get, update, forget, dueTrickOfTheDayPosts };
