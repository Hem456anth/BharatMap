// Search pill: autocomplete (recents, categories, local landmarks/sellers/DIGIPIN, Photon), category chips with
// real OSM POIs from Overpass around the map centre, results list + accessible map markers, "Search this area".
import { POI_CATEGORIES, fetchPois } from '../services/overpass.js';
import { localResolve, photonSearch, geocode } from '../services/geocode.js';
import { debounceAsync } from '../services/net.js';
import { openingStatus } from '../lib/opening-hours.js';
import { formatDistance } from '../nav/maneuver.js';
import { icon } from './icons.js';
import { STRINGS } from '../shared/i18n.js';
import { parseQuery } from '../shared/search.js';
import { BUSINESSES } from '../shared/seed.js';
import { indexFor, searchIndex } from '../lib/offline-index.js';

// Vocabulary of the (demo) catalogue: decides when to offer "Search products in Shop".
const PRODUCT_VOCAB = new Set(BUSINESSES.flatMap((b) => b.products.flatMap((p) => [p.category, ...p.tags.flatMap((t) => t.split(' ')), ...p.name.toLowerCase().split(/[^a-z0-9]+/)])).filter((w) => w && w.length >= 2 && !/^\d+$/.test(w)));
export function isProductQuery(text) {
  const pq = parseQuery(text);
  return pq.wholesale || pq.maxPrice != null || pq.terms.some((t) => PRODUCT_VOCAB.has(t) || PRODUCT_VOCAB.has(t.replace(/s$/, '')));
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function serviceError(ctx, e, service) {
  const m = String(e?.message || e);
  if (m === 'rate_limited' || /http_50[34]/.test(m)) return ctx.tf('err_busy', { service });
  if (m === 'timeout') return ctx.tf('err_timeout', { service });
  return ctx.tf('err_network', { service });
}

export function initSearch(ctx) {
  const { map, maplibregl } = ctx;
  const $ = (id) => document.getElementById(id);
  const q = $('q'), sug = $('suggest'), clearBtn = $('clearQ');
  let items = [], active = -1, markers = [], lastCat = null, lastCenter = null, sugSeq = 0;

  // ---------- category chips ----------
  const catLabel = (id) => ctx.t(`cat_${id}`);
  function renderCats() {
    $('cats').innerHTML = POI_CATEGORIES.map((c) => `<button class="chip cat" role="listitem" data-cat="${c.id}" aria-label="${esc(ctx.t('nearby'))}: ${esc(catLabel(c.id))}">${icon(c.icon, { size: 18 })}<span>${esc(catLabel(c.id))}</span></button>`).join('');
  }
  $('cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) openCategory(b.dataset.cat); });

  // ---------- suggestions ----------
  function catMatches(text) {
    const s = text.toLowerCase();
    return POI_CATEGORIES.filter((c) => Object.values(STRINGS).some((L) => (L[`cat_${c.id}`] || '').toLowerCase().includes(s)) || c.id.includes(s));
  }
  function renderSuggest() {
    q.setAttribute('aria-expanded', String(!!items.length));
    sug.hidden = !items.length;
    sug.innerHTML = items.map((it, i) => `<li role="option" id="sug-${i}" data-i="${i}" aria-selected="${i === active}">${icon(it.icon || 'pin', { size: 20 })}<span class="sug-txt"><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></li>`).join('');
    if (active >= 0) q.setAttribute('aria-activedescendant', `sug-${active}`); else q.removeAttribute('aria-activedescendant');
  }
  const kindLabel = (k) => String(k || '').replace(/_/g, ' ');
  const distLabel = (m) => (m == null ? '' : formatDistance(m));
  const photonDebounced = debounceAsync((text, c) => photonSearch(text, { lat: c.lat, lng: c.lng, lang: ctx.lang() }), 350);
  async function suggest() {
    const mySeq = ++sugSeq;
    const text = q.value.trim();
    clearBtn.hidden = !text;
    active = -1;
    if (!text) {
      items = ctx.saved.recents().slice(0, 6).map((r) => ({ kind: 'recent', icon: 'clock', label: r.label, sub: r.place?.address || '', recent: r }));
      renderSuggest(); return;
    }
    const c = ctx.origin();
    const local = localResolve(text, { city: ctx.state.city, origin: c, saved: ctx.saved?.data }).map((p) => ({ kind: 'place', icon: p.kind === 'seller' ? 'bag' : p.kind === 'saved' ? 'starfill' : 'pin', label: p.name, sub: [p.kind === 'seller' ? ctx.t('demo_seller') : p.kind === 'saved' ? ctx.t('offline_saved_places') : '', p.address, distLabel(p.distance_m)].filter(Boolean).join(' · '), place: p }));
    const cats = catMatches(text).slice(0, 3).map((cat) => ({ kind: 'cat', icon: cat.icon, label: catLabel(cat.id), sub: ctx.t('nearby'), cat: cat.id }));
    const recents = ctx.saved.recents().filter((r) => r.label.toLowerCase().includes(text.toLowerCase())).slice(0, 2).map((r) => ({ kind: 'recent', icon: 'clock', label: r.label, sub: '', recent: r }));
    const shop = isProductQuery(text) ? [{ kind: 'shop', icon: 'bag', label: ctx.tf('search_products', { q: text }), q: text }] : [];
    items = [...recents, ...cats, ...local, ...shop];
    renderSuggest();
    // v0.5: bundled offline place index (real OSM names from the bundled region tiles) — works with no network.
    try {
      const ix = await indexFor(c);
      if (ix && mySeq === sugSeq && q.value.trim() === text) {
        const seen = new Set(items.filter((x) => x.place).map((x) => x.place.name.toLowerCase()));
        const off = searchIndex(ix, text, { near: c, limit: navigator.onLine === false ? 8 : 4 }).filter((p) => !seen.has(p.name.toLowerCase()))
          .map((p) => ({ kind: 'place', icon: 'pin', label: p.name, sub: [ctx.t('offline_index'), kindLabel(p.kind), distLabel(p.distance_m)].filter(Boolean).join(' · '), place: p }));
        if (off.length) { items = [...items.filter((x) => x.kind !== 'shop'), ...off, ...items.filter((x) => x.kind === 'shop')]; renderSuggest(); }
      }
    } catch { /* index optional */ }
    if (text.length >= 3 && navigator.onLine !== false) {
      try {
        const res = await photonDebounced(text, c);
        if (res?.superseded || mySeq !== sugSeq || q.value.trim() !== text || document.activeElement !== q) return;
        const seen = new Set(items.filter((x) => x.place).map((x) => x.place.name.toLowerCase()));
        const extra = res.filter((p) => !seen.has(p.name.toLowerCase())).slice(0, 5).map((p) => ({ kind: 'place', icon: 'pin', label: p.name, sub: [p.address, distLabel(p.distance_m)].filter(Boolean).join(' · '), place: p }));
        items = [...items.filter((x) => x.kind !== 'shop'), ...extra, ...items.filter((x) => x.kind === 'shop')];
        renderSuggest();
      } catch { /* type-ahead is best effort; submit still geocodes */ }
    }
  }
  let sugT;
  q.addEventListener('input', () => { clearTimeout(sugT); sugT = setTimeout(suggest, 180); });
  q.addEventListener('focus', () => { if (!q.value.trim()) suggest(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; renderSuggest(); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; renderSuggest(); }
    else if (e.key === 'Escape') { closeSuggest(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
  });
  sug.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
  sug.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) pick(items[+li.dataset.i]); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#searchForm')) closeSuggest(); });
  clearBtn.addEventListener('click', () => { q.value = ''; clearBtn.hidden = true; q.focus(); suggest(); });
  function closeSuggest() { sugSeq++; clearTimeout(sugT); items = []; active = -1; renderSuggest(); }

  function pick(it) {
    closeSuggest();
    if (!it) return;
    if (it.kind === 'cat') { q.value = it.label; openCategory(it.cat); }
    else if (it.kind === 'place') { q.value = it.label; ctx.saved.addRecent({ label: it.label, place: it.place }); ctx.place.open(it.place); }
    else if (it.kind === 'shop') { ctx.openShop?.({ q: it.q }); }
    else if (it.kind === 'recent') {
      q.value = it.recent.label;
      if (it.recent.place) ctx.place.open(it.recent.place);
      else if (it.recent.cat) openCategory(it.recent.cat);
      else submit(it.recent.label);
    }
    q.blur();
  }

  async function submit(text) {
    text = (text || '').trim(); if (!text) return;
    closeSuggest(); q.blur();
    const cat = catMatches(text)[0];
    if (cat && text.length >= 3) return openCategory(cat.id);
    const c = ctx.origin();
    ctx.views.show('results', { detent: 'half' });
    $('resTitle').textContent = text; $('resMeta').textContent = ctx.t('loading'); $('poiList').innerHTML = '';
    const r = await geocode(text, { city: ctx.state.city, origin: c, lang: ctx.lang(), saved: ctx.saved?.data });
    if (!r.items.length || r.error) {
      // Offline / service down: answer from the bundled place index of this region.
      const ix = await indexFor(c).catch(() => null);
      const off = ix ? searchIndex(ix, text, { near: c, limit: 20 }) : [];
      if (off.length) { r.items = off; r.error = null; }
    }
    if (!r.items.length) {
      $('resMeta').textContent = r.error ? serviceError(ctx, { message: r.error }, 'Nominatim') : ctx.tf('no_match', { q: text });
      if (isProductQuery(text)) $('poiList').innerHTML = `<li><button class="row-btn" data-shopq="${esc(text)}">${icon('bag')}<span>${esc(ctx.tf('search_products', { q: text }))}</span></button></li>`;
      return;
    }
    ctx.saved.addRecent({ label: text, place: r.items.length === 1 ? r.items[0] : null });
    if (r.items.length === 1) return ctx.place.open(r.items[0]);
    showList(r.items, { title: text, meta: ctx.tf('places_n', { n: r.items.length }) });
  }
  $('searchForm').addEventListener('submit', (e) => { e.preventDefault(); if (active >= 0) pick(items[active]); else submit(q.value); });

  // ---------- category results (Overpass) ----------
  async function openCategory(catId, { center } = {}) {
    lastCat = catId;
    const cat = POI_CATEGORIES.find((c) => c.id === catId);
    const c = center || (() => { const m = map.getCenter(); return { lat: m.lat, lng: m.lng }; })();
    lastCenter = c;
    ctx.saved.addRecent({ label: catLabel(catId), cat: catId });
    ctx.views.show('results', { detent: 'half' });
    $('resTitle').textContent = catLabel(catId);
    $('resMeta').textContent = ctx.t('loading');
    $('poiList').innerHTML = '<li class="skeleton"></li><li class="skeleton"></li><li class="skeleton"></li>';
    $('searchAreaBtn').hidden = true;
    const b = map.getBounds();
    try {
      const from = ctx.myLoc && !center ? { lat: ctx.myLoc.lat, lng: ctx.myLoc.lng, real: true } : { ...c, real: false };
      const res = await fetchPois(catId, from, { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }, { maxKm: ctx.bw?.policy.overpassMaxKm ?? 8, limit: ctx.bw?.policy.poiLimit ?? 60 });
      if (ctx.views.current !== 'results' || lastCat !== catId) return;
      const list = res.items.slice(0, 60).map((p) => ({ ...p, icon: cat.icon, _from: from }));
      if (!list.length) { $('resMeta').textContent = ctx.tf('res_none', { cat: catLabel(catId).toLowerCase() }); $('poiList').innerHTML = ''; clearMarkers(); return; }
      showList(list, { title: catLabel(catId), meta: `${ctx.tf('places_n', { n: list.length })} · ${from.real ? ctx.t('your_location') : ctx.t('map_centre')}` });
    } catch (e) {
      if (ctx.views.current !== 'results') return;
      $('resMeta').innerHTML = `${esc(serviceError(ctx, e, 'Overpass (OpenStreetMap)'))} <button class="link" id="resRetry">${esc(ctx.t('retry'))}</button>`;
      $('poiList').innerHTML = '';
      $('resRetry').onclick = () => openCategory(catId, { center: c });
    }
  }

  function placeSub(p) {
    const parts = [];
    if (p.distance_m != null) parts.push(formatDistance(p.distance_m));
    const st = p.tags?.opening_hours ? openingStatus(p.tags.opening_hours) : null;
    if (st?.status === 'open') parts.push(ctx.t('open_now')); else if (st?.status === 'closed') parts.push(ctx.t('closed'));
    if (p.address) parts.push(p.address);
    return parts.join(' · ');
  }
  const nameOf = (p) => p.names?.[ctx.lang()] || p.name || ctx.tf('unnamed', { cat: catLabel(p.category || 'fuel').toLowerCase() });
  let shown = [];
  function showList(list, { title, meta }) {
    shown = list;
    ctx.views.show('results', { push: ctx.views.current !== 'results', detent: 'half', focus: false });
    $('resTitle').textContent = title; $('resMeta').textContent = meta || '';
    $('poiList').innerHTML = list.map((p, i) => `<li><button class="row-btn" data-poi="${i}">${`<span class="row-ic cat-${esc(p.category || 'pin')}">${icon(p.icon || (p.kind === 'seller' ? 'bag' : 'pin'), { size: 20 })}</span>`}<span class="row-txt"><b>${esc(nameOf(p))}</b><small>${esc(placeSub(p))}</small></span></button></li>`).join('');
    plotMarkers(list);
  }
  $('poiList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-poi]'); if (b) { const p = shown[+b.dataset.poi]; ctx.place.open({ ...p, name: nameOf(p) }); return; }
    const s = e.target.closest('[data-shopq]'); if (s) ctx.openShop?.({ q: s.dataset.shopq });
  });

  function clearMarkers() { markers.forEach((m) => m.remove()); markers = []; }
  function plotMarkers(list) {
    clearMarkers();
    list.forEach((p, i) => {
      const el = document.createElement('button');
      el.className = `poi-mk cat-${p.category || 'pin'}`;
      el.innerHTML = icon(p.icon || 'pin', { size: 16 });
      el.setAttribute('aria-label', `${nameOf(p)}${p.distance_m != null ? `, ${formatDistance(p.distance_m)}` : ''}`);
      el.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.place.open({ ...p, name: nameOf(p) }); });
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
    });
    const pts = list.slice(0, 15).map((p) => [p.lng, p.lat]);
    if (pts.length) ctx.cam.fit(pts, { maxZoom: 16 });
  }
  // "Search this area" after the map moves away from the last category search.
  map.on('moveend', () => {
    if (ctx.views.current !== 'results' || !lastCat || !lastCenter) return;
    const c = map.getCenter(); const b = map.getBounds();
    const span = Math.max(b.getNorth() - b.getSouth(), 1e-6);
    $('searchAreaBtn').hidden = Math.abs(c.lat - lastCenter.lat) / span < 0.3 && Math.abs(c.lng - lastCenter.lng) / (b.getEast() - b.getWest()) < 0.3;
  });
  $('searchAreaBtn').addEventListener('click', () => { const c = map.getCenter(); openCategory(lastCat, { center: { lat: c.lat, lng: c.lng } }); });
  ctx.on('view', ({ name }) => { if (name === 'home') { clearMarkers(); lastCat = null; $('searchAreaBtn').hidden = true; q.value = ''; clearBtn.hidden = true; } if (name !== 'results') $('searchAreaBtn').hidden = true; });
  ctx.on('lang', renderCats);
  renderCats();
  return { openCategory, submit, clearMarkers, catLabel };
}
