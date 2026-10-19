// Separate secure payment screen (#/pay/<orderId>, sheet view "payment"). The order already exists as
// 'pending_payment'; this screen only (1) asks the server to create a gateway order (amount from the server's DB),
// (2) runs that gateway's own checkout (UPI apps such as Google Pay appear inside it — Bharat never builds upi:// links),
// (3) asks the server to verify. Only a server-verified payment confirms the order. With no gateway keys it says
// "Payments not configured" and changes nothing. Keys never reach the client.
import { esc } from './search.js';
import { icon } from './icons.js';

const loadScript = (src) => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) return res();
  document.head.append(Object.assign(document.createElement('script'), { src, async: true, onload: res, onerror: () => rej(new Error('gateway_script_failed')) }));
});
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export function initPayment(ctx, { onTrack, onCancelled } = {}) {
  const el = () => document.getElementById('payBody');
  let order = null, cfg = null;

  async function open(orderId, { push = true } = {}) {
    if (push && location.hash !== `#/pay/${orderId}`) history.pushState(null, '', `#/pay/${orderId}`);
    ctx.views.show('payment', { detent: 'full' });
    el().innerHTML = `<p class="muted" aria-busy="true">${esc(ctx.t('sv_checking'))}</p>`;
    try {
      [order, cfg] = await Promise.all([ctx.api('GET', `/api/orders/${encodeURIComponent(orderId)}`), ctx.api('GET', '/api/payments/config').catch(() => ({ configured: false, gateways: [] }))]);
    } catch (e) { el().innerHTML = `<p class="err" role="alert">${esc(ctx.tf('sv_error', { what: orderId }))} (${esc(e.message)})</p>`; return; }
    render();
  }
  function render(msg = '') {
    const o = order;
    const status = o.tracking?.status || o.status;
    const head = `<div class="pay-head" data-testid="payHead"><p class="small muted">${esc(ctx.tf('pay_order', { id: o.id }))}</p>
      ${o.demo ? `<p class="prov-demo" data-prov="demo"><span class="hl hl-demo">${esc(ctx.t('label_demo_short'))}</span> ${esc(ctx.t('pay_demo'))}</p>` : ''}
      <p class="pay-amt"><small>${esc(ctx.t('pay_amount'))}</small><b>${inr(o.total)}</b></p>
      <p class="small">${esc(o.business?.name || '')} · ${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(', ')}</p></div>`;
    let body;
    if (status !== 'pending_payment') {
      body = `<p role="status" data-testid="payDone">${esc(o.payment_status === 'paid' ? ctx.t('pay_paid') : ctx.tf('pay_already', { status }))}</p>
        <div class="row"><button class="btn primary" data-pay-track>${esc(ctx.t('pay_track'))}</button></div>`;
    } else if (!cfg?.configured) {
      body = `<div class="pay-nc" role="status" data-testid="payNotConfigured"><h4>${icon('alert', { size: 18 })} ${esc(ctx.t('pay_not_configured'))}</h4><p>${esc(ctx.t('pay_not_configured_body'))}</p></div>
        <p class="pay-state" data-testid="payState">${esc(ctx.t('pay_pending'))}</p>
        <div class="row"><button class="btn ghost" data-pay-cancel>${esc(ctx.t('pay_cancel_order'))}</button><button class="btn" data-pay-track>${esc(ctx.t('pay_track'))}</button></div>`;
    } else {
      body = `<p class="pay-state" data-testid="payState">${esc(ctx.t('pay_pending'))}</p>
        <h4>${esc(ctx.t('pay_choose'))}</h4>
        <div class="pay-gws">${cfg.gateways.map((g) => `<button class="btn primary pay-gw" data-gw="${esc(g.id)}">${esc(ctx.tf('pay_with', { name: g.name }))}<small>${esc(ctx.tf('pay_mode', { mode: g.mode }))}${g.prototype ? ' · prototype' : ''}</small></button>`).join('')}</div>
        <p class="small muted">${esc(ctx.t('pay_upi_note'))}</p>
        <div class="row"><button class="btn ghost" data-pay-cancel>${esc(ctx.t('pay_cancel_order'))}</button></div>`;
    }
    el().innerHTML = `${head}${body}${msg ? `<p class="pay-msg" role="alert">${esc(msg)}</p>` : ''}<p class="small muted">${icon('shield', { size: 14 })} Keys stay on the server · amount set by the server · order confirmed only after server-side verification.</p>`;
  }
  async function verify(gw, body) {
    render(ctx.t('pay_verifying'));
    try { order = await ctx.api('POST', `/api/payments/${gw}/verify`, body); render(ctx.t('pay_paid')); ctx.toast(ctx.t('pay_paid')); }
    catch (e) { render(`${ctx.t('pay_failed')} (${e.message})`); }
  }
  async function pay(gwId) {
    let init;
    try { init = await ctx.api('POST', '/api/payments/orders', { order_id: order.id, gateway: gwId }); } catch (e) { render(e.message === 'payments_not_configured' ? ctx.t('pay_not_configured') : `${ctx.t('pay_failed')} (${e.message})`); return; }
    const c = init.checkout; const g = cfg.gateways.find((x) => x.id === gwId);
    try {
      if (gwId === 'razorpay') {
        await loadScript(g.script);
        const rz = new window.Razorpay({ key: c.key_id, order_id: c.order_id, amount: c.amount, currency: 'INR', name: 'Bharat Map', description: c.description, prefill: { email: ctx.state.user?.email || '' }, theme: { color: '#0f6e56' },
          handler: (resp) => verify('razorpay', resp), modal: { ondismiss: () => render(ctx.t('pay_failed')) } });
        rz.on('payment.failed', () => render(ctx.t('pay_failed')));
        rz.open();
      } else if (gwId === 'cashfree') {
        await loadScript(g.script);
        const cf = window.Cashfree({ mode: c.env === 'production' ? 'production' : 'sandbox' });
        await cf.checkout({ paymentSessionId: c.payment_session_id, redirectTarget: '_modal' });
        await verify('cashfree', { provider_order_id: init.provider_order_id });
      } else if (gwId === 'phonepe') {
        sessionStorage.setItem('bm-pay-attempt', JSON.stringify({ order: order.id, gw: 'phonepe', id: init.provider_order_id }));
        location.href = c.redirect_url; // PhonePe hosted checkout; on return the screen re-verifies server-side
      } else if (gwId === 'paytm') {
        await loadScript(g.script);
        const P = window.Paytm.CheckoutJS;
        await P.init({ root: '', flow: 'DEFAULT', data: { orderId: c.order_id, token: c.txn_token, tokenType: 'TXN_TOKEN', amount: c.amount }, handler: { transactionStatus: () => { P.close(); verify('paytm', { provider_order_id: init.provider_order_id }); }, notifyMerchant: () => {} } });
        P.invoke();
      }
    } catch (e) { render(`${ctx.t('pay_failed')} (${e.message})`); }
  }
  document.getElementById('payBody').addEventListener('click', async (e) => {
    const gw = e.target.closest('[data-gw]'); if (gw) return pay(gw.dataset.gw);
    if (e.target.closest('[data-pay-track]')) { onTrack?.(order.id); return; }
    if (e.target.closest('[data-pay-cancel]')) { try { order = await ctx.api('POST', `/api/orders/${order.id}/cancel`, {}); } catch (err) { ctx.toast(err.message); } await open(order.id, { push: false }); onCancelled?.(order.id); }
  });
  // Deep link / return from a redirect gateway: #/pay/<id>
  async function fromHash() {
    const m = /^#\/pay\/([\w-]{4,40})$/.exec(location.hash);
    if (!m) return;
    await open(m[1], { push: false });
    const att = JSON.parse(sessionStorage.getItem('bm-pay-attempt') || 'null');
    if (att && att.order === m[1] && order.status === 'pending_payment') { sessionStorage.removeItem('bm-pay-attempt'); verify(att.gw, { provider_order_id: att.id }); }
  }
  window.addEventListener('hashchange', fromHash);
  return { open, fromHash, get order() { return order; } };
}
