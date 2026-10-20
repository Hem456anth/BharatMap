// v0.7 place-card services API (mounted inside /api/v1 via app.locals.v1Extra, plus /api/admin/* listing routes):
//   GET  /api/v1/places/:id/services   service panel for a place (same builder as the app: shared/services/build.js)
//   GET  /api/v1/integrations          adapter registry (status only, never keys) + public client config
//   GET  /api/v1/address/resolve       landmark-anchor address resolution (offline index + Overpass when online)
//   GET  /api/v1/traffic/status        live traffic availability; /api/v1/traffic/tiles/:z/:x/:y.png proxies TomTom/HERE
//   POST /api/v1/ondc/prototype/{search,select,init,confirm}, GET …/status/:orderId, GET …/metro   (ONDC_PROTOTYPE=1)
//   POST /api/v1/courier/:provider/quote   partner-pending stubs (501, says what is missing)
//   /api/admin/place-services, /api/admin/provider-links   listing verification + provider links (role=admin, audited)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { requireRole } from './auth.js';
import { createIntegrations, stubAdapter } from './integrations/index.js';
import { buildServicePanel } from '../shared/services/build.js';
import { panelViolations } from '../shared/services/labels.js';
import { PANEL_TYPES } from '../shared/services/panel-types.js';
import { BY_ID, PROVIDERS } from '../shared/services/catalog.js';
import { cityOf, safeLinkout } from '../shared/services/linkouts.js';
import { resolveLandmarkAddress, anchorPlacesFromIndex, buildAnchorOverpassQuery, parseAnchorElements, extractAnchors } from '../shared/address.js';
import { openingStatus } from '../web/lib/opening-hours.js';
import { encodeDigipin, inIndia, haversineKm } from '../shared/geo.js';
import { BUSINESSES } from '../shared/seed.js';
import { searchMarketplace } from '../shared/search.js';
import { loadCatalog } from './db.js';
import { toBecknCatalog } from './services/ondc.js';
import { LOCALITIES } from '../shared/seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let INDEX = null;
const offlineIndex = () => { if (!INDEX) { try { INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/offline/search/index.json'), 'utf8')); } catch { INDEX = { places: [] }; } } return INDEX; };
const TAG_KEY = /^[a-z_:0-9]{1,40}$/;

export function mountServices(app, { db, v1, placeOrder, orderView, env = process.env, bad, str, num }) {
  const integrations = createIntegrations({ env, payments: null });
  const providers = v1?.providers, transit = v1?.transit;
  const r = express.Router();
  const ondcOn = () => env.ONDC_PROTOTYPE === '1';

  r.get('/integrations', (_req, res) => res.json({ integrations: integrations.list(), client: integrations.clientConfig(), classes: ['functional', 'deeplink', 'prototype', 'partner-pending', 'linkout', 'unavailable', 'demo'] }));

  // ---------- services for a place ----------
  r.get('/places/:id/services', async (req, res) => {
    const id = String(req.params.id || '').slice(0, 80);
    let tags = {};
    if (req.query.tags) { try { const t = JSON.parse(String(req.query.tags).slice(0, 8000)); for (const [k, v] of Object.entries(t || {})) if (TAG_KEY.test(k) && typeof v === 'string') tags[k] = v.slice(0, 300); } catch { return bad(res, 'invalid_tags'); } }
    let lat = num(req.query.lat), lng = num(req.query.lng), name = str(req.query.name, 120);
    let seller = null;
    const sm = /^seller:(b\d+)$/.exec(id);
    if (sm) { seller = BUSINESSES.find((b) => b.id === sm[1]) || null; if (!seller) return bad(res, 'not_found', 404); lat = seller.lat; lng = seller.lng; name = seller.name; tags = { phone: seller.phone, ...tags }; }
    // OSM element without tags from the client: look it up by id (online only).
    const om = /^osm:(node|way|relation)\/(\d{1,12})$/.exec(id);
    if (om && !Object.keys(tags).length && providers && env.OFFLINE !== '1') {
      try { const j = await providers.overpass(`[out:json][timeout:15];${om[1]}(${om[2]});out center tags;`); const e = j?.elements?.[0]; if (e) { tags = e.tags || {}; lat = e.lat ?? e.center?.lat; lng = e.lon ?? e.center?.lon; name = name || tags.name || ''; } } catch { /* no tags: panel from what we have */ }
    }
    if (!inIndia({ lat, lng })) return bad(res, 'invalid_point');
    const place = { id, name, lat, lng, tags, category: str(req.query.category, 20) || null };
    const listing = db.prepare('SELECT * FROM place_services WHERE place_id=?').get(id) || null;
    const verifiedLinks = db.prepare('SELECT id, provider_id, label, url, host, kind FROM provider_links WHERE place_id=? AND verified=1 ORDER BY id').all(id);
    const ctx = { now: Date.now(), online: true, seller, config: integrations.clientConfig(), verifiedLinks, hours: tags.opening_hours ? openingStatus(tags.opening_hours) : null, digipin: encodeDigipin(lat, lng), forceType: listing?.panel_type || null };
    if (transit) {
      const d = transit.departures(place, { date: req.query.date, time: req.query.time });
      if (d.status === 'ready' || /station|halt|subway|bus_stop|platform/.test(JSON.stringify(tags))) ctx.departures = d;
    }
    const oLat = num(req.query.origin_lat), oLng = num(req.query.origin_lng);
    if (inIndia({ lat: oLat, lng: oLng })) {
      ctx.origin = { lat: oLat, lng: oLng, real: true, label: 'My location' };
      if (req.query.eta === '1' && providers) {
        try { const rt = await providers.route('drive', ctx.origin, place, { alternates: 0 }); const x = rt.routes?.[0]; if (x) ctx.rideEstimate = { status: 'ready', duration_s: x.duration_s, distance_m: x.distance_m, engine: rt.engine, fallback: !!rt.fallback }; } catch { ctx.rideEstimate = { status: 'error' }; }
      }
    }
    if (!ctx.rideEstimate) ctx.rideEstimate = { status: 'client' }; // the app computes the ETA with its own routing
    const panel = buildServicePanel(place, ctx);
    const violations = panelViolations(panel);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json({ place: { id, name, lat, lng, city: cityOf(place) }, panel, listing: listing ? { verification: listing.verification, note: listing.note } : null, honesty: { violations }, generated_at: new Date().toISOString() });
  });

  // ---------- landmark-anchor address resolution ----------
  r.get('/address/resolve', async (req, res) => {
    const q = str(req.query.q, 200);
    if (q.length < 3) return bad(res, 'q_required');
    const base = resolveLandmarkAddress(q, { places: [] });
    const loc = base.base.components.locality ? LOCALITIES.find((l) => l.name === base.base.components.locality) : null;
    if (!loc) return res.json({ ...base, sources: [] });
    const places = anchorPlacesFromIndex(offlineIndex(), loc, 3);
    const sources = ['offline-index'];
    if (req.query.offline !== '1' && env.OFFLINE !== '1' && providers) {
      const anchors = extractAnchors(q).map((a) => a.phrase);
      const oq = anchors.length ? buildAnchorOverpassQuery(anchors, loc, 2500) : null;
      if (oq) { try { places.push(...parseAnchorElements(await providers.overpass(oq))); sources.push('overpass'); } catch { sources.push('overpass-unreachable'); } }
    }
    res.json({ ...resolveLandmarkAddress(q, { places }), sources, attribution: '© OpenStreetMap contributors (ODbL)' });
  });

  // ---------- traffic ----------
  r.get('/traffic/status', (_req, res) => {
    const t = integrations.traffic;
    res.json(t ? { available: true, provider: t.provider, name: t.name, attribution: t.attribution, tiles: '/api/v1/traffic/tiles/{z}/{x}/{y}.png', label: 'live' } : { available: false, reason: 'no_traffic_provider_configured', label: 'unavailable', message: 'Live traffic unavailable' });
  });
  const tileCache = new Map();
  r.get('/traffic/tiles/:z/:x/:y.png', async (req, res) => {
    const t = integrations.traffic; if (!t) return bad(res, 'traffic_unavailable', 404);
    const z = +req.params.z, x = +req.params.x, y = +req.params.y;
    if (![z, x, y].every(Number.isInteger) || z < 3 || z > 18 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return bad(res, 'invalid_tile');
    const k = `${z}/${x}/${y}`; const hit = tileCache.get(k);
    if (hit && hit.exp > Date.now()) { res.type('png').setHeader('Cache-Control', 'public, max-age=120'); return res.end(hit.body); }
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
      const up = await fetch(t.tiles(z, x, y), { signal: ctl.signal }); clearTimeout(tm);
      if (!up.ok) return res.sendStatus(up.status === 403 ? 502 : up.status);
      const body = Buffer.from(await up.arrayBuffer());
      if (tileCache.size > 2000) tileCache.delete(tileCache.keys().next().value);
      tileCache.set(k, { body, exp: Date.now() + 120_000 }); // ≤ 2 min: live data must not be served stale
      res.type('png').setHeader('Cache-Control', 'public, max-age=120'); res.end(body);
    } catch { res.sendStatus(502); }
  });

  // ---------- ONDC buyer flow: PROTOTYPE against Bharat's own demo network (no registry, unsigned) ----------
  const ondcGuard = (req, res, next) => (ondcOn() ? next() : bad(res, 'ondc_prototype_disabled', 404));
  const ctxOut = (action, c = {}) => ({ domain: c.domain || 'ONDC:RET10', action, version: '1.2.0', bap_id: env.ONDC_BAP_ID || 'bharatmap.prototype.bap', transaction_id: c.transaction_id || crypto.randomUUID(), message_id: crypto.randomUUID(), timestamp: new Date().toISOString(), country: 'IND', prototype: true, network: 'bharat-demo (not ONDC)' });
  r.post('/ondc/prototype/search', ondcGuard, (req, res) => {
    const q = str(req.body?.q, 120) || 'grocery';
    const seller = str(req.body?.seller_id, 20);
    const lat = num(req.body?.lat), lng = num(req.body?.lng);
    const origin = inIndia({ lat, lng }) ? { lat, lng } : null;
    let result = searchMarketplace(loadCatalog(db), q, { origin, radiusKm: 15 });
    if (seller) { const b = loadCatalog(db).find((x) => x.id === seller); result = { results: b ? [{ business: b, products: b.products.filter((p) => p.active !== false).slice(0, 12) }] : [] }; }
    const cat = toBecknCatalog({ ...ctxOut('search'), domain: req.body?.domain === 'food' ? 'ONDC:RET11' : 'ONDC:RET10' }, result);
    res.json({ ...cat, context: { ...cat.context, prototype: true, network: 'bharat-demo (not ONDC)' }, provenance: 'demo', note: 'Prototype: Bharat demo sellers in Beckn on_search shape. Not the ONDC network; prices are Demo data.' });
  });
  const quote = (items) => {
    const lines = []; let total = 0;
    for (const it of (Array.isArray(items) ? items : []).slice(0, 20)) {
      const p = db.prepare('SELECT id,name,price,stock,business_id FROM products WHERE id=? AND active=1').get(str(it.id, 40)); if (!p) continue;
      const qty = Math.max(1, Math.min(20, Math.floor(num(it.quantity?.count ?? it.qty) || 1)));
      lines.push({ id: p.id, name: p.name, qty, price: p.price, business_id: p.business_id }); total += p.price * qty;
    }
    return { lines, total };
  };
  r.post('/ondc/prototype/select', ondcGuard, (req, res) => {
    const q = quote(req.body?.items);
    if (!q.lines.length) return bad(res, 'items_required');
    res.json({ context: ctxOut('on_select', req.body?.context), message: { order: { items: q.lines.map((l) => ({ id: l.id, quantity: { count: l.qty } })), quote: { price: { currency: 'INR', value: String(q.total) }, breakup: q.lines.map((l) => ({ title: l.name, price: { currency: 'INR', value: String(l.price * l.qty) } })) } } }, provenance: 'demo' });
  });
  r.post('/ondc/prototype/init', ondcGuard, (req, res) => {
    const q = quote(req.body?.items);
    if (!q.lines.length) return bad(res, 'items_required');
    res.json({ context: ctxOut('on_init', req.body?.context), message: { order: { payment: { type: 'ON-ORDER', collected_by: 'BAP', status: 'NOT-PAID', note: 'Payment happens on Bharat\'s separate payment screen; nothing is paid at init.' } } }, provenance: 'demo' });
  });
  r.post('/ondc/prototype/confirm', ondcGuard, requireRole('customer', 'admin'), async (req, res) => {
    const q = quote(req.body?.items);
    if (!q.lines.length) return bad(res, 'items_required');
    const biz = q.lines[0].business_id;
    if (q.lines.some((l) => l.business_id !== biz)) return bad(res, 'single_provider_only');
    const out = await placeOrder(req.user, { business_id: biz, items: q.lines.map((l) => ({ product_id: l.id, qty: l.qty })), fulfilment: req.body?.fulfilment === 'delivery' ? 'delivery' : 'pickup', drop: req.body?.drop, payment_method: req.body?.payment_method === 'cod' ? 'cod' : 'online' }, { source: 'ondc-prototype' });
    if (out.code !== 201) return res.status(out.code).json(out.body);
    res.status(201).json({ context: ctxOut('on_confirm', req.body?.context), message: { order: { id: out.body.id, state: out.body.status === 'pending_payment' ? 'Created' : 'Accepted', provider: { id: biz } } }, order: out.body, provenance: 'demo' });
  });
  r.get('/ondc/prototype/status/:orderId', ondcGuard, requireRole(), (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id=? AND source=?').get(str(req.params.orderId, 40), 'ondc-prototype');
    if (!o || (o.customer_id !== req.user.sub && req.user.role !== 'admin')) return bad(res, 'not_found', 404);
    const v = orderView(o.id);
    res.json({ context: ctxOut('on_status'), message: { order: { id: o.id, state: v.tracking.status, fulfillments: [{ state: { descriptor: { code: v.tracking.status } } }] } }, provenance: 'demo' });
  });
  // Metro tickets: coverage only (operators on ONDC). Never a fare without a provider quote; Hyderabad is not on ONDC.
  r.get('/ondc/prototype/metro', ondcGuard, (req, res) => {
    const city = str(req.query.city, 20);
    const ops = PROVIDERS.filter((p) => p.kind === 'metro' && (!city || p.city === city)).map((p) => ({ id: p.id, name: p.name, city: p.city, on_ondc: p.ticketing === 'ondc', ticketing: p.ticketing, reason: p.reason }));
    res.json({ operators: ops, fares: null, note: 'Prototype coverage list from the provider catalogue. Real QR tickets need ONDC onboarding; no fares are shown without a quote.' });
  });

  // ---------- courier stubs ----------
  r.post('/courier/:provider/quote', (req, res) => {
    const id = req.params.provider; if (!['shiprocket', 'delhivery'].includes(id)) return bad(res, 'unknown_provider', 404);
    try { stubAdapter(id, env).run(); } catch (e) { return res.status(501).json({ error: e.message, class: 'partner-pending', reason: BY_ID[id].reason }); }
  });
  app.locals.v1Extra = r;

  // ---------- admin: listing verification + provider links ----------
  const admin = requireRole('admin');
  const audit = (req, action, entity, id) => db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES (?,?,?,?)').run(req.user.sub, action, entity, String(id));
  const PLACE_ID = /^(osm:(node|way|relation)\/\d{1,12}|seller:b\d{1,4})$/;
  app.get('/api/admin/place-services', admin, (req, res) => {
    const items = db.prepare(`SELECT ps.*, (SELECT COUNT(*) FROM provider_links pl WHERE pl.place_id=ps.place_id) links, (SELECT COUNT(*) FROM provider_links pl WHERE pl.place_id=ps.place_id AND pl.verified=1) verified_links
      FROM place_services ps ORDER BY ps.updated_at DESC LIMIT 200`).all();
    const sellers = BUSINESSES.map((b) => ({ place_id: `seller:${b.id}`, name: b.name, demo: true }));
    res.json({ items, sellers, panel_types: PANEL_TYPES, providers: PROVIDERS.filter((p) => p.url && p.class !== 'unavailable').map((p) => ({ id: p.id, name: p.name, domain: p.domain })) });
  });
  app.put('/api/admin/place-services/:placeId', admin, (req, res) => {
    const id = String(req.params.placeId); if (!PLACE_ID.test(id)) return bad(res, 'invalid_place_id');
    const ver = ['unverified', 'pending', 'verified', 'rejected'].includes(req.body?.verification) ? req.body.verification : 'unverified';
    const type = req.body?.panel_type ? String(req.body.panel_type) : null; if (type && !PANEL_TYPES.includes(type)) return bad(res, 'invalid_panel_type');
    const lat = num(req.body?.lat), lng = num(req.body?.lng);
    db.prepare(`INSERT INTO place_services(place_id,name,lat,lng,panel_type,verification,note,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(place_id) DO UPDATE SET name=COALESCE(excluded.name,name), lat=COALESCE(excluded.lat,lat), lng=COALESCE(excluded.lng,lng), panel_type=excluded.panel_type, verification=excluded.verification, note=excluded.note, updated_by=excluded.updated_by, updated_at=datetime('now')`)
      .run(id, str(req.body?.name, 120) || null, Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null, type, ver, str(req.body?.note, 300) || null, req.user.sub);
    audit(req, `listing.update verification=${ver}`, 'place', id);
    res.json(db.prepare('SELECT * FROM place_services WHERE place_id=?').get(id));
  });
  app.get('/api/admin/provider-links', admin, (req, res) => {
    const pid = str(req.query.place_id, 80);
    res.json({ items: pid ? db.prepare('SELECT * FROM provider_links WHERE place_id=? ORDER BY id').all(pid) : db.prepare('SELECT * FROM provider_links ORDER BY id DESC LIMIT 200').all() });
  });
  app.post('/api/admin/provider-links', admin, (req, res) => {
    const pid = str(req.body?.place_id, 80); if (!PLACE_ID.test(pid)) return bad(res, 'invalid_place_id');
    const url = str(req.body?.url, 500); if (!safeLinkout(url) || url.startsWith('tel:') || url.startsWith('intent:')) return bad(res, 'invalid_url');
    const provider = str(req.body?.provider_id, 40) || 'website';
    if (provider !== 'website' && !BY_ID[provider]) return bad(res, 'unknown_provider');
    if (BY_ID[provider]?.class === 'unavailable') return bad(res, 'provider_unavailable');
    const kind = ['linkout', 'tickets', 'menu', 'reserve', 'order', 'info'].includes(req.body?.kind) ? req.body.kind : 'linkout';
    try {
      const r2 = db.prepare('INSERT INTO provider_links(place_id,provider_id,label,url,host,kind,verified,added_by) VALUES (?,?,?,?,?,?,0,?)').run(pid, provider, str(req.body?.label, 80) || null, url, new URL(url).host, kind, req.user.sub);
      audit(req, `provider_link.add ${provider}`, 'provider_link', r2.lastInsertRowid);
      res.status(201).json(db.prepare('SELECT * FROM provider_links WHERE id=?').get(r2.lastInsertRowid));
    } catch (e) { return bad(res, /UNIQUE/.test(e.message) ? 'duplicate_link' : 'insert_failed', 409); }
  });
  app.patch('/api/admin/provider-links/:id', admin, (req, res) => {
    const l = db.prepare('SELECT * FROM provider_links WHERE id=?').get(Number(req.params.id)); if (!l) return bad(res, 'not_found', 404);
    const v = req.body?.verified ? 1 : 0;
    db.prepare('UPDATE provider_links SET verified=?, verified_by=? WHERE id=?').run(v, v ? req.user.sub : null, l.id);
    audit(req, `provider_link.verify=${v}`, 'provider_link', l.id);
    res.json(db.prepare('SELECT * FROM provider_links WHERE id=?').get(l.id));
  });
  app.delete('/api/admin/provider-links/:id', admin, (req, res) => {
    const r2 = db.prepare('DELETE FROM provider_links WHERE id=?').run(Number(req.params.id)); if (!r2.changes) return bad(res, 'not_found', 404);
    audit(req, 'provider_link.delete', 'provider_link', req.params.id);
    res.json({ ok: true });
  });
  return { integrations };
}
