// Encoded polyline (Google algorithm) decode/encode at precision 5 or 6 (Valhalla uses 6),
// plus Douglas-Peucker simplification and point-to-polyline projection in metres. Pure.
export function decodePolyline(str, precision = 6) {
  const f = 10 ** precision; const out = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i <= str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lng += d;
    }
    out.push([lng / f, lat / f]);
  }
  return out; // [[lng, lat], ...] (GeoJSON order)
}
export function encodePolyline(coords, precision = 6) {
  const f = 10 ** precision; let plat = 0, plng = 0, s = '';
  const enc = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let o = ''; while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return o + String.fromCharCode(v + 63); };
  for (const [lng, lat] of coords) { const a = Math.round(lat * f), b = Math.round(lng * f); s += enc(a - plat) + enc(b - plng); plat = a; plng = b; }
  return s;
}

// Local equirectangular projection around a reference latitude (metres). Good to <0.5% over tens of km.
const R = 6371008.8;
export function projector(refLat) {
  const kx = (Math.PI / 180) * R * Math.cos((refLat * Math.PI) / 180), ky = (Math.PI / 180) * R;
  return { xy: ([lng, lat]) => [lng * kx, lat * ky] };
}
export function lineLengthM(coords) {
  if (coords.length < 2) return 0;
  const { xy } = projector(coords[0][1]); let s = 0;
  for (let i = 1; i < coords.length; i++) { const a = xy(coords[i - 1]), b = xy(coords[i]); s += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return s;
}

/** Douglas-Peucker in metres. Keeps endpoints. */
export function simplify(coords, toleranceM = 30) {
  if (coords.length <= 2) return coords.slice();
  const { xy } = projector(coords[0][1]); const P = coords.map(xy);
  const keep = new Uint8Array(coords.length); keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(P[i], P[a], P[b]).d; if (d > maxD) { maxD = d; idx = i; } }
    if (maxD > toleranceM && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return coords.filter((_, i) => keep[i]);
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]; const L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx, y = a[1] + t * dy;
  return { d: Math.hypot(p[0] - x, p[1] - y), t };
}
/** Distance (m) from a point to a polyline, and the distance along the line (m) of the closest point. */
export function projectOnLine(pt, coords) {
  const { xy } = projector(coords[0][1]); const p = xy(pt);
  let best = { distM: Infinity, alongM: 0, index: 0 }, along = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = xy(coords[i - 1]), b = xy(coords[i]); const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const { d, t } = segDist(p, a, b);
    if (d < best.distM) best = { distM: d, alongM: along + t * seg, index: i - 1 };
    along += seg;
  }
  return best;
}
