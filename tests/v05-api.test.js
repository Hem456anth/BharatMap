// v0.5 API: community incidents (/api/v1/incidents: create, list by bbox, votes, 2-hour expiry, rate limit, labels),
// live location sharing (/api/v1/live: create, secret-protected update, public read, expiry, delete),
// speed limits (/api/v1/speed-limits: Valhalla trace_attributes → segments; real fixture) and multi-stop routes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createProviders } from '../server/providers/index.js';

process.env.NODE_ENV = 'test';
const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8');
const upstream = [];
const fetchImpl = async (url, o = {}) => {
  upstream.push({ url, body: o.body });
  const body = /trace_attributes/.test(url) ? fx('valhalla-trace-silkboard-ecity') : /routed-car/.test(url) ? fx('osrm-drive-silkboard-ecity') : /valhalla/.test(url) ? fx('valhalla-two-dwarakanagar-rkbeach') : null;
  if (!body) throw new TypeError('fetch failed');
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
};
const clock = { t: Date.UTC(2026, 9, 19, 6, 0, 0) };
let server, B;
before(async () => {
  const providers = createProviders({ env: {}, fetchImpl, sleep: async () => {} });
  server = createApp({ db: openDb(':memory:'), timeScale: 2000, providers, now: () => clock.t }).listen(0);
  await new Promise((r) => server.once('listening', r)); B = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
const call = async (method, p, body, ua = 'client-A') => { const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json', 'User-Agent': ua }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };

test('/api/v1/incidents: create → list (labelled, unverified) → votes → expiry after 2 h', async () => {
  const c = await call('POST', '/api/v1/incidents', { type: 'waterlogging', lat: 17.7262, lng: 83.3075, note: 'Knee-deep near the underpass' });
  assert.equal(c.status, 201); assert.equal(c.body.verified, false); assert.match(c.body.label, /not verified/); assert.equal(c.body.minutes_left, 120); assert.equal(c.body.confidence, 'low');
  assert.equal((await call('POST', '/api/v1/incidents', { type: 'ufo', lat: 17.7, lng: 83.3 })).status, 400);
  assert.equal((await call('POST', '/api/v1/incidents', { type: 'pothole', lat: 51.5, lng: -0.1 })).status, 400, 'outside India');
  const list = await call('GET', '/api/v1/incidents?bbox=83.2,17.6,83.4,17.8');
  assert.equal(list.body.incidents.length, 1); assert.equal(list.body.ttl_ms, 7_200_000);
  assert.equal((await call('GET', '/api/v1/incidents?bbox=1,2,3')).status, 400);
  const id = c.body.id;
  assert.equal((await call('POST', `/api/v1/incidents/${id}/vote`, { vote: 'up' })).status, 409, 'reporter cannot vote');
  const v1 = await call('POST', `/api/v1/incidents/${id}/vote`, { vote: 'up' }, 'client-B'); assert.equal(v1.body.up, 1); assert.equal(v1.body.confidence, 'medium');
  assert.equal((await call('POST', `/api/v1/incidents/${id}/vote`, { vote: 'up' }, 'client-B')).status, 409, 'one vote per client');
  await call('POST', `/api/v1/incidents/${id}/vote`, { vote: 'up' }, 'client-C'); await call('POST', `/api/v1/incidents/${id}/vote`, { vote: 'up' }, 'client-G');
  assert.equal((await call('GET', '/api/v1/incidents?bbox=83.2,17.6,83.4,17.8')).body.incidents[0].confidence, 'high');
  clock.t += 2 * 3600_000 + 1000; // "still there" votes extend by ≤ 30 min each, capped at 2 h from the vote
  assert.equal((await call('GET', '/api/v1/incidents?bbox=83.2,17.6,83.4,17.8')).body.incidents.length, 0, 'expired');
});
test('/api/v1/incidents: two "gone" votes remove a report; per-client rate limit', async () => {
  const c = await call('POST', '/api/v1/incidents', { type: 'police', lat: 17.44, lng: 78.45 }, 'client-D');
  await call('POST', `/api/v1/incidents/${c.body.id}/vote`, { vote: 'down' }, 'client-E');
  const r = await call('POST', `/api/v1/incidents/${c.body.id}/vote`, { vote: 'down' }, 'client-F');
  assert.equal(r.body.removed, true);
  for (let i = 0; i < 9; i++) await call('POST', '/api/v1/incidents', { type: 'pothole', lat: 17.44, lng: 78.45 + i / 1000 }, 'client-D');
  assert.equal((await call('POST', '/api/v1/incidents', { type: 'pothole', lat: 17.44, lng: 78.46 }, 'client-D')).status, 429);
});
test('/api/v1/live: create, update needs the secret, public read, delete, expiry', async () => {
  const s = await call('POST', '/api/v1/live', { name: 'Hemanth', ttl_min: 30 });
  assert.equal(s.status, 201); assert.ok(s.body.id && s.body.secret);
  assert.equal((await call('GET', `/api/v1/live/${s.body.id}`)).body.active, false);
  assert.equal((await call('PUT', `/api/v1/live/${s.body.id}`, { secret: 'wrong', lat: 17.7, lng: 83.3 })).status, 404);
  assert.equal((await call('PUT', `/api/v1/live/${s.body.id}`, { secret: s.body.secret, lat: 17.7, lng: 83.3, heading: 90 })).status, 200);
  const g = await call('GET', `/api/v1/live/${s.body.id}`);
  assert.deepEqual([g.body.active, g.body.lat, g.body.name], [true, 17.7, 'Hemanth']); assert.equal(g.body.secret, undefined);
  clock.t += 31 * 60_000;
  assert.equal((await call('GET', `/api/v1/live/${s.body.id}`)).status, 404, 'expired');
  const s2 = await call('POST', '/api/v1/live', {});
  assert.equal((await call('DELETE', `/api/v1/live/${s2.body.id}`, { secret: s2.body.secret })).status, 200);
  assert.equal((await call('GET', `/api/v1/live/${s2.body.id}`)).status, 404);
});
test('/api/v1/speed-limits: Valhalla trace_attributes (real fixture) → segments scaled to the line; validation', async () => {
  const route = JSON.parse(fx('osrm-drive-silkboard-ecity')).routes[0].geometry.coordinates;
  const r = await call('POST', '/api/v1/speed-limits', { coordinates: route, mode: 'drive' });
  assert.equal(r.status, 200); assert.equal(r.body.source, 'valhalla');
  assert.ok(r.body.coverage > 0.8); assert.equal(r.body.segments[0].kmh, 40);
  assert.ok(upstream.some((u) => /trace_attributes/.test(u.url) && /edge\.speed_limit/.test(u.body)));
  assert.equal((await call('POST', '/api/v1/speed-limits', { coordinates: [[0, 51]] })).status, 400);
});
test('/api/v1/route: multi-stop via points → one OSRM request with all points, no alternatives; lanes in steps', async () => {
  const r = await call('GET', '/api/v1/route?mode=drive&from_lat=12.9172&from_lng=77.6228&to_lat=12.8452&to_lng=77.6602&via=12.88,77.64');
  assert.equal(r.status, 200);
  const u = upstream.filter((x) => /routed-car/.test(x.url)).at(-1).url;
  assert.match(u, /77\.6228,12\.9172;77\.64,12\.88;77\.6602,12\.8452\?alternatives=false/);
  assert.ok(r.body.routes[0].lanes.length >= 1);
  assert.equal((await call('GET', '/api/v1/route?mode=drive&from_lat=12.9&from_lng=77.6&to_lat=12.8&to_lng=77.6&via=99,99')).status, 400);
});
