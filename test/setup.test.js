process.env.DB_PATH = ':memory:';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const guildSettings = require('../src/utils/guildSettings');
const { wrongChannel } = require('../src/utils/channelRules');
const { postDue } = require('../src/utils/trickOfTheDayScheduler');
const { nextPostTime } = require('../src/commands/setup');

beforeEach(() => db.exec('DELETE FROM guild_settings'));

function fakeClient(guildIds, channels) {
  const sent = [];
  return {
    sent,
    guilds: { cache: new Set(guildIds) },
    channels: {
      fetch: async id => {
        if (!channels[id]) throw Object.assign(new Error('Unknown Channel'), { code: channels[id] === undefined ? 10003 : 50001 });
        return { send: async message => sent.push({ channelId: id, message }) };
      }
    }
  };
}

test('settings upsert only the fields given', () => {
  guildSettings.update('g1', { latch_channel_id: 'c1' });
  guildSettings.update('g1', { games_channel_id: 'c2' });
  const settings = guildSettings.get('g1');
  assert.equal(settings.latch_channel_id, 'c1');
  assert.equal(settings.games_channel_id, 'c2');
  assert.equal(guildSettings.get('nope'), null);
});

test('a server is due once its hour arrives, then not again that day', async () => {
  guildSettings.update('g1', { totd_channel_id: 'c1', totd_hour: 14, totd_level: null });
  const client = fakeClient(['g1'], { c1: true });

  await postDue(client, new Date('2026-10-21T13:59:00Z'));
  assert.equal(client.sent.length, 0);
  await postDue(client, new Date('2026-10-21T14:00:00Z'));
  await postDue(client, new Date('2026-10-21T18:00:00Z'));
  assert.equal(client.sent.length, 1);
  await postDue(client, new Date('2026-10-22T14:30:00Z'));
  assert.equal(client.sent.length, 2);
});

test('a missed post time is caught up later the same day', async () => {
  guildSettings.update('g1', { totd_channel_id: 'c1', totd_hour: 9 });
  const client = fakeClient(['g1'], { c1: true });
  await postDue(client, new Date('2026-10-21T20:00:00Z'));
  assert.equal(client.sent.length, 1);
});

test('the posted card uses the configured level', async () => {
  guildSettings.update('g1', { totd_channel_id: 'c1', totd_hour: 0, totd_level: 'advanced' });
  const client = fakeClient(['g1'], { c1: true });
  await postDue(client, new Date('2026-10-21T01:00:00Z'));
  assert.match(JSON.stringify(client.sent[0].message), /Advanced/);
});

test('a deleted channel turns the daily post off', async () => {
  guildSettings.update('g1', { totd_channel_id: 'gone', totd_hour: 0 });
  await postDue(fakeClient(['g1'], {}), new Date('2026-10-21T01:00:00Z'));
  assert.equal(guildSettings.get('g1').totd_channel_id, null);
});

test('a channel the bot lost access to is skipped for the day but kept', async () => {
  guildSettings.update('g1', { totd_channel_id: 'locked', totd_hour: 0 });
  await postDue(fakeClient(['g1'], { locked: false }), new Date('2026-10-21T01:00:00Z'));
  const settings = guildSettings.get('g1');
  assert.equal(settings.totd_channel_id, 'locked');
  assert.equal(settings.totd_last_posted, '2026-10-21');
});

test('servers the bot has left are forgotten', async () => {
  guildSettings.update('g1', { totd_channel_id: 'c1', totd_hour: 0 });
  await postDue(fakeClient([], { c1: true }), new Date('2026-10-21T01:00:00Z'));
  assert.equal(guildSettings.get('g1'), null);
});

test('channel rules allow the set channel and its threads, and point elsewhere', () => {
  guildSettings.update('g1', { latch_channel_id: 'latch', games_channel_id: null });
  const channel = (id, parentId) => ({ isThread: () => Boolean(parentId), parentId });

  assert.equal(wrongChannel('latch', { guildId: 'g1', channelId: 'latch', channel: channel('latch') }), null);
  assert.equal(wrongChannel('latch', { guildId: 'g1', channelId: 't1', channel: channel('t1', 'latch') }), null);
  assert.match(wrongChannel('latch', { guildId: 'g1', channelId: 'general', channel: channel('general') }), /<#latch>/);
  assert.equal(wrongChannel('games', { guildId: 'g1', channelId: 'general', channel: channel('general') }), null);
  assert.equal(wrongChannel('latch', { guildId: null, channelId: 'dm', channel: null }), null);
});

test('the next post time is today if the hour is still ahead, otherwise tomorrow', () => {
  const now = new Date('2026-10-21T10:30:00Z');
  assert.equal(nextPostTime(14, now), Date.parse('2026-10-21T14:00:00Z') / 1000);
  assert.equal(nextPostTime(9, now), Date.parse('2026-10-22T09:00:00Z') / 1000);
});
