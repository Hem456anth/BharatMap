// Route preview: modes Drive / Two-wheeler (car-graph estimate) / Cycle / Walk (FOSSGIS OSRM) and Transit
// (nearest OSM stops only — no timetable data). Up to 3 alternatives drawn, selected highlighted; step list;
// Start (GPS) or Simulate drive. Offline/unreachable → straight-line estimate, clearly labelled.
import { getRoutes } from '../services/routing.js';
import { fetchPois } from '../services/overpass.js';
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
  const S = { from: null, to: null, mode: 'drive', result: null, selected: 0, seq: 0 };

  async function resolveOrigin() {
    if (ctx.myLoc) return { lat: ctx.myLoc.lat, lng: ctx.myLoc.lng, label: ctx.t('your_location'), real: true };
    try {
      // The user asked for directions: one location fix is reasonable (on user action).
      const p = await Promise.race([currentPosition(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
      ctx.myLoc = { ...p, ts: Date.now() }; ctx.controls.showPuck(ctx.myLoc);
      return { lat: p.lat, lng: p.lng, label: ctx.t('your_location'), real: true };
    } catch { const c = map.getCenter(); return { lat: c.lat, lng: c.lng, label: ctx.t('map_centre'), real: false }; }
  }

  async function open(dest, { mode } = {}) {
    S.to = { lat: dest.lat, lng: dest.lng, label: dest.name || ctx.t('dropped_pin'), id: dest.id };
    if (mode) S.mode = mode;
    ctx.views.show('directions', { push: ctx.views.current !== 'directions', detent: 'half' });
    body.innerHTML = `<p class="muted">${esc(ctx.t('loading'))}</p>`;
    S.from = await resolveOrigin();
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
    ctx.style.setRoutes(null);
    if (S.mode === 'transit') return transit(my);
    ctx.panels?.refreshOverlays?.(); // drop transit stop dots from a previous transit view
    const res = await getRoutes(S.mode, S.from, S.to);
    if (my !== S.seq) return;
    S.result = res; S.selected = 0;
    renderRoutes(); draw(true);
  }

  function renderRoutes() {
    const res = S.result; const el = document.getElementById('dirRoutes'); if (!el) return;
    const notes = [];
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
      <div class="row nav-start"><button class="btn primary big" id="dirStart">${icon('directions', { size: 20 })} ${esc(ctx.t('start'))}</button><button class="btn big" id="dirSim">${esc(ctx.t('simulate'))}</button></div>
      <details class="steps" id="dirSteps"><summary>${esc(ctx.t('steps'))} (${S.result.routes[S.selected].steps.length})</summary><ol>${stepsHtml()}</ol></details>
      <p class="small muted">${esc(ctx.t('osm_credit'))} · routing.openstreetmap.de (FOSSGIS)</p>`;
    el.querySelectorAll('[data-route]').forEach((b) => { b.onclick = () => select(+b.dataset.route); });
    document.getElementById('dirStart').onclick = () => ctx.nav.start(selected(), { mode: S.mode, dest: S.to, simulate: false, estimate: res.estimate });
    document.getElementById('dirSim').onclick = () => ctx.nav.start(selected(), { mode: S.mode, dest: S.to, simulate: true, estimate: res.estimate });
  }
  function stepsHtml() {
    return selected().steps.map((s) => { const lm = findLandmark(s.location); return `<li>${icon(maneuverIcon(s), { size: 20 })}<span>${esc(buildInstruction(s, ctx.lang(), { landmark: lm, destinationName: S.to.label }))}${s.distance_m ? `<small>${esc(formatDistance(s.distance_m))}</small>` : ''}</span></li>`; }).join('');
  }
  const selected = () => S.result.routes[S.selected];
  function select(i) {
    S.selected = i;
    document.querySelectorAll('#dirRoutes [data-route]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.route === i)));
    const st = document.getElementById('dirSteps'); if (st) st.innerHTML = `<summary>${esc(ctx.t('steps'))} (${selected().steps.length})</summary><ol>${stepsHtml()}</ol>`;
    draw(false);
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

  async function transit(my) {
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
      el().innerHTML = `<p class="note warn" role="note">${esc(ctx.t('transit_none'))}</p>
        <h4>${esc(ctx.t('near_start'))}</h4><ul class="rows">${a.map(li).join('') || `<li class="muted">${esc(ctx.t('no_stops'))}</li>`}</ul>
        <h4>${esc(ctx.t('near_dest'))}</h4><ul class="rows">${b.map(li).join('') || `<li class="muted">${esc(ctx.t('no_stops'))}</li>`}</ul>
        <p class="small muted">${esc(ctx.t('osm_credit'))}</p>`;
      el().onclick = (e) => { const s = e.target.closest('[data-stop]'); if (s) { const x = all.find((y) => y.id === s.dataset.stop); if (x) ctx.place.open(x); } };
      ctx.style.setPois({ type: 'FeatureCollection', features: all.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { color: '#7a3fb0' } })) });
      ctx.cam.fit([[S.from.lng, S.from.lat], [S.to.lng, S.to.lat], ...all.map((x) => [x.lng, x.lat])]);
    } catch (e) { if (my === S.seq) el().innerHTML = `<p class="note warn">${esc(ctx.t('transit_none'))}</p><p>${esc(serviceError(ctx, e, 'Overpass'))}</p>`; }
  }

  ctx.on('view-leave', ({ name, home }) => { if ((name === 'directions' || home) && !ctx.nav.active) { ctx.style.setRoutes(null); S.seq++; if (S.mode === 'transit') ctx.panels?.refreshOverlays?.(); } });
  ctx.on('view', ({ name }) => { if (name === 'home' && !ctx.nav.active) { ctx.style.setRoutes(null); S.seq++; } });
  ctx.on('lang', () => { if (ctx.views.current === 'directions' && S.result && S.mode !== 'transit') { const sel = S.selected; renderRoutes(); select(sel); } });
  return { open, get state() { return S; }, redraw: () => draw(false), setRouteFromNav(route) { if (S.result) { S.result.routes = [route]; S.selected = 0; } } };
}
