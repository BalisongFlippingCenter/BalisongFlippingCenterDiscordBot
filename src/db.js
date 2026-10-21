const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_PATH ?? path.join(__dirname, '../data/bot.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    totd_channel_id TEXT,
    totd_level TEXT,
    totd_hour INTEGER,
    totd_last_posted TEXT,
    latch_channel_id TEXT,
    games_channel_id TEXT
  )
`);

module.exports = db;
