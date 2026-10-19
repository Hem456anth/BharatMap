// Admin dashboard UI: KPIs, 14-day trend, businesses (verify/GSTIN), products (activate),
// users (role/disable), orders, CSV report, audit log, v0.7 listings (place-service verification + provider links: list/add/verify). Talks only to /api/admin/* (role=admin).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
let ctx = null, section = 'overview';

export function initAdmin({ api, apiBase, token, toast, root, isDemo }) {
  ctx = { api, apiBase, token, toast, root, isDemo };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', (e) => {
    if (e.target.matches('[data-search]')) { e.preventDefault(); render(); }
    else if (e.target.matches('[data-lform]')) { e.preventDefault(); saveListing(e.target); }
    else if (e.target.matches('[data-pform]')) { e.preventDefault(); addLink(e.target); }
  });
}
export async function loadAdmin() {
  if (!ctx) return;
  if (ctx.isDemo()) { ctx.root.innerHTML = '<div class="empty"><b>Admin dashboard needs the backend.</b><p class="muted">On-device demo mode has no server. Set your backend URL in Settings (⚙) and sign in as an admin.</p></div>'; return; }
  ctx.root.innerHTML = `<nav class="chips" role="tablist" aria-label="Admin sections">${['overview', 'businesses', 'products', 'users', 'orders', 'listings', 'audit'].map((s) => `<button class="chip" role="tab" data-asec="${s}" aria-selected="${s === section}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</nav><div id="adminBody" aria-live="polite"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  await render();
}
const q = () => ctx.root.querySelector('#aq')?.value || '';
const searchBox = (ph) => `<form data-search class="chatform"><label for="aq" class="sr">Search</label><input id="aq" placeholder="${ph}" value="${esc(q())}"><button class="btn">Search</button></form>`;
async function render() {
  const body = ctx.root.querySelector('#adminBody'); if (!body) return;
  try {
    if (section === 'overview') {
      const o = await ctx.api('GET', '/api/admin/overview');
      const max = Math.max(1, ...o.daily.map((d) => d.gmv));
      body.innerHTML = `<div class="kpis">
        <div class="kpi"><b>${inr(o.gmv)}</b>GMV</div><div class="kpi"><b>${o.orders.total}</b>Orders</div>
        <div class="kpi"><b>${o.businesses.verified}/${o.businesses.total}</b>Verified sellers</div><div class="kpi"><b>${Object.values(o.users).reduce((a, b) => a + b, 0)}</b>Users</div>
        <div class="kpi"><b>${o.products.low_stock}</b>Low stock</div><div class="kpi"><b>${o.riders.available}/${o.riders.total}</b>Riders free</div></div>
        <h3>Last 14 days</h3>${o.daily.length ? `<div class="bars" role="img" aria-label="Daily GMV">${o.daily.map((d) => `<div title="${esc(d.day)}: ${d.orders} orders, ${inr(d.gmv)}"><i style="height:${Math.round((d.gmv / max) * 100)}%"></i><span>${esc(d.day.slice(5))}</span></div>`).join('')}</div>` : '<p class="muted">No orders in the last 14 days.</p>'}
        <h3>By city</h3><table><thead><tr><th>City</th><th>Orders</th><th>GMV</th></tr></thead><tbody>${o.by_city.map((c) => `<tr><td>${esc(c.city)}</td><td>${c.orders}</td><td>${inr(c.gmv)}</td></tr>`).join('')}</tbody></table>
        <h3>Top sellers</h3>${o.top_businesses.length ? `<table><tbody>${o.top_businesses.map((b) => `<tr><td>${esc(b.name)}</td><td>${b.orders}</td><td>${inr(b.gmv)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No sales yet.</p>'}
        <h3>Payments</h3><p class="small">${Object.entries(o.payments).map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join(' · ') || '—'}</p>
        <h3>Reports</h3><div class="row"><label class="small">From <input type="date" id="rFrom"></label><label class="small">To <input type="date" id="rTo"></label><button class="btn" data-csv>Download orders CSV</button></div>`;
    } else if (section === 'businesses') {
      const { items } = await ctx.api('GET', `/api/admin/businesses?q=${encodeURIComponent(q())}`);
      body.innerHTML = searchBox('Search name, city, category') + (items.length ? items.map((b) => `<div class="card"><h3>${esc(b.name)} ${b.verified ? '<span class="vbadge">✓ Verified</span>' : '<span class="tag warn">Unverified</span>'}</h3>
        <div class="meta">${esc(b.type)} · ${esc(b.category)} · ${esc(b.city)} · ${b.products} products · ${b.orders} orders</div><div class="meta">${esc(b.address)} · ${esc(b.owner_email || '')}</div>
        <div class="row"><label for="g-${esc(b.id)}" class="sr">GSTIN</label><input id="g-${esc(b.id)}" placeholder="GSTIN" value="${esc(b.gstin || '')}" maxlength="15"><button class="btn" data-bsave="${esc(b.id)}">Save GSTIN</button>
        <button class="btn ${b.verified ? 'ghost' : 'primary'}" data-verify="${esc(b.id)}" data-v="${b.verified ? 0 : 1}">${b.verified ? 'Revoke verification' : 'Verify seller'}</button></div></div>`).join('') : '<p class="muted">No businesses match.</p>');
    } else if (section === 'products') {
      const { items } = await ctx.api('GET', `/api/admin/products?q=${encodeURIComponent(q())}`);
      body.innerHTML = searchBox('Search product, brand, category') + (items.length ? `<table><thead><tr><th>Product</th><th>Seller</th><th>₹</th><th>Stock</th><th>Live</th></tr></thead><tbody>${items.map((p) => `<tr class="${p.active ? '' : 'off'}"><td>${esc(p.name)}</td><td>${esc(p.business_name)}</td><td>${inr(p.price)}</td><td>${p.stock <= 2 ? `<b class="err">${p.stock}</b>` : p.stock}</td><td><label class="sr" for="pa-${esc(p.id)}">Listed</label><input type="checkbox" id="pa-${esc(p.id)}" data-pactive="${esc(p.id)}" ${p.active ? 'checked' : ''}></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No products match.</p>');
    } else if (section === 'users') {
      const { items } = await ctx.api('GET', `/api/admin/users?q=${encodeURIComponent(q())}`);
      body.innerHTML = searchBox('Search email or name') + (items.length ? `<table><thead><tr><th>User</th><th>Role</th><th>Active</th></tr></thead><tbody>${items.map((u) => `<tr class="${u.disabled ? 'off' : ''}"><td>${esc(u.name)}<br><span class="small muted">${esc(u.email)}</span></td><td><label class="sr" for="ur-${esc(u.id)}">Role</label><select id="ur-${esc(u.id)}" data-urole="${esc(u.id)}">${['customer', 'seller', 'rider', 'admin'].map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><label class="sr" for="ud-${esc(u.id)}">Active</label><input type="checkbox" id="ud-${esc(u.id)}" data-uactive="${esc(u.id)}" ${u.disabled ? '' : 'checked'}></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No users match.</p>');
    } else if (section === 'orders') {
      const { items } = await ctx.api('GET', `/api/admin/orders?q=${encodeURIComponent(q())}`);
      body.innerHTML = searchBox('Order id, seller or customer email') + (items.length ? items.map((o) => `<div class="card"><div class="meta"><b>${esc(o.id)}</b> · ${esc(o.created_at)}</div><div>${esc(o.business_name)} (${esc(o.city)}) → ${esc(o.customer_email)}</div><div class="meta">${inr(o.total)} · ${esc(o.fulfilment)} · ${esc(o.status)} · ${esc(o.payment_method)}/${esc(o.payment_status)}</div></div>`).join('') : '<p class="muted">No orders yet.</p>');
    } else if (section === 'listings') {
      await renderListings(body);
    } else if (section === 'audit') {
      const { items } = await ctx.api('GET', '/api/admin/audit?limit=100');
      body.innerHTML = items.length ? `<table><thead><tr><th>When</th><th>Who</th><th>Action</th></tr></thead><tbody>${items.map((a) => `<tr><td class="small">${esc(a.at)}</td><td class="small">${esc(a.email || a.user_id)}</td><td class="small">${esc(a.action)} ${esc(a.entity || '')}:${esc(a.entity_id || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Audit log is empty.</p>';
    }
  } catch (e) {
    body.innerHTML = `<div class="empty"><p class="err" role="alert">${e.status === 403 ? 'Admin role required.' : e.status === 401 ? 'Session expired. Sign in again.' : `Could not load: ${esc(e.message)}`}</p><button class="btn" data-retry>Retry</button></div>`;
  }
}
// ---------- v0.7 listings: /api/admin/place-services + /api/admin/provider-links ----------
// Only verified links reach the public place panel; new links are always added unverified.
let listingMeta = { items: [], sellers: [], panel_types: [], providers: [] };
const VER = ['unverified', 'pending', 'verified', 'rejected'];
const KINDS = ['linkout', 'tickets', 'menu', 'reserve', 'order', 'info'];
const opt = (v, sel, label = v) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label)}</option>`;
async function renderListings(body) {
  const pf = ctx.root.querySelector('#lpf')?.value || '';
  const [meta, links] = await Promise.all([
    ctx.api('GET', '/api/admin/place-services'),
    ctx.api('GET', `/api/admin/provider-links${pf ? `?place_id=${encodeURIComponent(pf)}` : ''}`),
  ]);
  listingMeta = meta;
  const placeList = `<datalist id="lplaces">${[...meta.items.map((i) => ({ place_id: i.place_id, name: i.name })), ...meta.sellers].map((p) => `<option value="${esc(p.place_id)}">${esc(p.name || '')}</option>`).join('')}</datalist>`;
  body.innerHTML = `${placeList}
    <h3>Place listings</h3>
    <p class="small muted">Place ids look like <code>osm:node/123</code> or <code>seller:b1</code>. Verification is an admin decision; it never marks data as Live.</p>
    <form data-lform class="card" aria-label="Add or update a listing">
      <div class="row"><label class="small">Place id <input name="place_id" list="lplaces" required maxlength="80" placeholder="osm:node/123"></label>
      <label class="small">Name <input name="name" maxlength="120"></label></div>
      <div class="row"><label class="small">Panel <select name="panel_type"><option value="">auto (from tags)</option>${meta.panel_types.map((t) => opt(t, '')).join('')}</select></label>
      <label class="small">Verification <select name="verification">${VER.map((v) => opt(v, 'pending')).join('')}</select></label>
      <label class="small">Note <input name="note" maxlength="300"></label>
      <button class="btn primary">Save listing</button></div>
    </form>
    ${meta.items.length ? `<table id="listingTable"><thead><tr><th>Place</th><th>Panel</th><th>Verification</th><th>Links</th></tr></thead><tbody>${meta.items.map((i) => `<tr data-place="${esc(i.place_id)}">
      <td>${esc(i.name || meta.sellers.find((x) => x.place_id === i.place_id)?.name || '—')}<br><span class="small muted">${esc(i.place_id)}</span></td><td class="small">${esc(i.panel_type || 'auto')}</td>
      <td><label class="sr" for="lv-${esc(i.place_id)}">Verification</label><select id="lv-${esc(i.place_id)}" data-lver="${esc(i.place_id)}">${VER.map((v) => opt(v, i.verification)).join('')}</select></td>
      <td class="small">${i.verified_links}/${i.links} verified <button class="btn ghost" data-lfilter="${esc(i.place_id)}">Show</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No listings yet.</p>'}
    <h3>Provider links</h3>
    <p class="small muted">Added links start <b>unverified</b> and stay hidden from the public panel until an admin verifies them. Web links (http/https) only; no tel:, upi:// or payment intents.</p>
    <form data-pform class="card" aria-label="Add a provider link">
      <div class="row"><label class="small">Place id <input name="place_id" list="lplaces" required maxlength="80" value="${esc(pf)}"></label>
      <label class="small">Provider <select name="provider_id">${opt('website', 'website', 'Official website')}${meta.providers.map((p) => opt(p.id, '', `${p.name} (${p.domain || ''})`)).join('')}</select></label>
      <label class="small">Kind <select name="kind">${KINDS.map((k) => opt(k, 'linkout')).join('')}</select></label></div>
      <div class="row"><label class="small">Label <input name="label" maxlength="80"></label>
      <label class="small">URL <input name="url" type="url" required maxlength="500" placeholder="https://"></label>
      <button class="btn primary">Add link</button></div>
    </form>
    <form data-search class="chatform" aria-label="Filter links by place"><label for="lpf" class="sr">Filter by place id</label><input id="lpf" list="lplaces" placeholder="Filter by place id" value="${esc(pf)}"><button class="btn">Filter</button>${pf ? '<button type="button" class="btn ghost" data-lfilter="">Clear</button>' : ''}</form>
    ${links.items.length ? `<table id="linkTable"><thead><tr><th>Place</th><th>Link</th><th>Verified</th><th></th></tr></thead><tbody>${links.items.map((l) => `<tr class="${l.verified ? '' : 'off'}" data-link="${l.id}">
      <td class="small">${esc(l.place_id)}</td><td class="small"><b>${esc(l.label || l.provider_id)}</b> · ${esc(l.kind)}<br><span class="muted">${esc(l.host)}</span></td>
      <td><label class="sr" for="lk-${l.id}">Verified</label><input type="checkbox" id="lk-${l.id}" data-lkver="${l.id}" ${l.verified ? 'checked' : ''}></td>
      <td><button class="btn ghost" data-lkdel="${l.id}" aria-label="Delete link ${l.id}">Delete</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No provider links yet.</p>'}`;
}
const ERRS = { invalid_place_id: 'Place id must look like osm:node/123 or seller:b1.', invalid_url: 'Only http(s) web links are allowed (no tel: or upi:).', unknown_provider: 'Unknown provider.', provider_unavailable: 'That provider is unavailable.', duplicate_link: 'That link already exists for this place.', invalid_panel_type: 'Unknown panel type.' };
async function saveListing(f) {
  const d = Object.fromEntries(new FormData(f));
  try {
    await ctx.api('PUT', `/api/admin/place-services/${encodeURIComponent(d.place_id.trim())}`, { name: d.name || undefined, panel_type: d.panel_type || null, verification: d.verification, note: d.note || null });
    ctx.toast('Listing saved'); render();
  } catch (err) { ctx.toast(ERRS[err.message] || `Failed: ${err.message}`); }
}
async function addLink(f) {
  const d = Object.fromEntries(new FormData(f));
  try {
    await ctx.api('POST', '/api/admin/provider-links', { place_id: d.place_id.trim(), provider_id: d.provider_id, kind: d.kind, label: d.label || undefined, url: d.url.trim() });
    ctx.toast('Link added (unverified)'); render();
  } catch (err) { ctx.toast(ERRS[err.message] || `Failed: ${err.message}`); }
}

async function onClick(e) {
  const t = e.target;
  if (t.dataset.asec) { section = t.dataset.asec; ctx.root.querySelectorAll('[data-asec]').forEach((b) => b.setAttribute('aria-selected', String(b === t))); const s = ctx.root.querySelector('#aq'); if (s) s.value = ''; return render(); }
  if (t.matches('[data-retry]')) return render();
  if (t.dataset.lfilter !== undefined) { const s = ctx.root.querySelector('#lpf'); if (s) s.value = t.dataset.lfilter; return render(); }
  try {
    if (t.dataset.lkdel) { if (!confirm('Delete this provider link?')) return; await ctx.api('DELETE', `/api/admin/provider-links/${t.dataset.lkdel}`); ctx.toast('Link deleted'); return render(); }
    if (t.dataset.verify) { await ctx.api('PATCH', `/api/admin/businesses/${t.dataset.verify}`, { verified: t.dataset.v === '1' }); ctx.toast(t.dataset.v === '1' ? 'Seller verified' : 'Verification revoked'); return render(); }
    if (t.dataset.bsave) { await ctx.api('PATCH', `/api/admin/businesses/${t.dataset.bsave}`, { gstin: ctx.root.querySelector(`#g-${t.dataset.bsave}`).value }); ctx.toast('GSTIN saved'); return render(); }
    if (t.matches('[data-csv]')) {
      const from = ctx.root.querySelector('#rFrom').value, to = ctx.root.querySelector('#rTo').value;
      const r = await fetch(`${ctx.apiBase()}/api/admin/reports/orders.csv?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${ctx.token()}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `mapos-orders-${from || 'all'}-${to || 'now'}.csv` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      ctx.toast('Report downloaded');
    }
  } catch (err) { ctx.toast(err.message === 'invalid_gstin' ? 'That GSTIN is not valid (15 characters, e.g. 37AABCU9603R1ZM).' : `Failed: ${err.message}`); }
}
async function onChange(e) {
  const t = e.target;
  try {
    if (t.dataset.pactive) { await ctx.api('PATCH', `/api/admin/products/${t.dataset.pactive}`, { active: t.checked }); ctx.toast(t.checked ? 'Product listed' : 'Product hidden from search'); t.closest('tr')?.classList.toggle('off', !t.checked); }
    if (t.dataset.lkver) { await ctx.api('PATCH', `/api/admin/provider-links/${t.dataset.lkver}`, { verified: t.checked }); ctx.toast(t.checked ? 'Link verified; it now shows on the place panel' : 'Link unverified; hidden from the place panel'); t.closest('tr')?.classList.toggle('off', !t.checked); }
    if (t.dataset.lver) {
      const i = listingMeta.items.find((x) => x.place_id === t.dataset.lver) || {};
      await ctx.api('PUT', `/api/admin/place-services/${encodeURIComponent(t.dataset.lver)}`, { verification: t.value, panel_type: i.panel_type || null, note: i.note || null });
      ctx.toast(`Listing ${t.value}`);
    }
    if (t.dataset.urole) { await ctx.api('PATCH', `/api/admin/users/${t.dataset.urole}`, { role: t.value }); ctx.toast('Role updated'); }
    if (t.dataset.uactive) { await ctx.api('PATCH', `/api/admin/users/${t.dataset.uactive}`, { disabled: !t.checked }); ctx.toast(t.checked ? 'User enabled' : 'User disabled; their sessions stop working now'); t.closest('tr')?.classList.toggle('off', !t.checked); }
  } catch (err) { ctx.toast(err.message === 'cannot_change_self' ? "You can't disable or demote your own admin account." : `Failed: ${err.message}`); render(); }
}
