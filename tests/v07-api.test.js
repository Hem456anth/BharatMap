// v0.7 API: order → separate payment (pending_payment until a VERIFIED payment; no keys → "not configured", nothing
// paid), gateway webhook signatures, /api/v1/places/:id/services, integrations registry, admin listing verification +
// provider links, ONDC prototype buyer flow, traffic honesty, truck routing, landmark address endpoint, courier stubs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { createProviders } from '../server/providers/index.js';
import { cashfreeAdapter, cashfreeSignature } from '../server/payments/index.js';

process.env.NODE_ENV = 'test';
// Pickup orders may be auto-accepted by the seller flow, so either confirmed state is valid.
const PICKUP_OK = ['placed', 'accepted'];
const noNet = async () => { throw new TypeError('fetch failed'); };
const valhallaCalls = [];
const truckFetch = async (url, o = {}) => {
  if (/valhalla/.test(url) && /route/.test(url)) {
    valhallaCalls.push(JSON.parse(o.body || decodeURIComponent((url.split('json=')[1] || '{}'))));
    const shape = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const body = JSON.stringify({ trip: { status: 0, legs: [{ shape, maneuvers: [] }], summary: { length: 10, time: 900 } } });
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
  }
  throw new TypeError('fetch failed');
};
const CF_ENV = { CASHFREE_APP_ID: 'cf_app', CASHFREE_SECRET_KEY: 'cf_secret_value' };
const fake = {
  id: 'fakepg', name: 'Fake PG (test)', enabled: true, mode: 'test', prototype: true, publicConfig: () => ({}),
  createOrder: async ({ orderId, amountPaise }) => ({ providerOrderId: `fk_${orderId}`, checkout: { amount: amountPaise } }),
  verifyClient: async (b, { providerOrderId }) => ({ ok: b.proof === 'gateway-says-paid', providerOrderId, providerPaymentId: 'fkpay_1' }),
  verifyWebhook: () => ({ ok: false }),
};
let A, B, sA, sB, dbB;
before(async () => {
  const pA = createProviders({ env: {}, fetchImpl: noNet, sleep: async () => {} });
  sA = createApp({ db: openDb(':memory:'), providers: pA, env: {} }).listen(0);
  dbB = openDb(':memory:');
  const pB = createProviders({ env: {}, fetchImpl: truckFetch, sleep: async () => {} });
  sB = createApp({ db: dbB, providers: pB, paymentAdapters: [fake, cashfreeAdapter(CF_ENV, { fetchImpl: noNet })], env: { ONDC_PROTOTYPE: '1', TRAFFIC_PROVIDER: 'tomtom', TOMTOM_API_KEY: 'TOMTOM_SECRET_KEY', UBER_CLIENT_ID: 'uber_public_id' } }).listen(0);
  await Promise.all([sA, sB].map((s) => new Promise((r) => s.once('listening', r))));
  A = `http://127.0.0.1:${sA.address().port}`; B = `http://127.0.0.1:${sB.address().port}`;
});
after(() => { sA.close(); sB.close(); });
const j = async (base, method, p, body, token, headers = {}) => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await r.text(); let b; try { b = JSON.parse(text); } catch { b = text; }
  return { status: r.status, body: b, text };
};
const login = async (base, email) => (await j(base, 'POST', '/api/auth/login', { email, password: 'demo1234' })).body.token;
const ORDER = { business_id: 'b3', items: [{ product_id: 'p9', qty: 1 }], fulfilment: 'pickup' };

test('no gateway keys: online order is created pending_payment, payment screen API says not configured, nothing is ever paid', async () => {
  const c = await login(A, 'customer@mapos.demo');
  const cfg = await j(A, 'GET', '/api/payments/config');
  assert.equal(cfg.body.configured, false); assert.deepEqual(cfg.body.gateways, []);
  const o = await j(A, 'POST', '/api/orders', { ...ORDER, payment_method: 'online' }, c);
  assert.equal(o.status, 201); assert.equal(o.body.status, 'pending_payment'); assert.equal(o.body.payment_status, 'pending_payment'); assert.equal(o.body.demo, true);
  assert.equal(o.body.tracking.status, 'pending_payment'); assert.equal(o.body.tracking.eta_s, null);
  const p = await j(A, 'POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'razorpay' }, c);
  assert.equal(p.status, 503); assert.equal(p.body.error, 'payments_not_configured');
  assert.equal((await j(A, 'POST', '/api/payments/razorpay/verify', { razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'z' }, c)).status, 400);
  assert.equal((await j(A, 'POST', '/api/payments/cashfree/webhook', '{}', null)).status, 400);
  const after = await j(A, 'GET', `/api/orders/${o.body.id}`, null, c);
  assert.equal(after.body.payment_status, 'pending_payment'); assert.equal(after.body.status, 'pending_payment');
  // The customer can cancel an unpaid order; stock is released.
  assert.equal((await j(A, 'POST', `/api/orders/${o.body.id}/cancel`, {}, c)).status, 200);
  // COD stays confirmed at once (not online payment) and simulated UPI is disabled.
  { const st = (await j(A, 'POST', '/api/orders', { ...ORDER, payment_method: 'cod' }, c)).body.status; assert.ok(PICKUP_OK.includes(st), `status ${st}`); }
  assert.equal((await j(A, 'POST', '/api/orders', { ...ORDER, payment_method: 'upi_simulated' }, c)).body.error, 'simulated_payments_disabled');
});

test('with a gateway: server-created payment order (amount from DB), failed verification keeps pending, verified payment confirms + starts tracking', async () => {
  const c = await login(B, 'customer@mapos.demo');
  const cfg = await j(B, 'GET', '/api/payments/config');
  assert.equal(cfg.body.configured, true); assert.deepEqual(cfg.body.gateways.map((g) => g.id), ['fakepg', 'cashfree']);
  assert.ok(!cfg.text.includes('cf_secret_value'));
  const o = await j(B, 'POST', '/api/orders', { ...ORDER, payment_method: 'online' }, c);
  assert.equal(o.body.status, 'pending_payment');
  const other = await login(B, 'seller+b1@mapos.demo');
  assert.equal((await j(B, 'POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'fakepg' }, other)).status, 404, 'only the customer');
  assert.equal((await j(B, 'POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'nope' }, c)).status, 400);
  const p = await j(B, 'POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'fakepg', amount: 1 }, c);
  assert.equal(p.status, 201); assert.equal(p.body.amount_paise, o.body.total * 100, 'client amount ignored');
  const bad = await j(B, 'POST', '/api/payments/fakepg/verify', { provider_order_id: p.body.provider_order_id, proof: 'client-says-paid' }, c);
  assert.equal(bad.status, 400); assert.equal(bad.body.error, 'payment_not_verified');
  assert.equal((await j(B, 'GET', `/api/orders/${o.body.id}`, null, c)).body.status, 'pending_payment');
  const good = await j(B, 'POST', '/api/payments/fakepg/verify', { provider_order_id: p.body.provider_order_id, proof: 'gateway-says-paid' }, c);
  assert.equal(good.status, 200); assert.equal(good.body.payment_status, 'paid'); assert.ok(PICKUP_OK.includes(good.body.status), `status ${good.body.status}`);
  assert.equal((await j(B, 'POST', '/api/payments/orders', { order_id: o.body.id, gateway: 'fakepg' }, c)).status, 409, 'already paid');
  const ev = (await j(B, 'GET', `/api/orders/${o.body.id}`, null, c)).body.events.map((e) => e.status);
  assert.deepEqual(ev, ['pending_payment', 'payment']);
});

test('gateway webhook (Cashfree): bad signature rejected; signed SUCCESS marks the order paid exactly once', async () => {
  const c = await login(B, 'customer@mapos.demo');
  const o = await j(B, 'POST', '/api/orders', { ...ORDER, payment_method: 'online' }, c);
  dbB.prepare('INSERT INTO payments(order_id,provider,provider_order_id,amount_paise,status) VALUES (?,?,?,?,?)').run(o.body.id, 'cashfree', `${o.body.id}_cf1`, o.body.total * 100, 'created');
  const raw = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: `${o.body.id}_cf1` }, payment: { payment_status: 'SUCCESS', cf_payment_id: 777 } } });
  assert.equal((await j(B, 'POST', '/api/payments/cashfree/webhook', raw, null, { 'x-webhook-timestamp': '1', 'x-webhook-signature': cashfreeSignature('wrong', '1', raw) })).status, 400);
  assert.equal((await j(B, 'GET', `/api/orders/${o.body.id}`, null, c)).body.status, 'pending_payment');
  for (let i = 0; i < 2; i++) assert.equal((await j(B, 'POST', '/api/payments/cashfree/webhook', raw, null, { 'x-webhook-timestamp': '1', 'x-webhook-signature': cashfreeSignature('cf_secret_value', '1', raw) })).status, 200);
  const v = (await j(B, 'GET', `/api/orders/${o.body.id}`, null, c)).body;
  assert.equal(v.payment_status, 'paid'); assert.ok(PICKUP_OK.includes(v.status), `status ${v.status}`);
  assert.equal(v.events.filter((e) => e.status === 'payment').length, 1);
});

test('/api/v1/places/:id/services: station departures Scheduled, restaurant link-outs, seller Demo, honesty self-check empty', async () => {
  const st = await j(A, 'GET', `/api/v1/places/${encodeURIComponent('osm:node/1')}/services?lat=17.4357&lng=78.4448&name=Ameerpet&date=2026-10-21&time=10:00&tags=${encodeURIComponent(JSON.stringify({ railway: 'station', station: 'subway' }))}`);
  assert.equal(st.status, 200); assert.equal(st.body.panel.type, 'station'); assert.deepEqual(st.body.honesty.violations, []);
  const deps = st.body.panel.sections.find((s) => s.id === 'departures').rows.filter((r) => r.id.startsWith('dep-'));
  assert.ok(deps.length >= 2 && deps.every((r) => r.label === 'scheduled'));
  assert.equal(st.body.place.city, 'hyderabad');
  const r = await j(B, 'GET', `/api/v1/places/${encodeURIComponent('osm:node/2')}/services?lat=17.4416&lng=78.4873&name=Paradise&origin_lat=17.4375&origin_lng=78.4483&tags=${encodeURIComponent(JSON.stringify({ amenity: 'restaurant', '<bad>': 'x' }))}`);
  assert.equal(r.body.panel.type, 'restaurant');
  const uber = r.body.panel.ride.actions.find((a) => a.id === 'uber');
  assert.match(uber.url, /client_id=uber_public_id/); assert.match(uber.url, /pickup\[latitude\]=17\.4375/);
  assert.ok(r.body.panel.actions.some((a) => a.id === 'swiggy' && a.host === 'www.swiggy.com'));
  const s = await j(A, 'GET', '/api/v1/places/seller%3Ab1/services');
  assert.equal(s.body.panel.provenance, 'demo'); assert.ok(s.body.panel.footer.some((f) => f.provenance === 'demo'));
  assert.equal((await j(A, 'GET', '/api/v1/places/seller%3Ab999/services')).status, 404);
  assert.equal((await j(A, 'GET', '/api/v1/places/x/services?lat=51.5&lng=0')).body.error, 'invalid_point');
});

test('/api/v1/integrations: every catalogue provider + traffic, status per adapter, env upgrades, no secrets', async () => {
  const a = await j(A, 'GET', '/api/v1/integrations');
  assert.ok(a.body.integrations.length >= 90);
  const byId = Object.fromEntries(a.body.integrations.map((x) => [x.id, x]));
  assert.equal(byId.blusmart.status, 'unavailable'); assert.equal(byId.uber.status, 'link-out'); assert.equal(byId['metro-hyderabad'].status, 'live');
  assert.equal(byId.traffic.status, 'unavailable'); assert.equal(a.body.client.traffic, null);
  const b = await j(B, 'GET', '/api/v1/integrations');
  assert.equal(b.body.integrations.find((x) => x.id === 'traffic').status, 'live'); assert.equal(b.body.client.ondcPrototype, true);
  assert.ok(!b.text.includes('TOMTOM_SECRET_KEY'));
  assert.ok(!(await j(B, 'GET', '/api/config')).text.includes('TOMTOM_SECRET_KEY'));
});

test('traffic honesty: unavailable without a key (no tiles); with TRAFFIC_PROVIDER the status is live and tiles go through the proxy', async () => {
  const a = await j(A, 'GET', '/api/v1/traffic/status');
  assert.equal(a.body.available, false); assert.equal(a.body.message, 'Live traffic unavailable');
  assert.equal((await fetch(`${A}/api/v1/traffic/tiles/10/700/450.png`)).status, 404);
  const b = await j(B, 'GET', '/api/v1/traffic/status');
  assert.equal(b.body.available, true); assert.equal(b.body.provider, 'tomtom'); assert.ok(!b.text.includes('TOMTOM_SECRET_KEY'));
  assert.equal((await fetch(`${B}/api/v1/traffic/tiles/2/0/0.png`)).status, 400, 'zoom bounds');
});

test('admin: listing verification + provider links (RBAC, audit, only verified links reach the public panel)', async () => {
  const admin = await login(A, 'admin@mapos.demo'); const cust = await login(A, 'customer@mapos.demo');
  assert.equal((await j(A, 'GET', '/api/admin/place-services', null, cust)).status, 403);
  const pid = 'osm:node/424242';
  const put = await j(A, 'PUT', `/api/admin/place-services/${encodeURIComponent(pid)}`, { name: 'Test Bistro', lat: 17.44, lng: 78.48, panel_type: 'restaurant', verification: 'verified' }, admin);
  assert.equal(put.status, 200); assert.equal(put.body.verification, 'verified');
  assert.equal((await j(A, 'PUT', `/api/admin/place-services/${encodeURIComponent(pid)}`, { panel_type: 'casino' }, admin)).status, 400);
  assert.equal((await j(A, 'POST', '/api/admin/provider-links', { place_id: pid, provider_id: 'zomato', url: 'javascript:alert(1)' }, admin)).body.error, 'invalid_url');
  assert.equal((await j(A, 'POST', '/api/admin/provider-links', { place_id: pid, provider_id: 'blusmart', url: 'https://example.com/' }, admin)).body.error, 'provider_unavailable');
  const l = await j(A, 'POST', '/api/admin/provider-links', { place_id: pid, provider_id: 'zomato', url: 'https://www.zomato.com/hyderabad/test-bistro', label: 'Zomato page', kind: 'order' }, admin);
  assert.equal(l.status, 201); assert.equal(l.body.verified, 0); assert.equal(l.body.host, 'www.zomato.com');
  const q = `/api/v1/places/${encodeURIComponent(pid)}/services?lat=17.44&lng=78.48&name=Test%20Bistro&tags=${encodeURIComponent(JSON.stringify({ amenity: 'restaurant' }))}`;
  assert.ok(!(await j(A, 'GET', q)).body.panel.actions.some((a) => a.id.startsWith('pl-')), 'unverified link hidden');
  await j(A, 'PATCH', `/api/admin/provider-links/${l.body.id}`, { verified: true }, admin);
  const pub = (await j(A, 'GET', q)).body;
  assert.ok(pub.panel.actions.some((a) => a.id === `pl-${l.body.id}` && a.url === 'https://www.zomato.com/hyderabad/test-bistro'));
  assert.equal(pub.listing.verification, 'verified');
  const list = await j(A, 'GET', '/api/admin/place-services', null, admin);
  assert.ok(list.body.items.some((x) => x.place_id === pid && x.verified_links === 1)); assert.ok(list.body.sellers.every((s) => s.demo));
  assert.equal((await j(A, 'DELETE', `/api/admin/provider-links/${l.body.id}`, null, admin)).status, 200);
});

test('ONDC buyer prototype: disabled → 404; enabled → search (Demo, Beckn shape) → select quote from DB → confirm creates pending_payment order → status', async () => {
  assert.equal((await j(A, 'POST', '/api/v1/ondc/prototype/search', { q: 'tv' })).status, 404);
  const s = await j(B, 'POST', '/api/v1/ondc/prototype/search', { seller_id: 'b3' });
  assert.equal(s.status, 200); assert.equal(s.body.provenance, 'demo'); assert.equal(s.body.context.prototype, true);
  const item = { id: 'p9', quantity: { count: 2 } };
  const sel = await j(B, 'POST', '/api/v1/ondc/prototype/select', { items: [item, { id: 'nope' }] });
  assert.equal(sel.body.message.order.items.length, 1);
  const quoted = Number(sel.body.message.order.quote.price.value);
  assert.equal((await j(B, 'POST', '/api/v1/ondc/prototype/confirm', { items: [item] })).status, 401);
  const c = await login(B, 'customer@mapos.demo');
  const conf = await j(B, 'POST', '/api/v1/ondc/prototype/confirm', { items: [item] }, c);
  assert.equal(conf.status, 201); assert.equal(conf.body.order.status, 'pending_payment'); assert.equal(conf.body.order.source, 'ondc-prototype');
  assert.equal(conf.body.order.subtotal, quoted);
  const st = await j(B, 'GET', `/api/v1/ondc/prototype/status/${conf.body.order.id}`, null, c);
  assert.equal(st.body.message.order.state, 'pending_payment');
  const metro = await j(B, 'GET', '/api/v1/ondc/prototype/metro?city=hyderabad');
  assert.equal(metro.body.operators[0].on_ondc, false); assert.equal(metro.body.fares, null);
});

test('truck routing uses Valhalla truck costing; tolls stay "fee unknown"; courier partners are stubs', async () => {
  const r = await j(B, 'GET', '/api/v1/route?mode=truck&from_lat=17.7289&from_lng=83.305&to_lat=17.6868&to_lng=83.2185&truck_height=4.1&truck_weight=20');
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.match(r.body.tolls_note, /fees are unknown/);
  const call = valhallaCalls.find((c) => c.costing === 'truck');
  assert.ok(call, 'valhalla truck request'); assert.equal(call.costing_options.truck.height, 4.1); assert.equal(call.costing_options.truck.weight, 20);
  const a = await j(A, 'GET', '/api/v1/route?mode=truck&from_lat=17.7289&from_lng=83.305&to_lat=17.6868&to_lng=83.2185');
  assert.equal(a.body.fallback, true, 'no car route substituted for a truck when Valhalla is unreachable');
  const cq = await j(A, 'POST', '/api/v1/courier/shiprocket/quote', {});
  assert.equal(cq.status, 501); assert.equal(cq.body.class, 'partner-pending');
});

test('landmark address endpoint (offline index only)', async () => {
  const r = await j(A, 'GET', `/api/v1/address/resolve?offline=1&q=${encodeURIComponent('Opposite RTC Complex, Dwaraka Nagar, Visakhapatnam')}`);
  assert.equal(r.status, 200); assert.deepEqual(r.body.sources, ['offline-index']);
  assert.ok(r.body.anchors.length >= 1); assert.ok(r.body.best);
  assert.equal((await j(A, 'GET', '/api/v1/address/resolve?q=ab')).status, 400);
});
