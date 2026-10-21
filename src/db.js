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
  );

  CREATE TABLE IF NOT EXISTS latch_answers (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS latch_feedback (
    answer_id INTEGER NOT NULL REFERENCES latch_answers (id),
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (answer_id, user_id)
  );
`);

module.exports = db;
