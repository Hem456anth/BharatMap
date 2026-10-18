// Geo helpers shared by server and browser. Pure functions, no deps.
export const EARTH_R_KM = 6371.0088;

export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Bounding box (approx) for a radius search, used to pre-filter before haversine.
export function bboxAround(p, radiusKm) {
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((p.lat * Math.PI) / 180));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
}

// Rough India envelope (mainland + islands) for input validation.
export const INDIA_BBOX = { minLat: 6.4, maxLat: 37.6, minLng: 68.0, maxLng: 97.5 };
export function inIndia(p) {
  return (
    Number.isFinite(p?.lat) && Number.isFinite(p?.lng) &&
    p.lat >= INDIA_BBOX.minLat && p.lat <= INDIA_BBOX.maxLat &&
    p.lng >= INDIA_BBOX.minLng && p.lng <= INDIA_BBOX.maxLng
  );
}

// Linear interpolation along a polyline [[lng,lat],...] by fraction 0..1.
export function pointAlong(coords, frac) {
  if (!coords?.length) return null;
  if (coords.length === 1 || frac <= 0) return { lng: coords[0][0], lat: coords[0][1] };
  const segs = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversineKm({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] });
    segs.push(d);
    total += d;
  }
  let target = Math.min(1, frac) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] === 0 ? 0 : Math.min(1, target / segs[i]);
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      return { lng: x1 + (x2 - x1) * t, lat: y1 + (y2 - y1) * t };
    }
    target -= segs[i];
  }
  const last = coords[coords.length - 1];
  return { lng: last[0], lat: last[1] };
}

// Straight-line fallback route when no routing engine is reachable.
export function fallbackRoute(from, to, speedKmh = 22) {
  const km = haversineKm(from, to) * 1.35; // detour factor for Indian urban roads (assumed)
  return {
    engine: 'fallback-straight-line',
    distance_m: Math.round(km * 1000),
    duration_s: Math.round((km / speedKmh) * 3600),
    geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
  };
}

// --- DIGIPIN (India Post open grid code). Implementation of the published
// algorithm: 4x4 grid subdivision over lat 2.5..38.5, lng 63.5..99.5, 10 levels.
const DIGIPIN_GRID = [
  ['F', 'C', '9', '8'],
  ['J', '3', '2', '7'],
  ['K', '4', '5', '6'],
  ['L', 'M', 'P', 'T'],
];
const DP = { minLat: 2.5, maxLat: 38.5, minLng: 63.5, maxLng: 99.5 };

export function encodeDigipin(lat, lng) {
  if (lat < DP.minLat || lat > DP.maxLat || lng < DP.minLng || lng > DP.maxLng) return null;
  let { minLat, maxLat, minLng, maxLng } = DP;
  let code = '';
  for (let level = 1; level <= 10; level++) {
    const latDiv = (maxLat - minLat) / 4;
    const lngDiv = (maxLng - minLng) / 4;
    let row = 3 - Math.floor((lat - minLat) / latDiv);
    let col = Math.floor((lng - minLng) / lngDiv);
    row = Math.max(0, Math.min(row, 3));
    col = Math.max(0, Math.min(col, 3));
    code += DIGIPIN_GRID[row][col];
    if (level === 3 || level === 6) code += '-';
    maxLat = minLat + latDiv * (4 - row);
    minLat = minLat + latDiv * (3 - row);
    minLng = minLng + lngDiv * col;
    maxLng = minLng + lngDiv;
  }
  return code;
}

export function decodeDigipin(code) {
  const c = String(code || '').replace(/-/g, '').toUpperCase();
  if (c.length !== 10) return null;
  let { minLat, maxLat, minLng, maxLng } = DP;
  for (const ch of c) {
    let r = -1, k = -1;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (DIGIPIN_GRID[i][j] === ch) { r = i; k = j; }
    if (r < 0) return null;
    const latDiv = (maxLat - minLat) / 4;
    const lngDiv = (maxLng - minLng) / 4;
    const lat1 = maxLat - latDiv * (r + 1);
    const lat2 = maxLat - latDiv * r;
    const lng1 = minLng + lngDiv * k;
    const lng2 = minLng + lngDiv * (k + 1);
    minLat = lat1; maxLat = lat2; minLng = lng1; maxLng = lng2;
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}
