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
import { offlineSearch, displayName } from '../lib/offline-search.js';
import { CHIP_ORDER, CAT_GROUPS, hueOf, hueForKind, highlightMatch, scriptBadge, distanceM, shortDistance, suggestionType } from '../lib/ux.js';
import { renderState } from './states.js';

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
  // v0.7.18 (A7): India-first chip grid with category hue circles; the last tile opens "All categories".
  const ordered = () => [...POI_CATEGORIES].sort((a, b) => (CHIP_ORDER.indexOf(a.id) + 99) % 99 - (CHIP_ORDER.indexOf(b.id) + 99) % 99);
  const catTile = (c, cls = 'chip cat ctile') => `<button class="${cls}" role="listitem" data-cat="${c.id}" aria-label="${esc(ctx.t('nearby'))}: ${esc(catLabel(c.id))}"><span class="glyph hue-${hueOf(c.id)}" aria-hidden="true">${icon(c.icon, { size: 18 })}</span><span>${esc(catLabel(c.id))}</span></button>`;
  function renderCats() {
    $('cats').innerHTML = ordered().map((c) => catTile(c)).join('')
      + `<button class="ctile cat-all" role="listitem" id="allCatsBtn"><span class="glyph" aria-hidden="true">${icon('grid', { size: 18 })}</span><span>${esc(ctx.t('all_categories'))}</span></button>`;
    const byId = Object.fromEntries(POI_CATEGORIES.map((c) => [c.id, c]));
    $('allCats').innerHTML = CAT_GROUPS.map(([g, ids]) => `<h4>${esc(ctx.t(g))}</h4><div class="cat-grid2" role="list">${ids.filter((id) => byId[id]).map((id) => catTile(byId[id], 'ctile cat')).join('')}</div>`).join('');
  }
  $('cats').addEventListener('click', (e) => {
    if (e.target.closest('#allCatsBtn')) { ctx.views.show('allcats', { detent: 'full' }); return; }
    const b = e.target.closest('[data-cat]'); if (b) openCategory(b.dataset.cat);
  });
  $('allCats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) openCategory(b.dataset.cat); });

  // ---------- suggestions ----------
  function catMatches(text) {
    const s = text.toLowerCase();
    return POI_CATEGORIES.filter((c) => Object.values(STRINGS).some((L) => (L[`cat_${c.id}`] || '').toLowerCase().includes(s)) || c.id.includes(s));
  }
  // v0.7.18 (A6): glyph circle by row type/category, only the matched part bolded, a script badge when the hit came
  // through another script (e.g. "simhachalam" → సింహాచలం), distance from the map centre on the right.
  const mapCentre = () => { const m = map.getCenter(); return { lat: m.lat, lng: m.lng }; };
  function rowHue(it) {
    const type = suggestionType(it);
    if (type === 'cat') return hueOf(it.cat);
    if (type === 'recent') return it.recent?.cat ? hueOf(it.recent.cat) : 'recent';
    if (type === 'shop') return 'shopq';
    if (type === 'digipin' || type === 'pincode') return type;
    if (type === 'area' || type === 'report' || type === 'empty') return 'search';
    return it.place?.kind === 'seller' ? 'shop' : hueForKind(it.place?.kind || it.place?.category, it.place?.osm_key);
  }
  const rowIcon = (it) => { const type = suggestionType(it); return type === 'digipin' ? 'digipin' : type === 'pincode' ? 'pincode' : it.icon || 'pin'; };
  function rowHtml(it, i, text) {
    const badge = it.native ? scriptBadge(it.label, it.native, text) : null;
    const dist = it.place && it.kind === 'place' ? distanceM(mapCentre(), it.place) : null;
    const cls = it.kind === 'empty' ? ' class="sug-empty"' : it.kind === 'area' || it.kind === 'report' ? ' class="sug-act"' : '';
    return `<li role="option" id="sug-${i}" data-i="${i}" aria-selected="${i === active}"${cls}><span class="glyph hue-${rowHue(it)}" aria-hidden="true">${icon(rowIcon(it), { size: 18 })}</span><span class="sug-txt"><span class="sug-t">${it.kind === 'place' || it.kind === 'recent' ? highlightMatch(it.label, text) : esc(it.label)}${badge ? `<span class="script-badge" lang="${badge.lang}" title="${esc(ctx.tf('sug_in_script', { script: badge.name }))}">${highlightMatch(badge.text, text)}</span>` : ''}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${dist != null ? `<span class="sug-dist" aria-label="${esc(shortDistance(dist))} ${esc(ctx.t('sug_from_centre'))}">${esc(shortDistance(dist))}</span>` : ''}</li>`;
  }
  function renderSuggest() {
    q.setAttribute('aria-expanded', String(!!items.length));
    sug.hidden = !items.length;
    const text = q.value.trim();
    sug.innerHTML = items.map((it, i) => rowHtml(it, i, text)).join('');
    if (active >= 0) q.setAttribute('aria-activedescendant', `sug-${active}`); else q.removeAttribute('aria-activedescendant');
  }
  const kindLabel = (k) => String(k || '').replace(/_/g, ' ');
  const photonDebounced = debounceAsync((text, c) => photonSearch(text, { lat: c.lat, lng: c.lng, lang: ctx.lang() }), 350);
  // Offline lookup: v2 index (all regions) first, else the v0.5 index of the region around the origin.
  async function offlineLookup(text, c, limit) {
    const v2 = await offlineSearch(text, { near: c, limit }).catch(() => []);
    if (v2.length) return v2;
    const ix = await indexFor(c).catch(() => null);
    return ix ? searchIndex(ix, text, { near: c, limit }) : null;
  }
  // The place's name in the UI language when OSM has it (e.g. సింహాచలం for Telugu), else in the script typed.
  // In English, the local-script name (Telugu in Andhra/Telangana, Hindi in Delhi, …) is shown next to the Latin one.
  const REGION_LANG = { vizag: 'te', hyderabad: 'te', vijayawada: 'te', guntur: 'te', tirupati: 'te', bengaluru: 'kn', chennai: 'ta', mumbai: 'mr', pune: 'mr', delhi: 'hi', kolkata: 'bn' };
  function nativeLabel(p) {
    const n = displayName(p, ctx.lang());
    if (n && n !== p.name) return n;
    const names = p.names || {};
    const local = names[REGION_LANG[p.region]] || names.te || names.hi || Object.values(names)[0];
    return local && local !== p.name ? local : '';
  }
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
    const local = localResolve(text, { city: ctx.state.city, origin: c, saved: ctx.saved?.data }).map((p) => ({ kind: 'place', icon: p.kind === 'seller' ? 'bag' : p.kind === 'saved' ? 'starfill' : 'pin', label: p.name, sub: [p.kind === 'seller' ? ctx.t('demo_seller') : p.kind === 'saved' ? ctx.t('offline_saved_places') : '', p.address].filter(Boolean).join(' · '), place: p }));
    const cats = catMatches(text).slice(0, 3).map((cat) => ({ kind: 'cat', icon: cat.icon, label: catLabel(cat.id), sub: ctx.t('nearby'), cat: cat.id }));
    const recents = ctx.saved.recents().filter((r) => r.label.toLowerCase().includes(text.toLowerCase())).slice(0, 2).map((r) => ({ kind: 'recent', icon: 'clock', label: r.label, sub: '', recent: r }));
    const shop = isProductQuery(text) ? [{ kind: 'shop', icon: 'bag', label: ctx.tf('search_products', { q: text }), q: text }] : [];
    items = [...recents, ...cats, ...local, ...shop];
    renderSuggest();
    // v0.6: offline search v2 — every bundled region, OSM native-script names, Latin↔Indic transliteration,
    // pincodes and DIGIPIN — works with no network (falls back to the v0.5 per-region index).
    try {
      const res = await offlineLookup(text, c, navigator.onLine === false ? 8 : 4);
      if (res && mySeq === sugSeq && q.value.trim() === text) {
        const seen = new Set(items.filter((x) => x.place).map((x) => x.place.name.toLowerCase()));
        const off = res.filter((p) => !seen.has(p.name.toLowerCase()))
          .map((p) => ({ kind: 'place', icon: 'pin', label: p.name, native: nativeLabel(p), sub: [ctx.t('offline_index'), p.kind === 'postcode' ? ctx.t('pincode') : p.kind === 'digipin' ? 'DIGIPIN' : kindLabel(p.kind)].filter(Boolean).join(' · '), place: p }));
        if (off.length) { items = [...items.filter((x) => x.kind !== 'shop'), ...off, ...items.filter((x) => x.kind === 'shop')]; renderSuggest(); }
      }
    } catch { /* index optional */ }
    if (text.length >= 3 && navigator.onLine !== false) {
      try {
        const res = await photonDebounced(text, c);
        if (res?.superseded || mySeq !== sugSeq || q.value.trim() !== text || document.activeElement !== q) return;
        const seen = new Set(items.filter((x) => x.place).map((x) => x.place.name.toLowerCase()));
        const extra = res.filter((p) => !seen.has(p.name.toLowerCase())).slice(0, 5).map((p) => ({ kind: 'place', icon: 'pin', label: p.name, sub: p.address || kindLabel(p.kind), place: p }));
        items = [...items.filter((x) => x.kind !== 'shop'), ...extra, ...items.filter((x) => x.kind === 'shop')];
        renderSuggest();
      } catch { /* type-ahead is best effort; submit still geocodes */ }
    }
    // v0.7.18 (A4): no match → say so and offer actions instead of an empty dropdown.
    if (mySeq === sugSeq && q.value.trim() === text && text.length >= 3 && !items.length) {
      items = [{ kind: 'empty', icon: 'search', label: ctx.tf('st_no_match_t', { q: text }) }, { kind: 'area', icon: 'search', label: ctx.tf('sug_area', { q: text }), q: text }, { kind: 'report', icon: 'flag', label: ctx.t('st_report_missing') }];
      renderSuggest();
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
    else if (it.kind === 'area') { areaSearch(it.q); }
    else if (it.kind === 'report') { reportMissing(); }
    else if (it.kind === 'empty') { return; }
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
    // v0.6: with no network, skip the online geocoder (its timeouts/retries would delay the on-device answer).
    const r = navigator.onLine === false
      ? { source: 'local', items: localResolve(text, { city: ctx.state.city, origin: c, saved: ctx.saved?.data }), error: 'offline' }
      : await geocode(text, { city: ctx.state.city, origin: c, lang: ctx.lang(), saved: ctx.saved?.data });
    if (r.error === 'offline' && r.items.length) r.error = null;
    if (!r.items.length || r.error) {
      // Offline / service down: answer from the bundled place index of this region.
      const off = (await offlineLookup(text, c, 20).catch(() => null)) || [];
      if (off.length) { r.items = off; r.error = null; }
    }
    if (!r.items.length) {
      $('resMeta').textContent = r.error ? serviceError(ctx, { message: r.error }, 'Nominatim') : ctx.tf('no_match', { q: text });
      noMatchState(text, r.error);
      return;
    }
    ctx.saved.addRecent({ label: text, place: r.items.length === 1 ? r.items[0] : null });
    if (r.items.length === 1) return ctx.place.open(r.items[0]);
    showList(r.items, { title: text, meta: ctx.tf('places_n', { n: r.items.length }) });
  }
  // v0.7.18 (A4): every empty/failed result offers a next step. Results stay inside India (the geocoders are bounded
  // to India); we never silently jump to another country.
  function noMatchState(text, error) {
    clearMarkers(); $('resMeta').textContent = '';
    const li = document.createElement('li'); li.className = 'state-li';
    $('poiList').replaceChildren(li);
    const actions = error
      ? [{ id: 'retry', label: ctx.t('st_retry'), icon: 'swap' }, { id: 'offline', label: ctx.t('st_offline_search'), icon: 'download' }]
      : [{ id: 'area', label: ctx.t('st_search_area'), icon: 'search' }, { id: 'report', label: ctx.t('st_report_missing'), icon: 'flag' }];
    if (isProductQuery(text)) actions.push({ id: 'shop', label: ctx.tf('search_products', { q: text }), icon: 'bag' });
    renderState(li, { icon: 'search', title: error ? ctx.t('st_error_t') : ctx.tf('st_no_match_t', { q: text }), body: error ? '' : ctx.t('st_no_match_b'), actions }, {
      retry: () => submit(text), area: () => areaSearch(text), report: reportMissing, shop: () => ctx.openShop?.({ q: text }),
      offline: async () => { const off = (await offlineLookup(text, mapCentre(), 20).catch(() => null)) || []; if (off.length) showList(off, { title: text, meta: ctx.tf('places_n', { n: off.length }) }); else noMatchState(text, null); },
    });
  }
  function reportMissing() { const c = mapCentre(); ctx.report?.open({ lat: c.lat, lng: c.lng, name: '' }); }
  /** Free-text search biased to the visible map (Photon near the map centre online; the on-device index offline). */
  async function areaSearch(text) {
    closeSuggest(); q.blur();
    const c = mapCentre();
    ctx.views.show('results', { push: ctx.views.current !== 'results', detent: 'half' });
    $('resTitle').textContent = text; $('resMeta').textContent = ctx.t('loading'); $('poiList').innerHTML = '<li class="skeleton"></li><li class="skeleton"></li>';
    let list = [];
    if (navigator.onLine !== false) { try { list = await photonSearch(text, { lat: c.lat, lng: c.lng, lang: ctx.lang() }); } catch { list = []; } }
    if (!list.length) list = (await offlineLookup(text, c, 20).catch(() => null)) || [];
    list = list.map((p) => ({ ...p, distance_m: distanceM(c, p), _from: { ...c, real: false } })).sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
    if (!list.length) { $('resMeta').textContent = ctx.tf('no_match', { q: text }); noMatchState(text, null); return; }
    showList(list, { title: text, meta: `${ctx.tf('places_n', { n: list.length })} · ${ctx.t('map_centre')}` });
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
      if (!list.length) {
        $('resMeta').textContent = ''; clearMarkers();
        const li = document.createElement('li'); li.className = 'state-li'; $('poiList').replaceChildren(li);
        renderState(li, { icon: cat.icon, title: ctx.tf('st_cat_none_t', { cat: catLabel(catId).toLowerCase() }), body: ctx.t('st_cat_none_b'),
          actions: [{ id: 'zoom', label: ctx.t('st_zoom_out'), icon: 'zoomout' }, { id: 'report', label: ctx.t('st_report_missing'), icon: 'flag' }] }, {
          zoom: () => { map.jumpTo({ zoom: Math.max(3, map.getZoom() - 2) }); const m = map.getCenter(); openCategory(catId, { center: { lat: m.lat, lng: m.lng } }); },
          report: reportMissing,
        });
        return;
      }
      showList(list, { title: catLabel(catId), meta: `${ctx.tf('places_n', { n: list.length })} · ${from.real ? ctx.t('your_location') : ctx.t('map_centre')}` });
    } catch (e) {
      if (ctx.views.current !== 'results') return;
      $('resMeta').textContent = '';
      const li = document.createElement('li'); li.className = 'state-li'; $('poiList').replaceChildren(li);
      renderState(li, { icon: 'alert', title: ctx.t('st_error_t'), body: serviceError(ctx, e, 'Overpass (OpenStreetMap)'),
        actions: [{ id: 'retry', label: ctx.t('st_retry'), icon: 'swap' }, ...(ctx.style?.offline ? [] : [{ id: 'lowbw', label: ctx.t('mf_lowbw'), icon: 'download' }])] }, {
        retry: () => openCategory(catId, { center: c }), lowbw: () => { ctx.bw?.set('on'); openCategory(catId, { center: c }); },
      });
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
    $('poiList').innerHTML = list.map((p, i) => `<li><button class="row-btn" data-poi="${i}">${`<span class="row-ic glyph hue-${p.category ? hueOf(p.category) : p.kind === 'seller' ? 'shop' : hueForKind(p.kind, p.osm_key)} cat-${esc(p.category || 'pin')}">${icon(p.icon || (p.kind === 'seller' ? 'bag' : 'pin'), { size: 20 })}</span>`}<span class="row-txt"><b>${esc(nameOf(p))}</b><small>${esc(placeSub(p))}</small></span></button></li>`).join('');
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
  return { openCategory, submit, clearMarkers, catLabel, areaSearch };
}
