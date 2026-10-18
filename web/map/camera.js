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
  return {
    reduced,
    padding,
    fly(opts) {
      const o = { padding: padding(), ...opts };
      if (reduced()) map.jumpTo(o); else map.flyTo({ duration: 1200, essential: false, ...o });
    },
    ease(opts) {
      const o = { padding: padding(), ...opts };
      if (reduced()) map.jumpTo(o); else map.easeTo({ duration: 600, ...o });
    },
    fit(coords, { maxZoom = 16 } = {}) {
      if (!coords?.length) return;
      if (coords.length === 1) return this.fly({ center: coords[0], zoom: Math.min(maxZoom, 16) });
      const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(b, { padding: padding(), maxZoom, duration: reduced() ? 0 : 900 });
    },
  };
}
