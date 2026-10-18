// Route preview: modes Drive / Two-wheeler (car-graph estimate) / Cycle / Walk (FOSSGIS OSRM) and Transit
// (nearest OSM stops only — no timetable data). Up to 3 alternatives drawn, selected highlighted; step list;
// Start (GPS) or Simulate drive. Offline/unreachable → straight-line estimate, clearly labelled.
import { getRoutes } from '../services/routing.js';
import { fetchPois } from '../services/overpass.js';
import { planTransit } from '../services/transit.js';
import { fetchTolls } from '../services/tolls.js';
import { tollFeatures } from '../shared/tolls.js';
import { fmtTime } from '../shared/transit/raptor.js';
import { store } from '../shared/storage.js';
import { buildInstruction, maneuverIcon, formatDistance, findLandmark } from '../nav/maneuver.js';
import { currentPosition } from '../native.js';
import { icon } from './icons.js';
import { esc, serviceError } from './search.js';

export const fmtDuration = (s, ctx) => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} ${ctx.t('min_short')}` : `${Math.floor(m / 60)} ${ctx.t('hr_short')} ${m % 60} ${ctx.t('min_short')}`; };
export const clock = (date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

const MODES = [['drive', 'car'], ['two', 'scooter'], ['bike', 'cycle'], ['walk', 'walk'], ['transit', 'transit']];

export function initDirections(ctx) {
  const { map } = ctx;
  const body = document.getElementById('dirBody');
  const S = { from: null, to: null, mode: 'drive', result: null, selected: 0, seq: 0, transit: null, tollSeq: 0,
    avoidTolls: store.getItem('bm-avoid-tolls') === '1', avoidHighways: store.getItem('bm-avoid-hw') === '1' };

  async function resolveOrigin() {
    if (ctx.myLoc) return { lat: ctx.myLoc.lat, lng: ctx.myLoc.lng, label: ctx.t('your_location'), real: true };
    try {
      // The user asked for directions: one location fix is reasonable (on user action).
      const p = await Promise.race([currentPosition(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
      ctx.myLoc = { ...p, ts: Date.now() }; ctx.controls.showPuck(ctx.myLoc);
      return { lat: p.lat, lng: p.lng, label: ctx.t('your_location'), real: true };
    } catch { const c = map.getCenter(); return { lat: c.lat, lng: c.lng, label: ctx.t('map_centre'), real: false }; }
  }

  async function open(dest, { mode, from } = {}) {
    S.to = { lat: dest.lat, lng: dest.lng, label: dest.name || ctx.t('dropped_pin'), id: dest.id };
    if (mode) S.mode = mode;
    ctx.views.show('directions', { push: ctx.views.current !== 'directions', detent: 'half' });
    body.innerHTML = `<p class="muted">${esc(ctx.t('loading'))}</p>`;
    S.from = from ? { lat: from.lat, lng: from.lng, label: from.name || from.label || ctx.t('map_centre'), real: false } : await resolveOrigin();
    compute();
  }

  function header() {
    return `<div class="od">
      <div class="od-rows">
        <div class="od-row"><span class="dot from" aria-hidden="true"></span><span><small>${esc(ctx.t('from'))}</small><b id="dirFrom">${esc(S.from.label)}</b></span>${S.from.real ? '' : `<button class="link" id="dirUseLoc">${esc(ctx.t('use_location'))}</button>`}</div>
        <div class="od-row"><span class="dot to" aria-hidden="true"></span><span><small>${esc(ctx.t('to'))}</small><b id="dirTo">${esc(S.to.label)}</b></span></div>
      </div>
      <button class="icon-btn" id="dirSwap" aria-label="${esc(ctx.t('swap'))}">${icon('swap')}</button>
    </div>
    <div class="modes" role="radiogroup" aria-label="${esc(ctx.t('directions'))}">${MODES.map(([m, ic]) => `<button role="radio" aria-checked="${S.mode === m}" data-mode="${m}">${icon(ic, { size: 20 })}<span>${esc(ctx.t(`mode_${m}`))}</span></button>`).join('')}</div>`;
  }
  function bind() {
    body.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { S.mode = b.dataset.mode; compute(); }; });
    const sw = document.getElementById('dirSwap'); if (sw) sw.onclick = () => { [S.from, S.to] = [{ ...S.to, real: false }, { ...S.from }]; compute(); };
    const ul = document.getElementById('dirUseLoc'); if (ul) ul.onclick = async () => { ctx.myLoc = null; const o = await resolveOrigin(); if (!o.real) ctx.toast(ctx.t('gps_denied')); else { S.from = o; compute(); } };
  }

  async function compute() {
    const my = ++S.seq;
    body.innerHTML = `${header()}<div id="dirRoutes" aria-live="polite"><p class="muted">${esc(ctx.t('loading'))}</p></div>`;
    bind();
    ctx.style.setRoutes(null); ctx.style.setLegs(null); ctx.style.setTolls(null);
    if (S.mode === 'transit') return transit(my);
    ctx.panels?.refreshOverlays?.(); // drop transit stop dots from a previous transit view
    const res = await getRoutes(S.mode, S.from, S.to, { avoidTolls: S.avoidTolls && motor(), avoidHighways: S.avoidHighways && motor() });
    if (my !== S.seq) return;
    S.result = res; S.selected = 0;
    renderRoutes(); draw(true);
  }

  const motor = () => S.mode === 'drive' || S.mode === 'two';
  function renderRoutes() {
    const res = S.result; const el = document.getElementById('dirRoutes'); if (!el) return;
    const notes = [];
    if (motor() && !res.fallback && (S.avoidTolls || S.avoidHighways) && res.avoid_applied === false) notes.push(`<p class="note warn" role="note">${esc(ctx.t('avoid_unsupported'))}</p>`);
    if (res.fallback) notes.push(`<p class="note warn" role="note">${esc(ctx.t('fallback_route'))}${res.error ? ` <small>(${esc(serviceError(ctx, { message: res.error }, 'OSRM'))})</small>` : ''}</p>`);
    else if (S.mode === 'two' && res.estimate) notes.push(`<p class="note warn" role="note">${esc(ctx.t('est_two'))}</p>`);
    else if (S.mode === 'drive') notes.push(`<p class="note" role="note">${esc(ctx.t('no_traffic'))}</p>`);
    const now = Date.now();
    el.innerHTML = `${notes.join('')}<ul class="routes" role="radiogroup" aria-label="${esc(ctx.t('directions'))}">${res.routes.map((r, i) => `
      <li><button class="route-opt" role="radio" aria-checked="${i === S.selected}" data-route="${i}">
        <span class="r-time">${esc(fmtDuration(r.duration_s, ctx))}</span>
        <span class="r-meta">${esc(formatDistance(r.distance_m))} · ${esc(ctx.tf('arrive_at', { t: clock(new Date(now + r.duration_s * 1000)) }))}${r.summary ? ` · ${esc(ctx.tf('via', { road: r.summary.split(',')[0].trim() }))}` : ''}</span>
        <span class="r-tag">${i === 0 && !r.fallback ? esc(ctx.t('fastest')) : r.fallback ? '' : esc(ctx.tf('alt_n', { n: i }))}</span>
      </button></li>`).join('')}</ul>
      ${motor() ? `<div class="avoid row wrap" role="group" aria-label="${esc(ctx.t('directions'))}"><label class="chk"><input type="checkbox" id="avoidTolls" ${S.avoidTolls ? 'checked' : ''}/><span>${esc(ctx.t('avoid_tolls'))}</span></label><label class="chk"><input type="checkbox" id="avoidHw" ${S.avoidHighways ? 'checked' : ''}/><span>${esc(ctx.t('avoid_highways'))}</span></label></div>
      <section class="tolls" id="dirTolls" aria-live="polite"></section>` : ''}
      <div class="row nav-start"><button class="btn primary big" id="dirStart">${icon('directions', { size: 20 })} ${esc(ctx.t('start'))}</button><button class="btn big" id="dirSim">${esc(ctx.t('simulate'))}</button></div>
      <details class="steps" id="dirSteps"><summary>${esc(ctx.t('steps'))} (${S.result.routes[S.selected].steps.length})</summary><ol>${stepsHtml()}</ol></details>
      <p class="small muted">${esc(ctx.t('osm_credit'))} · ${esc(engineCredit(res))}</p>`;
    const at = document.getElementById('avoidTolls'); if (at) at.onchange = () => { S.avoidTolls = at.checked; store.setItem('bm-avoid-tolls', at.checked ? '1' : '0'); compute(); };
    const ah = document.getElementById('avoidHw'); if (ah) ah.onchange = () => { S.avoidHighways = ah.checked; store.setItem('bm-avoid-hw', ah.checked ? '1' : '0'); compute(); };
    loadTolls();
    el.querySelectorAll('[data-route]').forEach((b) => { b.onclick = () => select(+b.dataset.route); });
    document.getElementById('dirStart').onclick = () => ctx.nav.start(selected(), { mode: S.mode, dest: S.to, simulate: false, estimate: res.estimate });
    document.getElementById('dirSim').onclick = () => ctx.nav.start(selected(), { mode: S.mode, dest: S.to, simulate: true, estimate: res.estimate });
  }
  function stepsHtml() {
    return selected().steps.map((s) => { const lm = findLandmark(s.location); return `<li>${icon(maneuverIcon(s), { size: 20 })}<span>${esc(buildInstruction(s, ctx.lang(), { landmark: lm, destinationName: S.to.label }))}${s.distance_m ? `<small>${esc(formatDistance(s.distance_m))}</small>` : ''}</span></li>`; }).join('');
  }
  const selected = () => S.result.routes[S.selected];
  function engineCredit(res) {
    const e = res.engine || '';
    return /valhalla/.test(e) ? `Valhalla${/fossgis/.test(e) ? ' (FOSSGIS valhalla1.openstreetmap.de)' : ''}` : /osrm/.test(e) ? `OSRM${/fossgis/.test(e) || !res.via ? ' (FOSSGIS routing.openstreetmap.de)' : ''}` : ctx.t('fallback_route');
  }
  // Toll plazas along the selected route (OSM barrier=toll_booth / highway=toll_gantry); no fees shown.
  async function loadTolls() {
    const el = document.getElementById('dirTolls'); const r = selected();
    if (!el || !r || r.fallback) return;
    const my = ++S.tollSeq;
    el.innerHTML = `<p class="small muted">${icon('toll', { size: 16 })} ${esc(ctx.t('tolls_checking'))}</p>`;
    try {
      const t = await fetchTolls(r.geometry.coordinates);
      if (my !== S.tollSeq || !document.getElementById('dirTolls')) return;
      S.tolls = t;
      ctx.style.setTolls(tollFeatures(t));
      const km = t.toll_road_m ? ` · ${esc(ctx.tf('toll_road_km', { km: (t.toll_road_m / 1000).toFixed(1) }))}` : '';
      el.innerHTML = t.count
        ? `<h4>${icon('toll', { size: 18 })} ${esc(ctx.t('tolls_title'))} <small class="muted">(${esc(ctx.t('tolls_fees'))})</small></h4>
           <p class="small"><b id="tollCount">${esc(ctx.tf('tolls_n', { n: t.count }))}</b>${km}</p>
           <ol class="toll-list">${t.plazas.map((p) => `<li><button class="row-btn" data-toll="${esc(p.id)}"><span class="row-txt"><b>${esc(p.name || ctx.t('toll_plaza'))}</b><small>${esc(formatDistance(p.along_m))}${p.operator ? ` · ${esc(p.operator)}` : ''}</small></span></button></li>`).join('')}</ol>
           <p class="small muted">${esc(ctx.t('osm_credit'))}</p>`
        : `<p class="small muted" id="tollCount">${icon('toll', { size: 16 })} ${esc(ctx.t('tolls_none'))}${km}</p>`;
      el.onclick = (e) => { const b = e.target.closest('[data-toll]'); const p = b && t.plazas.find((x) => x.id === b.dataset.toll); if (p) ctx.cam.fly({ center: [p.lng, p.lat], zoom: 15 }); };
    } catch (e) { if (my === S.tollSeq && document.getElementById('dirTolls')) el.innerHTML = `<p class="small muted">${esc(ctx.t('tolls_title'))}: ${esc(serviceError(ctx, e, 'Overpass'))}</p>`; }
  }
  function select(i) {
    S.selected = i;
    document.querySelectorAll('#dirRoutes [data-route]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.route === i)));
    const st = document.getElementById('dirSteps'); if (st) st.innerHTML = `<summary>${esc(ctx.t('steps'))} (${selected().steps.length})</summary><ol>${stepsHtml()}</ol>`;
    draw(false); loadTolls();
  }
  function draw(fit) {
    if (!S.result) return;
    const feats = S.result.routes.map((r, i) => ({ type: 'Feature', geometry: r.geometry, properties: { index: i, selected: i === S.selected, fallback: !!r.fallback } }));
    feats.sort((a, b) => a.properties.selected - b.properties.selected);
    ctx.style.setRoutes({ type: 'FeatureCollection', features: feats });
    ctx.place.showPin({ ...S.to, name: S.to.label });
    if (fit) ctx.cam.fit(S.result.routes.flatMap((r) => r.geometry.coordinates), { maxZoom: 16 });
  }
  // Tap an alternative on the map to select it.
  map.on('click', 'bm-route-alt', (e) => { const i = e.features?.[0]?.properties?.index; if (Number.isFinite(i) && ctx.views.current === 'directions') select(i); });

  // Scheduled journeys from GTFS (HMRL bundled; more feeds via the server). Falls back to nearby OSM stops.
  async function transit(my) {
    const el = () => document.getElementById('dirRoutes');
    let plan = null;
    try { plan = await planTransit(S.from, S.to); } catch { plan = null; }
    if (my !== S.seq) return;
    if (plan?.itineraries?.length) { S.transit = plan; S.transitSel = 0; renderItineraries(); return; }
    return transitStops(my, plan);
  }
  const mins = (s) => fmtDuration(s, ctx);
  function legChip(l) {
    if (l.type === 'ride') return `<span class="leg ride" style="--lc:${esc(l.route.color || '#2F3A8F')};--on:${esc(l.route.text || '#fff')}">${icon('metro', { size: 14 })}${esc(lineName(l.route))}</span>`;
    if (l.type === 'transfer') return '';
    return `<span class="leg walk">${icon('walk', { size: 14 })}${esc(mins(l.duration_s))}</span>`;
  }
  // HMRL short names are "C1_RED" etc. → "Red Line"; other feeds show their short (or long) name as published.
  const lineName = (r) => { const m = /^C\d_([A-Z]+)$/.exec(r.short || ''); return m ? `${m[1][0]}${m[1].slice(1).toLowerCase()} Line` : (r.short || r.long || ''); };
  function renderItineraries() {
    const plan = S.transit; const its = plan.itineraries; const i0 = S.transitSel;
    const el = document.getElementById('dirRoutes'); if (!el) return;
    el.innerHTML = `<p class="note" role="note"><b>${esc(ctx.t('transit_scheduled'))}</b></p>
      <h4>${esc(ctx.t('transit_itins'))}</h4>
      <ul class="routes" role="radiogroup" aria-label="${esc(ctx.t('transit_itins'))}">${its.map((it, i) => `
        <li><button class="route-opt itin" role="radio" aria-checked="${i === i0}" data-itin="${i}">
          <span class="r-time">${esc(fmtTime(it.depart_s))} – ${esc(fmtTime(it.arrive_s))}</span>
          <span class="r-meta">${esc(mins(it.duration_s))} · ${esc(it.transfers ? ctx.tf('transit_changes', { n: it.transfers }) : ctx.t('transit_direct'))}</span>
          <span class="legs" aria-hidden="true">${it.legs.map(legChip).join('<span class="sep">›</span>').replace(/(<span class="sep">›<\/span>)+/g, '<span class="sep">›</span>')}</span>
        </button></li>`).join('')}</ul>
      <ol class="itin-steps" id="itinSteps">${itinSteps(its[i0])}</ol>
      <p class="small muted">${esc(plan.attribution || '')} · ${esc(ctx.t('transit_scheduled'))}</p>`;
    el.querySelectorAll('[data-itin]').forEach((b) => { b.onclick = () => { S.transitSel = +b.dataset.itin; renderItineraries(); }; });
    drawItinerary(its[i0]);
  }
  function itinSteps(it) {
    return it.legs.map((l) => {
      if (l.type === 'walk') return `<li>${icon('walk', { size: 20 })}<span>${esc(l.to.name === 'destination' ? ctx.tf('transit_walk_dest', { d: formatDistance(l.distance_m) }) : ctx.tf('transit_walk_to', { d: formatDistance(l.distance_m), stop: l.to.name }))}<small>${esc(mins(l.duration_s))}</small></span></li>`;
      if (l.type === 'transfer') return `<li>${icon('swap', { size: 20 })}<span>${esc(ctx.tf('transit_change_at', { stop: l.to.name }))}<small>${esc(mins(l.duration_s))}</small></span></li>`;
      return `<li>${icon('metro', { size: 20 })}<span><b class="line-pill" style="--lc:${esc(l.route.color || '#2F3A8F')};--on:${esc(l.route.text || '#fff')}">${esc(lineName(l.route))}</b> ${esc(ctx.tf('transit_ride', { line: '', headsign: l.headsign }).trim())}
        <small>${esc(l.from.name)} ${esc(fmtTime(l.depart_s))} → ${esc(l.to.name)} ${esc(fmtTime(l.arrive_s))} · ${esc(ctx.tf('transit_stops_n', { n: l.stops }))}${l.from.platform ? ` · P${esc(l.from.platform)}` : ''}</small></span></li>`;
    }).join('');
  }
  function drawItinerary(it) {
    const feats = it.legs.map((l) => ({ type: 'Feature', geometry: l.type === 'ride' ? l.geometry : { type: 'LineString', coordinates: [[l.from.lng, l.from.lat], [l.to.lng, l.to.lat]] }, properties: { kind: l.type, color: l.route?.color || null } }));
    ctx.style.setLegs({ type: 'FeatureCollection', features: feats });
    ctx.place.showPin({ ...S.to, name: S.to.label });
    ctx.cam.fit(feats.flatMap((f) => f.geometry.coordinates), { maxZoom: 15 });
  }
  async function transitStops(my, plan) {
    const el = () => document.getElementById('dirRoutes');
    const kinds = ['metro', 'rail', 'bus'];
    const near = async (p) => {
      const lists = await Promise.allSettled(kinds.map((k) => fetchPois(k, p, null, { limit: 15 }).then((r) => r.items.map((x) => ({ ...x, kind: k })))));
      const ok = lists.filter((x) => x.status === 'fulfilled').flatMap((x) => x.value);
      if (!ok.length && lists.some((x) => x.status === 'rejected')) throw lists.find((x) => x.status === 'rejected').reason;
      return ok.filter((x) => x.distance_m <= 2500).sort((a, b) => a.distance_m - b.distance_m).slice(0, 4);
    };
    try {
      const [a, b] = await Promise.all([near(S.from), near(S.to)]);
      if (my !== S.seq) return;
      const li = (x) => `<li><button class="row-btn" data-stop="${esc(x.id)}">${icon(x.kind === 'metro' ? 'metro' : x.kind === 'rail' ? 'rail' : 'bus', { size: 20 })}<span class="row-txt"><b>${esc(x.name || ctx.t(`cat_${x.kind}`))}</b><small>${esc(ctx.t(`cat_${x.kind}`))} · ${esc(formatDistance(x.distance_m))}</small></span></button></li>`;
      const all = [...a, ...b];
      const why = plan?.reason === 'no_trip_found' || plan?.reason === 'no_service_on_date' ? ctx.t('transit_none_found') : ctx.t('transit_no_feed');
      el().innerHTML = `<p class="note warn" role="note">${esc(why)} ${esc(ctx.t('transit_none'))}</p>
        <h4>${esc(ctx.t('near_start'))}</h4><ul class="rows">${a.map(li).join('') || `<li class="muted">${esc(ctx.t('no_stops'))}</li>`}</ul>
        <h4>${esc(ctx.t('near_dest'))}</h4><ul class="rows">${b.map(li).join('') || `<li class="muted">${esc(ctx.t('no_stops'))}</li>`}</ul>
        <p class="small muted">${esc(ctx.t('osm_credit'))}</p>`;
      el().onclick = (e) => { const s = e.target.closest('[data-stop]'); if (s) { const x = all.find((y) => y.id === s.dataset.stop); if (x) ctx.place.open(x); } };
      ctx.style.setPois({ type: 'FeatureCollection', features: all.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { color: '#7a3fb0' } })) });
      ctx.cam.fit([[S.from.lng, S.from.lat], [S.to.lng, S.to.lat], ...all.map((x) => [x.lng, x.lat])]);
    } catch (e) { if (my === S.seq) el().innerHTML = `<p class="note warn">${esc(ctx.t('transit_none'))}</p><p>${esc(serviceError(ctx, e, 'Overpass'))}</p>`; }
  }

  const clearMap = () => { ctx.style.setRoutes(null); ctx.style.setLegs(null); ctx.style.setTolls(null); S.seq++; S.tollSeq++; };
  ctx.on('view-leave', ({ name, home }) => { if ((name === 'directions' || home) && !ctx.nav.active) { clearMap(); if (S.mode === 'transit') ctx.panels?.refreshOverlays?.(); } });
  ctx.on('view', ({ name }) => { if (name === 'home' && !ctx.nav.active) clearMap(); });
  ctx.on('lang', () => { if (ctx.views.current !== 'directions') return; if (S.mode === 'transit' && S.transit?.itineraries?.length) renderItineraries(); else if (S.result && S.mode !== 'transit') { const sel = S.selected; renderRoutes(); select(sel); } });
  return { open, get state() { return S; }, redraw: () => draw(false), setRouteFromNav(route) { if (S.result) { S.result.routes = [route]; S.selected = 0; } } };
}
