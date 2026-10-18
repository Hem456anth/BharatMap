// Razorpay adapter (real provider; works in Test Mode with rzp_test_* keys, Live Mode with rzp_live_*).
// Docs: https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/
// Flow: server creates a Razorpay order -> client opens Checkout -> server verifies the
// HMAC-SHA256 signature of `${order_id}|${payment_id}` -> webhook (payment.captured) is the backstop.
import crypto from 'node:crypto';

const safeEq = (a, b) => {
  const x = Buffer.from(String(a || ''), 'utf8'), y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
export const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export function verifyCheckoutSignature({ secret, orderId, paymentId, signature }) {
  if (!secret || !orderId || !paymentId || !signature) return false;
  return safeEq(hmac(secret, `${orderId}|${paymentId}`), signature);
}
export function verifyWebhookSignature({ secret, rawBody, signature }) {
  if (!secret || !rawBody || !signature) return false;
  return safeEq(hmac(secret, rawBody), signature);
}

export function createRazorpay({
  keyId = process.env.RAZORPAY_KEY_ID,
  keySecret = process.env.RAZORPAY_KEY_SECRET,
  webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET,
  apiBase = process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com',
  fetchImpl = globalThis.fetch,
} = {}) {
  const enabled = Boolean(keyId && keySecret);
  return {
    enabled,
    keyId: enabled ? keyId : null,
    mode: !enabled ? 'disabled' : keyId.startsWith('rzp_live_') ? 'live' : 'test',
    async createOrder({ amountPaise, receipt, notes }) {
      if (!enabled) throw Object.assign(new Error('payments_not_configured'), { code: 503 });
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10_000);
      try {
        const r = await fetchImpl(`${apiBase}/v1/orders`, {
          method: 'POST', signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
          body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.id) throw Object.assign(new Error(`razorpay_error:${j.error?.code || r.status}`), { code: 502 });
        return j;
      } finally { clearTimeout(t); }
    },
    verifyCheckout: (orderId, paymentId, signature) => verifyCheckoutSignature({ secret: keySecret, orderId, paymentId, signature }),
    verifyWebhook: (rawBody, signature) => verifyWebhookSignature({ secret: webhookSecret, rawBody, signature }),
  };
}
