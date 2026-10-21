const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');

const UNRATED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function recordAnswer(sessionId, question, answer, now = new Date()) {
  db.prepare(`
    DELETE FROM latch_answers
    WHERE created_at < ? AND id NOT IN (SELECT answer_id FROM latch_feedback)
  `).run(new Date(now - UNRATED_RETENTION_MS).toISOString());

  return Number(db.prepare('INSERT INTO latch_answers (session_id, question, answer, created_at) VALUES (?, ?, ?, ?)')
    .run(sessionId, question, answer, now.toISOString()).lastInsertRowid);
}

function rate(answerId, userId, rating) {
  if (!db.prepare('SELECT 1 FROM latch_answers WHERE id = ?').get(answerId)) return false;
  db.prepare(`
    INSERT INTO latch_feedback (answer_id, user_id, rating, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (answer_id, user_id) DO UPDATE SET rating = excluded.rating, created_at = excluded.created_at
  `).run(answerId, userId, rating, new Date().toISOString());
  return true;
}

function ratedAnswers() {
  return db.prepare(`
    SELECT a.id, a.session_id, a.question, a.answer, a.created_at,
      SUM(f.rating = 1) AS up, SUM(f.rating = -1) AS down
    FROM latch_answers a JOIN latch_feedback f ON f.answer_id = a.id
    GROUP BY a.id
    ORDER BY up - down, a.created_at
  `).all();
}

function feedbackButtons(answerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`latch:up:${answerId}`).setEmoji('👍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`latch:down:${answerId}`).setEmoji('👎').setStyle(ButtonStyle.Secondary)
  );
}

module.exports = { recordAnswer, rate, ratedAnswers, feedbackButtons };
