// v0.4 API: /api/v1 (route, geocode, reverse, places/nearby, ev, tolls, transit, regions, providers), per-IP rate
// limiting, gzip, client config. Boots the real Express app with providers wired to a fake upstream (real fixtures).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createProviders } from '../server/providers/index.js';
import { TokenBucketLimiter } from '../server/lib/ratelimit.js';

process.env.NODE_ENV = 'test';
const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8');
const upstreamLog = [];
const fetchImpl = async (url, o = {}) => {
  upstreamLog.push({ url, ua: o.headers?.['User-Agent'] });
  const body = /valhalla/.test(url) ? fx('valhalla-two-dwarakanagar-rkbeach') : /routed-car/.test(url) ? (url.includes('83.0037') ? fx('osrm-drive-dwarakanagar-anakapalli') : fx('osrm-drive-dwarakanagar-rkbeach'))
    : /photon/.test(url) ? fx('photon-kailasa') : /nominatim.*reverse/.test(url) ? fx('nominatim-reverse-dwarakanagar') : /nominatim/.test(url) ? fx('nominatim-search-kailasagiri')
      : /overpass/.test(url) ? (decodeURIComponent(o.body || '').includes('toll_booth') ? fx('overpass-tolls-dwarakanagar-anakapalli') : decodeURIComponent(o.body || '').includes('charging_station') ? fx('overpass-ev-dwarakanagar') : fx('overpass-fuel-dwarakanagar')) : null;
  if (!body) throw new TypeError('fetch failed');
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
};
let server, B;
before(async () => {
  const providers = createProviders({ env: {}, fetchImpl, sleep: async () => {} });
  server = createApp({ db: openDb(':memory:'), timeScale: 2000, providers }).listen(0);
  await new Promise((r) => server.once('listening', r)); B = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
const get = async (p, h = {}) => { const r = await fetch(B + p, { headers: h }); return { status: r.status, body: await r.json().catch(() => null), headers: r.headers }; };

test('/api/v1/route: two-wheeler via Valhalla (not an estimate), drive via OSRM, validation', async () => {
  const two = await get('/api/v1/route?mode=two&from_lat=17.7289&from_lng=83.305&to_lat=17.714&to_lng=83.323');
  assert.equal(two.status, 200); assert.equal(two.body.provider, 'valhalla'); assert.equal(two.body.estimate, false); assert.ok(two.body.routes.length >= 2);
  const drive = await get('/api/v1/route?mode=drive&from_lat=17.7289&from_lng=83.305&to_lat=17.714&to_lng=83.323');
  assert.equal(drive.body.provider, 'osrm'); assert.ok(drive.body.routes[0].steps.length > 3);
  assert.equal((await get('/api/v1/route?mode=drive&from_lat=51&from_lng=0&to_lat=17.7&to_lng=83.3')).status, 400, 'outside India');
  assert.equal((await get('/api/v1/route?mode=hover&from_lat=17.7&from_lng=83.3&to_lat=17.71&to_lng=83.31')).status, 400);
  assert.ok(upstreamLog.every((l) => /BharatMap\/0\.5/.test(l.ua)), 'identifying UA on every upstream call');
});
test('/api/v1/geocode + /reverse + /places/nearby + /ev', async () => {
  const g = await get('/api/v1/geocode?q=Kailasa&autocomplete=1&lat=17.72&lng=83.3');
  assert.equal(g.body.provider, 'photon'); assert.ok(g.body.items.length >= 2);
  assert.equal((await get('/api/v1/geocode?q=a')).status, 400);
  const rv = await get('/api/v1/reverse?lat=17.7262&lng=83.3075'); assert.match(rv.body.item.address, /Visakhapatnam/);
  const pn = await get('/api/v1/places/nearby?category=fuel&lat=17.7289&lng=83.305&radius=2000');
  assert.equal(pn.body.provider, 'overpass'); assert.ok(pn.body.items.length >= 10);
  assert.equal((await get('/api/v1/places/nearby?category=casino&lat=17.7289&lng=83.305')).status, 400);
  const ev = await get('/api/v1/ev?lat=17.7289&lng=83.305'); assert.ok(ev.body.items.every((x) => x.ev));
});
test('/api/v1/tolls: plazas along the real Anakapalli route, no fees', async () => {
  const route = JSON.parse(fx('osrm-drive-dwarakanagar-anakapalli')).routes[0].geometry.coordinates;
  const r = await fetch(`${B}/api/v1/tolls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ coordinates: route }) });
  const j = await r.json();
  assert.equal(j.count, 2); assert.equal(j.fees, null); assert.match(j.note, /fees not available/);
  const badR = await fetch(`${B}/api/v1/tolls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ coordinates: [[0, 0]] }) });
  assert.equal(badR.status, 400);
});
test('/api/v1/transit: HMRL feed loaded with attribution; plan returns scheduled itineraries; stops with departures', async () => {
  const f = await get('/api/v1/transit/feeds');
  const h = f.body.feeds.find((x) => x.id === 'hmrl');
  assert.ok(h); assert.match(h.attribution, /Contains data provided by Hyderabad Metro Rail Ltd/);
  const p = await get('/api/v1/transit/plan?from_lat=17.4966&from_lng=78.3731&to_lat=17.4013&to_lng=78.5602&date=2026-10-21&time=09:00');
  assert.equal(p.body.scheduled, true); assert.match(p.body.label, /not live/);
  assert.ok(p.body.itineraries.length >= 1); assert.ok(p.body.itineraries[0].legs.some((l) => l.type === 'ride'));
  const none = await get('/api/v1/transit/plan?from_lat=17.7289&from_lng=83.305&to_lat=17.714&to_lng=83.323');
  assert.equal(none.body.itineraries.length, 0); assert.equal(none.body.reason, 'no_feed_covers_trip');
  const s = await get('/api/v1/transit/stops?lat=17.4357&lng=78.4448');
  assert.match(s.body.stops[0].name, /Ameerpet/);
});
test('/api/v1/regions catalogue (9 cities), /api/v1/providers status, gzip, client config', async () => {
  const r = await get('/api/v1/regions');
  assert.equal(r.body.regions.length, 9);
  assert.deepEqual(r.body.regions.map((x) => x.id).sort(), ['bengaluru', 'chennai', 'delhi', 'hyderabad', 'kolkata', 'mumbai', 'pune', 'vijayawada', 'visakhapatnam']);
  const st = await get('/api/v1/providers'); assert.ok(st.body.providers.valhalla); assert.equal(st.body.providers.ocm.configured, false);
  const raw = await new Promise((resolve) => { import('node:http').then(({ get: hg }) => hg(`${B}/api/v1/regions`, { headers: { 'accept-encoding': 'gzip' } }, (res) => { const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => resolve({ enc: res.headers['content-encoding'], buf: Buffer.concat(ch) })); })); });
  assert.equal(raw.enc, 'gzip'); assert.equal(JSON.parse(zlib.gunzipSync(raw.buf)).regions.length, 9);
  const cfg = await (await fetch(`${B}/config.js`)).text(); assert.match(cfg, /"services":"direct"/);
  assert.equal((await get('/api/health')).body.version, '0.5.0');
});
test('per-IP rate limit on /api/v1 (429 + Retry-After)', async () => {
  const providers = createProviders({ env: { OFFLINE: '1' } });
  const express = (await import('express')).default; const { mountApiV1 } = await import('../server/api-v1.js');
  const app = express(); mountApiV1(app, { root: new URL('..', import.meta.url).pathname, providers, limiter: new TokenBucketLimiter({ capacity: 2, refillPerSec: 0.001 }) });
  const s = app.listen(0); await new Promise((r) => s.once('listening', r));
  const u = `http://127.0.0.1:${s.address().port}/api/v1/transit/feeds`;
  const codes = []; for (let i = 0; i < 3; i++) codes.push((await fetch(u)).status);
  const last = await fetch(u); s.close();
  assert.deepEqual(codes, [200, 200, 429]); assert.ok(Number(last.headers.get('retry-after')) > 0);
});
