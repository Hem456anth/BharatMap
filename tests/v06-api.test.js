// v0.6 API: offline search v2 over SQLite FTS5 (/api/v1/places/search) and India road hints (/api/v1/road-hints:
// Valhalla trace_attributes + Overpass tags; real captured fixtures for the Dwaraka Nagar → Anakapalli NH16 route).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createProviders } from '../server/providers/index.js';

process.env.NODE_ENV = 'test';
process.env.SEARCH_DB = `${process.env.TMPDIR || '/tmp'}/bm-search-api-${process.pid}.db`;
const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8');
const fetchImpl = async (url, o = {}) => {
  const body = /trace_attributes/.test(url) ? fx('valhalla-roadhints-dwarakanagar-anakapalli') : /overpass/.test(url) ? fx('overpass-roadhints-dwarakanagar-anakapalli') : null;
  if (!body) throw new TypeError('fetch failed');
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
};
let server, B;
before(async () => {
  const providers = createProviders({ env: {}, fetchImpl, sleep: async () => {} });
  server = createApp({ db: openDb(':memory:'), providers }).listen(0);
  await new Promise((r) => server.once('listening', r)); B = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); for (const f of [process.env.SEARCH_DB, `${process.env.SEARCH_DB}-wal`, `${process.env.SEARCH_DB}-shm`]) fs.rmSync(f, { force: true }); });
const get = async (p) => { const r = await fetch(B + p); return { status: r.status, body: await r.json() }; };

test('/api/v1/places/search: FTS5 engine, Latin ↔ Telugu/Hindi, pincode, DIGIPIN', async () => {
  const a = await get('/api/v1/places/search?q=simhachalam&lat=17.7289&lng=83.305');
  assert.equal(a.status, 200); assert.equal(a.body.engine, 'fts5'); assert.equal(a.body.results[0].names.te, 'సింహాచలం');
  const b = await get(`/api/v1/places/search?q=${encodeURIComponent('గాజువాక')}&lat=17.7289&lng=83.305`);
  assert.equal(b.body.results[0].name, 'Gajuwaka');
  const c = await get(`/api/v1/places/search?q=${encodeURIComponent('चारमीनार')}&lat=17.4375&lng=78.4483&limit=3`);
  assert.match(c.body.results[0].name, /^Charminar/); assert.ok(c.body.results.length <= 3);
  const p = await get('/api/v1/places/search?q=530016'); assert.equal(p.body.results[0].kind, 'postcode');
  const d = await get('/api/v1/places/search?q=4P3-JK8-52C9'); assert.equal(d.body.results[0].kind, 'digipin');
  assert.deepEqual((await get('/api/v1/places/search?q=a')).body.results, []);
});

test('/api/v1/road-hints: flyover events on the NH16 route (real Valhalla + Overpass fixtures); invalid lines rejected', async () => {
  const coords = JSON.parse(fx('osrm-drive-dwarakanagar-anakapalli')).routes[0].geometry.coordinates;
  const r = await fetch(`${B}/api/v1/road-hints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coordinates: coords, mode: 'drive' }) });
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.source, 'valhalla+overpass');
  const fly = j.events.filter((e) => e.type === 'flyover');
  assert.ok(fly.length >= 3 && fly[0].atM > 2000 && fly[0].atM < 3000, JSON.stringify(fly[0]));
  const bad = await fetch(`${B}/api/v1/road-hints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coordinates: [[0, 51], [0.1, 51]] }) });
  assert.equal(bad.status, 400);
});
