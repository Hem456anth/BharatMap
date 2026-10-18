// One upstream HTTP service (Valhalla, OSRM, Photon, Nominatim, Overpass, Open Charge Map) with:
//  - an identifying User-Agent (public OSM services require one)
//  - a minimum interval between requests (1 req/s for public instances), queued in order
//  - request coalescing: identical in-flight requests share one upstream call
//  - an LRU + TTL response cache
//  - a timeout per request and a circuit breaker (after N consecutive failures the upstream is skipped
//    for cooldownMs, so callers fall back immediately instead of waiting for timeouts)
import { LruCache } from './lru.js';

export const DEFAULT_UA = process.env.HTTP_USER_AGENT || 'BharatMap/0.5 (+https://github.com/Hem456anth/BharatMap; open-source map app)';

export class UpstreamError extends Error {
  constructor(message, { status = 0, upstream = '', open = false } = {}) { super(message); Object.assign(this, { status, upstream, breakerOpen: open }); }
}

export function createUpstream({ name, baseUrl, minIntervalMs = 0, timeoutMs = 10_000, failureThreshold = 3, cooldownMs = 30_000,
  cacheMax = 2000, ttlMs = 10 * 60_000, userAgent = DEFAULT_UA, fetchImpl, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const cache = new LruCache({ max: cacheMax, ttlMs, now });
  const inflight = new Map();
  let nextSlot = 0; // earliest time the next upstream request may start
  const breaker = { failures: 0, openUntil: 0, state: 'closed' };
  const stats = { requests: 0, upstream: 0, cacheHits: 0, coalesced: 0, failures: 0, shortCircuited: 0 };

  function breakerState() {
    if (breaker.openUntil && now() >= breaker.openUntil) { breaker.state = 'half-open'; }
    return breaker.state;
  }
  async function throttle() {
    if (!minIntervalMs) return;
    const t = now();
    const start = Math.max(t, nextSlot);
    nextSlot = start + minIntervalMs;
    if (start > t) await sleep(start - t);
  }

  /** request(path, { method, body, headers, ttlMs, parse: 'json'|'text', cacheKey }) */
  async function request(path, opts = {}) {
    stats.requests++;
    const method = opts.method || 'GET';
    const url = /^https?:/.test(path) ? path : `${baseUrl.replace(/\/$/, '')}${path}`;
    const key = opts.cacheKey || `${method} ${url} ${opts.body || ''}`;
    const ttl = opts.ttlMs ?? ttlMs;
    if (ttl > 0) { const hit = cache.get(key); if (hit !== undefined) { stats.cacheHits++; return hit; } }
    if (inflight.has(key)) { stats.coalesced++; return inflight.get(key); }
    if (breakerState() === 'open') { stats.shortCircuited++; throw new UpstreamError(`${name}_circuit_open`, { upstream: name, open: true }); }
    const p = (async () => {
      await throttle();
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), opts.timeoutMs || timeoutMs);
      stats.upstream++;
      try {
        const r = await (fetchImpl || globalThis.fetch)(url, { method, body: opts.body, signal: ctl.signal,
          headers: { 'User-Agent': userAgent, Accept: 'application/json', ...(opts.body && !opts.headers?.['Content-Type'] ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(opts.headers || {}) } });
        if (!r.ok) throw new UpstreamError(`${name}_http_${r.status}`, { status: r.status, upstream: name });
        const val = opts.parse === 'text' ? await r.text() : await r.json();
        breaker.failures = 0; breaker.state = 'closed'; breaker.openUntil = 0;
        if (ttl > 0) cache.set(key, val, ttl);
        return val;
      } catch (e) {
        stats.failures++;
        // 4xx (bad request / no route) is the caller's problem, not an upstream outage.
        const countable = !(e instanceof UpstreamError) || e.status === 0 || e.status === 429 || e.status >= 500;
        if (countable) {
          breaker.failures++;
          if (breaker.state === 'half-open' || breaker.failures >= failureThreshold) { breaker.state = 'open'; breaker.openUntil = now() + cooldownMs; }
        }
        if (e instanceof UpstreamError) throw e;
        throw new UpstreamError(e.name === 'AbortError' ? `${name}_timeout` : `${name}_network_error`, { upstream: name });
      } finally { clearTimeout(tm); }
    })();
    inflight.set(key, p);
    try { return await p; } finally { inflight.delete(key); }
  }
  return { name, baseUrl, request, cache, stats, get breaker() { breakerState(); return { ...breaker }; } };
}

/** Try providers in order; return the first success with { provider, value, tried }. */
export async function withFallback(steps) {
  const tried = [];
  for (const [label, fn] of steps) {
    try { const value = await fn(); return { provider: label, value, tried }; } catch (e) { tried.push({ provider: label, error: e.message }); }
  }
  const err = new Error('all_providers_failed'); err.tried = tried; throw err;
}
