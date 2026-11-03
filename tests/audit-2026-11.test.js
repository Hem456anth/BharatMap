// Regression tests for the November 2026 technical audit (docs/AUDIT-2026-11.md). One test (or more) per fixed
// finding, named by its AUD id, so a regression points straight at the finding it reopens.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.OFFLINE = '1';
// Small limits so the caps are reachable in a test; read by createApp at start.
process.env.MAX_PENDING_PAYMENTS = '3';
process.env.SSE_PER_USER = '2';
process.env.AUTH_RATE_BURST = '40';

const { createApp } = await import('../server/app.js');
const { openDb, demoPasswordFor } = await import('../server/db.js');
const { signToken, verifyToken, assertAuthConfig, verifyPasswordAsync, hashPassword } = await import('../server/auth.js');
const { paytmAdapter, paytmGenerateSignature, paytmParamString } = await import('../server/payments/index.js');
const external = await import('../server/services/external.js');
const { cspString } = await import('../shared/csp.js');

const ORDER = { business_id: 'b3', items: [{ product_id: 'p9', qty: 1 }], fulfilment: 'pickup' };
const PAYTM_ENV = { PAYTM_MID: 'MID123', PAYTM_MERCHANT_KEY: '0123456789abcdef' };
const fake = {
  id: 'fakepg', name: 'Fake PG', enabled: true, mode: 'test', prototype: true, publicConfig: () => ({}),
  createOrder: async ({ orderId, amountPaise }) => ({ providerOrderId: `fk_${orderId}`, checkout: { amount: amountPaise } }),
  verifyClient: async (b, { providerOrderId }) => ({ ok: b.proof === 'paid', providerOrderId, providerPaymentId: `fkpay_${providerOrderId}` }),
  verifyWebhook: () => ({ ok: false }),
};
let app, server, B, db;
before(async () => {
  db = openDb(':memory:');
  app = createApp({ db, timeScale: 1, env: PAYTM_ENV, paymentAdapters: [fake, paytmAdapter(PAYTM_ENV, { fetchImpl: async () => { throw new TypeError('no net'); } })] });
  server = app.listen(0); await new Promise((r) => server.once('listening', r));
  B = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// Raw HTTP so tests can set Host and other headers fetch() would not send as given.
function raw(method, path, { headers = {}, body = null, keepOpen = false } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: server.address().port, method, path, headers }, (res) => {
      if (keepOpen) return resolve({ status: res.statusCode, headers: res.headers, res, req: r });
      let d = ''; res.setEncoding('utf8'); res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: d }));
    });
    r.on('error', reject); if (body) r.write(body); r.end();
  });
}
const j = async (method, p, body, token) => {
  const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body == null ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
};
const login = async (email) => (await j('POST', '/api/auth/login', { email, password: 'demo1234' })).body.token;
const stockOf = (id) => db.prepare('SELECT stock FROM products WHERE id=?').get(id).stock;

test('AUD-01: production never seeds a known demo password', () => {
  assert.equal(demoPasswordFor({ NODE_ENV: 'development' }), 'demo1234');
  const a = demoPasswordFor({ NODE_ENV: 'production' }), b = demoPasswordFor({ NODE_ENV: 'production' });
  assert.notEqual(a, 'demo1234'); assert.notEqual(a, b); assert.ok(a.length >= 24);
  assert.throws(() => demoPasswordFor({ NODE_ENV: 'production', DEMO_PASSWORD: 'short' }), /12 chars/);
  assert.equal(demoPasswordFor({ NODE_ENV: 'production', DEMO_PASSWORD: 'a-long-demo-pass' }), 'a-long-demo-pass');
});

test('AUD-02: unpaid online orders expire, giving back stock (and rider); a late payment is flagged for refund', async () => {
  const c = await login('customer@mapos.demo');
  const s0 = stockOf('p9');
  const o = await j('POST', '/api/orders', { ...ORDER, payment_method: 'online' }, c);
  assert.equal(o.body.status, 'pending_payment'); assert.equal(stockOf('p9'), s0 - 1);
  const pay = await j('POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'fakepg' }, c);
  assert.equal(pay.status, 201);
  // 31 minutes later the sweep closes it.
  assert.equal(app.locals.expirePendingPayments(Date.now() + 31 * 60_000), 1);
  const row = db.prepare('SELECT status, payment_status FROM orders WHERE id=?').get(o.body.id);
  assert.deepEqual({ ...row }, { status: 'cancelled', payment_status: 'expired' });
  assert.equal(stockOf('p9'), s0, 'stock released');
  assert.equal(app.locals.expirePendingPayments(Date.now() + 31 * 60_000), 0, 'idempotent');
  // The gateway still reports success afterwards: recorded, never re-opens the order, refund flagged.
  const v = await j('POST', '/api/payments/fakepg/verify', { provider_order_id: pay.body.provider_order_id, proof: 'paid' }, c);
  assert.equal(v.status, 200); assert.equal(v.body.status, 'cancelled'); assert.equal(v.body.payment_status, 'refund_required');
  assert.ok(v.body.events.some((e) => e.status === 'refund_required'));
  assert.equal(stockOf('p9'), s0, 'no second release');
});

test('AUD-02: a customer can hold only MAX_PENDING_PAYMENTS unpaid orders at once', async () => {
  const r = await j('POST', '/api/auth/register', { email: 'hoarder@x.in', name: 'H', password: 'longpassword' });
  const t = r.body.token;
  for (let i = 0; i < 3; i++) assert.equal((await j('POST', '/api/orders', { ...ORDER, payment_method: 'online' }, t)).status, 201);
  const fourth = await j('POST', '/api/orders', { ...ORDER, payment_method: 'online' }, t);
  assert.equal(fourth.status, 429); assert.equal(fourth.body.error, 'too_many_pending_payments');
  assert.equal((await j('POST', '/api/orders', { ...ORDER, payment_method: 'cod' }, t)).status, 201, 'COD unaffected');
});

test('AUD-03: style proxy cache cannot be poisoned through the Host header', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, o) => (String(url).startsWith('https://tiles.openfreemap.org')
    ? new Response(JSON.stringify({ sources: { ofm: { url: 'https://tiles.openfreemap.org/planet' } }, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf' }), { headers: { 'content-type': 'application/json' } })
    : realFetch(url, o));
  try {
    const evil = await raw('GET', '/map/style.json', { headers: { Host: 'evil.example' } });
    assert.equal(evil.status, 200); assert.ok(evil.text.includes('http://evil.example/map/ofm/planet')); // only the requester's own host
    const good = await raw('GET', '/map/style.json', { headers: { Host: 'maps.good.in' } });
    assert.ok(good.text.includes('http://maps.good.in/map/ofm/planet')); assert.ok(!good.text.includes('evil.example'), 'cached copy is not the poisoned one');
    assert.equal(good.headers.vary, 'Host');
    const bad = await raw('GET', '/map/style.json', { headers: { Host: 'a"b<c>' } });
    assert.equal(bad.status, 400);
    for (const v of app.locals.tileCache.values()) assert.ok(!v.body.toString().includes('evil.example'));
  } finally { globalThis.fetch = realFetch; }
});

test('AUD-04: role and seller business come from the database, so a demoted admin loses admin at once', async () => {
  const r = await j('POST', '/api/auth/register', { email: 'tmpadmin@x.in', name: 'T', password: 'longpassword' });
  db.prepare("UPDATE users SET role='admin' WHERE email='tmpadmin@x.in'").run();
  const t = (await j('POST', '/api/auth/login', { email: 'tmpadmin@x.in', password: 'longpassword' })).body.token;
  assert.equal((await j('GET', '/api/admin/overview', null, t)).status, 200);
  db.prepare("UPDATE users SET role='customer' WHERE email='tmpadmin@x.in'").run();
  assert.equal((await j('GET', '/api/admin/overview', null, t)).status, 403, 'token still says admin, DB says customer');
  // A forged-role token for a real customer gets the DB role.
  const forged = signToken({ sub: r.body.user.id, role: 'admin' });
  assert.equal((await j('GET', '/api/admin/overview', null, forged)).status, 403);
  // Token for a user that no longer exists → anonymous.
  assert.equal((await j('GET', '/api/me', null, signToken({ sub: 'u_gone', role: 'admin' }))).status, 401);
});

test('AUD-05: SSE streams are capped per user', async () => {
  const c = await login('customer@mapos.demo');
  const o = await j('POST', '/api/orders', { ...ORDER, payment_method: 'cod' }, c);
  const open = [];
  for (let i = 0; i < 2; i++) { const s = await raw('GET', `/api/orders/${o.body.id}/stream?token=${c}`, { keepOpen: true }); assert.equal(s.status, 200); open.push(s); }
  const third = await raw('GET', `/api/orders/${o.body.id}/stream?token=${c}`);
  assert.equal(third.status, 429); assert.match(third.text, /too_many_streams/);
  for (const s of open) s.req.destroy();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(app.locals.sseOpen.size, 0, 'counter released on close');
});

test('AUD-06: JWT with a multi-byte signature is rejected (401), not a 500', async () => {
  const good = signToken({ sub: 'u_customer', role: 'customer' });
  const [h, b, s] = good.split('.');
  const bad = `${h}.${b}.${'é'.repeat(s.length)}`; // same string length, different byte length
  assert.equal(verifyToken(bad), null);
  assert.equal((await j('GET', '/api/me', null, bad)).status, 401);
});

test('AUD-07: login runs scrypt for unknown e-mails too, asynchronously, and has a per-IP limit', async () => {
  assert.equal(await verifyPasswordAsync('x', undefined), false);
  assert.equal(await verifyPasswordAsync('pw-123456', hashPassword('pw-123456')), true);
  assert.equal(await verifyPasswordAsync('wrong', hashPassword('pw-123456')), false);
  const t0 = performance.now(); await verifyPasswordAsync('x', undefined); const unknownMs = performance.now() - t0;
  assert.ok(unknownMs > 5, `unknown e-mail still costs scrypt work (${unknownMs.toFixed(1)} ms)`);
  // Separate app with a tiny burst to reach the per-IP limiter.
  process.env.AUTH_RATE_BURST = '3';
  const a2 = createApp({ db: openDb(':memory:') }).listen(0); await new Promise((r) => a2.once('listening', r));
  try {
    const url = `http://127.0.0.1:${a2.address().port}/api/auth/login`;
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `n${i}@x.in`, password: 'whatever1' }) })).status);
    assert.deepEqual(codes.slice(0, 3), [401, 401, 401]); assert.equal(codes[4], 429);
  } finally { a2.close(); process.env.AUTH_RATE_BURST = '40'; }
});

test('AUD-08: production refuses to start without JWT_SECRET', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = 'production'; delete process.env.JWT_SECRET;
    assert.throws(() => assertAuthConfig(), /JWT_SECRET/);
    process.env.JWT_SECRET = 'x'.repeat(32); assert.doesNotThrow(() => assertAuthConfig());
  } finally { process.env.NODE_ENV = saved.NODE_ENV; if (saved.JWT_SECRET === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = saved.JWT_SECRET; }
});

test('AUD-09: a second successful payment for the same order is flagged for refund, not double-confirmed', async () => {
  const c = await login('customer@mapos.demo');
  const o = await j('POST', '/api/orders', { ...ORDER, payment_method: 'online' }, c);
  const p1 = await j('POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'fakepg' }, c);
  // A second attempt created before the first one was verified (two tabs).
  const p2 = await j('POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'paytm' }, c);
  assert.equal(p1.status, 201); assert.equal(p2.status, 502, 'paytm has no network here');
  db.prepare("INSERT INTO payments(order_id,provider,provider_order_id,amount_paise,status) VALUES (?,?,?,?,'created')").run(o.body.id, 'fakepg', `fk_second_${o.body.id}`, 100);
  assert.equal((await j('POST', '/api/payments/fakepg/verify', { provider_order_id: p1.body.provider_order_id, proof: 'paid' }, c)).body.payment_status, 'paid');
  const second = await j('POST', '/api/payments/fakepg/verify', { provider_order_id: `fk_second_${o.body.id}`, proof: 'paid' }, c);
  assert.equal(second.body.payment_status, 'refund_required');
  assert.equal(second.body.events.filter((e) => e.status === 'payment').length, 1, 'confirmed once');
});

test('AUD-10: form-encoded (Paytm) webhooks keep their raw body, so a valid checksum verifies', async () => {
  const params = { ORDERID: 'ord_unknown', TXNID: 't1', STATUS: 'TXN_SUCCESS', MID: 'MID123' };
  params.CHECKSUMHASH = paytmGenerateSignature(paytmParamString(params), PAYTM_ENV.PAYTM_MERCHANT_KEY);
  const body = new URLSearchParams(params).toString();
  const ok = await raw('POST', '/api/payments/paytm/webhook', { headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) }, body });
  assert.equal(ok.status, 200, ok.text);
  const tampered = body.replace('TXN_SUCCESS', 'TXN_FAILURE');
  const no = await raw('POST', '/api/payments/paytm/webhook', { headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(tampered) }, body: tampered });
  assert.equal(no.status, 400);
});

test('AUD-11: sellers cannot accept unpaid orders; riders cannot cancel; a paid cancel is flagged for refund', async () => {
  const c = await login('customer@mapos.demo');
  const o = await j('POST', '/api/orders', { ...ORDER, payment_method: 'online' }, c);
  const seller = await login('seller+b3@mapos.demo');
  const acc = await j('POST', `/api/seller/orders/${o.body.id}/accept`, {}, seller);
  assert.equal(acc.status, 409); assert.equal(acc.body.error, 'cannot_accept_now');
  const rider = await login('rider+r1@mapos.demo');
  assert.equal((await j('POST', `/api/orders/${o.body.id}/cancel`, {}, rider)).status, 403);
  const p = await j('POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'fakepg' }, c);
  await j('POST', '/api/payments/fakepg/verify', { provider_order_id: p.body.provider_order_id, proof: 'paid' }, c);
  const cx = await j('POST', `/api/orders/${o.body.id}/cancel`, {}, c);
  assert.equal(cx.status, 200); assert.equal(cx.body.payment_status, 'refund_required');
  assert.equal((await j('POST', `/api/orders/${o.body.id}/cancel`, {}, c)).status, 409, 'second cancel refused, no double restock');
});

test('AUD-12: legacy upstream calls have a circuit breaker', async () => {
  const realFetch = globalThis.fetch; const saved = process.env.OFFLINE; delete process.env.OFFLINE;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError('fetch failed'); };
  external.resetBreakers();
  try {
    const from = { lat: 17.72, lng: 83.30 }, to = { lat: 17.73, lng: 83.32 };
    for (let i = 0; i < 3; i++) await external.route({ ...from, lat: from.lat + i / 1000 }, to);
    assert.equal(calls, 3);
    const r = await external.route({ ...from, lat: 17.9 }, to);
    assert.equal(calls, 3, 'breaker open: no 4th upstream call'); assert.match(r.engine, /fallback/);
  } finally { globalThis.fetch = realFetch; external.resetBreakers(); if (saved === undefined) delete process.env.OFFLINE; else process.env.OFFLINE = saved; }
});

test('AUD-13: hardening headers — CSP frame-ancestors on the HTTP header only, request ids sanitised, /metrics gated', async () => {
  const h = await raw('GET', '/api/health', { headers: { 'X-Request-Id': 'bad id\twith<tab>' } });
  assert.ok(h.headers['content-security-policy'].endsWith("frame-ancestors 'none'"));
  assert.ok(!cspString().includes('frame-ancestors'), 'meta CSP (index.html) stays without it');
  assert.match(h.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  assert.equal((await raw('GET', '/api/health', { headers: { 'X-Request-Id': 'abc-123' } })).headers['x-request-id'], 'abc-123');
  process.env.METRICS_TOKEN = 'm-token';
  try {
    assert.equal((await raw('GET', '/metrics')).status, 404);
    assert.equal((await raw('GET', '/metrics', { headers: { Authorization: 'Bearer m-token' } })).status, 200);
  } finally { delete process.env.METRICS_TOKEN; }
  const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try { assert.equal((await raw('GET', '/metrics')).status, 404, 'production without a token: not exposed'); } finally { process.env.NODE_ENV = prev; }
});

test('AUD-14: seller product creation is bounded like updates', async () => {
  const seller = await login('seller+b3@mapos.demo');
  assert.equal((await j('POST', '/api/seller/products', { name: 'X', category: 'tv', price: '1e400' }, seller)).status, 400);
  assert.equal((await j('POST', '/api/seller/products', { name: 'X', category: 'tv', price: 100, stock: 5e9 }, seller)).status, 400);
  assert.equal((await j('POST', '/api/seller/products', { name: 'X', category: 'tv', price: 100, stock: 5 }, seller)).status, 201);
});

test('AUD-15: migration 006 adds the order / incident lookup indexes', () => {
  const idx = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r) => r.name));
  for (const n of ['idx_order_items_order', 'idx_order_events_order', 'idx_incidents_reporter', 'idx_orders_status_created']) assert.ok(idx.has(n), n);
  const plan = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM order_items WHERE order_id=?').all('x').map((r) => r.detail).join(' ');
  assert.match(plan, /idx_order_items_order/);
});

test('AUD-16: /ondc prototype endpoint is behind the API rate limiter', async () => {
  const r = await raw('POST', '/ondc/search', { headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.ok(r.headers['ratelimit-remaining'] !== undefined);
});

test('AUD-17: dependency, CI and Android hardening (source checks)', () => {
  const bp = JSON.parse(fs.readFileSync('node_modules/body-parser/package.json', 'utf8')).version.split('.').map(Number);
  assert.ok(bp[0] > 1 || (bp[0] === 1 && (bp[1] > 20 || (bp[1] === 20 && bp[2] >= 9))), `body-parser ${bp.join('.')} ≥ 1.20.9 (GHSA-27r3-jxmh-p828)`);
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /^permissions:\n {2}contents: read/m, 'workflow token read-only by default');
  assert.ok(!/uses: [\w-]+\/[\w-]+@v\d/.test(ci), 'every action pinned to a commit SHA');
  for (const f of ['.github/workflows/ci.yml', '.github/workflows/attach-apk.yml']) {
    const y = fs.readFileSync(f, 'utf8');
    assert.ok(y.includes('d04d20f9fd727d7ca6d966e771e2ed5760b20fefe9c139d36f0e3e86b7997c6c'), `${f} pins the release certificate`);
    assert.ok(!/grep -q "CN=Bharat Map"/.test(y), `${f} no longer trusts the CN alone`);
  }
  const fp = fs.readFileSync('android/app/src/main/res/xml/file_paths.xml', 'utf8');
  assert.ok(!/<external-path/.test(fp), 'FileProvider does not expose shared storage'); assert.match(fp, /<cache-path/);
});

test('AUD-18: one failing statement cannot leave the DB connection inside a transaction', async () => {
  const c = await login('customer@mapos.demo');
  const o = await j('POST', '/api/orders', { ...ORDER, payment_method: 'cod' }, c);
  // Make the stock restore fail mid-cancel with a trigger, then check the next write still works.
  db.exec("CREATE TEMP TRIGGER boom BEFORE UPDATE OF stock ON products BEGIN SELECT RAISE(ABORT, 'boom'); END;");
  const r = await j('POST', `/api/orders/${o.body.id}/cancel`, {}, c);
  db.exec('DROP TRIGGER boom');
  assert.equal(r.status, 500);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(o.body.id).status !== 'cancelled', true, 'rolled back');
  assert.equal(db.isTransaction, false, 'no transaction left open');
  const again = await j('POST', '/api/orders', { ...ORDER, payment_method: 'cod' }, c);
  assert.equal(again.status, 201, 'later transactions still work');
});
