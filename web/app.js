// Bharat Map web client. Talks to the REST API; falls back to an in-browser
// backend (mock-api.js) when served statically without a server.
import { store } from './shared/storage.js';
import * as maplibregl from './vendor/maplibre-gl.mjs';
import { LANGS, t as tr } from './shared/i18n.js';
import { CITIES } from './shared/seed.js';
import { mockApi, mockLogout } from './mock-api.js';
import { priceOrder } from './shared/logistics.js';
import { haversineKm } from './shared/geo.js';
import { isNative, currentPosition, deviceNotify, ensureNotifyPermission } from './native.js';
import { initAdmin, loadAdmin } from './admin.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const state = {
  lang: store.getItem('mapos-lang') || 'en',
  city: store.getItem('mapos-city') || 'vizag',
  me: null, token: store.getItem('mapos-token') || null, user: JSON.parse(store.getItem('mapos-user') || 'null'),
  results: [], cart: null, drop: null, demo: false, markers: [], mobMarkers: [], trackTimer: null, stream: null,
  config: null, offline: store.getItem('mapos-offline') === '1', lastNotif: Number(store.getItem('mapos-last-notif') || 0), notifTimer: null,
};
// Backend base URL: '' = same origin (server-hosted web). The Android app has no same-origin server,
// so it uses the URL saved in Settings or baked in at build time (www/config.js → window.__MAPOS_CONFIG__).
const apiBase = () => (store.getItem('mapos-api') ?? window.__MAPOS_CONFIG__?.apiBase ?? '').replace(/\/$/, '');

// ---------------- API ----------------
async function detectMode() {
  if (window.__MAPOS_DEMO__ || location.protocol === 'file:' || new URLSearchParams(location.search).has('demo')) return (state.demo = true);
  if (isNative() && !apiBase()) return (state.demo = true); // no backend configured yet → on-device mode
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${apiBase()}/api/health`, { cache: 'no-store', signal: ctl.signal }); const j = await r.json(); state.demo = j.status !== 'ok';
    if (!state.demo) state.config = await fetch(`${apiBase()}/api/config`).then((x) => x.json()).catch(() => null);
  } catch { state.demo = true; }
}
async function api(method, path, body) {
  if (state.demo) {
    try { return await mockApi(method, path, body); } catch (e) { throw e; }
  }
  let r;
  try {
    r = await fetch(apiBase() + path, { method, headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw Object.assign(new Error(navigator.onLine === false ? 'You are offline' : 'Server unreachable'), { status: 0, network: true }); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && state.token && path !== '/api/auth/login') { signOut(); toast('Session expired. Please sign in again.'); }
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status, body: j });
  return j;
}
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }

// ---------------- i18n ----------------
function applyLang() {
  document.documentElement.lang = state.lang;
  $('#q').placeholder = tr(state.lang, 'search');
  $$('[data-i18n]').forEach((el) => { el.textContent = tr(state.lang, el.dataset.i18n); });
  $('#authBtn').textContent = state.user ? `${tr(state.lang, 'logout')} (${state.user.role})` : tr(state.lang, 'login');
  $('#placeBtn').textContent = tr(state.lang, 'place_order');
  renderResults();
}

// ---------------- Map ----------------
const center = () => state.me || CITIES[state.city].center;
function onlineStyle() {
  // Server-hosted web uses the same-origin tile proxy; app/standalone builds talk to OpenFreeMap directly.
  return window.__MAPOS_DEMO__ || location.protocol === 'file:' || isNative() || apiBase() ? 'https://tiles.openfreemap.org/styles/liberty' : '/map/style.json';
}
async function applyMapStyle() {
  let style = onlineStyle(), offlineOn = false;
  if (state.offline || navigator.onLine === false) {
    try { const m = await import('./offline-map.js'); style = await m.offlineStyle(maplibregl, state.city, state.lang); offlineOn = true; } catch (e) { toast(`Offline map unavailable: ${e.message}`); }
  }
  map.setStyle(style, { diff: false });
  map.once('styledata', () => { addRouteLayers(); if (!offlineOn) setLabelLanguage(); });
  const b = $('#offBtn'); if (b) { b.setAttribute('aria-pressed', String(offlineOn)); b.title = offlineOn ? 'Offline map on (bundled OpenStreetMap data)' : 'Use offline map'; }
  updateBadge(offlineOn);
}
const map = new maplibregl.Map({
  container: 'map',
  style: onlineStyle(),
  center: [CITIES[state.city].center.lng, CITIES[state.city].center.lat], zoom: 12.5, attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
let meMarker = null, dropMarker = null, riderMarker = null;
if (window.ResizeObserver) new ResizeObserver(() => map.resize()).observe(document.getElementById('map'));

let lastRoute = null;
function addRouteLayers() {
  if (map.getSource('route')) return;
  map.addSource('route', { type: 'geojson', data: lastRoute ? { type: 'Feature', geometry: lastRoute, properties: {} } : { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#0b5543', 'line-width': 8, 'line-opacity': 0.35 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#0f6e56', 'line-width': 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
}
map.on('load', () => {
  addRouteLayers();
  // Prefer local-language labels where OSM has them (name:te, name:hi, ...), fall back to name.
  setLabelLanguage();
});
function setLabelLanguage() {
  if (!map.isStyleLoaded()) return;
  for (const l of map.getStyle().layers) {
    if (l.type === 'symbol' && l.layout?.['text-field']) {
      try { map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', `name:${state.lang}`], ['get', 'name:en'], ['get', 'name']]); } catch { /* some layers use other fields */ }
    }
  }
}
function setMe(p) {
  state.me = p;
  if (!meMarker) { const el = document.createElement('div'); el.className = 'me'; el.setAttribute('aria-label', 'Your location'); meMarker = new maplibregl.Marker({ element: el }); }
  meMarker.setLngLat([p.lng, p.lat]).addTo(map);
  if (!state.drop) setDrop({ ...p, label: 'Current location' });
}
function setDrop(p) {
  state.drop = p;
  if (!dropMarker) { const el = document.createElement('div'); el.className = 'drop'; el.textContent = '📍'; dropMarker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' }); dropMarker.on('dragend', () => { const ll = dropMarker.getLngLat(); state.drop = { lat: ll.lat, lng: ll.lng, label: 'Pinned on map' }; updateQuote(); }); }
  dropMarker.setLngLat([p.lng, p.lat]).addTo(map);
}
function drawRoute(geometry) {
  lastRoute = geometry || null;
  const src = map.getSource('route'); if (!src) return;
  src.setData(geometry ? { type: 'Feature', geometry, properties: {} } : { type: 'FeatureCollection', features: [] });
  if (geometry?.coordinates?.length) {
    const b = geometry.coordinates.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0]));
    map.fitBounds(b, { padding: { top: 60, bottom: 60, left: window.innerWidth > 820 ? 60 : 30, right: 60 }, maxZoom: 15 });
  }
}
function clearMarkers(list) { list.forEach((m) => m.remove()); list.length = 0; }
function plotResults() {
  clearMarkers(state.markers);
  const pts = [];
  state.results.forEach((r, i) => {
    const el = document.createElement('button');
    const p = r.products[0];
    el.className = `mk${r.business.verified ? ' v' : ''}`;
    el.textContent = p ? inr(p.price) : r.business.name;
    el.setAttribute('aria-label', `${r.business.name}${p ? `, ${p.name} ${inr(p.price)}` : ''}`);
    el.onclick = () => selectResult(i);
    state.markers.push(new maplibregl.Marker({ element: el }).setLngLat([r.business.lng, r.business.lat]).addTo(map));
    pts.push([r.business.lng, r.business.lat]);
  });
  if (state.me) pts.push([state.me.lng, state.me.lat]);
  if (pts.length > 1) map.fitBounds(pts.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(pts[0], pts[0])), { padding: 70, maxZoom: 15 });
  else if (pts.length) map.flyTo({ center: pts[0], zoom: 15 });
}
function selectResult(i) {
  $$('.card').forEach((c) => c.classList.remove('sel'));
  state.markers.forEach((m, j) => m.getElement().classList.toggle('sel', i === j));
  const card = $(`#res-${i}`); if (card) { card.classList.add('sel'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  const r = state.results[i]; map.flyTo({ center: [r.business.lng, r.business.lat], zoom: 15.5 });
}

// ---------------- Search ----------------
async function runSearch(q) {
  if (!q) return;
  showTab('explore');
  $('#q').value = q;
  $('#summary').textContent = '…';
  const c = center();
  try {
    const res = await api('GET', `/api/search?q=${encodeURIComponent(q)}&lat=${c.lat}&lng=${c.lng}&radius_km=20`);
    state.results = res.results;
    const parts = [`${res.count} ${tr(state.lang, 'results').toLowerCase()}`];
    if (res.price_range) parts.push(`${inr(res.price_range.min)} – ${inr(res.price_range.max)}`);
    if (res.intent?.locality) parts.push(`📍 ${res.intent.locality.name}`);
    if (res.intent?.wholesale) parts.push(tr(state.lang, 'wholesale'));
    if (res.intent?.maxPrice) parts.push(`≤ ${inr(res.intent.maxPrice)}`);
    $('#summary').textContent = parts.join(' · ');
    if (!res.count && res.places?.length) { const p = res.places[0]; map.flyTo({ center: [p.lng, p.lat], zoom: 15 }); $('#summary').textContent = `📍 ${p.name}`; }
    renderResults(); plotResults();
  } catch (e) { $('#summary').textContent = `Search failed: ${e.message}`; }
}
function renderResults() {
  const L = state.lang;
  $('#results').innerHTML = state.results.map((r, i) => `
    <article class="card" id="res-${i}" tabindex="0" aria-label="${esc(r.business.name)}">
      <h3>${esc(r.business.name)} ${r.business.verified ? `<span class="vbadge">✓ ${esc(tr(L, 'verified'))}</span>` : '<span class="ubadge">Unverified</span>'}</h3>
      <div class="meta">${esc(r.business.type)} · ★ ${r.business.rating} · ${r.distance_km != null ? `${r.distance_km} km` : ''}${r.eta_min && r.business.delivery ? ` · 🛵 ~${r.eta_min} min` : ''} · ${esc(r.business.hours || '')}</div>
      <div class="meta">${esc(r.business.address)}</div>
      ${r.products.slice(0, 4).map((p) => `
        <div class="prod">
          <div><div>${esc(p.name)}</div>
            <div><span class="price">${inr(p.price)}</span>${p.mrp > p.price ? `<span class="mrp">${inr(p.mrp)}</span><span class="off">${p.discount_pct}% off</span>` : ''}</div>
            ${p.wholesale_price ? `<div class="ws">${esc(tr(L, 'wholesale'))}: ${inr(p.wholesale_price)} × ${p.min_wholesale_qty}+</div>` : ''}
            <div class="stock ${p.stock > 0 ? '' : 'out'}">${p.stock > 0 ? `${esc(tr(L, 'in_stock'))} (${p.stock})` : esc(tr(L, 'out_of_stock'))}</div></div>
          <button class="btn ${p.stock > 0 ? 'primary' : ''}" ${p.stock > 0 ? '' : 'disabled'} data-add="${i}:${esc(p.id)}" aria-label="Add ${esc(p.name)} to cart">${esc(tr(L, 'add'))}</button>
        </div>`).join('')}
      <div class="row" style="margin-top:6px"><button class="btn ghost" data-dir="${i}">↗ ${esc(tr(L, 'directions'))}</button></div>
    </article>`).join('');
}
$('#results').addEventListener('click', async (e) => {
  const add = e.target.closest('[data-add]');
  if (add) { const [i, pid] = add.dataset.add.split(':'); addToCart(state.results[+i], pid); return; }
  const dir = e.target.closest('[data-dir]');
  if (dir) { const b = state.results[+dir.dataset.dir].business; const c = center(); const r = await api('GET', `/api/route?from_lat=${c.lat}&from_lng=${c.lng}&to_lat=${b.lat}&to_lng=${b.lng}`); drawRoute(r.geometry); toast(`${(r.distance_m / 1000).toFixed(1)} km · ${Math.round(r.duration_s / 60)} min (${r.engine})`); return; }
  const card = e.target.closest('.card'); if (card) selectResult(+card.id.split('-')[1]);
});

// Typeahead suggestions from the local place index (debounced)
let sugT;
$('#q').addEventListener('input', (e) => {
  clearTimeout(sugT);
  const v = e.target.value.trim();
  if (v.length < 2) { $('#suggest').hidden = true; return; }
  sugT = setTimeout(async () => {
    try {
      const c = center();
      const r = await api('GET', `/api/search?q=${encodeURIComponent(v)}&lat=${c.lat}&lng=${c.lng}&city=${state.city}`);
      const items = [...(r.places || []).map((p) => ({ label: `📍 ${p.name}${p.pincode ? ` · ${p.pincode}` : ''}`, place: p })), ...r.results.slice(0, 4).map((x) => ({ label: `🏪 ${x.business.name}`, q: v }))];
      $('#suggest').innerHTML = items.map((it, i) => `<li role="option" data-i="${i}">${esc(it.label)}</li>`).join('');
      $('#suggest').hidden = !items.length;
      $('#suggest').onclick = (ev) => { const it = items[+ev.target.dataset.i]; $('#suggest').hidden = true; if (it?.place) { map.flyTo({ center: [it.place.lng, it.place.lat], zoom: 15 }); setMe({ lat: it.place.lat, lng: it.place.lng }); } else runSearch(v); };
    } catch { /* ignore */ }
  }, 220);
});
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) $('#suggest').hidden = true; });
$('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); $('#suggest').hidden = true; runSearch($('#q').value.trim()); });
$$('[data-q]').forEach((b) => b.addEventListener('click', () => runSearch(b.dataset.q)));

// ---------------- Cart & checkout ----------------
function addToCart(r, pid) {
  const p = r.products.find((x) => x.id === pid);
  if (state.cart && state.cart.business.id !== r.business.id) {
    if (!confirm(`Your cart has items from ${state.cart.business.name}. Start a new cart from ${r.business.name}?`)) return;
    state.cart = null;
  }
  state.cart = state.cart || { business: r.business, items: [] };
  const line = state.cart.items.find((x) => x.id === pid);
  if (line) line.qty = Math.min(line.qty + 1, p.stock); else state.cart.items.push({ ...p, qty: 1 });
  renderCartFab(); toast(`${p.name} → ${tr(state.lang, 'cart')}`);
}
function renderCartFab() {
  const c = state.cart; const n = c ? c.items.reduce((s, i) => s + i.qty, 0) : 0;
  $('#cartBtn').hidden = !n; $('#cartCount').textContent = n;
  $('#cartTotal').textContent = c ? inr(c.items.reduce((s, i) => s + i.price * i.qty, 0)) : '';
}
function openCart() {
  const c = state.cart; if (!c) return;
  $('#cartTitle').textContent = `${tr(state.lang, 'cart')} · ${c.business.name}`;
  $('#cartBody').innerHTML = c.items.map((it, i) => `<div class="prod"><div>${esc(it.name)}<div class="meta">${inr(it.price)}${it.wholesale_price ? ` · ${tr(state.lang, 'wholesale')} ${inr(it.wholesale_price)} × ${it.min_wholesale_qty}+` : ''}</div></div>
    <div class="row"><button type="button" class="btn" data-qty="${i}:-1" aria-label="Decrease">−</button><b aria-live="polite">${it.qty}</b><button type="button" class="btn" data-qty="${i}:1" aria-label="Increase">+</button></div></div>`).join('');
  $('[name=ful][value=delivery]').disabled = !c.business.delivery; $('[name=ful][value=pickup]').disabled = !c.business.pickup;
  if (!c.business.delivery) $('[name=ful][value=pickup]').checked = true;
  $('#dropInfo').textContent = state.drop ? `Drop: ${state.drop.label || 'selected'} (${state.drop.lat.toFixed(4)}, ${state.drop.lng.toFixed(4)}) — drag 📍 on the map to adjust` : 'Set a drop location';
  updateQuote(); $('#cartDlg').showModal();
}
// Client-side quote mirrors server pricing rules (server is authoritative).
async function updateQuote() {
  const c = state.cart; if (!c) return;
  const ful = $('[name=ful]:checked').value;
  const dist = state.drop ? haversineKm(c.business, state.drop) : 0;
  const q = priceOrder(c.items.map((i) => ({ product_id: i.id, qty: i.qty, unit_price: i.price, name: i.name, category: i.category, wholesale_price: i.wholesale_price, min_wholesale_qty: i.min_wholesale_qty })), dist, ful);
  $('#quote').innerHTML = `<div><span>Subtotal${q.lines.some((l) => l.wholesale_applied) ? ' (wholesale applied)' : ''}</span><span>${inr(q.subtotal)}</span></div>
    ${ful === 'delivery' ? `<div><span>${tr(state.lang, 'delivery')} (${dist.toFixed(1)} km)</span><span>${q.delivery_fee ? inr(q.delivery_fee) : 'Free'}</span></div>` : ''}
    ${q.handling_fee ? `<div><span>Bulky item handling</span><span>${inr(q.handling_fee)}</span></div>` : ''}
    <div class="tot"><span>${tr(state.lang, 'total')}</span><span>${inr(q.total)}</span></div><div class="muted small">Prices include GST. Demo sellers & stock are fictional.</div>`;
}
$('#cartBody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-qty]'); if (!b) return;
  const [i, d] = b.dataset.qty.split(':').map(Number); const it = state.cart.items[i];
  it.qty = Math.max(0, Math.min(it.stock, it.qty + d));
  if (!it.qty) state.cart.items.splice(i, 1);
  if (!state.cart.items.length) { state.cart = null; $('#cartDlg').close(); }
  renderCartFab(); if (state.cart) openCart();
});
$$('[name=ful]').forEach((r) => r.addEventListener('change', updateQuote));
$('#cartBtn').addEventListener('click', openCart);
$('#dropLocate').addEventListener('click', async () => {
  const v = $('#dropAddr').value.trim(); if (!v) return;
  const r = await api('GET', `/api/geocode?q=${encodeURIComponent(v)}`);
  if (!r.best) { $('#dropInfo').textContent = 'Could not locate. Try a landmark, locality, pincode or DIGIPIN.'; return; }
  setDrop({ lat: r.best.lat, lng: r.best.lng, label: v });
  $('#dropInfo').textContent = `Located via ${r.best.source} · ${Math.round(r.best.confidence * 100)}% · ±${r.best.precision_m} m · DIGIPIN ${r.best.digipin}`;
  updateQuote();
});
$('#placeBtn').addEventListener('click', async () => {
  if (!state.user) { $('#cartDlg').close(); openAuth('customer@mapos.demo'); toast('Sign in to place the order'); return; }
  const c = state.cart; const ful = $('[name=ful]:checked').value;
  if (ful === 'delivery' && !state.drop) { toast('Set a drop location first'); return; }
  $('#placeBtn').disabled = true;
  try {
    const o = await api('POST', '/api/orders', { business_id: c.business.id, fulfilment: ful, payment_method: $('[name=pay]:checked').value, items: c.items.map((i) => ({ product_id: i.id, qty: i.qty })), drop: state.drop, drop_address: $('#dropAddr').value || state.drop?.label });
    state.cart = null; renderCartFab(); $('#cartDlg').close();
    toast(`Order ${o.id} placed · ${inr(o.total)}`);
    ensureNotifyPermission().catch(() => {});
    showTab('orders'); track(o.id);
    if (o.razorpay) payWithRazorpay(o);
    else if (o.payment_status === 'payment_init_failed') toast('Payment could not start. Retry from Orders or choose cash on delivery.');
  } catch (e) { toast(`Order failed: ${ERRORS[e.message] || e.message}`); } finally { $('#placeBtn').disabled = false; }
});

const ERRORS = { payments_not_configured: 'Online payment is not set up on this server. Choose cash on delivery.', out_of_delivery_range: 'That address is beyond this seller\'s 25 km delivery range.', no_rider_available: 'No rider is free right now. Try pickup or retry in a few minutes.', insufficient_stock: 'Someone just bought the last units. Reduce quantity.', drop_location_required: 'Set a drop location first.' };

// ---------------- Payments (Razorpay Checkout; real provider, Test or Live mode by server keys) ----------------
function loadScript(src) {
  return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = Object.assign(document.createElement('script'), { src, async: true, onload: res, onerror: () => rej(new Error('Could not load Razorpay. Check your connection.')) }); document.head.append(s); });
}
async function payWithRazorpay(o) {
  try {
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    const rz = new window.Razorpay({
      key: o.razorpay.key_id, order_id: o.razorpay.order_id, amount: o.razorpay.amount, currency: 'INR',
      name: 'Bharat Map', description: o.razorpay.description, prefill: { email: state.user?.email || '' }, theme: { color: '#0f6e56' },
      handler: async (resp) => {
        try { await api('POST', '/api/payments/razorpay/verify', resp); toast('Payment successful ✓'); deviceNotify('Payment received', `${inr(o.total)} paid for ${o.id}`); track(o.id); } catch (e) { toast(`Payment verification failed: ${e.message}`); }
      },
      modal: { ondismiss: () => toast('Payment not completed. The order stays unpaid; you can pay from Orders.') },
    });
    rz.on('payment.failed', (r) => toast(`Payment failed: ${r.error?.description || 'declined'}`));
    rz.open();
  } catch (e) { toast(e.message); }
}

// ---------------- Tracking ----------------
const STEPS = ['placed', 'accepted', 'picked_up', 'out_for_delivery', 'delivered'];
const STEP_LABEL = { placed: 'Order placed', accepted: 'Seller packing', picked_up: 'Picked up', out_for_delivery: 'Out for delivery', delivered: 'Delivered', ready_for_pickup: 'Ready for pickup', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected by seller' };
async function track(id) {
  clearInterval(state.trackTimer); state.stream?.close();
  const o = await api('GET', `/api/orders/${id}`);
  drawRoute(o.route?.geometry || null);
  if (o.drop) setDrop({ ...o.drop, label: o.drop.address || 'Drop' });
  const render = (tk) => {
    const idx = STEPS.indexOf(tk.status);
    $('#tracking').innerHTML = `<div class="card"><h3>${esc(tr(state.lang, 'tracking'))} · ${esc(o.id)}</h3>
      <div class="meta">${esc(o.business.name)} → ${esc(o.drop?.address || 'you')} · ${inr(o.total)} · ${esc(o.payment_method === 'cod' ? 'Cash on delivery' : o.payment_method === 'razorpay' ? `Razorpay · ${o.payment_status}` : 'UPI (simulated)')}</div>
      ${o.rider ? `<div class="meta">🛵 ${esc(tr(state.lang, 'rider'))}: ${esc(o.rider.name)} (${esc(o.rider.vehicle)}) · route: ${esc(o.route?.engine || '')}</div>` : ''}
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((tk.fraction || 0) * 100)}"><i style="width:${Math.round((tk.fraction || 0) * 100)}%"></i></div>
      <p><b>${esc(STEP_LABEL[tk.status] || tk.status)}</b>${tk.eta_s ? ` · ${esc(tr(state.lang, 'eta'))} ${Math.max(1, Math.round(tk.eta_s / 60))} min` : ''}</p>
      ${o.fulfilment === 'delivery' ? `<ol class="timeline">${STEPS.map((s, i) => `<li class="${i <= idx ? 'done' : ''}">${STEP_LABEL[s]}</li>`).join('')}</ol>` : ''}
      <p class="muted small">Rider movement is simulated along the real road route (demo runs faster than real time).</p></div>`;
    if (tk.position) {
      if (!riderMarker) { const el = document.createElement('div'); el.className = 'rider'; el.textContent = '🛵'; el.setAttribute('aria-label', 'Rider'); riderMarker = new maplibregl.Marker({ element: el }); }
      riderMarker.setLngLat([tk.position.lng, tk.position.lat]).addTo(map);
    }
    if (['delivered', 'completed', 'cancelled', 'rejected'].includes(tk.status)) { clearInterval(state.trackTimer); state.stream?.close(); loadOrders(); }
  };
  let lastStatus = o.tracking.status;
  const render0 = render;
  const renderAndNotify = (tk) => {
    render0(tk);
    if (tk.status !== lastStatus) {
      lastStatus = tk.status;
      // On-device mode has no server feed, so status changes raise device notifications here.
      if (state.demo) deviceNotify(STEP_LABEL[tk.status] || tk.status, `${o.business.name} · ${o.id}`);
    }
  };
  render(o.tracking);
  if (!state.demo && window.EventSource) {
    state.stream = new EventSource(`${apiBase()}/api/orders/${id}/stream?token=${encodeURIComponent(state.token)}`);
    state.stream.onmessage = (ev) => renderAndNotify(JSON.parse(ev.data));
    state.stream.onerror = () => { state.stream.close(); state.trackTimer = setInterval(async () => { try { renderAndNotify(await api('GET', `/api/orders/${id}/track`)); } catch { /* keep last state while offline */ } }, 2000); };
  } else state.trackTimer = setInterval(async () => { try { renderAndNotify(await api('GET', `/api/orders/${id}/track`)); } catch { /* offline */ } }, 1500);
}
async function loadOrders() {
  if (!state.user) { $('#orderList').innerHTML = '<p class="muted">Sign in to see your orders.</p>'; return; }
  const { items } = await api('GET', '/api/orders');
  $('#orderList').innerHTML = items.length ? items.map((o) => `<div class="card"><h3>${esc(o.business.name)}</h3><div class="meta">${esc(o.id)} · ${inr(o.total)} · ${esc(STEP_LABEL[o.tracking.status] || o.tracking.status)}</div><button class="btn ghost" data-track="${esc(o.id)}">${esc(tr(state.lang, 'tracking'))}</button></div>`).join('') : '<p class="muted">No orders yet. Try “LED TVs near me”.</p>';
}
$('#orderList').addEventListener('click', (e) => { const b = e.target.closest('[data-track]'); if (b) track(b.dataset.track); });

// ---------------- Assistant ----------------
$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('#chatIn').value.trim(); if (!v) return;
  $('#chatIn').value = '';
  $('#chat').insertAdjacentHTML('beforeend', `<div class="msg user">${esc(v)}</div>`);
  const c = center();
  try {
    const r = await api('POST', '/api/assistant', { query: v, lat: c.lat, lng: c.lng });
    $('#chat').insertAdjacentHTML('beforeend', `<div class="msg bot">${esc(r.reply)}</div>`);
    if (r.action?.type === 'search') { state.results = r.action.result.results; renderResults(); plotResults(); $('#summary').textContent = r.reply; }
    if (r.action?.type === 'route' && r.action.route) { drawRoute(r.action.route.geometry); $('#chat').insertAdjacentHTML('beforeend', `<div class="msg bot">${(r.action.route.distance_m / 1000).toFixed(1)} km · ~${Math.round(r.action.route.duration_s / 60)} min by road (${esc(r.action.route.engine)}).</div>`); }
    if (r.action?.type === 'mobility') plotMobility(r.action.items);
    if (r.action?.type === 'geocode') { const b = r.action.result.best; setDrop({ lat: b.lat, lng: b.lng, label: v }); map.flyTo({ center: [b.lng, b.lat], zoom: 16 }); }
  } catch (err) { $('#chat').insertAdjacentHTML('beforeend', `<div class="msg bot">Sorry, that failed (${esc(err.message)}).</div>`); }
  $('#chat').lastElementChild.scrollIntoView({ behavior: 'smooth' });
});

// ---------------- Mobility & address intelligence ----------------
const MOB_ICON = { metro: '🚇', rail: '🚆', bus: '🚌', airport: '✈️', ev: '⚡', parking: '🅿️', toll: '🛣️', fuel: '⛽' };
function plotMobility(items) {
  clearMarkers(state.mobMarkers);
  items.forEach((m) => { const el = document.createElement('div'); el.className = 'mk mob'; el.textContent = `${MOB_ICON[m.kind] || '•'} ${m.name.slice(0, 26)}`; state.mobMarkers.push(new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map)); });
  if (items.length) { const pts = items.map((m) => [m.lng, m.lat]); map.fitBounds(pts.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(pts[0], pts[0])), { padding: 80, maxZoom: 15 }); }
}
$('#mobChips').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-kind]'); if (!b) return;
  $$('#mobChips .chip').forEach((c) => c.classList.toggle('on', c === b));
  const c = center();
  const r = await api('GET', `/api/mobility?kind=${b.dataset.kind}&lat=${c.lat}&lng=${c.lng}${$('#liveOsm').checked ? '&live=1' : ''}`);
  $('#mobList').innerHTML = r.items.map((m) => `<div class="card"><h3>${MOB_ICON[m.kind] || ''} ${esc(m.name)}</h3><div class="meta">${m.distance_km != null ? `${m.distance_km} km · ` : ''}${esc(m.meta || '')} <i>${esc(m.source || 'sample')}</i></div></div>`).join('') + `<p class="muted small">${esc(r.note || '')}</p>`;
  plotMobility(r.items);
});
$('#geoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await api('GET', `/api/geocode?q=${encodeURIComponent($('#geoIn').value)}`);
  if (!r.best) { $('#geoOut').textContent = 'No match.'; return; }
  const comp = Object.entries(r.local.components).map(([k, v]) => `${k}: ${v}`).join(' · ');
  $('#geoOut').innerHTML = `<b>${Math.round(r.best.confidence * 100)}% confidence</b> · ±${r.best.precision_m} m · via ${esc(r.best.source)} · DIGIPIN <b>${esc(r.best.digipin)}</b><br>${esc(comp)}<br><span class="small">${esc((r.local.explanation || []).join(' '))}</span>`;
  setDrop({ lat: r.best.lat, lng: r.best.lng, label: $('#geoIn').value }); map.flyTo({ center: [r.best.lng, r.best.lat], zoom: 16 });
});

// ---------------- Seller dashboard ----------------
async function loadSeller() {
  if (state.user?.role !== 'seller') return;
  try {
    const d = await api('GET', '/api/seller/dashboard');
    $('#sellerView').innerHTML = `<h3>${esc(d.business.name)} ${d.business.verified ? '<span class="vbadge">✓</span>' : ''}</h3>
      <div class="kpis"><div class="kpi"><b>${d.kpis.orders}</b>Orders</div><div class="kpi"><b>${inr(d.kpis.revenue)}</b>Revenue</div><div class="kpi"><b>${d.kpis.catalogue}</b>Products</div><div class="kpi"><b>${d.kpis.low_stock}</b>Low stock</div></div>
      <table><thead><tr><th>Product</th><th>Price ₹</th><th>Stock</th><th></th></tr></thead><tbody>
      ${d.business.products.map((p) => `<tr><td>${esc(p.name)}</td><td><input type="number" min="0" value="${p.price}" id="pp-${esc(p.id)}" aria-label="Price for ${esc(p.name)}"></td><td><input type="number" min="0" value="${p.stock}" id="ps-${esc(p.id)}" aria-label="Stock for ${esc(p.name)}"></td><td><button class="btn" data-save="${esc(p.id)}">Save</button></td></tr>`).join('')}
      </tbody></table>
      <h3>Recent orders</h3>${d.orders.length ? d.orders.map((o) => `<div class="card"><div class="meta">${esc(o.id)} · ${inr(o.total)} · ${esc(STEP_LABEL[o.tracking.status] || o.tracking.status)}</div><div>${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(', ')}</div></div>`).join('') : '<p class="muted">No orders yet.</p>'}`;
  } catch (e) { $('#sellerView').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
$('#sellerView').addEventListener('click', async (e) => {
  if (e.target.id === 'demoSeller') { openAuth('seller+b2@mapos.demo'); return; }
  const b = e.target.closest('[data-save]'); if (!b) return;
  const id = b.dataset.save;
  try { await api('PATCH', `/api/seller/products/${id}`, { price: +$(`#pp-${id}`).value, stock: +$(`#ps-${id}`).value }); toast('Saved. Live in search now.'); loadSeller(); } catch (err) { toast(`Save failed: ${err.message}`); }
});

// ---------------- Auth ----------------
function signOut() {
  state.user = null; state.token = null; store.removeItem('mapos-token'); store.removeItem('mapos-user'); if (state.demo) mockLogout();
  clearInterval(state.notifTimer); $('#bellBtn').hidden = true; $('#adminTab').hidden = true;
  applyLang(); loadOrders(); $('#sellerView').innerHTML = '<p class="muted">Sign in as a seller to manage price, stock and orders.</p><button class="btn" id="demoSeller">Use demo seller (Vizag Digital World)</button>';
  if (!$('[data-pane=admin]').hidden) showTab('explore');
}
function afterSignIn() {
  $('#adminTab').hidden = state.user?.role !== 'admin';
  startNotifications();
}
function openAuth(email) { $('#email').value = email || 'customer@mapos.demo'; $('#authErr').textContent = ''; $('#authDlg').showModal(); }
$('#authBtn').addEventListener('click', () => {
  if (state.user) { signOut(); return; }
  openAuth();
});
$('#authClose').addEventListener('click', () => $('#authDlg').close());
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('POST', '/api/auth/login', { email: $('#email').value, password: $('#pw').value });
    state.token = r.token; state.user = r.user;
    store.setItem('mapos-token', r.token); store.setItem('mapos-user', JSON.stringify(r.user));
    $('#authDlg').close(); applyLang(); toast(`Signed in as ${r.user.role}`); afterSignIn();
    if (r.user.role === 'seller') { showTab('seller'); loadSeller(); } else if (r.user.role === 'admin') showTab('admin'); else loadOrders();
  } catch (err) { $('#authErr').textContent = err.message === 'invalid_credentials' ? 'Wrong email or password.' : err.message === 'too_many_attempts' ? 'Too many attempts. Wait 5 minutes.' : err.message; }
});

// ---------------- Tabs, controls, boot ----------------
function showTab(name) {
  $$('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tabpane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
  if (name === 'orders') loadOrders();
  if (name === 'seller') loadSeller();
  if (name === 'admin') loadAdmin();
}

// ---------------- Notifications (server feed → device notifications) ----------------
async function pollNotifications(initial = false) {
  if (!state.user || state.demo) return;
  try {
    const { items, unread } = await api('GET', `/api/notifications?since=${initial ? 0 : state.lastNotif}`);
    $('#bellBtn').hidden = false; $('#bellCount').textContent = unread ? String(unread) : ''; $('#bellBtn').setAttribute('aria-label', `Notifications, ${unread} unread`);
    const fresh = items.filter((n) => n.id > state.lastNotif).reverse();
    if (!initial) for (const n of fresh.slice(-3)) deviceNotify(n.title, n.body);
    if (items.length) { state.lastNotif = Math.max(state.lastNotif, ...items.map((n) => n.id)); store.setItem('mapos-last-notif', String(state.lastNotif)); }
    state.notifItems = initial || !state.notifItems ? items : [...fresh.reverse(), ...state.notifItems].slice(0, 50);
  } catch { /* offline: retry next tick */ }
}
function startNotifications() {
  clearInterval(state.notifTimer);
  if (!state.user || state.demo) return;
  pollNotifications(true);
  state.notifTimer = setInterval(() => pollNotifications(false), 15000);
}
$('#bellBtn').addEventListener('click', async () => {
  const items = state.notifItems || [];
  $('#notifBody').innerHTML = items.length ? items.map((n) => `<div class="card ${n.read ? '' : 'unread'}"><b>${esc(n.title)}</b><div class="meta">${esc(n.body)}</div><div class="small muted">${esc(new Date(`${n.created_at.replace(' ', 'T')}Z`).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}</div>${n.order_id ? `<button class="btn ghost" data-ntrack="${esc(n.order_id)}">Track</button>` : ''}</div>`).join('') : '<p class="muted">No notifications yet.</p>';
  $('#notifDlg').showModal();
  try { await api('POST', '/api/notifications/read', {}); $('#bellCount').textContent = ''; } catch { /* ignore */ }
});
$('#notifBody').addEventListener('click', (e) => { const b = e.target.closest('[data-ntrack]'); if (b) { $('#notifDlg').close(); showTab('orders'); track(b.dataset.ntrack); } });

// ---------------- Settings (backend URL, offline maps, mode) ----------------
function updateBadge(offlineOn = state.offline) {
  const b = $('#modeBadge');
  const parts = [];
  if (state.demo) parts.push(isNative() ? 'On-device mode: no backend connected · fictional sellers' : 'Demo mode: in-browser backend · fictional sellers');
  if (offlineOn) parts.push('Offline map: bundled OSM data (© OpenStreetMap contributors · Protomaps)');
  else parts.push('Map © OpenStreetMap contributors / OpenFreeMap');
  b.hidden = !(state.demo || offlineOn); b.textContent = parts.join(' · ');
}
$('#setBtn').addEventListener('click', () => {
  $('#apiUrl').value = apiBase(); $('#setOffline').checked = state.offline;
  $('#setInfo').textContent = state.demo ? 'Status: on-device mode (no backend).' : `Status: connected to ${apiBase() || location.origin} · v${state.config?.version || '?'} · payments: ${state.config?.payments?.razorpay ? `Razorpay ${state.config.payments.mode}` : 'COD/UPI-simulated only'}`;
  $('#setDlg').showModal();
});
$('#setClose').addEventListener('click', () => $('#setDlg').close());
$('#setForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('#apiUrl').value.trim().replace(/\/$/, '');
  if (url && !/^https:\/\/[\w.-]+(:\d+)?(\/.*)?$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/.test(url)) { $('#setInfo').textContent = 'Use an https:// URL (http only for localhost testing).'; return; }
  if (url) {
    $('#setInfo').textContent = 'Testing connection…';
    try { const r = await fetch(`${url}/api/health`, { cache: 'no-store' }); const j = await r.json(); if (j.status !== 'ok') throw new Error('unhealthy'); } catch { $('#setInfo').textContent = 'Could not reach that server. Check the URL and that CORS allows this app.'; return; }
  }
  store.setItem('mapos-api', url);
  state.offline = $('#setOffline').checked; store.setItem('mapos-offline', state.offline ? '1' : '0');
  if (state.token && url !== (store.getItem('mapos-api-prev') || '')) signOut();
  store.setItem('mapos-api-prev', url);
  $('#setDlg').close(); toast('Settings saved'); await detectMode(); applyMapStyle(); updateBadge(); runSearch($('#q').value || 'LED TVs near me');
});
$$('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('.grab').addEventListener('click', () => $('#panel').classList.toggle('full'));
$('#locBtn').addEventListener('click', async () => {
  $('#locBtn').setAttribute('aria-busy', 'true');
  try {
    const p = await currentPosition(); setMe(p); map.flyTo({ center: [p.lng, p.lat], zoom: 15 });
    if (p.lat < 6 || p.lat > 38 || p.lng < 68 || p.lng > 98) toast('You appear to be outside India; sellers here are India-only.');
  } catch (e) { toast(e.code === 'denied' ? 'Location permission denied. Enable it in Android Settings → Apps → Bharat Map. Using city centre.' : 'Could not get your location. Using city centre.'); }
  finally { $('#locBtn').removeAttribute('aria-busy'); }
});
$('#offBtn').addEventListener('click', () => { state.offline = !state.offline; store.setItem('mapos-offline', state.offline ? '1' : '0'); applyMapStyle(); });
window.addEventListener('offline', () => { toast('You are offline. Switching to the bundled offline map.'); applyMapStyle(); });
window.addEventListener('online', () => { toast('Back online.'); if (!state.offline) applyMapStyle(); startNotifications(); });
let threeD = false;
$('#tdBtn').addEventListener('click', () => { threeD = !threeD; map.easeTo({ pitch: threeD ? 60 : 0, bearing: threeD ? -20 : 0, duration: 800 }); $('#tdBtn').setAttribute('aria-pressed', String(threeD)); });
$('#lang').innerHTML = LANGS.map((l) => `<option value="${l.code}">${l.name}</option>`).join('');
$('#lang').value = state.lang;
$('#lang').addEventListener('change', (e) => { state.lang = e.target.value; store.setItem('mapos-lang', state.lang); applyLang(); setLabelLanguage(); });
$('#city').value = state.city;
$('#city').addEventListener('change', (e) => { state.city = e.target.value; store.setItem('mapos-city', state.city); if (state.offline || navigator.onLine === false) applyMapStyle(); state.me = null; state.drop = null; const c = CITIES[state.city].center; setMe(c); map.flyTo({ center: [c.lng, c.lat], zoom: 12.5 }); state.results = []; renderResults(); clearMarkers(state.markers); $('#summary').textContent = ''; });

(async function boot() {
  await detectMode();
  initAdmin({ api, apiBase, token: () => state.token, toast, root: $('#adminView'), isDemo: () => state.demo });
  if ($('[name=pay][value=razorpay]')) $('[name=pay][value=razorpay]').closest('label').hidden = !state.config?.payments?.razorpay;
  if (state.config?.payments && !state.config.payments.upi_simulated) $('[name=pay][value=upi_simulated]').closest('label').hidden = true;
  updateBadge();
  if (state.offline || navigator.onLine === false) applyMapStyle();
  if (state.user) afterSignIn();
  // Default location: a point in Dwaraka Nagar (Vizag) or Ameerpet (Hyderabad) so "near me" works without GPS.
  setMe(state.city === 'vizag' ? { lat: 17.7289, lng: 83.3050 } : { lat: 17.4375, lng: 78.4483 });
  applyLang();
  const q = new URLSearchParams(location.search).get('q');
  runSearch(q || 'LED TVs near me');
  if ('serviceWorker' in navigator && !state.demo && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
