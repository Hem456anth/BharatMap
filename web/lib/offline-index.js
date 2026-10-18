// Offline place search over the bundled index (web/offline/pois/<region>.json, built from the bundled PMTiles by
// scripts/build-poi-index.mjs — real OpenStreetMap names). Works with no network. Pure core (unit-tested) + loader.

/** Normalise for matching: lower case, strip accents/punctuation, collapse spaces. Indic scripts kept as-is. */
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
}
const KIND_WEIGHT = { aerodrome: 3, station: 2.5, bus_station: 2, attraction: 2.2, hospital: 2, university: 2, college: 1.6, stadium: 1.8, mall: 1.8, park: 1.4, place_of_worship: 1.3, beach: 2, museum: 2, zoo: 2, suburb: 1.8, neighbourhood: 1.5, locality: 1.4, quarter: 1.5, town: 2, city: 2.2, village: 1.2 };

/** Build an index from the compact rows [name, kind, lat, lng, name_hi, name_te, layer]. */
export function buildIndex(rows) {
  return rows.map((r) => {
    const names = [r[0], r[4], r[5]].filter(Boolean);
    return { name: r[0], kind: r[1], lat: r[2], lng: r[3], name_hi: r[4] || '', name_te: r[5] || '', layer: r[6], keys: names.map(norm), w: KIND_WEIGHT[r[1]] || 1 };
  });
}
const R = 6371;
function km(a, b) { const d2r = Math.PI / 180; const x = (b.lng - a.lng) * d2r * Math.cos(((a.lat + b.lat) / 2) * d2r); const y = (b.lat - a.lat) * d2r; return Math.hypot(x, y) * R; }

/**
 * Search: every query word must prefix-match a word of the name (or the whole name contains the query).
 * Score = match quality × kind weight, nudged by distance from `near`. Returns up to `limit` hits.
 */
export function searchIndex(index, query, { near = null, limit = 8 } = {}) {
  const q = norm(query); if (q.length < 2) return [];
  const words = q.split(' ');
  const hits = [];
  for (const e of index) {
    let best = 0;
    for (const k of e.keys) {
      if (!k) continue;
      let s = 0;
      if (k === q) s = 10;
      else if (k.startsWith(q)) s = 7;
      else {
        const kw = k.split(' ');
        if (words.every((w) => kw.some((x) => x.startsWith(w)))) s = 5 - Math.min(2, kw.length - words.length) * 0.3;
        else if (q.length >= 4 && k.includes(q)) s = 3;
      }
      if (s > best) best = s;
    }
    if (!best) continue;
    const d = near ? km(near, e) : null;
    const score = best * e.w - (d != null ? Math.min(3, d / 8) : 0);
    hits.push({ e, score, d });
  }
  hits.sort((a, b) => b.score - a.score);
  const seen = new Set(); const out = [];
  for (const h of hits) {
    const key = `${norm(h.e.name)}|${h.e.kind}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ id: `off-${h.e.lat},${h.e.lng}`, name: h.e.name, kind: h.e.kind, lat: h.e.lat, lng: h.e.lng, names: { hi: h.e.name_hi || undefined, te: h.e.name_te || undefined }, distance_m: h.d != null ? Math.round(h.d * 1000) : null, source: 'offline-index' });
    if (out.length >= limit) break;
  }
  return out;
}

/** Landmarks for navigation instructions: well-known kinds near a point (within maxM). */
const LANDMARK_KINDS = new Set(['attraction', 'hospital', 'station', 'bus_station', 'university', 'college', 'stadium', 'mall', 'park', 'place_of_worship', 'museum', 'beach', 'fuel', 'cinema', 'aerodrome', 'zoo', 'theatre', 'townhall', 'police', 'post_office', 'supermarket', 'department_store']);
export function landmarkNear(index, location, { maxM = 120 } = {}) {
  if (!index || !location) return null;
  const p = { lng: location[0], lat: location[1] };
  let best = null;
  for (const e of index) {
    if (e.layer !== 0 || !LANDMARK_KINDS.has(e.kind)) continue;
    if (Math.abs(e.lat - p.lat) > 0.002 || Math.abs(e.lng - p.lng) > 0.002) continue;
    const d = km(p, e) * 1000;
    if (d <= maxM && (!best || d * (2 - e.w / 3) < best.score)) best = { name: e.name, distance_m: Math.round(d), kind: e.kind, score: d * (2 - e.w / 3) };
  }
  return best ? { name: best.name, distance_m: best.distance_m, kind: best.kind } : null;
}

// ---- loader (browser) ----
let regionsMeta = null; const cache = new Map();
/** Region id of the bundled index covering a point (null if none). */
export async function regionFor(p, fetchImpl = fetch) {
  if (!regionsMeta) regionsMeta = await (await fetchImpl('offline/regions.json')).json();
  for (const [id, r] of Object.entries(regionsMeta.regions)) { const b = r.bbox; if (p.lng >= b[0] && p.lat >= b[1] && p.lng <= b[2] && p.lat <= b[3]) return id; }
  return null;
}
export async function loadIndex(id, fetchImpl = fetch) {
  if (!id) return null;
  if (!cache.has(id)) cache.set(id, fetchImpl(`offline/pois/${id}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => (j ? buildIndex(j.rows) : null)).catch(() => null));
  return cache.get(id);
}
export async function indexFor(p, fetchImpl = fetch) { try { return await loadIndex(await regionFor(p, fetchImpl), fetchImpl); } catch { return null; } }
