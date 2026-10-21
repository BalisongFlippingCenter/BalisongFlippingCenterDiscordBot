const logUsage = require('./usageLog');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const serverUsage = new Map();
let globalUsage = [];

const SERVER_LIMIT_REACHED = "⏳ Latch has hit this server's hourly question limit — try again a bit later.";
const GLOBAL_LIMIT_REACHED = '⏳ Latch has hit its daily question limit — try again later.';

module.exports = {
  acquire(key) {
    const serverLimit = Number(process.env.LATCH_LIMIT_PER_SERVER_PER_HOUR) || 30;
    const globalLimit = Number(process.env.LATCH_LIMIT_GLOBAL_PER_DAY) || 500;
    const now = Date.now();

    const recent = (serverUsage.get(key) ?? []).filter(time => now - time < HOUR_MS);
    serverUsage.set(key, recent);
    globalUsage = globalUsage.filter(time => now - time < DAY_MS);

    if (globalUsage.length >= globalLimit) {
      logUsage('latch_limited', { limit: 'global', key });
      return GLOBAL_LIMIT_REACHED;
    }
    if (recent.length >= serverLimit) {
      logUsage('latch_limited', { limit: 'server', key });
      return SERVER_LIMIT_REACHED;
    }

    recent.push(now);
    globalUsage.push(now);
    return null;
  }
};
