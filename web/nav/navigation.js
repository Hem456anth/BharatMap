// Full-screen turn-by-turn navigation: maneuver banner, next-step preview, ETA strip, follow camera
// (bearing + pitch), voice guidance, landmark-enhanced instructions, off-route → reroute, arrival.
// Position source: GPS (Capacitor Geolocation.watchPosition natively, navigator.geolocation on web)
// or the clearly-labelled drive simulator that moves along the route.
import { createTracker, cumulative, pointAtDistance, bearingDeg } from './tracker.js';
import { buildInstruction, spokenInstruction, maneuverIcon, formatDistance, findLandmark } from './maneuver.js';
import { createVoice } from './voice.js';
import { getRoutes } from '../services/routing.js';
import { watchPosition } from '../native.js';
import { prefetchCorridor } from '../map/prefetch.js';
import { icon } from '../ui/icons.js';
import { fmtDuration, clock } from '../ui/directions.js';
import { createSounds } from './sounds.js';
import { laneStripHtml, laneHintUseful } from '../shared/lanes.js';
import { limitAt, createOverspeedMonitor, speedKmhFromFixes } from '../shared/maxspeed.js';
import { getSpeedLimits } from '../services/speed.js';
import { isComplexJunction, junctionSvg } from './junction.js';
import { projectOnRoute } from './tracker.js';
import { navStyleFor } from '../shared/sun.js';
import { store } from '../shared/storage.js';
import { esc } from '../ui/search.js';
import { landmarkNear, indexFor } from '../lib/offline-index.js';

const SIM_SPEED_KMH = { drive: 32, two: 30, bike: 15, walk: 5 };

export function initNavigation(ctx) {
  const { map } = ctx;
  const $ = (id) => document.getElementById(id);
  const voice = createVoice(ctx);
  const sounds = createSounds({ isMuted: () => voice.muted });
  const N = { active: false, route: null, tracker: null, opts: null, stop: null, sim: null, lastStep: -1, nowSaid: -1, overview: false, rerouting: false, last: null, arrived: false, simMult: Number(new URLSearchParams(location.search).get('simspeed')) || 4, fixes: 0 };

  // Landmarks: curated seed list first, then the bundled OSM place index of the region (offline, real names).
  let lmIndex = null;
  const landmarkFor = (step) => (step?.location ? findLandmark(step.location) || (lmIndex ? landmarkNear(lmIndex, step.location) : null) : null);
  const instr = (step, lang = ctx.lang()) => buildInstruction(step, lang, { landmark: landmarkFor(step), destinationName: N.opts?.dest?.label });

  function setMuteUi() {
    const b = $('navMute');
    b.setAttribute('aria-pressed', String(voice.muted));
    b.setAttribute('aria-label', ctx.t(voice.muted ? 'nav_unmute' : 'nav_mute'));
    b.innerHTML = icon(voice.muted ? 'mute' : 'volume');
  }

  function start(route, opts) {
    if (N.active) end({ silent: true });
    Object.assign(N, { active: true, route, opts, tracker: createTracker(route), lastStep: -1, nowSaid: -1, overview: false, rerouting: false, arrived: false, fixes: 0, last: null,
      startedAt: Date.now(), travelledM: 0, maxKmh: 0,
      speedSegs: null, speedSource: null, overspeed: createOverspeedMonitor(), lastFixAt: Date.now(), gpsLost: false, prevFix: null, lanesAlong: null, approachCue: -1 });
    prepareRoute(route);
    applyNavTheme();
    document.documentElement.classList.add('navigating');
    $('nav').hidden = false; ctx.sheet.hide(true);
    $('navSim').hidden = !opts.simulate;
    $('simSpeed').textContent = ctx.tf('sim_speed', { n: N.simMult });
    setMuteUi();
    $('navInstr').textContent = ctx.t('gps_wait'); $('navDist').textContent = ''; $('navIcon').innerHTML = icon(maneuverIcon(route.steps[0]), { size: 44 });
    say(ctx.t('nav_started'));
    ctx.style.setRoutes({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.geometry, properties: { selected: true, fallback: !!route.fallback } }] });
    if (opts.simulate) startSim(); else { startGps(); N.watchdog = setInterval(gpsWatchdog, 2000); }
    // v0.4: on unmetered connections, cache the route corridor's tiles (z12–14) so the route survives a dropped network.
    if (!opts.simulate && ctx.bw?.policy.prefetchRoute && !ctx.style.offline) {
      prefetchCorridor(ctx.map, route.geometry.coordinates).then((n) => { if (n) ctx.toast(ctx.tf('prefetch_done', { n })); }).catch(() => {});
    }
    ctx.emit('nav', { active: true, simulate: !!opts.simulate });
  }

  // ---- v0.5: lanes, speed limits, junction view, sounds, day/night style ----
  function prepareRoute(route) {
    const coords = route.geometry.coordinates;
    // Along-route distance of each intersection that has lane data.
    N.lanesAlong = (route.lanes || []).map((l) => { const pr = projectOnRoute(coords, N.tracker.cumulative, l.location, null); return { ...l, along: pr.along, off: pr.dist }; }).filter((l) => l.off < 30);
    N.speedSegs = route.speed_limits || null; N.speedSource = N.speedSegs ? 'route' : null;
    renderLimit(null);
    if (!N.speedSegs && ['drive', 'two'].includes(N.opts.mode)) {
      const r0 = route;
      getSpeedLimits(route, { mode: N.opts.mode }).then((res) => { if (N.active && N.route === r0 && res.segments) { N.speedSegs = res.segments; N.speedSource = res.source; ctx.emit('speed-limits', res); if (N.state && !N.arrived) render(N.state); } }).catch(() => {});
    }
    const loc = route.geometry.coordinates[0];
    indexFor({ lng: loc[0], lat: loc[1] }).then((ix) => { lmIndex = ix; }).catch(() => {});
  }
  function renderLimit(kmh) {
    const el = $('navLimit');
    el.hidden = !kmh; // never show a limit when it is unknown
    if (kmh) { el.querySelector('b').textContent = String(kmh); el.setAttribute('aria-label', ctx.tf('speed_limit_aria', { n: kmh })); }
  }
  function renderSpeed(fix, st) {
    const v = speedKmhFromFixes(fix, N.prevFix);
    N.prevFix = fix;
    const limit = N.speedSegs ? limitAt(N.speedSegs, st.along) : null;
    renderLimit(limit);
    const box = $('navSpeed');
    box.querySelector('b').textContent = Number.isFinite(v) ? String(Math.round(v)) : '–';
    const o = N.overspeed.update(v, limit);
    box.classList.toggle('over', !!o.over); $('navLimit').classList.toggle('over', !!o.over);
    if (o.chime) { sounds.play('overspeed'); $('navLive').textContent = ctx.tf('overspeed_live', { n: limit }); ctx.emit('overspeed', { speed: v, limit }); }
    N.speedNow = v; N.limitNow = limit; N.overNow = !!o.over;
    if (Number.isFinite(v)) N.maxKmh = Math.max(N.maxKmh, v);
  }
  function renderLanes(st) {
    const el = $('navLanes');
    const ahead = (N.lanesAlong || []).find((l) => l.along - st.along > -5 && l.along - st.along < 350 && (l.maneuver ? true : laneHintUseful(l.lanes)));
    const step = ahead ? N.route.steps[ahead.stepIndex] : null;
    const html = ahead ? laneStripHtml(ahead.lanes, step?.modifier, { label: ctx.t('lanes') }) : '';
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    el.hidden = !html;
  }
  function renderJunction(st) {
    const el = $('navJunction');
    const step = N.route.steps[st.stepIndex];
    const show = step && isComplexJunction(step) && st.distanceToManeuverM < 400 && st.distanceToManeuverM > 8 && !N.overview;
    const key = show ? `${N.route.id}:${st.stepIndex}` : '';
    if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = show ? junctionSvg(step, N.route.geometry.coordinates, { label: `${ctx.t('junction_view')}: ${instr(step)}` }) : ''; }
    el.hidden = !show || !el.innerHTML;
  }
  function gpsWatchdog() {
    if (!N.active || N.opts.simulate || N.arrived) return;
    if (!N.gpsLost && Date.now() - N.lastFixAt > 12000) {
      N.gpsLost = true; $('navGps').hidden = false; sounds.play('gps_lost'); $('navLive').textContent = ctx.t('gps_lost');
    }
  }
  function applyNavTheme() {
    const pref = store.getItem('bm-nav-style') || 'auto';
    const p = N.last || ctx.myLoc || (() => { const c = N.route.geometry.coordinates[0]; return { lng: c[0], lat: c[1] }; })();
    const theme = navStyleFor(pref, new Date(), p.lat, p.lng);
    N.navTheme = theme;
    document.documentElement.dataset.navTheme = theme;
    ctx.style.setDriving?.(theme);
    $('navTheme').setAttribute('aria-label', ctx.tf('nav_style_now', { s: ctx.t(`nav_style_${pref}`) }));
    $('navTheme').dataset.pref = pref;
  }

  async function startGps() {
    if (!(await ctx.perm.ensure('location'))) { if (N.active) { $('navInstr').textContent = ctx.t('gps_denied'); } return; }
    if (!N.active || N.opts.simulate) return;
    // Android: a foreground service keeps fixes coming with the screen off (after the one-time rationale).
    if (ctx.bg?.supported()) {
      const ok = await ctx.bg.ensureRationale();
      if (ok && N.active && !N.opts.simulate) {
        try { const stop = await ctx.bg.start({ dest: N.opts.dest?.label || '', onFix }); if (stop) { if (!N.active) { stop(); return; } N.stop = stop; return; } } catch { /* fall back to foreground GPS */ }
      }
      if (!N.active || N.opts.simulate) return;
    }
    watchPosition(onFix, (e) => {
      if (!N.active || N.opts.simulate) return;
      if (e.code === 'denied') { $('navInstr').textContent = ctx.t('gps_denied'); ctx.perm.denied('location'); } else ctx.toast(ctx.t('gps_wait'));
    }).then((stop) => { if (N.active && !N.opts.simulate) N.stop = stop; else stop(); });
  }
  function startSim() {
    const coords = N.route.geometry.coordinates; const cum = cumulative(coords);
    let d = N.opts.simStartM || 0, lastT = performance.now();
    const mps = (N.simKmh || Number(new URLSearchParams(location.search).get('simkmh')) || SIM_SPEED_KMH[N.opts.mode] || 30) / 3.6;
    const tick = () => {
      const now = performance.now(); const dt = Math.min(1, (now - lastT) / 1000); lastT = now;
      d += mps * N.simMult * dt;
      const at = pointAtDistance(coords, cum, d);
      onFix({ lat: at.point[1], lng: at.point[0], heading: at.bearing, accuracy: 5, speed: mps, simulated: true });
      if (at.done) { clearInterval(N.sim); N.sim = null; }
    };
    N.sim = setInterval(tick, 250); tick();
  }

  function onFix(fix) {
    if (!N.active || N.arrived) return;
    N.fixes++;
    N.lastFixAt = Date.now();
    if (N.gpsLost) { N.gpsLost = false; $('navGps').hidden = true; sounds.play('gps_back'); $('navLive').textContent = ctx.t('gps_back'); }
    if (!fix.ts) fix.ts = Date.now();
    if (N.last) { const dl = Math.hypot((fix.lng - N.last.lng) * 111320 * Math.cos((fix.lat * Math.PI) / 180), (fix.lat - N.last.lat) * 110574); if (dl < 500) N.travelledM += dl; }
    if (!Number.isFinite(fix.heading) && N.last) fix.heading = bearingDeg([N.last.lng, N.last.lat], [fix.lng, fix.lat]);
    N.last = fix;
    if (!fix.simulated) ctx.myLoc = fix;
    const st = N.tracker.update(fix);
    N.state = st;
    ctx.controls.showPuck(fix);
    if (!N.overview) {
      const opt = { center: [fix.lng, fix.lat], bearing: Number.isFinite(fix.heading) ? fix.heading : map.getBearing(), pitch: 55, zoom: N.opts.mode === 'walk' ? 17.5 : 16.8, padding: { top: 180, bottom: 160, left: 0, right: 0 } };
      if (ctx.cam.reduced()) map.jumpTo(opt); else map.easeTo({ ...opt, duration: fix.simulated ? 260 : 900, easing: (x) => x });
    }
    render(st);
    renderSpeed(fix, st); renderLanes(st); renderJunction(st);
    if (st.arrived) return arrive();
    if (st.offRoute && !N.rerouting && !fix.simulated) reroute(fix);
  }

  function render(st) {
    const steps = N.route.steps; const step = steps[st.stepIndex];
    $('navIcon').innerHTML = icon(maneuverIcon(step), { size: 44 });
    $('navDist').textContent = formatDistance(st.distanceToManeuverM);
    $('navInstr').textContent = instr(step);
    const next = steps[st.stepIndex + 1];
    $('navNext').hidden = !next || st.stepIndex >= steps.length - 1;
    if (next) { $('navNextIcon').innerHTML = icon(maneuverIcon(next), { size: 20 }); $('navNextText').textContent = instr(next); }
    const arr = new Date(Date.now() + st.remainingS * 1000);
    $('navArrive').textContent = clock(arr);
    $('navRemain').textContent = `${ctx.t('nav_arrival')} · ${fmtDuration(st.remainingS, ctx)} · ${formatDistance(st.remainingM)}`;
    // Voice: announce each new maneuver with its distance, and again just before it.
    if (st.stepIndex !== N.lastStep) {
      N.lastStep = st.stepIndex;
      const sp = spokenInstruction(step, st.distanceToManeuverM, ctx.lang(), { landmark: landmarkFor(step), destinationName: N.opts.dest?.label });
      say(sp, spokenInstruction(step, st.distanceToManeuverM, 'en', { landmark: landmarkFor(step) }));
    } else if (N.nowSaid !== st.stepIndex && st.distanceToManeuverM <= (N.opts.mode === 'walk' ? 25 : 60) && step.type !== 'arrive') {
      N.nowSaid = st.stepIndex;
      sounds.play('approach');
      say(instr(step), instr(step, 'en'));
    }
  }
  function say(text, fallbackText) {
    $('navLive').textContent = text; // TalkBack / screen readers
    voice.speak(text, { fallbackText });
  }

  async function reroute(fix) {
    N.rerouting = true;
    $('navInstr').textContent = ctx.t('rerouting');
    sounds.play('reroute');
    say(ctx.t('rerouting'));
    const res = await getRoutes(N.opts.mode, { lat: fix.lat, lng: fix.lng }, N.opts.dest);
    if (!N.active) return;
    if (res.routes?.length && !res.fallback) {
      N.route = res.routes[0]; N.tracker = createTracker(N.route); N.lastStep = -1; N.nowSaid = -1;
      prepareRoute(N.route);
      ctx.style.setRoutes({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: N.route.geometry, properties: { selected: true } }] });
      ctx.directions.setRouteFromNav(N.route);
    }
    setTimeout(() => { N.rerouting = false; }, 4000);
  }

  function arrive() {
    N.arrived = true;
    stopSources();
    sounds.play('arrival');
    $('navLanes').hidden = true; $('navJunction').hidden = true;
    $('navIcon').innerHTML = icon('arrive', { size: 44 });
    $('navDist').textContent = '';
    $('navInstr').textContent = ctx.t('arrived');
    $('navNext').hidden = true;
    say(buildInstruction({ type: 'arrive' }, ctx.lang()), buildInstruction({ type: 'arrive' }, 'en'));
    $('navEnd').textContent = ctx.t('done');
    // v0.5 arrival summary: trip time, distance, average speed, and "report a problem on this trip" (OSM note).
    const mins = Math.max(1, Math.round((Date.now() - N.startedAt) / 60000));
    const km = N.travelledM / 1000; const avg = (Date.now() - N.startedAt) > 0 ? km / ((Date.now() - N.startedAt) / 3600000) : 0;
    const dest = N.opts.dest;
    $('navArrival').innerHTML = `<b>${esc(ctx.t('trip_summary'))}</b><span>${esc(ctx.tf('trip_stats', { min: mins, km: km.toFixed(1), avg: Math.round(avg) }))}${N.opts.simulate ? ` · ${esc(ctx.t('sim_badge'))}` : ''}</span><button class="link" id="navReport" type="button">${esc(ctx.t('trip_report'))}</button>`;
    $('navArrival').hidden = false;
    $('navReport').onclick = () => ctx.report.open({ lat: dest?.lat ?? N.last?.lat, lng: dest?.lng ?? N.last?.lng, name: dest?.label });
    ctx.emit('nav-arrived', { minutes: mins, km, avgKmh: avg });
  }
  function stopSources() { clearInterval(N.sim); N.sim = null; clearInterval(N.watchdog); N.watchdog = null; N.stop?.(); N.stop = null; }
  function end({ silent = false } = {}) {
    if (!N.active) return;
    stopSources(); voice.stop();
    N.active = false;
    document.documentElement.classList.remove('navigating');
    delete document.documentElement.dataset.navTheme;
    ctx.style.setDriving?.(null);
    $('navLanes').hidden = true; $('navJunction').hidden = true; $('navGps').hidden = true; $('navLimit').hidden = true; $('navArrival').hidden = true;
    $('nav').hidden = true; ctx.sheet.hide(false);
    $('navEnd').textContent = ctx.t('nav_end');
    if (!N.last?.simulated && !ctx.myLoc) ctx.controls.hidePuck();
    if (N.opts?.simulate) ctx.controls.hidePuck();
    ctx.cam.flatten({ duration: 600, padding: ctx.cam.padding() });
    if (!silent) { ctx.directions.redraw(); ctx.emit('nav', { active: false }); }
  }

  $('navEnd').addEventListener('click', () => end());
  $('navMute').addEventListener('click', () => { voice.setMuted(!voice.muted); setMuteUi(); });
  $('navOverview').addEventListener('click', () => {
    N.overview = !N.overview;
    $('navOverview').setAttribute('aria-label', ctx.t(N.overview ? 'nav_recenter' : 'nav_overview'));
    if (N.overview) ctx.cam.fit(N.route.geometry.coordinates, { maxZoom: 16 }); else if (N.last) onFix({ ...N.last });
  });
  $('navTheme').addEventListener('click', () => {
    const order = ['auto', 'day', 'night']; const cur = store.getItem('bm-nav-style') || 'auto';
    const next = order[(order.indexOf(cur) + 1) % 3]; store.setItem('bm-nav-style', next);
    applyNavTheme(); ctx.toast(ctx.tf('nav_style_now', { s: ctx.t(`nav_style_${next}`) }));
  });
  $('navMute').addEventListener('click', () => sounds.unlock(), { capture: true });
  $('simSpeed').addEventListener('click', () => { N.simMult = N.simMult >= 16 ? 1 : N.simMult * 4; $('simSpeed').textContent = ctx.tf('sim_speed', { n: N.simMult }); });
  ctx.on('lang', () => { setMuteUi(); if (N.active && N.state && !N.arrived) render(N.state); });
  setMuteUi();

  return {
    start, end,
    get active() { return N.active; },
    get state() { return N.state; },
    get route() { return N.route; },
    voice, sounds, applyNavTheme,
    /** Simulated vehicle speed (km/h) for the drive simulator (tests / demos). */
    setSimSpeedKmh(v) { N.simKmh = Number(v) || null; },
    get speed() { return { now: N.speedNow, limit: N.limitNow, over: N.overNow, source: N.speedSource }; },
    /** Feed a position fix (used by tests to exercise off-route/reroute without GPS). */
    feed: (fix) => onFix(fix),
  };
}
