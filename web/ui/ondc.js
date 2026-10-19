// ONDC buyer-flow PROTOTYPE sheet (ONDC_PROTOTYPE=1 on the server). Talks to Bharat's own demo network in Beckn shape:
// search → select (quote from the server's DB, Demo prices) → confirm → the order is created as pending_payment and the
// separate payment screen opens. Never presented as the real ONDC network.
import { esc } from './search.js';
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
export function initOndc(ctx) {
  const dlg = document.getElementById('ondcDlg'), body = document.getElementById('ondcBody');
  let items = [];
  const call = async (path, payload) => {
    const r = await fetch(`${ctx.apiBase()}/api/v1/ondc/prototype/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(ctx.state.token ? { Authorization: `Bearer ${ctx.state.token}` } : {}) }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `http_${r.status}`); return j;
  };
  async function open(place, a) {
    if (ctx.state.demo) { ctx.toast('ONDC prototype needs the Bharat Map server'); return; }
    body.innerHTML = `<p class="muted">${esc(ctx.t('sv_checking'))}</p>`; dlg.showModal();
    try {
      const cat = await call('search', { seller_id: a.sellerId || '', q: place.name || '', lat: place.lat, lng: place.lng, domain: a.domain || 'retail' });
      const prov = cat.message?.catalog?.['bpp/providers'] || cat.message?.catalog?.providers || [];
      items = prov.flatMap((p) => (p.items || []).map((it) => ({ id: it.id, name: it.descriptor?.name, price: +(it.price?.value || 0), provider: p.descriptor?.name || p.id })));
      body.innerHTML = `<p class="prov-demo" data-prov="demo"><span class="hl hl-demo">${esc(ctx.t('label_demo_short'))}</span> ${esc(cat.note || '')}</p>
        ${items.length ? `<ul class="ondc-items">${items.slice(0, 12).map((it) => `<li><span><b>${esc(it.name)}</b><small>${esc(it.provider)} · ${inr(it.price)} (Demo)</small></span><button class="btn" data-ondc="${esc(it.id)}">${esc(ctx.t('sv_order_demo'))}</button></li>`).join('')}</ul>` : `<p>${esc(ctx.t('sv_order_none'))}</p>`}`;
    } catch (e) { body.innerHTML = `<p class="err" role="alert">${esc(e.message)}</p>`; }
  }
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ondc]'); if (!b) return;
    if (!ctx.state.user) { dlg.close(); ctx.toast('Sign in to order'); ctx.requireSignIn?.(); return; }
    b.disabled = true;
    try {
      const sel = [{ id: b.dataset.ondc, quantity: { count: 1 } }];
      await call('select', { items: sel }); await call('init', { items: sel });
      const r = await call('confirm', { items: sel, fulfilment: 'pickup', payment_method: 'online' });
      dlg.close();
      ctx.payment.open(r.order.id);
    } catch (err) { ctx.toast(err.message); b.disabled = false; }
  });
  document.getElementById('ondcClose').addEventListener('click', () => dlg.close());
  return { open };
}
