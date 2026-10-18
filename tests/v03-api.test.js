// v0.3 API + shell integration: saved-places sync endpoints, CSP (header == <meta> in the app shell),
// migration 003, version. Boots the real Express app with an in-memory DB.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { cspString, THIRD_PARTY_HOSTS } from '../shared/csp.js';

process.env.NODE_ENV = 'test';
process.env.OFFLINE = '1';
let server, B, db;
const j = async (method, path, body, token) => {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};
const login = async (email) => (await j('POST', '/api/auth/login', { email, password: 'demo1234' })).body.token;
before(async () => { db = openDb(':memory:'); server = createApp({ db, timeScale: 2000 }).listen(0); await new Promise((r) => server.once('listening', r)); B = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());

test('saved places: auth required, round-trip, normalised, isolated per user, size-capped', async () => {
  assert.equal((await j('GET', '/api/me/places')).status, 401);
  const tok = await login('customer@mapos.demo');
  assert.deepEqual((await j('GET', '/api/me/places', null, tok)).body.data, null);
  const doc = { home: { id: 'osm:node/1', name: 'Home', lat: 17.72, lng: 83.3 }, lists: [{ id: 'favorites', items: [{ id: 'x', name: 'RK Beach', lat: 17.714, lng: 83.323, evil: '<script>' }, { name: 'bad', lat: 'NaN' }] }], updated_ms: 5 };
  assert.equal((await j('PUT', '/api/me/places', doc, tok)).status, 200);
  const back = (await j('GET', '/api/me/places', null, tok)).body.data;
  assert.equal(back.home.name, 'Home');
  assert.equal(back.lists[0].items.length, 1, 'invalid item dropped');
  assert.equal(back.lists[0].items[0].evil, undefined, 'unknown fields stripped');
  const admin = await login('admin@mapos.demo');
  assert.equal((await j('GET', '/api/me/places', null, admin)).body.data, null, 'other users cannot see it');
  const huge = { lists: Array.from({ length: 20 }, (_, i) => ({ id: `l${i}`, name: 'x'.repeat(60), items: Array.from({ length: 200 }, (_, k) => ({ id: `p${k}`, name: 'y'.repeat(120), lat: 17, lng: 83, address: 'z'.repeat(240) })) })) };
  const r = await j('PUT', '/api/me/places', huge, tok);
  assert.ok([413].includes(r.status), `expected 413, got ${r.status}`);
  assert.equal((await j('PUT', '/api/me/places', [1, 2], tok)).status, 400);
});

test('CSP: server header equals the app-shell <meta>, and lists only the required third-party hosts', async () => {
  const r = await j('GET', '/api/health');
  const header = r.headers.get('content-security-policy');
  assert.equal(header, cspString());
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(meta, cspString());
  const connect = header.split('; ').find((d) => d.startsWith('connect-src')).split(' ').slice(1);
  for (const h of THIRD_PARTY_HOSTS) assert.ok(connect.includes(h), h);
  assert.ok(!connect.includes('https:') && !connect.includes('*'), 'no wildcard schemes');
  assert.ok(header.includes("script-src 'self' https://checkout.razorpay.com"), 'no inline scripts');
  assert.ok(!/<script>[^<]/.test(html.replace(/<script type="application\/ld\+json">[^<]*<\/script>/, '')), 'no inline <script> in the shell');
});

test('version 0.4 + migration 003 + map style proxy accepts only known styles', async () => {
  assert.equal((await j('GET', '/api/health')).body.version, '0.5.0');
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE version='003_saved_places.sql'").get());
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='user_places'").get());
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.match(pkg.version, /^0\.5\./);
});

test('service worker precache list only names files that exist (install would fail otherwise)', () => {
  const sw = fs.readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  const assets = JSON.parse(sw.match(/const ASSETS = (\[[^\]]+\])/)[1]);
  for (const a of assets.filter((x) => x !== '/')) {
    const local = a.startsWith('/shared/') ? `../${a.slice(1)}` : `../web${a}`;
    assert.ok(fs.existsSync(new URL(local, import.meta.url)), a);
  }
  for (const m of ['/shell.js', '/ui/sheet.js', '/nav/navigation.js', '/services/routing.js']) assert.ok(assets.includes(m), m);
});
