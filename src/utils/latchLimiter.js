const WINDOW_MS = 60 * 60 * 1000;
const usage = new Map();

module.exports = {
  tryAcquire(key) {
    const limit = Number(process.env.LATCH_LIMIT_PER_SERVER_PER_HOUR) || 30;
    const now = Date.now();
    const recent = (usage.get(key) ?? []).filter(time => now - time < WINDOW_MS);
    if (recent.length >= limit) {
      usage.set(key, recent);
      return false;
    }
    recent.push(now);
    usage.set(key, recent);
    return true;
  }
};
