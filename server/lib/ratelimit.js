// Per-key (per-IP) token bucket. Pure and clock-injectable so it is unit-testable.
// capacity = burst size, refillPerSec = sustained rate. take() returns { ok, remaining, retryAfterMs }.
export class TokenBucketLimiter {
  constructor({ capacity = 60, refillPerSec = 1, maxKeys = 50_000, now = () => Date.now() } = {}) {
    Object.assign(this, { capacity, refillPerSec, maxKeys, now });
    this.buckets = new Map();
  }
  take(key, cost = 1) {
    const t = this.now();
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= this.maxKeys) this.buckets.delete(this.buckets.keys().next().value);
      b = { tokens: this.capacity, t };
      this.buckets.set(key, b);
    }
    b.tokens = Math.min(this.capacity, b.tokens + ((t - b.t) / 1000) * this.refillPerSec);
    b.t = t;
    if (b.tokens >= cost) { b.tokens -= cost; return { ok: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 }; }
    return { ok: false, remaining: 0, retryAfterMs: Math.ceil(((cost - b.tokens) / this.refillPerSec) * 1000) };
  }
}

/** Express middleware around a TokenBucketLimiter (key = client IP; honours trust proxy). */
export function rateLimitMiddleware(limiter, { name = 'api' } = {}) {
  return (req, res, next) => {
    const r = limiter.take(`${name}:${req.ip}`);
    res.setHeader('RateLimit-Limit', limiter.capacity);
    res.setHeader('RateLimit-Remaining', r.remaining);
    if (!r.ok) { res.setHeader('Retry-After', Math.ceil(r.retryAfterMs / 1000)); return res.status(429).json({ error: 'rate_limited', retry_after_ms: r.retryAfterMs }); }
    next();
  };
}
