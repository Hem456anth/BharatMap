// Floating map controls: locate-me (follow → heading → off) with a heading puck, compass (reset bearing),
// layers, 2D/3D; long-press / right-click to drop a pin. Location is only requested on user action.
import { watchPosition } from '../native.js';
import { hydrateIcons } from './icons.js';

export function initControls(ctx) {
  const { map, maplibregl } = ctx;
  const $ = (id) => document.getElementById(id);
  const locBtn = $('locBtn'), compassBtn = $('compassBtn'), tdBtn = $('tdBtn');
  let mode = 'off', stopWatch = null, puck = null, firstFix = false;

  function ensurePuck() {
    if (puck) return puck;
    const el = document.createElement('div');
    el.className = 'puck';
    el.innerHTML = '<span class="puck-cone"></span><span class="puck-dot"></span>';
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', ctx.t('your_location'));
    puck = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });
    return puck;
  }
  /** Show the location puck (used by locate and by navigation, incl. simulation). */
  function showPuck(fix) {
    const p = ensurePuck();
    p.setLngLat([fix.lng, fix.lat]).addTo(map);
    const hasHeading = Number.isFinite(fix.heading);
    p.getElement().classList.toggle('has-heading', hasHeading);
    if (hasHeading) p.setRotation(fix.heading);
  }
  function setMode(m) {
    mode = m;
    locBtn.setAttribute('aria-pressed', String(m !== 'off'));
    locBtn.dataset.mode = m;
    locBtn.setAttribute('aria-label', ctx.t(m === 'off' ? 'locate' : m === 'follow' ? 'locate_follow' : 'locate_heading'));
    locBtn.innerHTML = '';
    locBtn.dataset.icon = m === 'heading' ? 'heading' : 'locate';
    hydrateIcons(locBtn.parentElement);
    if (m === 'off') { stopWatch?.(); stopWatch = null; if (map.getBearing()) ctx.cam.ease({ bearing: 0 }); }
  }
  async function startWatch() {
    if (stopWatch) return;
    firstFix = true;
    if (!(await ctx.perm.ensure('location'))) { setMode('off'); return; }
    locBtn.setAttribute('aria-busy', 'true');
    stopWatch = await watchPosition((fix) => {
      locBtn.removeAttribute('aria-busy');
      ctx.myLoc = fix; ctx.emit('location', fix);
      if (ctx.nav?.active) return; // navigation drives the puck + camera
      showPuck(fix);
      if (firstFix) { firstFix = false; ctx.cam.fly({ center: [fix.lng, fix.lat], zoom: Math.max(map.getZoom(), 16) }); }
      else if (mode === 'follow') ctx.cam.ease({ center: [fix.lng, fix.lat], duration: 600 });
      else if (mode === 'heading') ctx.cam.ease({ center: [fix.lng, fix.lat], bearing: Number.isFinite(fix.heading) ? fix.heading : map.getBearing(), duration: 600 });
      if (fix.lat < 6 || fix.lat > 38 || fix.lng < 68 || fix.lng > 98) ctx.toast('You appear to be outside India; sellers here are India-only.');
    }, (e) => {
      locBtn.removeAttribute('aria-busy');
      if (e.code === 'denied') ctx.perm.denied('location'); else ctx.toast(ctx.t('gps_wait'));
      setMode('off');
    });
  }
  locBtn.addEventListener('click', () => {
    if (mode === 'off') { setMode('follow'); startWatch(); if (ctx.myLoc) ctx.cam.fly({ center: [ctx.myLoc.lng, ctx.myLoc.lat], zoom: Math.max(map.getZoom(), 16) }); }
    else if (mode === 'follow') setMode('heading');
    else setMode('off');
  });
  // Panning by hand leaves follow mode (location keeps updating until the user turns it off).
  map.on('dragstart', () => { if (mode !== 'off' && !ctx.nav?.active) { mode = 'off'; locBtn.setAttribute('aria-pressed', 'false'); locBtn.dataset.mode = 'off'; stopWatch?.(); stopWatch = null; } });

  // Compass: rotates with the map, visible only when rotated or tilted; tap resets north-up and flat.
  const updateCompass = () => {
    const b = map.getBearing(), p = map.getPitch();
    compassBtn.style.setProperty('--rot', `${-b}deg`);
    compassBtn.hidden = Math.abs(b) < 0.5 && p < 1;
    compassBtn.setAttribute('aria-label', ctx.tf('compass_label', { deg: Math.round(((b % 360) + 360) % 360) }));
    if (ctx.bw?.policy.active) { tdBtn.disabled = true; tdBtn.setAttribute('aria-disabled', 'true'); } else { tdBtn.disabled = false; tdBtn.removeAttribute('aria-disabled'); }
    const three = p >= 20;
    tdBtn.textContent = three ? '2D' : '3D';
    tdBtn.setAttribute('aria-pressed', String(three));
    tdBtn.setAttribute('aria-label', ctx.t(three ? 'view_2d' : 'view_3d'));
  };
  map.on('rotate', updateCompass); map.on('pitch', updateCompass); map.on('load', updateCompass); updateCompass();
  ctx.on('bandwidth', updateCompass);
  // Compass feedback: after a two-finger rotate that ends within ±7° of north, snap to north with a light haptic tick.
  let rotating = false;
  map.on('rotatestart', (e) => { rotating = !!e.originalEvent; });
  map.on('rotateend', () => {
    if (!rotating) return; rotating = false;
    const b = map.getBearing();
    if (b !== 0 && Math.abs(b) < 7) { ctx.cam.ease({ bearing: 0, duration: 200 }); navigator.vibrate?.(10); compassBtn.classList.add('snap'); setTimeout(() => compassBtn.classList.remove('snap'), 300); }
  });
  // Controls fade during gestures (UI_UX_SPEC §12: 120 ms out, back 600 ms after the gesture; not with reduced motion).
  let fadeT = null; const fabs = document.getElementById('mapctl');
  map.on('movestart', (e) => { if (!e.originalEvent || ctx.cam.reduced?.()) return; clearTimeout(fadeT); fabs?.classList.add('gesturing'); });
  map.on('moveend', () => { clearTimeout(fadeT); fadeT = setTimeout(() => fabs?.classList.remove('gesturing'), 600); });
  compassBtn.addEventListener('click', () => ctx.cam.ease({ bearing: 0, pitch: 0, duration: 500 }));
  tdBtn.addEventListener('click', () => {
    const to3d = map.getPitch() < 20 || !!ctx.cam.flattening; // mid-reset after navigation counts as flat
    if (to3d && ctx.bw?.policy.active) { ctx.toast(ctx.t('low_bw_on')); return; }
    if (to3d && !ctx.style.buildings3d) ctx.style.set3D(true);
    ctx.cam.ease({ pitch: to3d ? 55 : 0, bearing: to3d ? (map.getBearing() || -17) : map.getBearing(), duration: 800 });
  });
  $('layersBtn').addEventListener('click', () => ctx.views.show('layers', { detent: 'half' }));

  // Long-press (touch) / right-click (mouse) → dropped pin.
  let lp = null;
  const canvas = map.getCanvasContainer();
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { clearTimeout(lp?.t); lp = null; return; }
    const tch = e.touches[0]; const r = canvas.getBoundingClientRect();
    lp = { x: tch.clientX, y: tch.clientY, t: setTimeout(() => { const pt = [lp.x - r.left, lp.y - r.top]; lp = null; const ll = map.unproject(pt); navigator.vibrate?.(15); ctx.place.dropPin(ll.lat, ll.lng); }, 550) };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (lp && Math.hypot(e.touches[0].clientX - lp.x, e.touches[0].clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; } }, { passive: true });
  canvas.addEventListener('touchend', () => { if (lp) { clearTimeout(lp.t); lp = null; } });
  map.on('contextmenu', (e) => { if (e.originalEvent?.pointerType === 'touch' || e.originalEvent?.sourceCapabilities?.firesTouchEvents) return; ctx.place.dropPin(e.lngLat.lat, e.lngLat.lng); });

  ctx.on('lang', () => { setMode(mode); updateCompass(); puck?.getElement().setAttribute('aria-label', ctx.t('your_location')); });
  return { showPuck, get mode() { return mode; }, hidePuck() { puck?.remove(); } };
}
