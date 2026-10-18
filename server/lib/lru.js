// LRU cache with per-entry TTL. Map iteration order is insertion order, so re-inserting on read
// moves an entry to the "most recent" end and the first key is always the least recently used.
export class LruCache {
  constructor({ max = 1000, ttlMs = 10 * 60_000, now = () => Date.now() } = {}) {
    this.max = max; this.ttlMs = ttlMs; this.now = now; this.map = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0, expired: 0 };
  }
  get(key) {
    const e = this.map.get(key);
    if (!e) { this.stats.misses++; return undefined; }
    if (e.exp <= this.now()) { this.map.delete(key); this.stats.expired++; this.stats.misses++; return undefined; }
    this.map.delete(key); this.map.set(key, e); this.stats.hits++;
    return e.value;
  }
  has(key) { const e = this.map.get(key); return !!e && e.exp > this.now(); }
  set(key, value, ttlMs = this.ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, exp: this.now() + ttlMs });
    while (this.map.size > this.max) { this.map.delete(this.map.keys().next().value); this.stats.evictions++; }
    return this;
  }
  delete(key) { return this.map.delete(key); }
  clear() { this.map.clear(); }
  get size() { return this.map.size; }
}
