// Small network layer for third-party open-data services (Overpass, Nominatim, Photon, OSRM).
// - every request has a timeout
// - responses are cached in memory with a TTL (keyed by URL + body)
// - per-host minimum spacing (Nominatim's policy is max 1 request/second)
// - in-flight de-duplication so the same query is never sent twice concurrently
// Browsers do not allow setting User-Agent; requests carry the app's Origin/Referer instead.
// Nothing here sends account data or device identifiers: only the query text / coordinates.

const cache = new Map(); // key -> { exp, value }
const inflight = new Map();
const lastHit = new Map(); // host -> ms
const MAX_CACHE = 300;

export const HOST_SPACING_MS = {
  'nominatim.openstreetmap.org': 1100,
  'overpass-api.de': 1000,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class NetError extends Error {
  constructor(message, { status = 0, offline = false } = {}) { super(message); this.status = status; this.offline = offline; }
}

export async function fetchJSON(url, { method = 'GET', body = null, headers = {}, timeout = 15000, ttl = 10 * 60_000, fetchImpl } = {}) {
  const key = `${method} ${url} ${body || ''}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const host = new URL(url).host;
    const gap = HOST_SPACING_MS[host] || 0;
    if (gap) {
      const wait = (lastHit.get(host) || 0) + gap - Date.now();
      lastHit.set(host, Date.now() + Math.max(0, wait));
      if (wait > 0) await sleep(wait);
    }
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), timeout);
    let r;
    try {
      r = await (fetchImpl || globalThis.fetch)(url, { method, body, headers: { Accept: 'application/json', ...headers }, signal: ctl.signal, referrerPolicy: 'strict-origin-when-cross-origin' });
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw new NetError(e.name === 'AbortError' ? 'timeout' : offline ? 'offline' : 'network_error', { offline });
    } finally { clearTimeout(tm); }
    if (r.status === 429) throw new NetError('rate_limited', { status: 429 });
    if (!r.ok) throw new NetError(`http_${r.status}`, { status: r.status });
    const value = await r.json();
    if (ttl > 0) {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
      cache.set(key, { exp: Date.now() + ttl, value });
    }
    return value;
  })();
  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}

export function clearNetCache() { cache.clear(); }

// Trailing-edge debounce that returns a promise for the latest call only.
export function debounceAsync(fn, ms) {
  let t = null, pending = null;
  return (...args) => new Promise((resolve, reject) => {
    clearTimeout(t);
    if (pending) pending.resolve({ superseded: true });
    pending = { resolve, reject };
    const mine = pending;
    t = setTimeout(async () => {
      try { const v = await fn(...args); if (pending === mine) resolve(v); else resolve({ superseded: true }); } catch (e) { reject(e); }
    }, ms);
  });
}
