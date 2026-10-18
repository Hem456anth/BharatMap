// Camera helpers: smooth flyTo/easeTo/fitBounds that respect prefers-reduced-motion and keep
// targets visible above the bottom sheet (mobile) or beside the side panel (desktop).
export function createCamera(ctx) {
  const { map, maplibregl } = ctx;
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced = () => !!mq?.matches;
  const padding = () => {
    const r = ctx.sheet?.coverage?.() || { bottom: 0, left: 0 };
    return { top: 84, right: 72, bottom: Math.min(window.innerHeight * 0.7, r.bottom + 24), left: r.left + 24 };
  };
  // "Flatten" intent (set when navigation ends): the map must return north-up and flat. If another camera
  // move (a fly to a dropped pin, a fit to results) starts before that ease finishes — easy on a slow device,
  // where the 600 ms ease can be cut short — the pending pitch/bearing reset is carried into that move
  // instead of being lost, so the map never stays tilted after navigation. Cleared once the map is flat, by an
  // explicit pitch (3D button), or by a user gesture.
  let flat = false;
  const navigating = () => document.documentElement.classList.contains('navigating');
  const merge = (opts) => {
    if (Number.isFinite(opts?.pitch) && opts.pitch > 0) flat = false;
    return flat && !navigating() ? { pitch: 0, bearing: 0, ...opts } : opts;
  };
  map.on('moveend', () => { if (flat && map.getPitch() < 0.5 && Math.abs(map.getBearing()) < 0.5) flat = false; });
  for (const ev of ['dragstart', 'rotatestart', 'pitchstart']) map.on(ev, (e) => { if (e.originalEvent) flat = false; });
  return {
    reduced,
    padding,
    get flattening() { return flat; },
    flatten(opts = {}) {
      flat = true;
      this.ease({ pitch: 0, bearing: 0, ...opts });
    },
    fly(opts) {
      opts = merge(opts);
      const o = { padding: padding(), ...opts };
      if (reduced()) map.jumpTo(o); else map.flyTo({ duration: 1200, essential: false, ...o });
    },
    ease(opts) {
      opts = merge(opts);
      const o = { padding: padding(), ...opts };
      if (reduced()) map.jumpTo(o); else map.easeTo({ duration: 600, ...o });
    },
    fit(coords, { maxZoom = 16 } = {}) {
      if (!coords?.length) return;
      if (coords.length === 1) return this.fly({ center: coords[0], zoom: Math.min(maxZoom, 16) });
      const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(b, merge({ padding: padding(), maxZoom, duration: reduced() ? 0 : 900 }));
    },
  };
}
