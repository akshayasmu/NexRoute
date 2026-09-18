// cache.js — a tiny in-memory TTL cache.
// LTA's refresh rates are documented per-endpoint (e.g. PCDRealTime every 10
// min, BusArrival real-time, PCDForecast once a day). Calling the live API
// more often than that wastes your rate limit for no new information, so
// every live call in ltaClient.js / weatherClient.js is wrapped with this.

const store = new Map();

function get(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function cached(key, ttlMs, fn) {
  const hit = get(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  set(key, value, ttlMs);
  return value;
}

module.exports = { get, set, cached };
