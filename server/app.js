import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, seed, loadCatalog } from './db.js';
import { authOptional, requireRole, signToken, verifyPassword, hashPassword } from './auth.js';
import { route as routeSvc, geocodeExternal, overpassNearby, llmRewrite } from './services/external.js';
import { searchMarketplace, searchPlaces, searchMobility, assistant } from '../shared/search.js';
import { parseIndianAddress } from '../shared/address.js';
import { encodeDigipin, decodeDigipin, inIndia, haversineKm } from '../shared/geo.js';
import { priceOrder, assignRider, progress, optimizeStops, vehicleFor, RULES } from '../shared/logistics.js';
import { LANGS, STRINGS } from '../shared/i18n.js';
import { toBecknCatalog } from './services/ondc.js';
import { createRazorpay } from './services/payments.js';
import { mountAdmin } from './admin.js';
import { cspString } from '../shared/csp.js';
import { normalizeSaved } from '../web/lib/saved-model.js';
import { notify, notifyOrderParties } from './notify.js';
import { mountApiV1 } from './api-v1.js';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSP = cspString();
export const VERSION = '0.5.0';

// ---------- small infra helpers ----------
const metrics = { requests: 0, errors: 0, byRoute: new Map(), latencyMs: [] };
function rateLimiter({ windowMs = 60_000, max = 240 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const k = req.ip; const now = Date.now();
    const h = hits.get(k) || { n: 0, reset: now + windowMs };
    if (now > h.reset) { h.n = 0; h.reset = now + windowMs; }
    h.n++; hits.set(k, h);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - h.n));
    if (h.n > max) return res.status(429).json({ error: 'rate_limited' });
    if (hits.size > 50_000) hits.clear();
    next();
  };
}
const num = (v) => (v === undefined || v === '' ? NaN : Number(v));
const point = (lat, lng) => { const p = { lat: num(lat), lng: num(lng) }; return inIndia(p) ? p : null; };
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function createApp({ db = openDb(), timeScale = Number(process.env.DEMO_TIME_SCALE || RULES.demoTimeScale), payments = createRazorpay(), providers, transit, now } = {}) {
  seed(db);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === '1');
  app.locals.db = db;

  // Security headers (helmet-equivalent, dependency-free)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', CSP);
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use((req, res, next) => {
    const t0 = process.hrtime.bigint();
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      metrics.requests++; if (res.statusCode >= 500) metrics.errors++;
      const key = `${req.method} ${req.route?.path || req.path.split('/').slice(0, 3).join('/')}`;
      metrics.byRoute.set(key, (metrics.byRoute.get(key) || 0) + 1);
      metrics.latencyMs.push(ms); if (metrics.latencyMs.length > 5000) metrics.latencyMs.shift();
      if (process.env.LOG_REQUESTS !== '0' && process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ t: new Date().toISOString(), id: req.id, m: req.method, p: req.path, s: res.statusCode, ms: +ms.toFixed(1) }));
    });
    next();
  });
  const allowed = (process.env.CORS_ORIGINS ?? 'https://localhost,capacitor://localhost,http://localhost').split(',').map((x) => x.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && allowed.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE'); }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  // rawBody kept for webhook signature verification (Razorpay signs the exact bytes).
  app.use(express.json({ limit: '64kb', verify: (req, _res, buf) => { if (req.url.startsWith('/api/payments/razorpay/webhook')) req.rawBody = buf.toString('utf8'); } }));
  app.use('/api', rateLimiter({ max: Number(process.env.RATE_LIMIT_PER_MIN || 240) }));
  app.use(authOptional);
  // Stateless JWTs are re-checked against the users table so an admin can disable an account immediately.
  const isDisabled = db.prepare('SELECT disabled FROM users WHERE id=?');
  app.use((req, _res, next) => { if (req.user && isDisabled.get(req.user.sub)?.disabled) req.user = null; next(); });

  // gzip JSON API responses (> 1 KB) for low-bandwidth clients; dependency-free.
  app.use('/api', (req, res, next) => {
    if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
    const json = res.json.bind(res);
    res.json = (obj) => {
      const body = Buffer.from(JSON.stringify(obj));
      if (body.length < 1024 || res.headersSent) return json(obj);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding');
      return res.end(zlib.gzipSync(body, { level: 6 }));
    };
    next();
  });
  // Client config: CLIENT_SERVICES=server makes the server-hosted web app use /api/v1 for map services.
  app.get('/config.js', (_req, res) => {
    res.type('application/javascript').setHeader('Cache-Control', 'no-cache');
    res.send(`window.__MAPOS_CONFIG__ = window.__MAPOS_CONFIG__ || ${JSON.stringify({ apiBase: '', services: process.env.CLIENT_SERVICES === 'server' ? 'server' : 'direct', regionsBase: process.env.REGIONS_BASE || '' })};\n`);
  });
  const v1 = mountApiV1(app, { root: ROOT, db, now, ...(providers ? { providers } : {}), ...(transit ? { transit } : {}) });
  app.locals.v1 = v1;

  // ---------- static frontend ----------
  app.use('/shared', express.static(path.join(ROOT, 'shared'), { maxAge: '1h' }));
  app.use(express.static(path.join(ROOT, 'web'), { maxAge: '10m', index: 'index.html' }));

  // ---------- map tile proxy (same-origin, cacheable at CDN; swap upstream for self-hosted PMTiles) ----------
  const TILE_UP = (process.env.TILE_UPSTREAM || 'https://tiles.openfreemap.org').replace(/\/$/, '');
  const tileCache = new Map();
  app.get(['/map/style.json', '/map/ofm/*'], async (req, res) => {
    const styleName = req.query.style === 'dark' ? 'dark' : (process.env.MAP_STYLE || 'liberty');
    const upPath = req.path === '/map/style.json' ? `/styles/${styleName}` : req.path.slice('/map/ofm'.length);
    const key = upPath;
    const hit = tileCache.get(key);
    const send = (v) => { res.setHeader('Content-Type', v.type); res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(v.body); };
    if (hit) return send(hit);
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(TILE_UP + upPath, { signal: ctl.signal });
      clearTimeout(tm);
      if (!r.ok) return res.sendStatus(r.status);
      const type = r.headers.get('content-type') || 'application/octet-stream';
      let body = Buffer.from(await r.arrayBuffer());
      if (/json/.test(type)) body = Buffer.from(body.toString('utf8').split(TILE_UP).join(`${req.protocol}://${req.get('host')}/map/ofm`));
      const v = { type, body };
      if (tileCache.size > 4000) tileCache.delete(tileCache.keys().next().value);
      tileCache.set(key, v);
      send(v);
    } catch { res.sendStatus(502); }
  });

  // ---------- ops ----------
  app.get('/api/health', (_req, res) => {
    let dbOk = true; try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
    res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'degraded', db: dbOk, version: VERSION, time: new Date().toISOString() });
  });
  // Public client configuration: which real integrations are switched on for this deployment.
  app.get('/api/config', (_req, res) => res.json({
    version: VERSION,
    payments: { razorpay: payments.enabled, key_id: payments.keyId, mode: payments.mode, cod: true, upi_simulated: process.env.ALLOW_SIMULATED_UPI !== '0' },
    routing: process.env.OFFLINE === '1' ? 'fallback' : (process.env.VALHALLA_URL ? 'valhalla-self-hosted' : process.env.OSRM_URL ? 'osrm-self-hosted' : 'osrm-public-demo'),
    services: { v1: true, valhalla: !!process.env.VALHALLA_URL, ev_ocm: !!process.env.OCM_API_KEY, transit_feeds: v1.transit.feeds().map((f) => f.id) },
    llm: Boolean(process.env.LLM_API_KEY),
  }));
  app.get('/metrics', (_req, res) => {
    const l = [...metrics.latencyMs].sort((a, b) => a - b);
    const q = (p) => (l.length ? l[Math.min(l.length - 1, Math.floor(p * l.length))] : 0);
    let out = `# TYPE mapos_requests_total counter\nmapos_requests_total ${metrics.requests}\n# TYPE mapos_errors_total counter\nmapos_errors_total ${metrics.errors}\n`;
    out += `# TYPE mapos_latency_ms summary\nmapos_latency_ms{quantile="0.5"} ${q(0.5).toFixed(2)}\nmapos_latency_ms{quantile="0.95"} ${q(0.95).toFixed(2)}\nmapos_latency_ms{quantile="0.99"} ${q(0.99).toFixed(2)}\n`;
    for (const [k, v] of metrics.byRoute) out += `mapos_route_requests_total{route="${k.replace(/"/g, '')}"} ${v}\n`;
    res.type('text/plain').send(out);
  });
  app.get('/api/i18n', (_req, res) => res.json({ languages: LANGS, strings: STRINGS }));

  // ---------- auth ----------
  app.post('/api/auth/register', (req, res) => {
    const email = str(req.body?.email, 120).toLowerCase(); const name = str(req.body?.name, 80); const password = String(req.body?.password || '');
    const role = ['customer', 'seller'].includes(req.body?.role) ? req.body.role : 'customer';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, 'invalid_email');
    if (password.length < 8) return bad(res, 'password_too_short');
    if (!name) return bad(res, 'name_required');
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'email_taken', 409);
    const id = `u_${crypto.randomUUID()}`;
    db.prepare('INSERT INTO users(id,email,name,role,password_hash,preferred_lang) VALUES (?,?,?,?,?,?)').run(id, email, name, role, hashPassword(password), LANGS.some((l) => l.code === req.body?.lang) ? req.body.lang : 'en');
    res.status(201).json({ token: signToken({ sub: id, role, name }), user: { id, email, name, role } });
  });
  const loginFails = new Map();
  app.post('/api/auth/login', (req, res) => {
    const email = str(req.body?.email, 120).toLowerCase();
    const f = loginFails.get(email) || { n: 0, until: 0 };
    if (f.until > Date.now()) return bad(res, 'too_many_attempts', 429);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!u || !verifyPassword(req.body?.password, u.password_hash) || u.disabled) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 5 * 60_000; f.n = 0; } loginFails.set(email, f);
      return bad(res, 'invalid_credentials', 401);
    }
    loginFails.delete(email);
    const biz = u.role === 'seller' ? db.prepare('SELECT id FROM businesses WHERE owner_id=?').get(u.id) : null;
    res.json({ token: signToken({ sub: u.id, role: u.role, name: u.name, biz: biz?.id }), user: { id: u.id, email: u.email, name: u.name, role: u.role, business_id: biz?.id || null } });
  });
  // Saved places sync (v0.3): one validated JSON document per user.
  app.get('/api/me/places', requireRole(), (req, res) => {
    const row = db.prepare('SELECT data, updated_ms FROM user_places WHERE user_id=?').get(req.user.sub);
    res.json({ data: row ? normalizeSaved(JSON.parse(row.data)) : null, updated_ms: row?.updated_ms || 0 });
  });
  app.put('/api/me/places', requireRole(), (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return bad(res, 'invalid_body');
    const data = normalizeSaved(req.body);
    const json = JSON.stringify(data);
    if (json.length > 48_000) return bad(res, 'too_large', 413);
    const now = Date.now();
    db.prepare('INSERT INTO user_places(user_id,data,updated_ms) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_ms=excluded.updated_ms').run(req.user.sub, json, now);
    res.json({ ok: true, updated_ms: now });
  });
  app.get('/api/me', requireRole(), (req, res) => {
    const u = db.prepare('SELECT id,email,name,role,preferred_lang FROM users WHERE id=?').get(req.user.sub);
    if (!u) return bad(res, 'not_found', 404);
    res.json(u);
  });

  // ---------- search / AI ----------
  app.get('/api/search', (req, res) => {
    const q = str(req.query.q, 200);
    if (!q) return bad(res, 'q_required');
    const origin = point(req.query.lat, req.query.lng);
    const radiusKm = Math.min(50, num(req.query.radius_km) || 15);
    const result = searchMarketplace(loadCatalog(db, str(req.query.city, 30) || undefined), q, { origin, radiusKm });
    res.json({ ...result, places: searchPlaces(q, str(req.query.city, 30) || undefined) });
  });
  app.post('/api/assistant', async (req, res) => {
    let q = str(req.body?.query, 500);
    if (!q) return bad(res, 'query_required');
    const origin = point(req.body?.lat, req.body?.lng);
    const rewritten = await llmRewrite(q);
    const ctx = { origin, businesses: loadCatalog(db), mobility: db.prepare('SELECT * FROM mobility_pois').all(), radiusKm: 15 };
    const out = assistant(rewritten || q, ctx);
    if (out.action?.type === 'route' && out.action.from && out.action.to) out.action.route = await routeSvc(out.action.from, out.action.to);
    res.json({ ...out, llm_used: !!rewritten, rewritten_query: rewritten || undefined });
  });

  // ---------- geo ----------
  app.get('/api/geocode', async (req, res) => {
    const q = str(req.query.q, 300);
    if (!q) return bad(res, 'q_required');
    const local = parseIndianAddress(q);
    let external = [];
    if (!local.best || local.best.confidence < 0.6) external = await geocodeExternal(q);
    const best = local.best && (!external[0] || local.best.confidence >= external[0].confidence) ? local.best : external[0] || null;
    res.json({ query: q, best: best ? { ...best, digipin: encodeDigipin(best.lat, best.lng) } : null, local, external });
  });
  app.get('/api/reverse', (req, res) => {
    const p = point(req.query.lat, req.query.lng);
    if (!p) return bad(res, 'invalid_point');
    const near = db.prepare('SELECT name, city, lat, lng FROM businesses').all().map((b) => ({ ...b, d: haversineKm(p, b) })).sort((a, b) => a.d - b.d)[0];
    res.json({ ...p, digipin: encodeDigipin(p.lat, p.lng), nearest_business: near ? { name: near.name, distance_km: +near.d.toFixed(2) } : null });
  });
  app.get('/api/digipin/:code', (req, res) => {
    const p = decodeDigipin(req.params.code);
    if (!p) return bad(res, 'invalid_digipin');
    res.json({ code: req.params.code.toUpperCase(), ...p });
  });
  app.get('/api/route', async (req, res) => {
    const from = point(req.query.from_lat, req.query.from_lng); const to = point(req.query.to_lat, req.query.to_lng);
    if (!from || !to) return bad(res, 'invalid_points');
    const profile = ['driving', 'bike', 'truck'].includes(req.query.profile) ? req.query.profile : 'driving';
    res.json(await routeSvc(from, to, profile));
  });
  app.post('/api/route/optimize', (req, res) => {
    const start = point(req.body?.start?.lat, req.body?.start?.lng);
    const stops = (Array.isArray(req.body?.stops) ? req.body.stops : []).slice(0, 25).map((s) => ({ ...point(s.lat, s.lng), id: str(s.id, 40) })).filter((s) => Number.isFinite(s.lat));
    if (!start || !stops.length) return bad(res, 'start_and_stops_required');
    res.json({ engine: 'nearest-neighbour+2opt (MVP; VROOM in production)', ...optimizeStops(start, stops) });
  });

  // ---------- mobility ----------
  app.get('/api/mobility', async (req, res) => {
    const origin = point(req.query.lat, req.query.lng);
    const kind = str(req.query.kind, 20) || undefined;
    const sample = searchMobility(db.prepare('SELECT * FROM mobility_pois').all(), kind, origin, 20);
    let live = [];
    if (req.query.live === '1' && origin && ['ev', 'parking', 'fuel', 'bus'].includes(kind)) {
      live = (await overpassNearby(kind, origin)).map((m) => ({ ...m, distance_km: +haversineKm(origin, m).toFixed(2) })).sort((a, b) => a.distance_km - b.distance_km).slice(0, 15);
    }
    res.json({ items: [...live, ...sample], live_count: live.length, note: 'sample = illustrative seed; live = OpenStreetMap via Overpass (ODbL). Traffic & toll live feeds require licensed providers.' });
  });

  // ---------- marketplace ----------
  app.get('/api/businesses/:id', (req, res) => {
    const b = loadCatalog(db).find((x) => x.id === req.params.id);
    if (!b) return bad(res, 'not_found', 404);
    res.json(b);
  });
  app.get('/api/businesses', (req, res) => {
    const origin = point(req.query.lat, req.query.lng);
    let list = loadCatalog(db, str(req.query.city, 30) || undefined).map(({ products, ...b }) => ({ ...b, product_count: products.length, distance_km: origin ? +haversineKm(origin, b).toFixed(2) : null }));
    if (req.query.type) list = list.filter((b) => b.type === req.query.type);
    if (origin) list.sort((a, b) => a.distance_km - b.distance_km);
    res.json({ items: list.slice(0, 200) });
  });

  // ---------- orders ----------
  app.post('/api/orders', requireRole('customer', 'admin'), async (req, res) => {
    const businessId = str(req.body?.business_id, 40);
    const fulfilment = req.body?.fulfilment === 'pickup' ? 'pickup' : 'delivery';
    const payment = ['upi_simulated', 'razorpay'].includes(req.body?.payment_method) ? req.body.payment_method : 'cod';
    if (payment === 'razorpay' && !payments.enabled) return bad(res, 'payments_not_configured', 503);
    if (payment === 'upi_simulated' && process.env.ALLOW_SIMULATED_UPI === '0') return bad(res, 'simulated_payments_disabled');
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 30) : [];
    const drop = fulfilment === 'delivery' ? point(req.body?.drop?.lat, req.body?.drop?.lng) : null;
    if (!items.length) return bad(res, 'items_required');
    if (fulfilment === 'delivery' && !drop) return bad(res, 'drop_location_required');
    const biz = db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
    if (!biz) return bad(res, 'business_not_found', 404);
    if (fulfilment === 'delivery' && !biz.delivery) return bad(res, 'delivery_not_offered');
    if (fulfilment === 'pickup' && !biz.pickup) return bad(res, 'pickup_not_offered');
    const distanceKm = drop ? haversineKm(biz, drop) : 0;
    if (drop && distanceKm > 25) return bad(res, 'out_of_delivery_range');

    const getP = db.prepare('SELECT * FROM products WHERE id=? AND business_id=?');
    const lines = [];
    for (const it of items) {
      const qty = Math.floor(num(it.qty));
      if (!(qty >= 1 && qty <= 500)) return bad(res, 'invalid_qty');
      const p = getP.get(str(it.product_id, 40), businessId);
      if (!p || p.active === 0) return bad(res, 'product_not_found', 404);
      if (p.stock < qty) return bad(res, `insufficient_stock:${p.id}`, 409);
      lines.push({ product_id: p.id, qty, unit_price: p.price, name: p.name, category: p.category, wholesale_price: p.wholesale_price, min_wholesale_qty: p.min_wholesale_qty });
    }
    const priced = priceOrder(lines, distanceKm, fulfilment);
    let rider = null, routeObj = null;
    if (fulfilment === 'delivery') {
      const riders = db.prepare('SELECT * FROM riders WHERE city=? AND available=1').all(biz.city);
      const pick = assignRider(riders, biz, lines);
      if (!pick) return bad(res, 'no_rider_available', 503);
      rider = pick.rider;
      routeObj = await routeSvc({ lat: biz.lat, lng: biz.lng }, drop, rider.vehicle === 'mini-truck' || rider.vehicle === 'truck' ? 'truck' : 'bike');
    }
    const id = `ord_${crypto.randomBytes(6).toString('hex')}`;
    const nowMs = Date.now();
    // Atomic stock reservation: conditional decrement inside a transaction prevents overselling.
    db.exec('BEGIN IMMEDIATE');
    try {
      const dec = db.prepare('UPDATE products SET stock = stock - ?, updated_at = datetime(\'now\') WHERE id = ? AND stock >= ?');
      for (const l of priced.lines) { const r = dec.run(l.qty, l.product_id, l.qty); if (r.changes !== 1) throw Object.assign(new Error('stock_race'), { code: 409 }); }
      db.prepare(`INSERT INTO orders(id,customer_id,business_id,rider_id,fulfilment,status,payment_method,payment_status,subtotal,delivery_fee,handling_fee,total,drop_lat,drop_lng,drop_address,route_json,created_ms)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, req.user.sub, biz.id, rider?.id || null, fulfilment, 'placed', payment, payment === 'upi_simulated' ? 'paid_simulated' : payment === 'razorpay' ? 'awaiting_payment' : 'pending', priced.subtotal, priced.delivery_fee, priced.handling_fee, priced.total, drop?.lat ?? null, drop?.lng ?? null, str(req.body?.drop_address, 300) || null, routeObj ? JSON.stringify(routeObj) : null, nowMs);
      const insI = db.prepare('INSERT INTO order_items(order_id,product_id,name,qty,unit_price) VALUES (?,?,?,?,?)');
      for (const l of priced.lines) insI.run(id, l.product_id, l.name, l.qty, l.unit_price);
      db.prepare('INSERT INTO order_events(order_id,status,note) VALUES (?,?,?)').run(id, 'placed', rider ? `rider ${rider.id} (${rider.vehicle}) assigned` : 'pickup order');
      if (rider) db.prepare('UPDATE riders SET available=0 WHERE id=?').run(rider.id);
      db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES (?,?,?,?)').run(req.user.sub, 'order.create', 'order', id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); return bad(res, e.message === 'stock_race' ? 'insufficient_stock' : 'order_failed', e.code || 500); }
    notifyOrderParties(db, id, 'order_placed', 'Order placed', `${biz.name} · ₹${priced.total}`);
    const out = orderView(db, id, timeScale);
    if (payment === 'razorpay') {
      try {
        const rz = await payments.createOrder({ amountPaise: priced.total * 100, receipt: id, notes: { mapos_order: id } });
        db.prepare('INSERT INTO payments(order_id,provider,provider_order_id,amount_paise,status,raw) VALUES (?,?,?,?,?,?)').run(id, 'razorpay', rz.id, priced.total * 100, 'created', JSON.stringify({ status: rz.status }));
        out.razorpay = { key_id: payments.keyId, order_id: rz.id, amount: priced.total * 100, currency: 'INR', name: 'Bharat Map', description: `Order ${id}` };
      } catch (e) {
        db.prepare("UPDATE orders SET payment_status='payment_init_failed' WHERE id=?").run(id);
        out.payment_status = 'payment_init_failed'; out.payment_error = e.message;
      }
    }
    res.status(201).json(out);
  });
  app.get('/api/orders', requireRole(), (req, res) => {
    const rows = req.user.role === 'admin' ? db.prepare('SELECT id FROM orders ORDER BY created_ms DESC LIMIT 100').all()
      : req.user.role === 'seller' ? db.prepare('SELECT id FROM orders WHERE business_id=? ORDER BY created_ms DESC LIMIT 100').all(req.user.biz || '')
      : db.prepare('SELECT id FROM orders WHERE customer_id=? ORDER BY created_ms DESC LIMIT 100').all(req.user.sub);
    res.json({ items: rows.map((r) => orderView(db, r.id, timeScale)) });
  });
  const canSee = (req, o) => req.user.role === 'admin' || o.customer_id === req.user.sub || (req.user.role === 'seller' && o.business_id === req.user.biz) || (req.user.role === 'rider' && o.rider_id && `u_${o.rider_id}` === req.user.sub);
  app.get('/api/orders/:id', requireRole(), (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
    if (!o || !canSee(req, o)) return bad(res, 'not_found', 404);
    res.json(orderView(db, o.id, timeScale));
  });
  app.get('/api/orders/:id/track', requireRole(), (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
    if (!o || !canSee(req, o)) return bad(res, 'not_found', 404);
    res.json(orderView(db, o.id, timeScale).tracking);
  });
  // Server-Sent Events stream. EventSource can't set headers, so it accepts ?token=.
  app.get('/api/orders/:id/stream', (req, res) => {
    if (!req.user && req.query.token) { req.headers.authorization = `Bearer ${req.query.token}`; authOptional(req, res, () => {}); }
    if (!req.user) return bad(res, 'auth_required', 401);
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
    if (!o || !canSee(req, o)) return bad(res, 'not_found', 404);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const tick = () => {
      const v = orderView(db, o.id, timeScale);
      res.write(`data: ${JSON.stringify(v.tracking)}\n\n`);
      if (['delivered', 'completed', 'cancelled', 'rejected'].includes(v.tracking.status)) { clearInterval(iv); res.end(); }
    };
    const iv = setInterval(tick, 1500); tick();
    req.on('close', () => clearInterval(iv));
  });
  app.post('/api/orders/:id/cancel', requireRole(), (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
    if (!o || !canSee(req, o)) return bad(res, 'not_found', 404);
    const live = orderView(db, o.id, timeScale).tracking.status;
    if (!['placed', 'accepted'].includes(live)) return bad(res, 'cannot_cancel_now', 409);
    db.exec('BEGIN');
    db.prepare("UPDATE orders SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(o.id);
    for (const it of db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id)) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(it.qty, it.product_id);
    if (o.rider_id) db.prepare('UPDATE riders SET available=1 WHERE id=?').run(o.rider_id);
    db.prepare('INSERT INTO order_events(order_id,status,note) VALUES (?,?,?)').run(o.id, 'cancelled', `by ${req.user.role}`);
    db.exec('COMMIT');
    res.json(orderView(db, o.id, timeScale));
  });

  // ---------- seller dashboard ----------
  const ownBiz = (req) => (req.user.role === 'admin' ? str(req.query.business_id || req.body?.business_id, 40) : req.user.biz);
  app.get('/api/seller/dashboard', requireRole('seller', 'admin'), (req, res) => {
    const bid = ownBiz(req);
    const b = loadCatalog(db, null, { includeInactive: true }).find((x) => x.id === bid);
    if (!b) return bad(res, 'no_business', 404);
    const orders = db.prepare('SELECT id FROM orders WHERE business_id=? ORDER BY created_ms DESC LIMIT 50').all(bid).map((r) => orderView(db, r.id, timeScale));
    const revenue = orders.filter((o) => !['cancelled', 'rejected'].includes(o.tracking.status)).reduce((s, o) => s + o.subtotal, 0);
    res.json({ business: b, kpis: { orders: orders.length, revenue, low_stock: b.products.filter((p) => p.stock <= 2).length, catalogue: b.products.length }, orders });
  });
  app.patch('/api/seller/products/:id', requireRole('seller', 'admin'), (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
    if (!p || (req.user.role !== 'admin' && p.business_id !== req.user.biz)) return bad(res, 'not_found', 404);
    const price = req.body?.price !== undefined ? Math.round(num(req.body.price)) : p.price;
    const stock = req.body?.stock !== undefined ? Math.round(num(req.body.stock)) : p.stock;
    if (!(price >= 0 && price <= 10_000_000) || !(stock >= 0 && stock <= 1_000_000)) return bad(res, 'invalid_values');
    db.prepare("UPDATE products SET price=?, stock=?, updated_at=datetime('now') WHERE id=?").run(price, stock, p.id);
    db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES (?,?,?,?)').run(req.user.sub, 'product.update', 'product', p.id);
    res.json(db.prepare('SELECT * FROM products WHERE id=?').get(p.id));
  });
  app.post('/api/seller/products', requireRole('seller', 'admin'), (req, res) => {
    const bid = ownBiz(req);
    if (!db.prepare('SELECT 1 FROM businesses WHERE id=?').get(bid)) return bad(res, 'no_business', 404);
    const name = str(req.body?.name, 120), category = str(req.body?.category, 40).toLowerCase();
    const price = Math.round(num(req.body?.price)), stock = Math.round(num(req.body?.stock ?? 0));
    if (!name || !category || !(price >= 0) || !(stock >= 0)) return bad(res, 'invalid_product');
    const id = `p_${crypto.randomBytes(5).toString('hex')}`;
    const tags = (Array.isArray(req.body?.tags) ? req.body.tags : []).slice(0, 10).map((t) => str(t, 30).toLowerCase()).filter(Boolean);
    db.prepare('INSERT INTO products(id,business_id,name,category,brand,unit,price,mrp,stock,tags) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, bid, name, category, str(req.body?.brand, 60) || null, str(req.body?.unit, 20) || 'piece', price, Math.round(num(req.body?.mrp)) || price, stock, JSON.stringify(tags));
    res.status(201).json(db.prepare('SELECT * FROM products WHERE id=?').get(id));
  });
  app.post('/api/seller/orders/:id/:action(accept|reject)', requireRole('seller', 'admin'), (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
    if (!o || (req.user.role !== 'admin' && o.business_id !== req.user.biz)) return bad(res, 'not_found', 404);
    if (req.params.action === 'reject') {
      if (!['placed', 'accepted'].includes(orderView(db, o.id, timeScale).tracking.status)) return bad(res, 'cannot_reject_now', 409);
      db.exec('BEGIN');
      db.prepare("UPDATE orders SET status='rejected' WHERE id=?").run(o.id);
      for (const it of db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id)) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(it.qty, it.product_id);
      if (o.rider_id) db.prepare('UPDATE riders SET available=1 WHERE id=?').run(o.rider_id);
      db.prepare('INSERT INTO order_events(order_id,status,note) VALUES (?,?,?)').run(o.id, 'rejected', 'by seller');
      db.exec('COMMIT');
      notify(db, o.customer_id, { kind: 'order_rejected', title: 'Order rejected', body: 'The seller could not fulfil your order. Stock was released.', order_id: o.id });
    } else {
      db.prepare('INSERT INTO order_events(order_id,status,note) VALUES (?,?,?)').run(o.id, 'accepted', 'by seller');
      notify(db, o.customer_id, { kind: 'order_accepted', title: 'Seller accepted your order', body: 'It is being packed now.', order_id: o.id });
    }
    res.json(orderView(db, o.id, timeScale));
  });

  // ---------- admin ----------
  app.post('/api/admin/businesses/:id/verify', requireRole('admin'), (req, res) => {
    const r = db.prepare('UPDATE businesses SET verified=? WHERE id=?').run(req.body?.verified === false ? 0 : 1, req.params.id);
    if (!r.changes) return bad(res, 'not_found', 404);
    db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES (?,?,?,?)').run(req.user.sub, 'business.verify', 'business', req.params.id);
    res.json({ ok: true });
  });
  app.get('/api/admin/fleet', requireRole('admin'), (_req, res) => {
    res.json({ riders: db.prepare('SELECT * FROM riders').all(), warehouses: db.prepare('SELECT * FROM warehouses').all() });
  });

  // ---------- payments (Razorpay) ----------
  const markPaid = (providerOrderId, paymentId, raw) => {
    const pay = db.prepare("SELECT * FROM payments WHERE provider='razorpay' AND provider_order_id=?").get(providerOrderId);
    if (!pay) return null;
    if (pay.status !== 'paid') {
      db.exec('BEGIN');
      db.prepare("UPDATE payments SET status='paid', provider_payment_id=?, raw=?, updated_at=datetime('now') WHERE id=?").run(paymentId, raw ? JSON.stringify(raw).slice(0, 4000) : pay.raw, pay.id);
      db.prepare("UPDATE orders SET payment_status='paid', updated_at=datetime('now') WHERE id=?").run(pay.order_id);
      db.prepare('INSERT INTO order_events(order_id,status,note) VALUES (?,?,?)').run(pay.order_id, 'payment', `razorpay ${paymentId}`);
      db.exec('COMMIT');
      notifyOrderParties(db, pay.order_id, 'payment_paid', 'Payment received', `₹${pay.amount_paise / 100} via Razorpay`);
    }
    return pay.order_id;
  };
  app.post('/api/payments/razorpay/verify', requireRole(), (req, res) => {
    const rzOrder = str(req.body?.razorpay_order_id, 60), rzPay = str(req.body?.razorpay_payment_id, 60), sig = str(req.body?.razorpay_signature, 200);
    const pay = db.prepare("SELECT p.*, o.customer_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.provider_order_id=?").get(rzOrder);
    if (!pay || (pay.customer_id !== req.user.sub && req.user.role !== 'admin')) return bad(res, 'not_found', 404);
    if (!payments.verifyCheckout(rzOrder, rzPay, sig)) {
      db.prepare("UPDATE payments SET status='failed', updated_at=datetime('now') WHERE id=? AND status!='paid'").run(pay.id);
      return bad(res, 'invalid_signature', 400);
    }
    const orderId = markPaid(rzOrder, rzPay);
    res.json(orderView(db, orderId, timeScale));
  });
  app.post('/api/payments/razorpay/webhook', (req, res) => {
    if (!payments.verifyWebhook(req.rawBody, req.headers['x-razorpay-signature'])) return bad(res, 'invalid_signature', 400);
    const ev = req.body?.event; const ent = req.body?.payload?.payment?.entity;
    if ((ev === 'payment.captured' || ev === 'order.paid') && ent?.order_id) markPaid(ent.order_id, ent.id, { event: ev, method: ent.method });
    if (ev === 'payment.failed' && ent?.order_id) db.prepare("UPDATE payments SET status='failed', updated_at=datetime('now') WHERE provider_order_id=? AND status!='paid'").run(ent.order_id);
    res.json({ ok: true });
  });

  // ---------- notifications (server feed; the app turns new items into device notifications) ----------
  app.get('/api/notifications', requireRole(), (req, res) => {
    const since = Math.max(0, Math.floor(num(req.query.since) || 0));
    const items = db.prepare('SELECT id,kind,title,body,order_id,read,created_at FROM notifications WHERE user_id=? AND id>? ORDER BY id DESC LIMIT 50').all(req.user.sub, since);
    const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0').get(req.user.sub).c;
    res.json({ items, unread });
  });
  app.post('/api/notifications/read', requireRole(), (req, res) => {
    db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.sub);
    res.json({ ok: true });
  });

  mountAdmin(app, { db, orderView: (id) => orderView(db, id, timeScale), bad, str, num });

  // ---------- ONDC (Beckn-shaped, PROTOTYPE: unsigned, not registry-connected) ----------
  app.post('/ondc/search', (req, res) => {
    const intent = req.body?.message?.intent || {};
    const q = str(intent.item?.descriptor?.name, 120) || 'tv';
    const gps = str(intent.fulfillment?.end?.location?.gps, 40).split(',').map(Number);
    const origin = point(gps[0], gps[1]);
    const r = searchMarketplace(loadCatalog(db), q, { origin, radiusKm: 15 });
    res.json(toBecknCatalog(req.body?.context || {}, r));
  });

  // SPA fallback + errors
  app.use('/api', (_req, res) => bad(res, 'not_found', 404));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') return bad(res, 'invalid_json');
    if (err.type === 'entity.too.large') return bad(res, 'payload_too_large', 413);
    console.error(JSON.stringify({ level: 'error', id: req.id, msg: err.message }));
    res.status(500).json({ error: 'internal_error', request_id: req.id });
  });
  return app;
}

export function orderView(db, id, timeScale) {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  const b = db.prepare('SELECT id,name,lat,lng,address,phone FROM businesses WHERE id=?').get(o.business_id);
  const r = o.rider_id ? db.prepare('SELECT id,name,vehicle FROM riders WHERE id=?').get(o.rider_id) : null;
  const items = db.prepare('SELECT product_id,name,qty,unit_price FROM order_items WHERE order_id=?').all(id);
  const route = o.route_json ? JSON.parse(o.route_json) : null;
  const tr = progress({ ...o, business: b, route }, Date.now(), timeScale);
  // Persist terminal transition once (idempotent) and free the rider.
  if (tr.status === 'delivered' && o.status !== 'delivered') {
    db.prepare("UPDATE orders SET status='delivered', payment_status=CASE WHEN payment_method='cod' THEN 'collected' ELSE payment_status END, updated_at=datetime('now') WHERE id=? AND status!='delivered'").run(id);
    if (o.rider_id) db.prepare('UPDATE riders SET available=1, lat=?, lng=? WHERE id=?').run(tr.position.lat, tr.position.lng, o.rider_id);
    db.prepare('INSERT INTO order_events(order_id,status,note) VALUES (?,?,?)').run(id, 'delivered', 'auto (simulated rider)');
    notifyOrderParties(db, id, 'order_delivered', 'Delivered', `${b.name} order delivered`);
  }
  return {
    id: o.id, business: b, rider: r, items, fulfilment: o.fulfilment, payment_method: o.payment_method, payment_status: o.payment_status,
    subtotal: o.subtotal, delivery_fee: o.delivery_fee, handling_fee: o.handling_fee, total: o.total,
    drop: o.drop_lat ? { lat: o.drop_lat, lng: o.drop_lng, address: o.drop_address } : null, route, created_at: o.created_at,
    tracking: { order_id: o.id, ...tr, rider: r, vehicle_policy: r ? vehicleFor(items.map((i) => ({ ...i, category: /TV/.test(i.name) ? 'tv' : '' }))) : null },
    events: db.prepare('SELECT status,note,at FROM order_events WHERE order_id=? ORDER BY id').all(id),
  };
}
