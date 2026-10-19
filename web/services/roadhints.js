// India road hints along a route (see shared/roadhints.js for the rules). Order: Bharat Map server
// /api/v1/road-hints → FOSSGIS Valhalla /trace_attributes (bridge, road class, use = the edges the route really
// uses) merged with Overpass tags Valhalla does not expose (*:conditional time restrictions, width/lanes=1, odd-even
// notes) → Overpass alone (every highway in the corridor, so the nearest-way match is safe). Nothing is invented:
// with no data there are simply no hints.
import { fetchJSON } from './net.js';
import { encodePolyline, simplify, lineLengthM } from '../shared/polyline.js';
import { segmentsFromValhallaEdges, segmentsFromOverpass, buildRoadHintsQuery, mergeHintSegments, scaleHintSegments, hintEvents } from '../shared/roadhints.js';
import { useServer, v1 } from './server.js';
import { VALHALLA_BASE } from './routing.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
/** Pure: Valhalla trace_attributes GET URL for the hint attributes. */
export function buildHintsTraceUrl(coords, costing = 'auto') {
  const pts = coords.length > 600 ? simplify(coords, 4) : coords;
  const body = { encoded_polyline: encodePolyline(pts, 6), shape_match: 'map_snap', costing, filters: { attributes: ['edge.length', 'edge.bridge', 'edge.road_class', 'edge.use', 'edge.names', 'edge.traversability'], action: 'include' } };
  return `${VALHALLA_BASE}/trace_attributes?json=${encodeURIComponent(JSON.stringify(body))}`;
}
const overpass = (q, fetchImpl) => fetchJSON(OVERPASS, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 25000, ttl: 30 * 60_000, fetchImpl });

export async function getRoadHints(route, { fetchImpl, mode = 'drive' } = {}) {
  const coords = route?.geometry?.coordinates;
  if (!coords || coords.length < 2 || route.fallback) return { source: null, segments: null, events: [] };
  if (route.road_hints?.events) return route.road_hints;
  const total = lineLengthM(coords);
  if (useServer()) {
    try { const r = await v1('/road-hints', { method: 'POST', body: { coordinates: coords, mode }, timeout: 25000, fetchImpl }); if (r?.events) return r; } catch { /* go direct */ }
  }
  let vSegs = null;
  try { vSegs = scaleHintSegments(segmentsFromValhallaEdges(await fetchJSON(buildHintsTraceUrl(coords, mode === 'two' ? 'motor_scooter' : 'auto'), { timeout: 15000, ttl: 30 * 60_000, fetchImpl })), total); } catch { /* Overpass only */ }
  let oSegs = null;
  try { oSegs = segmentsFromOverpass(await overpass(buildRoadHintsQuery(coords, { full: !vSegs }), fetchImpl), coords, { structure: !vSegs }); } catch { /* tags unknown */ }
  const segs = mergeHintSegments(vSegs, oSegs);
  return { source: vSegs && oSegs ? 'valhalla+overpass' : vSegs ? 'valhalla' : oSegs ? 'overpass' : null, segments: segs, events: hintEvents(segs) };
}
