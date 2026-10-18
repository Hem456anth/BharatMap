// /api/v1 — Bharat Map's own map services. The app calls these when it is built with MAPOS_API_BASE (or the web
// app is served with CLIENT_SERVICES=server); otherwise it talks to the public OSM services directly (v0.3 behaviour).
// Every route: input validation (India envelope), per-IP token-bucket rate limit, gzip (see gzipJson in app.js),
// upstream caching / throttling / circuit breaking in server/providers.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createProviders, MODES } from './providers/index.js';
import { createTransit } from './transit/index.js';
import { TokenBucketLimiter, rateLimitMiddleware } from './lib/ratelimit.js';
import { inIndia } from '../shared/geo.js';
import { CATEGORY_BY_ID } from '../web/services/overpass.js';

const num = (v) => (v === undefined || v === '' ? NaN : Number(v));
const pt = (lat, lng) => { const p = { lat: num(lat), lng: num(lng) }; return inIndia(p) ? p : null; };
const bad = (res, error, code = 400) => res.status(code).json({ error });

export function mountApiV1(app, { root, providers = createProviders(), transit = createTransit(), regionsDir = process.env.REGIONS_DIR || path.join(root, 'data/regions'),
  limiter = new TokenBucketLimiter({ capacity: Number(process.env.V1_RATE_BURST || 60), refillPerSec: Number(process.env.V1_RATE_PER_SEC || 2) }) } = {}) {
  const r = express.Router();
  r.use(rateLimitMiddleware(limiter, { name: 'v1' }));
  r.use(express.json({ limit: '512kb' }));
  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    const code = /^unknown_|^invalid/.test(e.message) ? 400 : /offline_mode/.test(e.message) ? 503 : 502;
    res.status(code).json({ error: e.message, tried: e.tried });
  });

  r.get('/route', wrap(async (req, res) => {
    const from = pt(req.query.from_lat, req.query.from_lng), to = pt(req.query.to_lat, req.query.to_lng);
    if (!from || !to) return bad(res, 'invalid_points');
    const mode = String(req.query.mode || 'drive');
    if (!MODES.includes(mode)) return bad(res, 'unknown_mode');
    const opts = { avoidTolls: req.query.avoid_tolls === '1', avoidHighways: req.query.avoid_highways === '1', alternates: req.query.alternatives === '0' ? 0 : 2 };
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(await providers.route(mode, from, to, opts));
  }));
  r.get('/geocode', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 200);
    if (q.length < 2) return bad(res, 'q_required');
    const lat = num(req.query.lat), lng = num(req.query.lng);
    res.json(await providers.geocode(q, { lat, lng, lang: String(req.query.lang || 'en').slice(0, 5), limit: Math.min(10, Number(req.query.limit) || 6), autocomplete: req.query.autocomplete === '1' }));
  }));
  r.get('/reverse', wrap(async (req, res) => {
    const p = pt(req.query.lat, req.query.lng); if (!p) return bad(res, 'invalid_point');
    res.json(await providers.reverse(p.lat, p.lng, { lang: String(req.query.lang || 'en').slice(0, 5) }));
  }));
  r.get('/places/nearby', wrap(async (req, res) => {
    const p = pt(req.query.lat, req.query.lng); if (!p) return bad(res, 'invalid_point');
    const cat = String(req.query.category || req.query.cat || '');
    if (!CATEGORY_BY_ID[cat]) return bad(res, 'unknown_category');
    res.json(await providers.nearby(cat, p, { radiusM: Number(req.query.radius) || 3000, limit: Math.min(120, Number(req.query.limit) || 60) }));
  }));
  r.get('/ev', wrap(async (req, res) => {
    const p = pt(req.query.lat, req.query.lng); if (!p) return bad(res, 'invalid_point');
    res.json(await providers.nearby('ev', p, { radiusM: Number(req.query.radius) || 5000, limit: Math.min(100, Number(req.query.limit) || 50) }));
  }));
  r.post('/tolls', wrap(async (req, res) => {
    const c = req.body?.coordinates;
    if (!Array.isArray(c) || c.length < 2 || c.length > 20000 || !c.every((x) => Array.isArray(x) && inIndia({ lat: +x[1], lng: +x[0] }))) return bad(res, 'invalid_line');
    res.json(await providers.tolls(c.map((x) => [+x[0], +x[1]])));
  }));
  r.get('/transit/feeds', (_req, res) => res.json({ feeds: transit.feeds(), errors: transit.errors() }));
  r.get('/transit/plan', (req, res) => {
    const from = pt(req.query.from_lat, req.query.from_lng), to = pt(req.query.to_lat, req.query.to_lng);
    if (!from || !to) return bad(res, 'invalid_points');
    res.json(transit.plan(from, to, { date: req.query.date, time: req.query.time }));
  });
  r.get('/transit/stops', (req, res) => {
    const p = pt(req.query.lat, req.query.lng); if (!p) return bad(res, 'invalid_point');
    res.json({ scheduled: true, stops: transit.stops(p, { radiusM: Math.min(3000, Number(req.query.radius) || 1200) }) });
  });
  r.get('/regions', (_req, res) => {
    const cat = JSON.parse(fs.readFileSync(path.join(root, 'web/offline/catalog.json'), 'utf8'));
    res.json({ ...cat, regions: cat.regions.map((x) => { const f = path.join(regionsDir, `${x.id}.pmtiles`); const ok = fs.existsSync(f); return { ...x, available: ok, size_bytes: ok ? fs.statSync(f).size : null, url: ok ? `/regions/${x.id}.pmtiles` : null }; }) });
  });
  r.get('/providers', (_req, res) => res.json({ providers: providers.status(), transit: transit.feeds() }));
  r.use((_req, res) => bad(res, 'not_found', 404));
  app.use('/api/v1', r);
  // Region files (PMTiles) with HTTP Range support for partial reads and resumable downloads.
  app.use('/regions', express.static(regionsDir, { maxAge: '7d', acceptRanges: true, index: false }), (_req, res) => res.status(404).json({ error: 'region_not_hosted' }));
  return { providers, transit };
}
