// Toll plazas and toll road segments along a route, from OpenStreetMap (ODbL) via Overpass:
//   plazas: barrier=toll_booth (nodes / ways) and highway=toll_gantry (open-road tolling)
//   toll roads: highway=* ways tagged toll=yes
// Fees are NOT shown: OSM has no reliable fee data for Indian plazas and NHAI rates change per vehicle class
// and year. The UI labels results "toll plazas on route (fees not available)". Pure, isomorphic.
import { simplify, projectOnLine, projector } from './polyline.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5;
/** Route line reduced to at most maxPts vertices (Overpass `around` with a polyline). */
export function corridorLine(coords, maxPts = 180) {
  let tol = 15, line = simplify(coords, tol);
  while (line.length > maxPts && tol < 5000) { tol *= 1.6; line = simplify(coords, tol); }
  return line;
}
/** Pure: Overpass QL for toll plazas (≤ radiusM of the route) and toll=yes ways (≤ 15 m). */
export function buildTollQuery(coords, { radiusM = 60, timeout = 25 } = {}) {
  if (!Array.isArray(coords) || coords.length < 2) throw new Error('invalid_line');
  const line = corridorLine(coords).map(([lng, lat]) => `${r5(lat)},${r5(lng)}`).join(',');
  return `[out:json][timeout:${timeout}];(node["barrier"="toll_booth"](around:${radiusM},${line});way["barrier"="toll_booth"](around:${radiusM},${line});node["highway"="toll_gantry"](around:${radiusM},${line}););out center tags;way["highway"]["toll"="yes"](around:15,${line});out tags geom;`;
}

/**
 * Pure: plazas ordered along the route (booths on both carriageways within mergeM are one plaza),
 * plus the length of the route that runs on toll=yes ways.
 */
export function parseTolls(json, coords, { maxDistM = 80, mergeM = 350, tollWayM = 20 } = {}) {
  const els = json?.elements || [];
  const raw = [];
  const ways = [];
  for (const e of els) {
    const tags = e.tags || {};
    if (e.type === 'way' && tags.toll === 'yes' && Array.isArray(e.geometry)) { ways.push({ tags, line: e.geometry.map((g) => [g.lon, g.lat]) }); continue; }
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (tags.barrier !== 'toll_booth' && tags.highway !== 'toll_gantry') continue;
    const pr = projectOnLine([lng, lat], coords);
    if (pr.distM > maxDistM) continue;
    raw.push({ id: `osm:${e.type}/${e.id}`, name: tags.name || tags['name:en'] || '', operator: tags.operator || '', kind: tags.highway === 'toll_gantry' ? 'gantry' : 'plaza',
      lat, lng, along_m: Math.round(pr.alongM), off_route_m: Math.round(pr.distM), fee_tagged: tags.fee || null });
  }
  raw.sort((a, b) => a.along_m - b.along_m);
  const plazas = [];
  for (const p of raw) {
    const prev = plazas[plazas.length - 1];
    if (prev && p.along_m - prev.along_m < mergeM) { prev.booths++; if (!prev.name && p.name) prev.name = p.name; continue; }
    plazas.push({ ...p, booths: 1 });
  }
  // Toll road length: route segments whose midpoint lies within tollWayM of a toll=yes way.
  let tollM = 0; const names = new Set();
  if (ways.length && coords.length > 1) {
    const { xy } = projector(coords[0][1]);
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i]; const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (const w of ways) {
        if (w.line.length < 2) continue;
        if (projectOnLine(mid, w.line).distM <= tollWayM) {
          const A = xy(a), B = xy(b); tollM += Math.hypot(B[0] - A[0], B[1] - A[1]);
          const n = w.tags.ref || w.tags.name; if (n) names.add(n);
          break;
        }
      }
    }
  }
  return { plazas, count: plazas.length, toll_road_m: Math.round(tollM), toll_roads: [...names].slice(0, 5), fees: null,
    note: 'Toll plazas on route from OpenStreetMap (fees not available)' };
}

/** GeoJSON for drawing plazas on the map. */
export function tollFeatures(result) {
  return { type: 'FeatureCollection', features: (result?.plazas || []).map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, n: i + 1, name: p.name } })) };
}
