// Integration tests: boots the real Express app on an ephemeral port with an in-memory DB.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';

process.env.NODE_ENV = 'test';
process.env.OFFLINE = '1'; // deterministic: no external OSRM/Nominatim calls in CI
let server, B, db;
const j = async (method, path, body, token) => {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};
const login = async (email) => (await j('POST', '/api/auth/login', { email, password: 'demo1234' })).body.token;

before(async () => {
  db = openDb(':memory:');
  const app = createApp({ db, timeScale: 2000 });
  await new Promise((res) => { server = app.listen(0, res); });
  B = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('health + security headers', async () => {
  const r = await j('GET', '/api/health');
  assert.equal(r.status, 200); assert.equal(r.body.db, true);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('content-security-policy').includes("default-src 'self'"));
  assert.equal(r.headers.get('x-powered-by'), null);
});
test('search validates input and returns sellers', async () => {
  assert.equal((await j('GET', '/api/search')).status, 400);
  const r = await j('GET', '/api/search?q=LED%20TVs%20near%20me&lat=17.7289&lng=83.3050');
  assert.equal(r.status, 200); assert.ok(r.body.count >= 3); assert.equal(r.body.results[0].business.name, 'Sri Sai Electronics');
});
test('geocode, reverse, digipin, route (offline fallback), optimize', async () => {
  const g = await j('GET', `/api/geocode?q=${encodeURIComponent('near RTC complex, Dwaraka Nagar, Vizag')}`);
  assert.equal(g.body.best.source, 'landmark'); assert.ok(g.body.best.digipin);
  assert.ok((await j('GET', '/api/reverse?lat=17.7289&lng=83.3050')).body.digipin);
  assert.equal((await j('GET', '/api/reverse?lat=51&lng=0')).status, 400);
  assert.equal((await j('GET', '/api/digipin/39J-49L-L8T4')).status, 200);
  const rt = await j('GET', '/api/route?from_lat=17.7215&from_lng=83.307&to_lat=17.714&to_lng=83.323');
  assert.equal(rt.body.engine, 'fallback-straight-line'); assert.ok(rt.body.distance_m > 1000);
  const op = await j('POST', '/api/route/optimize', { start: { lat: 17.72, lng: 83.30 }, stops: [{ lat: 17.80, lng: 83.37 }, { lat: 17.73, lng: 83.31 }] });
  assert.equal(op.body.sequence.length, 2);
});
test('assistant + mobility + i18n + ONDC catalog', async () => {
  const a = await j('POST', '/api/assistant', { query: 'టీవీ దగ్గర', lat: 17.7289, lng: 83.305 });
  assert.equal(a.body.intent, 'product_search');
  const m = await j('GET', '/api/mobility?kind=metro&lat=17.4375&lng=78.4483');
  assert.equal(m.body.items[0].kind, 'metro');
  assert.equal((await j('GET', '/api/i18n')).body.languages.length, 11);
  const o = await j('POST', '/ondc/search', { context: { domain: 'ONDC:RET14' }, message: { intent: { item: { descriptor: { name: 'led tv' } }, fulfillment: { end: { location: { gps: '17.7289,83.3050' } } } } } });
  assert.equal(o.body.context.action, 'on_search'); assert.ok(o.body.message.catalog['bpp/providers'].length >= 1);
});
test('auth: register, bad login, lockout, protected routes, RBAC', async () => {
  const reg = await j('POST', '/api/auth/register', { email: 'new@user.in', name: 'New', password: 'longpassword' });
  assert.equal(reg.status, 201);
  assert.equal((await j('POST', '/api/auth/register', { email: 'new@user.in', name: 'New', password: 'longpassword' })).status, 409);
  assert.equal((await j('POST', '/api/auth/register', { email: 'x@y.in', name: 'X', password: 'short' })).status, 400);
  assert.equal((await j('GET', '/api/me')).status, 401);
  assert.equal((await j('GET', '/api/me', null, 'forged.token.here')).status, 401);
  for (let i = 0; i < 5; i++) await j('POST', '/api/auth/login', { email: 'lock@me.in', password: 'nope' });
  assert.equal((await j('POST', '/api/auth/login', { email: 'lock@me.in', password: 'nope' })).status, 429);
  const cust = await login('customer@mapos.demo');
  assert.equal((await j('GET', '/api/seller/dashboard', null, cust)).status, 403);
  assert.equal((await j('POST', '/api/admin/businesses/b4/verify', {}, cust)).status, 403);
});
test('KILLER FLOW: search → order → rider assigned → live tracking → delivered; stock decremented', async () => {
  const cust = await login('customer@mapos.demo');
  const before = db.prepare('SELECT stock FROM products WHERE id=?').get('p1').stock;
  const o = await j('POST', '/api/orders', { business_id: 'b1', items: [{ product_id: 'p1', qty: 1 }], fulfilment: 'delivery', payment_method: 'cod', drop: { lat: 17.7215, lng: 83.307 } }, cust);
  assert.equal(o.status, 201, JSON.stringify(o.body));
  assert.equal(o.body.total, 28990 + 299);
  assert.ok(o.body.rider?.id); assert.ok(o.body.route.geometry.coordinates.length >= 2);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get('p1').stock, before - 1);
  const t1 = await j('GET', `/api/orders/${o.body.id}/track`, null, cust);
  assert.ok(['placed', 'accepted', 'picked_up', 'out_for_delivery', 'delivered'].includes(t1.body.status));
  // SSE stream emits events
  const r = await fetch(`${B}/api/orders/${o.body.id}/stream?token=${cust}`);
  const reader = r.body.getReader(); const { value } = await reader.read(); reader.cancel();
  assert.match(new TextDecoder().decode(value), /^data: /);
  await new Promise((res) => setTimeout(res, 1500)); // timeScale 2000 => delivered quickly
  const t2 = await j('GET', `/api/orders/${o.body.id}/track`, null, cust);
  assert.equal(t2.body.status, 'delivered');
  const other = await j('POST', '/api/auth/register', { email: 'snoop@x.in', name: 'S', password: 'longpassword' });
  assert.equal((await j('GET', `/api/orders/${o.body.id}`, null, other.body.token)).status, 404); // IDOR protection
});
test('order validation: out of stock, bad qty, out of range, no drop', async () => {
  const cust = await login('customer@mapos.demo');
  assert.equal((await j('POST', '/api/orders', { business_id: 'b1', items: [{ product_id: 'p3', qty: 1 }], fulfilment: 'delivery', drop: { lat: 17.72, lng: 83.30 } }, cust)).status, 409);
  assert.equal((await j('POST', '/api/orders', { business_id: 'b1', items: [{ product_id: 'p1', qty: 0 }], fulfilment: 'pickup' }, cust)).status, 400);
  assert.equal((await j('POST', '/api/orders', { business_id: 'b1', items: [{ product_id: 'p1', qty: 1 }], fulfilment: 'delivery', drop: { lat: 17.4375, lng: 78.4483 } }, cust)).status, 400);
  assert.equal((await j('POST', '/api/orders', { business_id: 'b1', items: [{ product_id: 'p1', qty: 1 }], fulfilment: 'delivery' }, cust)).status, 400);
  assert.equal((await j('POST', '/api/orders', { business_id: 'b1', items: [{ product_id: 'p11', qty: 1 }], fulfilment: 'pickup' }, cust)).status, 404); // product of another shop
});
test('wholesale pickup order applies tier price; cancel restores stock', async () => {
  const cust = await login('customer@mapos.demo');
  const s0 = db.prepare('SELECT stock FROM products WHERE id=?').get('p9').stock;
  const o = await j('POST', '/api/orders', { business_id: 'b3', items: [{ product_id: 'p9', qty: 5 }], fulfilment: 'pickup', payment_method: 'upi_simulated' }, cust);
  assert.equal(o.status, 201); assert.equal(o.body.subtotal, 12100 * 5);
  assert.equal(o.body.payment_status, 'paid_simulated');
  const c = await j('POST', `/api/orders/${o.body.id}/cancel`, {}, cust);
  assert.ok([200, 409].includes(c.status));
  if (c.status === 200) assert.equal(db.prepare('SELECT stock FROM products WHERE id=?').get('p9').stock, s0);
});
test('seller dashboard: KPIs, edit own product, cannot edit others', async () => {
  const s = await login('seller+b1@mapos.demo');
  const d = await j('GET', '/api/seller/dashboard', null, s);
  assert.equal(d.status, 200); assert.equal(d.body.business.id, 'b1'); assert.ok(d.body.kpis.orders >= 1);
  const u = await j('PATCH', '/api/seller/products/p1', { price: 27999, stock: 10 }, s);
  assert.equal(u.body.price, 27999);
  assert.equal((await j('PATCH', '/api/seller/products/p5', { price: 1 }, s)).status, 404);
  assert.equal((await j('PATCH', '/api/seller/products/p1', { price: -5 }, s)).status, 400);
  const np = await j('POST', '/api/seller/products', { name: 'Philips 43" 4K TV', category: 'tv', price: 25999, stock: 3, tags: ['led tv'] }, s);
  assert.equal(np.status, 201);
  const r = await j('GET', '/api/search?q=philips%20tv&lat=17.7289&lng=83.3050');
  assert.ok(r.body.results.some((x) => x.products.some((p) => p.name.startsWith('Philips'))));
});
test('admin verify + fleet; malformed JSON; unknown route', async () => {
  const a = await login('admin@mapos.demo');
  assert.equal((await j('POST', '/api/admin/businesses/b4/verify', { verified: true }, a)).status, 200);
  assert.equal((await j('GET', '/api/admin/fleet', null, a)).body.riders.length, 7);
  const bad = await fetch(`${B}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  assert.equal(bad.status, 400);
  assert.equal((await j('GET', '/api/nope')).status, 404);
});
test('SQL injection attempt is inert', async () => {
  const r = await j('GET', `/api/search?q=${encodeURIComponent("tv' OR 1=1; DROP TABLE products;--")}`);
  assert.equal(r.status, 200);
  assert.ok(db.prepare('SELECT COUNT(*) c FROM products').get().c > 0);
});
test('metrics endpoint exposes Prometheus counters', async () => {
  const r = await fetch(`${B}/metrics`); const txt = await r.text();
  assert.match(txt, /mapos_requests_total \d+/); assert.match(txt, /quantile="0.95"/);
});
