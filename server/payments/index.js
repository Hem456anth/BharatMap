// Payments module: one adapter per gateway, each ENABLED ONLY BY ITS ENV KEYS (keys never leave the server).
// Flow (docs/ARCHITECTURE.md "Order → payment"):
//   1. POST /api/orders {payment_method:'online'} → order created with status 'pending_payment' (no rider movement,
//      not confirmed); the app opens the separate payment screen (#/pay/<orderId>).
//   2. POST /api/payments/orders {order_id, gateway} → the server creates the gateway order (amount from OUR database,
//      never from the client) and returns only public checkout parameters.
//   3. The gateway checkout runs (UPI apps such as Google Pay appear INSIDE it — no hand-built upi://pay intents).
//   4. POST /api/payments/:gateway/verify (client callback) → server-side verification (signature or a server-to-server
//      status re-check); POST /api/payments/:gateway/webhook → signature-verified backstop.
//   5. Only a verified payment flips the order to paid → status 'placed' (confirmed) and starts tracking.
// With no keys: config says configured=false, POST /api/payments/orders → 503 payments_not_configured; nothing is marked paid.
//
// Adapter contract: { id, name, enabled, mode, publicConfig(), createOrder({ orderId, amountPaise, customer, returnUrl }) →
//   { providerOrderId, checkout }, verifyClient(body, ctx) → { ok, providerOrderId, providerPaymentId },
//   verifyWebhook(rawBody, headers) → { ok, providerOrderId, providerPaymentId, paid, failed } }
// Razorpay: production-tested flow from v0.2 (test mode). Cashfree / PhonePe / Paytm: PROTOTYPE adapters written from their
// public docs, unit-tested with locally computed signatures; NOT exercised against a live sandbox (no keys in this build).
import crypto from 'node:crypto';
import { createRazorpay } from '../services/payments.js';

const safeEq = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
async function call(fetchImpl, url, init, tag) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12_000);
  try {
    const r = await fetchImpl(url, { ...init, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`${tag}_error:${j.code || j.message || r.status}`), { code: 502, body: j });
    return j;
  } finally { clearTimeout(t); }
}

// ---------------- Razorpay (wraps the v0.2 adapter) ----------------
export function razorpayAdapter(env = process.env, { fetchImpl = globalThis.fetch, impl } = {}) {
  const rz = impl || createRazorpay({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET, apiBase: env.RAZORPAY_API_BASE || 'https://api.razorpay.com', fetchImpl });
  return {
    id: 'razorpay', name: 'Razorpay', enabled: rz.enabled, mode: rz.mode, script: 'https://checkout.razorpay.com/v1/checkout.js',
    publicConfig: () => ({ key_id: rz.keyId }),
    async createOrder({ orderId, amountPaise }) {
      const o = await rz.createOrder({ amountPaise, receipt: orderId, notes: { mapos_order: orderId } });
      return { providerOrderId: o.id, checkout: { key_id: rz.keyId, order_id: o.id, amount: amountPaise, currency: 'INR', name: 'Bharat Map', description: `Order ${orderId}` } };
    },
    async verifyClient(b) {
      const ok = rz.verifyCheckout(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature);
      return { ok, providerOrderId: b.razorpay_order_id, providerPaymentId: b.razorpay_payment_id };
    },
    verifyWebhook(raw, h) {
      if (!rz.verifyWebhook(raw, h['x-razorpay-signature'])) return { ok: false };
      const j = JSON.parse(raw); const ent = j.payload?.payment?.entity || {};
      return { ok: true, providerOrderId: ent.order_id, providerPaymentId: ent.id, paid: ['payment.captured', 'order.paid'].includes(j.event), failed: j.event === 'payment.failed' };
    },
    raw: rz,
  };
}

// ---------------- Cashfree PG (API version 2023-08-01) ----------------
// Create order: POST {base}/pg/orders (x-client-id / x-client-secret / x-api-version) → payment_session_id for the JS SDK.
// Verify: server re-fetches GET {base}/pg/orders/{order_id} and requires order_status === 'PAID' (client callbacks are not trusted).
// Webhook: x-webhook-signature = base64(HMAC-SHA256(x-webhook-timestamp + rawBody, client secret)).
export const cashfreeSignature = (secret, timestamp, raw) => crypto.createHmac('sha256', secret).update(`${timestamp}${raw}`).digest('base64');
export function cashfreeAdapter(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const id = env.CASHFREE_APP_ID, secret = env.CASHFREE_SECRET_KEY;
  const prod = env.CASHFREE_ENV === 'production';
  const base = env.CASHFREE_API_BASE || (prod ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com');
  const H = { 'x-client-id': id, 'x-client-secret': secret, 'x-api-version': '2023-08-01', 'Content-Type': 'application/json' };
  return {
    id: 'cashfree', name: 'Cashfree Payments', enabled: !!(id && secret), mode: !(id && secret) ? 'disabled' : prod ? 'live' : 'test', prototype: true, script: 'https://sdk.cashfree.com/js/v3/cashfree.js',
    publicConfig: () => ({ env: prod ? 'production' : 'sandbox' }),
    async createOrder({ orderId, amountPaise, customer, returnUrl }) {
      const j = await call(fetchImpl, `${base}/pg/orders`, { method: 'POST', headers: H, body: JSON.stringify({ order_id: orderId, order_amount: amountPaise / 100, order_currency: 'INR', customer_details: { customer_id: customer.id.slice(0, 50), customer_phone: customer.phone || '9999999999', customer_email: customer.email || undefined }, order_meta: { return_url: returnUrl } }) }, 'cashfree');
      return { providerOrderId: j.order_id || orderId, checkout: { payment_session_id: j.payment_session_id, env: prod ? 'production' : 'sandbox' } };
    },
    async verifyClient(_b, { providerOrderId }) {
      const j = await call(fetchImpl, `${base}/pg/orders/${encodeURIComponent(providerOrderId)}`, { headers: H }, 'cashfree');
      return { ok: j.order_status === 'PAID', providerOrderId, providerPaymentId: j.cf_order_id ? String(j.cf_order_id) : null };
    },
    verifyWebhook(raw, h) {
      const ts = h['x-webhook-timestamp'], sig = h['x-webhook-signature'];
      if (!secret || !ts || !sig || !safeEq(cashfreeSignature(secret, ts, raw), sig)) return { ok: false };
      const j = JSON.parse(raw); const d = j.data || {};
      return { ok: true, providerOrderId: d.order?.order_id, providerPaymentId: d.payment?.cf_payment_id ? String(d.payment.cf_payment_id) : null, paid: d.payment?.payment_status === 'SUCCESS', failed: ['FAILED', 'USER_DROPPED'].includes(d.payment?.payment_status) };
    },
  };
}

// ---------------- PhonePe PG (v2 Standard Checkout) ----------------
// OAuth: POST {auth}/v1/oauth/token (client_id, client_version, client_secret, grant_type=client_credentials) → access_token.
// Pay: POST {pg}/checkout/v2/pay (Authorization: O-Bearer <token>) → redirectUrl (PhonePe hosted page; UPI apps inside).
// Verify: GET {pg}/checkout/v2/order/{merchantOrderId}/status → state === 'COMPLETED'.
// Webhook: Authorization header = SHA256("<username>:<password>") configured in the PhonePe dashboard.
export const phonepeWebhookAuth = (user, pass) => sha256hex(`${user}:${pass}`);
export function phonepeAdapter(env = process.env, { fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cid = env.PHONEPE_CLIENT_ID, csec = env.PHONEPE_CLIENT_SECRET, cver = env.PHONEPE_CLIENT_VERSION || '1';
  const prod = env.PHONEPE_ENV === 'production';
  const pg = env.PHONEPE_PG_BASE || (prod ? 'https://api.phonepe.com/apis/pg' : 'https://api-preprod.phonepe.com/apis/pg-sandbox');
  const auth = env.PHONEPE_AUTH_BASE || (prod ? 'https://api.phonepe.com/apis/identity-manager' : 'https://api-preprod.phonepe.com/apis/pg-sandbox');
  let tok = null;
  async function token() {
    if (tok && tok.exp > now() + 60_000) return tok.v;
    const body = new URLSearchParams({ client_id: cid, client_version: cver, client_secret: csec, grant_type: 'client_credentials' });
    const j = await call(fetchImpl, `${auth}/v1/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 'phonepe');
    tok = { v: j.access_token, exp: (j.expires_at ? j.expires_at * 1000 : now() + 15 * 60_000) };
    return tok.v;
  }
  return {
    id: 'phonepe', name: 'PhonePe Payment Gateway', enabled: !!(cid && csec), mode: !(cid && csec) ? 'disabled' : prod ? 'live' : 'test', prototype: true,
    publicConfig: () => ({}),
    async createOrder({ orderId, amountPaise, returnUrl }) {
      const t = await token();
      const j = await call(fetchImpl, `${pg}/checkout/v2/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${t}` }, body: JSON.stringify({ merchantOrderId: orderId, amount: amountPaise, paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: returnUrl } } }) }, 'phonepe');
      return { providerOrderId: orderId, checkout: { redirect_url: j.redirectUrl } };
    },
    async verifyClient(_b, { providerOrderId }) {
      const t = await token();
      const j = await call(fetchImpl, `${pg}/checkout/v2/order/${encodeURIComponent(providerOrderId)}/status`, { headers: { Authorization: `O-Bearer ${t}` } }, 'phonepe');
      return { ok: j.state === 'COMPLETED', providerOrderId, providerPaymentId: j.paymentDetails?.[0]?.transactionId || null };
    },
    verifyWebhook(raw, h) {
      const u = env.PHONEPE_WEBHOOK_USER, p = env.PHONEPE_WEBHOOK_PASSWORD;
      if (!u || !p || !safeEq(phonepeWebhookAuth(u, p), String(h.authorization || '').replace(/^SHA256\s+/i, ''))) return { ok: false };
      const j = JSON.parse(raw); const pl = j.payload || {};
      return { ok: true, providerOrderId: pl.merchantOrderId, providerPaymentId: pl.paymentDetails?.[0]?.transactionId || null, paid: pl.state === 'COMPLETED', failed: pl.state === 'FAILED' };
    },
  };
}

// ---------------- Paytm PG (Paytm Payments Services) ----------------
// Checksum (PaytmChecksum, public algorithm): base64(AES-128-CBC(key, iv='@@@@&&&&####$$$$', sha256hex(body + '|' + salt) + salt)).
// initiateTransaction → txnToken for the JS Checkout; verify via /v3/order/status (signed) → resultStatus 'TXN_SUCCESS';
// callback/webhook carry CHECKSUMHASH over the posted params (sorted, '|'-joined).
const PAYTM_IV = Buffer.from('@@@@&&&&####$$$$');
const aes = (key) => { const k = Buffer.from(key); return k.length === 16 ? 'aes-128-cbc' : k.length === 24 ? 'aes-192-cbc' : 'aes-256-cbc'; };
export function paytmGenerateSignature(str, key, salt = crypto.randomBytes(3).toString('base64').slice(0, 4)) {
  const c = crypto.createCipheriv(aes(key), Buffer.from(key), PAYTM_IV);
  return Buffer.concat([c.update(`${sha256hex(`${str}|${salt}`)}${salt}`, 'utf8'), c.final()]).toString('base64');
}
export function paytmVerifySignature(str, key, checksum) {
  try {
    const d = crypto.createDecipheriv(aes(key), Buffer.from(key), PAYTM_IV);
    const plain = Buffer.concat([d.update(Buffer.from(String(checksum), 'base64')), d.final()]).toString('utf8');
    const salt = plain.slice(-4);
    return safeEq(plain, `${sha256hex(`${str}|${salt}`)}${salt}`);
  } catch { return false; }
}
export const paytmParamString = (params) => Object.keys(params).filter((k) => k !== 'CHECKSUMHASH').sort().map((k) => (params[k] == null || params[k] === 'null' ? '' : String(params[k]))).join('|');
export function paytmAdapter(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const mid = env.PAYTM_MID, key = env.PAYTM_MERCHANT_KEY;
  const prod = env.PAYTM_ENV === 'production';
  const base = env.PAYTM_API_BASE || (prod ? 'https://secure.paytmpayments.com' : 'https://securestage.paytmpayments.com');
  return {
    id: 'paytm', name: 'Paytm Payment Gateway', enabled: !!(mid && key), mode: !(mid && key) ? 'disabled' : prod ? 'live' : 'test', prototype: true,
    script: `${base}/merchantpgpui/checkoutjs/merchants/${encodeURIComponent(mid || 'MID')}.js`,
    publicConfig: () => ({ mid, host: base }),
    async createOrder({ orderId, amountPaise, customer, returnUrl }) {
      const body = { requestType: 'Payment', mid, websiteName: env.PAYTM_WEBSITE || (prod ? 'DEFAULT' : 'WEBSTAGING'), orderId, callbackUrl: returnUrl, txnAmount: { value: (amountPaise / 100).toFixed(2), currency: 'INR' }, userInfo: { custId: customer.id.slice(0, 50) } };
      const j = await call(fetchImpl, `${base}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(orderId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, head: { signature: paytmGenerateSignature(JSON.stringify(body), key) } }) }, 'paytm');
      if (j.body?.resultInfo?.resultStatus !== 'S') throw Object.assign(new Error(`paytm_error:${j.body?.resultInfo?.resultCode || 'init'}`), { code: 502 });
      return { providerOrderId: orderId, checkout: { mid, order_id: orderId, txn_token: j.body.txnToken, amount: body.txnAmount.value, host: base } };
    },
    async verifyClient(_b, { providerOrderId }) {
      const body = { mid, orderId: providerOrderId };
      const j = await call(fetchImpl, `${base}/v3/order/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, head: { signature: paytmGenerateSignature(JSON.stringify(body), key) } }) }, 'paytm');
      return { ok: j.body?.resultInfo?.resultStatus === 'TXN_SUCCESS', providerOrderId, providerPaymentId: j.body?.txnId || null };
    },
    verifyWebhook(raw, _h) {
      let params; try { params = raw.trim().startsWith('{') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)); } catch { return { ok: false }; }
      if (!key || !params.CHECKSUMHASH || !paytmVerifySignature(paytmParamString(params), key, params.CHECKSUMHASH)) return { ok: false };
      return { ok: true, providerOrderId: params.ORDERID, providerPaymentId: params.TXNID || null, paid: params.STATUS === 'TXN_SUCCESS', failed: params.STATUS === 'TXN_FAILURE' };
    },
  };
}

/** Registry: only adapters whose env keys are present are enabled. `adapters` lets tests inject fakes. */
export function createPayments({ env = process.env, fetchImpl = globalThis.fetch, razorpay, adapters } = {}) {
  const list = adapters || [razorpayAdapter(env, { fetchImpl, impl: razorpay }), cashfreeAdapter(env, { fetchImpl }), phonepeAdapter(env, { fetchImpl }), paytmAdapter(env, { fetchImpl })];
  const byId = Object.fromEntries(list.map((a) => [a.id, a]));
  return {
    list, get: (id) => byId[id] || null,
    enabled: () => list.filter((a) => a.enabled),
    configured: () => list.some((a) => a.enabled),
    publicConfig: () => ({
      configured: list.some((a) => a.enabled),
      gateways: list.filter((a) => a.enabled).map((a) => ({ id: a.id, name: a.name, mode: a.mode, prototype: !!a.prototype, script: a.script || null, ...a.publicConfig() })),
      upi: 'inside gateway checkout only',
      all: list.map((a) => ({ id: a.id, name: a.name, enabled: a.enabled, prototype: !!a.prototype })),
    }),
  };
}
