// Low-bandwidth policy (pure, unit-tested). Auto-on when the browser reports Save-Data or a 2G/3G effective
// connection type (Network Information API, Chromium/Android WebView), or when the user turns it on.
export const NORMAL = { active: false, reason: null, maxZoom: 20, prefetchZoomDelta: 4, allow3D: true, overpassMaxKm: 8, poiLimit: 60, fadeDuration: 300 };

/** Read navigator.connection safely. */
export function readConnection(nav = globalThis.navigator) {
  const c = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
  return c ? { saveData: !!c.saveData, effectiveType: c.effectiveType || '', type: c.type || '', downlink: c.downlink ?? null } : { saveData: false, effectiveType: '', type: '', downlink: null };
}

/** manual: 'auto' | 'on' | 'off' */
export function bandwidthPolicy(conn = {}, manual = 'auto') {
  const slow = /^(slow-2g|2g|3g)$/.test(conn.effectiveType || '');
  let reason = null;
  if (manual === 'on') reason = 'manual';
  else if (manual !== 'off') reason = conn.saveData ? 'save-data' : slow ? conn.effectiveType : null;
  const active = !!reason;
  const unmetered = conn.type === 'wifi' || conn.type === 'ethernet';
  return active
    ? { active, reason, maxZoom: 16, prefetchZoomDelta: 0, allow3D: false, overpassMaxKm: 3, poiLimit: 25, fadeDuration: 0, prefetchRoute: false }
    : { ...NORMAL, prefetchRoute: unmetered || (!conn.type && conn.effectiveType === '4g' && !conn.saveData) };
}

/** Slippy-map tile for a point. */
export function lngLatToTile(lng, lat, z) {
  const n = 2 ** z; const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return [z, Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
}
/** Tiles covering a route corridor at the given zooms (buffer = neighbouring tiles), capped at max. */
export function corridorTiles(coords, { zooms = [12, 13, 14], buffer = 1, max = 400 } = {}) {
  const out = new Map();
  for (const z of zooms) {
    // sample the line densely enough that no tile is skipped (half a tile)
    const step = 180 / 2 ** z / 2;
    for (let i = 0; i < coords.length; i++) {
      const [a, b] = [coords[i], coords[i + 1] || coords[i]];
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step));
      for (let k = 0; k <= n; k++) {
        const [, x, y] = lngLatToTile(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, z);
        for (let dx = -buffer; dx <= buffer; dx++) for (let dy = -buffer; dy <= buffer; dy++) {
          out.set(`${z}/${x + dx}/${y + dy}`, [z, x + dx, y + dy]);
          if (out.size >= max) return [...out.values()];
        }
      }
    }
  }
  return [...out.values()];
}
