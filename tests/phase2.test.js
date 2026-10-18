// Phase 2 integration tests: payments (Razorpay, stubbed HTTP), notifications, admin API, CORS for the Android WebView.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createRazorpay, verifyCheckoutSignature } from '../server/services/payments.js';

process.env.NODE_ENV = 'test';
process.env.OFFLINE = '1';
const SECRET = 'test_secret_xyz', WH = 'wh_secret_abc';
let server, B, db, rzCalls = [];
const fakeFetch = async (url, init) => {
  rzCalls.push({ url, init });
  const body = JSON.parse(init.body);
  return new Response(JSON.stringify({ id: `order_TEST${rzCalls.length}`, amount: body.amount, currency: 'INR', status: 'created' }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const j = async (method, path, body, token, headers = {}) => {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* csv */ }
  return { status: r.status, body: json, text, headers: r.headers };
};
const login = async (email) => (await j('POST', '/api/auth/login', { email, password: 'demo1234' })).body.token;
const sign = (s, d) => crypto.createHmac('sha256', s).update(d).digest('hex');
const ORDER = { business_id: 'b2', fulfilment: 'delivery', items: [{ product_id: 'p_b2_1', qty: 1 }], drop: { lat: 17.7289, lng: 83.305 }, drop_address: 'Dwaraka Nagar' };

before(async () => {
  db = openDb(':memory:');
  const payments = createRazorpay({ keyId: 'rzp_test_dummy', keySecret: SECRET, webhookSecret: WH, fetchImpl: fakeFetch });
  const app = createApp({ db, timeScale: 2000, payments });
  await new Promise((res) => { server = app.listen(0, res); });
  B = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('migrations: 002 applied, orders accept razorpay, FK intact', () => {
  const v = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((r) => r.version);
  assert.deepEqual(v, ['001_init.sql', '002_payments_notifications.sql']);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.ok(db.prepare("SELECT sql FROM sqlite_master WHERE name='orders'").get().sql.includes("'razorpay'"));
});
test('config exposes enabled integrations without secrets', async () => {
  const r = await j('GET', '/api/config');
  assert.equal(r.body.payments.razorpay, true); assert.equal(r.body.payments.mode, 'test');
  assert.equal(r.body.payments.key_id, 'rzp_test_dummy'); assert.ok(!r.text.includes(SECRET));
});
test('CORS allows the Capacitor WebView origin, not arbitrary sites', async () => {
  const ok = await j('GET', '/api/health', null, null, { origin: 'https://localhost' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://localhost');
  const no = await j('GET', '/api/health', null, null, { origin: 'https://evil.example' });
  assert.equal(no.headers.get('access-control-allow-origin'), null);
});
test('razorpay: order created with provider order, signature verified, bad signature rejected', async () => {
  const c = await login('customer@mapos.demo');
  const p0 = db.prepare("SELECT product_id FROM order_items LIMIT 1").get();
  const r = await j('POST', '/api/orders', { ...ORDER, items: [{ product_id: db.prepare("SELECT id FROM products WHERE business_id='b2' AND stock>3 LIMIT 1").get().id, qty: 1 }], payment_method: 'razorpay' }, c);
  assert.equal(r.status, 201, JSON.stringify(r.body)); void p0;
  assert.equal(r.body.payment_status, 'awaiting_payment');
  assert.equal(r.body.razorpay.amount, r.body.total * 100);
  assert.ok(rzCalls[0].url.endsWith('/v1/orders'));
  assert.ok(rzCalls[0].init.headers.Authorization.startsWith('Basic '));
  const rzOrder = r.body.razorpay.order_id;
  const badSig = await j('POST', '/api/payments/razorpay/verify', { razorpay_order_id: rzOrder, razorpay_payment_id: 'pay_X', razorpay_signature: 'deadbeef' }, c);
  assert.equal(badSig.status, 400);
  const other = await login('admin@mapos.demo'); void other;
  const good = await j('POST', '/api/payments/razorpay/verify', { razorpay_order_id: rzOrder, razorpay_payment_id: 'pay_X', razorpay_signature: sign(SECRET, `${rzOrder}|pay_X`) }, c);
  assert.equal(good.status, 200); assert.equal(good.body.payment_status, 'paid');
  // idempotent re-verify
  assert.equal((await j('POST', '/api/payments/razorpay/verify', { razorpay_order_id: rzOrder, razorpay_payment_id: 'pay_X', razorpay_signature: sign(SECRET, `${rzOrder}|pay_X`) }, c)).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM order_events WHERE status='payment'").get().c, 1);
});
test('razorpay webhook: requires valid signature over raw body', async () => {
  const c = await login('customer@mapos.demo');
  const r = await j('POST', '/api/orders', { ...ORDER, items: [{ product_id: db.prepare("SELECT id FROM products WHERE business_id='b2' AND stock>3 LIMIT 1").get().id, qty: 1 }], payment_method: 'razorpay' }, c);
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_W', order_id: r.body.razorpay.order_id, method: 'upi' } } } });
  const send = (sig) => fetch(`${B}/api/payments/razorpay/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig }, body: raw });
  assert.equal((await send('nope')).status, 400);
  assert.equal((await send(sign(WH, raw))).status, 200);
  assert.equal(db.prepare('SELECT payment_status s FROM orders WHERE id=?').get(r.body.id).s, 'paid');
});
test('signature helper is constant-time safe on length mismatch', () => {
  assert.equal(verifyCheckoutSignature({ secret: 's', orderId: 'a', paymentId: 'b', signature: 'short' }), false);
});
test('razorpay disabled deployment returns 503, never creates an order', async () => {
  const db2 = openDb(':memory:');
  const app2 = createApp({ db: db2, payments: createRazorpay({ keyId: '', keySecret: '' }) });
  const s2 = await new Promise((res) => { const s = app2.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${s2.address().port}`;
  const tok = (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'customer@mapos.demo', password: 'demo1234' }) })).json()).token;
  const r = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ ...ORDER, payment_method: 'razorpay' }) });
  assert.equal(r.status, 503);
  assert.equal(db2.prepare('SELECT COUNT(*) c FROM orders').get().c, 0);
  s2.close();
});
test('notifications: customer and seller get order + payment notifications', async () => {
  const c = await login('customer@mapos.demo');
  const n = await j('GET', '/api/notifications', null, c);
  assert.equal(n.status, 200); assert.ok(n.body.items.some((x) => x.kind === 'order_placed')); assert.ok(n.body.items.some((x) => x.kind === 'payment_paid'));
  assert.ok(n.body.unread > 0);
  const s = await login('seller+b2@mapos.demo');
  assert.ok((await j('GET', '/api/notifications', null, s)).body.items.some((x) => x.kind === 'seller_order_placed'));
  await j('POST', '/api/notifications/read', {}, c);
  assert.equal((await j('GET', '/api/notifications', null, c)).body.unread, 0);
  const max = Math.max(...n.body.items.map((x) => x.id));
  assert.equal((await j('GET', `/api/notifications?since=${max}`, null, c)).body.items.length, 0);
  assert.equal((await j('GET', '/api/notifications')).status, 401);
});
test('admin: RBAC, overview, lists, CSV report', async () => {
  const c = await login('customer@mapos.demo'); const a = await login('admin@mapos.demo');
  assert.equal((await j('GET', '/api/admin/overview', null, c)).status, 403);
  assert.equal((await j('GET', '/api/admin/overview')).status, 401);
  const o = await j('GET', '/api/admin/overview', null, a);
  assert.equal(o.status, 200); assert.ok(o.body.orders.total >= 2); assert.ok(o.body.gmv > 0); assert.equal(o.body.businesses.total, 15);
  assert.ok((await j('GET', '/api/admin/users?role=seller', null, a)).body.items.every((u) => u.role === 'seller'));
  assert.ok((await j('GET', '/api/admin/businesses?verified=0', null, a)).body.items.every((b) => b.verified === 0));
  assert.ok((await j('GET', '/api/admin/orders?q=ord_', null, a)).body.items.length >= 2);
  const csv = await j('GET', '/api/admin/reports/orders.csv', null, a);
  assert.equal(csv.status, 200); assert.ok(csv.headers.get('content-type').includes('text/csv'));
  assert.ok(csv.text.split('\n')[0].startsWith('id,created_at,business'));
  assert.ok((await j('GET', '/api/admin/audit', null, a)).body.items.length > 0);
});
test('admin: deactivate product hides it from search and blocks ordering; reactivate restores', async () => {
  const a = await login('admin@mapos.demo'); const c = await login('customer@mapos.demo');
  const p = db.prepare("SELECT id,name FROM products WHERE business_id='b2' AND stock>3 LIMIT 1").get();
  assert.equal((await j('PATCH', `/api/admin/products/${p.id}`, { active: false }, a)).body.active, false);
  const s = await j('GET', `/api/search?q=${encodeURIComponent(p.name)}&lat=17.7289&lng=83.305`);
  assert.ok(!s.body.results.some((r) => r.product?.id === p.id));
  assert.equal((await j('POST', '/api/orders', { ...ORDER, items: [{ product_id: p.id, qty: 1 }], payment_method: 'cod' }, c)).status, 404);
  await j('PATCH', `/api/admin/products/${p.id}`, { active: true }, a);
  assert.equal((await j('POST', '/api/orders', { ...ORDER, items: [{ product_id: p.id, qty: 1 }], payment_method: 'cod' }, c)).status, 201);
});
test('admin: disabling a user revokes their live token and login; admin cannot disable self', async () => {
  const a = await login('admin@mapos.demo');
  const reg = await j('POST', '/api/auth/register', { email: 'temp@example.in', name: 'Temp', password: 'longpassword1' });
  const t = reg.body.token;
  assert.equal((await j('GET', '/api/me', null, t)).status, 200);
  assert.equal((await j('PATCH', `/api/admin/users/${reg.body.user.id}`, { disabled: true }, a)).body.disabled, 1);
  assert.equal((await j('GET', '/api/me', null, t)).status, 401);
  assert.equal((await j('POST', '/api/auth/login', { email: 'temp@example.in', password: 'longpassword1' })).status, 401);
  assert.equal((await j('PATCH', '/api/admin/users/u_admin', { disabled: true }, a)).status, 409);
  assert.equal((await j('PATCH', `/api/admin/users/${reg.body.user.id}`, { role: 'superuser' }, a)).status, 400);
});
test('admin: GSTIN validation on business update', async () => {
  const a = await login('admin@mapos.demo');
  assert.equal((await j('PATCH', '/api/admin/businesses/b2', { gstin: 'NOTAGSTIN' }, a)).status, 400);
  assert.equal((await j('PATCH', '/api/admin/businesses/b2', { gstin: '37AABCU9603R1ZM', verified: true }, a)).body.gstin, '37AABCU9603R1ZM');
});
