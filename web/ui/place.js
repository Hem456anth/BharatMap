// Place card: name, category, distance, address, opening hours (parsed → open/closed, else raw), phone,
// website, wheelchair, DIGIPIN; actions Directions · Save · Share · Call; "Shop here" for demo sellers.
// Dropped pins are reverse-geocoded with Nominatim (only the tapped coordinate is sent).
import { canSuggestEdit } from '../shared/osm-edit.js';
import { reverseGeocode } from '../services/geocode.js';
import { openingStatus } from '../lib/opening-hours.js';
import { formatDistance } from '../nav/maneuver.js';
import { encodeDigipin, haversineKm } from '../shared/geo.js';
import { BUSINESSES } from '../shared/seed.js';
import { POI_CATEGORIES } from '../services/overpass.js';
import { icon } from './icons.js';
import { esc, serviceError } from './search.js';
import { shareLink } from '../native.js';
import { buildShareLinks } from '../shared/deeplink.js';
import { serverBase } from '../services/server.js';
import { parseOsmCharger, parseParking } from '../shared/ev.js';
import { alsoHere } from '../services/also-here.js';

const CAT_FROM_TAGS = [
  ['fuel', (t) => t.amenity === 'fuel'], ['ev', (t) => t.amenity === 'charging_station'], ['atm', (t) => t.amenity === 'atm'],
  ['metro', (t) => /subway|light_rail|monorail/.test(t.station || '') || t.subway === 'yes'], ['rail', (t) => /station|halt/.test(t.railway || '')],
  ['bus', (t) => t.highway === 'bus_stop' || t.amenity === 'bus_station'], ['hospital', (t) => t.amenity === 'hospital' || t.healthcare === 'hospital'],
  ['pharmacy', (t) => t.amenity === 'pharmacy'], ['restaurant', (t) => /restaurant|fast_food/.test(t.amenity || '')],
  ['grocery', (t) => /supermarket|convenience|grocery|general/.test(t.shop || '')], ['parking', (t) => t.amenity === 'parking'], ['toilets', (t) => t.amenity === 'toilets'],
  ['airport', (t) => t.aeroway === 'aerodrome' || t.aeroway === 'terminal'],
];

/** Demo seller that this place corresponds to (explicit id, or same spot within 60 m). */
export function matchSeller(place, businesses = BUSINESSES) {
  if (place.seller_id) return businesses.find((b) => b.id === place.seller_id) || null;
  let best = null;
  for (const b of businesses) {
    const d = haversineKm(place, b) * 1000;
    const nameHit = place.name && b.name.toLowerCase().split(/\W+/).filter((w) => w.length > 3).some((w) => place.name.toLowerCase().includes(w));
    if ((d <= 60 || (nameHit && d <= 250)) && (!best || d < best.d)) best = { b, d };
  }
  return best?.b || null;
}

export function initPlace(ctx) {
  const { map, maplibregl } = ctx;
  const $ = (id) => document.getElementById(id);
  let current = null, pin = null, seq = 0;

  function showPin(p) {
    if (!pin) { const el = document.createElement('div'); el.className = 'sel-pin'; el.innerHTML = icon("pin", { size: 38 }); pin = new maplibregl.Marker({ element: el, anchor: 'bottom' }); }
    pin.getElement().setAttribute('aria-label', p.name || ctx.t('dropped_pin'));
    pin.setLngLat([p.lng, p.lat]).addTo(map);
  }
  const categoryOf = (p) => p.category || CAT_FROM_TAGS.find(([, f]) => f(p.tags || {}))?.[0] || null;

  function hoursHtml(raw) {
    if (!raw) return '';
    const st = openingStatus(raw);
    let line;
    if (st.status === 'open') line = `<b class="ok">${esc(ctx.t('open_now'))}</b>${st.until ? ` · ${esc(ctx.tf('closes_at', { t: st.until }))}` : ` · ${esc(ctx.t('open_24'))}`}`;
    else if (st.status === 'closed') line = `<b class="bad">${esc(ctx.t('closed'))}</b>${st.opensAt ? ` · ${esc(ctx.tf(st.opensDay === 'tomorrow' ? 'opens_tomorrow' : 'opens_at', { t: st.opensAt }))}` : ''}`;
    else line = `<span class="muted">${esc(ctx.t('hours_raw'))}</span>`;
    return `<li class="detail">${icon('clock', { size: 20 })}<div><div>${line}</div><small class="mono">${esc(raw)}</small></div></li>`;
  }

  const yn = (v) => (v === 'yes' ? ctx.t('val_yes') : v === 'no' ? ctx.t('val_no') : v || ctx.t('val_unknown'));
  // v0.4: EV charging details (Open Charge Map via our server, or OSM socket:* tags) and parking details (OSM).
  function evHtml(p) {
    const ev = p.ev || parseOsmCharger(p.tags || {});
    const conn = ev.connectors?.length
      ? `<ul class="conn">${ev.connectors.map((c) => `<li>${icon('plug', { size: 16 })}<b>${esc(c.type)}</b>${c.count ? ` × ${esc(c.count)}` : ''}${c.power_kw ? ` · ${esc(c.power_kw)} kW` : ''}${c.current ? ` · ${esc(c.current)}` : ''}</li>`).join('')}</ul>`
      : `<span class="muted">${esc(ctx.t('ev_none'))}</span>`;
    const rows = [[ctx.t('ev_operator'), ev.operator || ev.network], [ctx.t('ev_power'), ev.max_power_kw ? `${ev.max_power_kw} kW` : ''], [ctx.t('ev_points'), ev.points], [ctx.t('parking_fee'), ev.fee ? yn(ev.fee) : ''], [ctx.t('ev_status'), ev.status?.title]].filter(([, v]) => v);
    return `<li class="detail ev" id="pcEv">${icon('ev', { size: 20 })}<div><div><b>${esc(ctx.t('ev_details'))}</b></div>
      <div><small>${esc(ctx.t('ev_connectors'))}</small>${conn}</div>
      ${rows.length ? `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      <small class="muted">${esc(ctx.tf('ev_source', { src: ev.source || 'OpenStreetMap' }))}</small></div></li>`;
  }
  function parkingHtml(p) {
    const pk = p.parking || parseParking(p.tags || {});
    const kinds = { surface: 'Surface', 'multi-storey': 'Multi-storey', underground: 'Underground', street_side: 'Street side', lane: 'On street', rooftop: 'Rooftop' };
    const rows = [[ctx.t('parking_fee'), yn(pk.fee)], [ctx.t('parking_capacity'), pk.capacity ?? ctx.t('val_unknown')], [ctx.t('parking_type'), kinds[pk.kind] || pk.kind || ctx.t('val_unknown')]];
    return `<li class="detail" id="pcParking">${icon('parking', { size: 20 })}<div><div><b>${esc(ctx.t('parking_details'))}</b></div><dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl><small class="muted">OpenStreetMap</small></div></li>`;
  }

  function render(p) {
    const cat = categoryOf(p);
    const tags = p.tags || {};
    const from = ctx.myLoc ? { ...ctx.myLoc, real: true } : p._from || ctx.origin();
    const dist = ctx.tf(from.real ? 'away' : 'from_centre', { d: formatDistance(haversineKm(from, p) * 1000) });
    const seller = matchSeller(p);
    const phone = tags.phone || tags['contact:phone'] || '';
    const web = tags.website || tags['contact:website'] || '';
    const safeWeb = /^https?:\/\//i.test(web) ? web : web ? `https://${web}` : '';
    const wc = tags.wheelchair;
    const saved = ctx.saved.isSaved(p.id);
    const digipin = encodeDigipin(p.lat, p.lng);
    $('placeTitle').textContent = p.name || ctx.t('dropped_pin');
    $('placeCard').innerHTML = `
      <p class="place-sub">${cat ? `<span class="tag cat-${cat}">${icon(POI_CATEGORIES.find((c) => c.id === cat)?.icon || 'pin', { size: 16 })}${esc(ctx.t(`cat_${cat}`))}</span>` : p.kind === 'seller' || seller ? `<span class="tag">${icon('bag', { size: 16 })}${esc(ctx.t('demo_seller'))}</span>` : ''}<span>${esc(dist)}</span></p>
      <div class="actions">
        <button class="act primary" id="pcDir">${icon('directions')}<span>${esc(ctx.t('directions'))}</span></button>
        <button class="act" id="pcSave" aria-pressed="${saved}">${icon(saved ? 'starfill' : 'star')}<span>${esc(ctx.t('save'))}</span></button>
        <button class="act" id="pcShare">${icon('share')}<span>${esc(ctx.t('share'))}</span></button>
        ${phone ? `<a class="act" id="pcCall" href="tel:${esc(phone.split(';')[0].replace(/[^\d+]/g, ''))}">${icon('phone')}<span>${esc(ctx.t('call'))}</span></a>` : seller ? '' : ''}
        ${seller ? `<button class="act shop" id="pcShop">${icon('bag')}<span>${esc(ctx.t('shop_here'))}</span></button>` : ''}
      </div>
      <div id="pcServices" class="pc-services"></div>
      <ul class="details">
        ${cat === 'ev' ? evHtml(p) : ''}${cat === 'parking' ? parkingHtml(p) : ''}
        ${hoursHtml(tags.opening_hours)}
        <li class="detail">${icon('pin', { size: 20 })}<div><div id="pcAddr">${p.address ? esc(p.address) : `<span class="muted">${esc(ctx.t('looking_up'))}</span>`}</div><small>${esc(ctx.t('address'))}</small></div><button class="icon-btn sm" data-copy="addr" aria-label="${esc(ctx.t('address'))}: copy">${icon('copy', { size: 18 })}</button></li>
        ${phone ? `<li class="detail">${icon('phone', { size: 20 })}<div><div><a href="tel:${esc(phone.split(';')[0].replace(/[^\d+]/g, ''))}">${esc(phone)}</a></div><small>${esc(ctx.t('phone'))}</small></div></li>` : ''}
        ${safeWeb ? `<li class="detail">${icon('globe', { size: 20 })}<div><div><a href="${esc(safeWeb)}" target="_blank" rel="noopener noreferrer">${esc(web.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></div><small>${esc(ctx.t('website'))}</small></div></li>` : ''}
        ${wc ? `<li class="detail">${icon('wheelchair', { size: 20 })}<div><div>${esc(ctx.t(wc === 'yes' ? 'wc_yes' : wc === 'limited' ? 'wc_limited' : 'wc_no'))}</div><small>${esc(ctx.t('wheelchair'))}</small></div></li>` : ''}
        <li class="detail">${icon('locate', { size: 20 })}<div><div class="mono">${esc(digipin || '')}</div><small>${esc(ctx.t('digipin'))} · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</small></div><button class="icon-btn sm" data-copy="digipin" aria-label="${esc(ctx.t('digipin'))}: copy">${icon('copy', { size: 18 })}</button></li>
      </ul>
      <div class="row wrap"><button class="link" id="pcHome">${esc(ctx.t('set_as_home'))}</button><button class="link" id="pcWork">${esc(ctx.t('set_as_work'))}</button>${ctx.directions.state?.to ? `<button class="link" id="pcStop">${icon('plus', { size: 16 })} ${esc(ctx.t('add_stop'))}</button>` : ''}<button class="link" id="pcReport">${icon('flag', { size: 16 })} ${esc(ctx.t('report_title'))}</button>${canSuggestEdit(p) ? `<button class="link" id="pcEdit">${icon('edit', { size: 16 })} ${esc(ctx.t('edit_suggest'))}</button>` : ''}</div>
      <section id="pcAlso" class="pc-also" hidden aria-labelledby="pcAlsoH"></section>
      <p class="small muted">${p.source === 'seller' || (seller && p.kind === 'seller') ? esc(ctx.t('demo_seller')) : p.source === 'ocm' ? 'Open Charge Map (CC BY 4.0)' : esc(ctx.t('osm_credit'))}</p>`;
    $('pcDir').onclick = () => ctx.directions.open(p);
    $('pcSave').onclick = () => ctx.saved.openSaveDialog(p, () => render(current));
    $('pcShare').onclick = () => share(p);
    if (seller) $('pcShop').onclick = () => ctx.openShop?.({ sellerId: seller.id, q: seller.products[0]?.category === 'tv' ? 'LED TVs near me' : seller.name });
    $('pcHome').onclick = () => { ctx.saved.setShortcut('home', p); ctx.toast(ctx.tf('saved_ok', { list: ctx.t('home') })); };
    $('pcWork').onclick = () => { ctx.saved.setShortcut('work', p); ctx.toast(ctx.tf('saved_ok', { list: ctx.t('work') })); };
    $('pcReport').onclick = () => ctx.report.open({ lat: p.lat, lng: p.lng, name: p.name });
    if ($('pcEdit')) $('pcEdit').onclick = () => ctx.osmEdit.open(current);
    if ($('pcStop')) $('pcStop').onclick = () => ctx.directions.addStop({ lat: p.lat, lng: p.lng, name: p.name || ctx.t('dropped_pin') });
    // v0.7 service panel (Map → Place → Services → Book/Order → Track) and "Also here" (OSM containment, online only).
    ctx.services?.mount($('pcServices'), p, { seller, origin: from });
    loadAlsoHere(p);
    $('placeCard').onclick = async (e) => {
      const ah = e.target.closest('[data-also]'); if (ah) { const it = alsoItems.find((x) => x.id === ah.dataset.also); if (it) open({ ...it, _from: p._from }); return; }
      const c = e.target.closest('[data-copy]'); if (!c) return;
      const txt = c.dataset.copy === 'digipin' ? digipin : (current.address || `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
      try { await navigator.clipboard.writeText(txt); ctx.toast(ctx.t('copied')); } catch { ctx.toast(txt); }
    };
  }

  let alsoItems = [];
  async function loadAlsoHere(p) {
    const el = $('pcAlso'); if (!el || p.kind === 'pin' || navigator.onLine === false || ctx.style?.forceOffline) return;
    const my = seq;
    try {
      const r = await alsoHere(p);
      if (my !== seq || !r.container || !r.items.length) return;
      alsoItems = r.items;
      el.hidden = false;
      el.innerHTML = `<h4 id="pcAlsoH">${esc(ctx.t('also_here'))}${r.container.name ? ` · ${esc(r.container.name)}` : ''}</h4><div class="also-row">${r.items.slice(0, 10).map((x) => `<button class="also" data-also="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(x.kind.replace('shop:', ''))}</small></button>`).join('')}</div><p class="small muted">${esc(ctx.t('osm_credit'))}</p>`;
    } catch { /* optional section: stays hidden */ }
  }

  async function share(p) {
    // v0.5: a geo: URI (opens in any maps app) + a bharatmap:// app link, and an https link when the web app is hosted.
    const links = buildShareLinks({ lat: p.lat, lng: p.lng, name: p.name || '' }, { webBase: serverBase() || (location.protocol === 'https:' ? location.origin : '') });
    const url = links.web || `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(6)}&mlon=${p.lng.toFixed(6)}#map=18/${p.lat.toFixed(6)}/${p.lng.toFixed(6)}`;
    const text = [p.name, p.address, `DIGIPIN ${encodeDigipin(p.lat, p.lng)}`, links.geo, links.app].filter(Boolean).join('\n');
    ctx.emit('share', { links, text, url });
    const r = await shareLink({ title: p.name || ctx.t('dropped_pin'), text, url });
    if (r === 'copied') ctx.toast(ctx.t('copied'));
  }

  async function open(place, { fly = true } = {}) {
    const p = { ...place, tags: { ...(place.tags || {}) } };
    if (p.kind === 'seller' && !p.seller_id) p.seller_id = p.id?.replace('seller:', '');
    p._from = place._from || ctx.origin();
    current = p; const my = ++seq;
    ctx.views.show('place', { push: ctx.views.current !== 'place', detent: 'half' });
    render(p); showPin(p);
    if (fly) ctx.cam.fly({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16) });
    ctx.emit('place', p);
    if (!p.address) {
      try {
        const r = await reverseGeocode(p.lat, p.lng, { lang: ctx.lang() });
        if (my !== seq || !r) { if (my === seq) $('pcAddr').textContent = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`; return; }
        current.address = r.address;
        if (!current.name) { current.name = r.name || ctx.t('dropped_pin'); $('placeTitle').textContent = current.name; }
        if (my === seq) $('pcAddr').textContent = r.address;
      } catch (e) { if (my === seq) $('pcAddr').innerHTML = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} <small class="muted">(${esc(serviceError(ctx, e, 'Nominatim'))})</small>`; }
    }
  }
  function dropPin(lat, lng) {
    open({ id: `pin:${lat.toFixed(5)},${lng.toFixed(5)}`, name: '', lat, lng, kind: 'pin', tags: {} }, { fly: false });
    $('placeTitle').textContent = ctx.t('dropped_pin');
    current.name = '';
  }
  ctx.on('view', ({ name }) => { if (!['place', 'directions', 'list'].includes(name) && !ctx.nav?.active) pin?.remove(); });
  ctx.on('lang', () => { if (current && ctx.views.current === 'place') render(current); });
  return { open, dropPin, get current() { return current; }, hidePin: () => pin?.remove(), showPin };
}
