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

const SIM_SPEED_KMH = { drive: 32, two: 30, bike: 15, walk: 5 };

export function initNavigation(ctx) {
  const { map } = ctx;
  const $ = (id) => document.getElementById(id);
  const voice = createVoice(ctx);
  const N = { active: false, route: null, tracker: null, opts: null, stop: null, sim: null, lastStep: -1, nowSaid: -1, overview: false, rerouting: false, last: null, arrived: false, simMult: Number(new URLSearchParams(location.search).get('simspeed')) || 4, fixes: 0 };

  const landmarkFor = (step) => (step?.location ? findLandmark(step.location) : null);
  const instr = (step, lang = ctx.lang()) => buildInstruction(step, lang, { landmark: landmarkFor(step), destinationName: N.opts?.dest?.label });

  function setMuteUi() {
    const b = $('navMute');
    b.setAttribute('aria-pressed', String(voice.muted));
    b.setAttribute('aria-label', ctx.t(voice.muted ? 'nav_unmute' : 'nav_mute'));
    b.innerHTML = icon(voice.muted ? 'mute' : 'volume');
  }

  function start(route, opts) {
    if (N.active) end({ silent: true });
    Object.assign(N, { active: true, route, opts, tracker: createTracker(route), lastStep: -1, nowSaid: -1, overview: false, rerouting: false, arrived: false, fixes: 0, last: null });
    document.documentElement.classList.add('navigating');
    $('nav').hidden = false; ctx.sheet.hide(true);
    $('navSim').hidden = !opts.simulate;
    $('simSpeed').textContent = ctx.tf('sim_speed', { n: N.simMult });
    setMuteUi();
    $('navInstr').textContent = ctx.t('gps_wait'); $('navDist').textContent = ''; $('navIcon').innerHTML = icon(maneuverIcon(route.steps[0]), { size: 44 });
    say(ctx.t('nav_started'));
    ctx.style.setRoutes({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.geometry, properties: { selected: true, fallback: !!route.fallback } }] });
    if (opts.simulate) startSim(); else startGps();
    // v0.4: on unmetered connections, cache the route corridor's tiles (z12–14) so the route survives a dropped network.
    if (!opts.simulate && ctx.bw?.policy.prefetchRoute && !ctx.style.offline) {
      prefetchCorridor(ctx.map, route.geometry.coordinates).then((n) => { if (n) ctx.toast(ctx.tf('prefetch_done', { n })); }).catch(() => {});
    }
    ctx.emit('nav', { active: true, simulate: !!opts.simulate });
  }

  async function startGps() {
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
      ctx.toast(e.code === 'denied' ? ctx.t('gps_denied') : ctx.t('gps_wait'));
      if (e.code === 'denied') $('navInstr').textContent = ctx.t('gps_denied');
    }).then((stop) => { if (N.active && !N.opts.simulate) N.stop = stop; else stop(); });
  }
  function startSim() {
    const coords = N.route.geometry.coordinates; const cum = cumulative(coords);
    let d = 0, lastT = performance.now();
    const mps = (SIM_SPEED_KMH[N.opts.mode] || 30) / 3.6;
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
    say(ctx.t('rerouting'));
    const res = await getRoutes(N.opts.mode, { lat: fix.lat, lng: fix.lng }, N.opts.dest);
    if (!N.active) return;
    if (res.routes?.length && !res.fallback) {
      N.route = res.routes[0]; N.tracker = createTracker(N.route); N.lastStep = -1; N.nowSaid = -1;
      ctx.style.setRoutes({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: N.route.geometry, properties: { selected: true } }] });
      ctx.directions.setRouteFromNav(N.route);
    }
    setTimeout(() => { N.rerouting = false; }, 4000);
  }

  function arrive() {
    N.arrived = true;
    stopSources();
    $('navIcon').innerHTML = icon('arrive', { size: 44 });
    $('navDist').textContent = '';
    $('navInstr').textContent = ctx.t('arrived');
    $('navNext').hidden = true;
    say(buildInstruction({ type: 'arrive' }, ctx.lang()), buildInstruction({ type: 'arrive' }, 'en'));
    $('navEnd').textContent = ctx.t('done');
    ctx.emit('nav-arrived', {});
  }
  function stopSources() { clearInterval(N.sim); N.sim = null; N.stop?.(); N.stop = null; }
  function end({ silent = false } = {}) {
    if (!N.active) return;
    stopSources(); voice.stop();
    N.active = false;
    document.documentElement.classList.remove('navigating');
    $('nav').hidden = true; ctx.sheet.hide(false);
    $('navEnd').textContent = ctx.t('nav_end');
    if (!N.last?.simulated && !ctx.myLoc) ctx.controls.hidePuck();
    if (N.opts?.simulate) ctx.controls.hidePuck();
    ctx.cam.ease({ pitch: 0, bearing: 0, duration: 600, padding: ctx.cam.padding() });
    if (!silent) { ctx.directions.redraw(); ctx.emit('nav', { active: false }); }
  }

  $('navEnd').addEventListener('click', () => end());
  $('navMute').addEventListener('click', () => { voice.setMuted(!voice.muted); setMuteUi(); });
  $('navOverview').addEventListener('click', () => {
    N.overview = !N.overview;
    $('navOverview').setAttribute('aria-label', ctx.t(N.overview ? 'nav_recenter' : 'nav_overview'));
    if (N.overview) ctx.cam.fit(N.route.geometry.coordinates, { maxZoom: 16 }); else if (N.last) onFix({ ...N.last });
  });
  $('simSpeed').addEventListener('click', () => { N.simMult = N.simMult >= 16 ? 1 : N.simMult * 4; $('simSpeed').textContent = ctx.tf('sim_speed', { n: N.simMult }); });
  ctx.on('lang', () => { setMuteUi(); if (N.active && N.state && !N.arrived) render(N.state); });
  setMuteUi();

  return {
    start, end,
    get active() { return N.active; },
    get state() { return N.state; },
    get route() { return N.route; },
    voice,
    /** Feed a position fix (used by tests to exercise off-route/reroute without GPS). */
    feed: (fix) => onFix(fix),
  };
}
