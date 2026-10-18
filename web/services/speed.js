// Speed limits along a route (see shared/maxspeed.js for the parsing). Order: limits already on the route (OSRM
// annotations=maxspeed from a self-hosted OSRM, or the server) → Bharat Map server /api/v1/speed-limits →
// FOSSGIS Valhalla /trace_attributes (edge.speed_limit) → Overpass maxspeed tags along the corridor.
// Every number shown comes from OpenStreetMap maxspeed data; when nothing is found the limit stays unknown.
import { fetchJSON } from './net.js';
import { encodePolyline, simplify } from '../shared/polyline.js';
import { segmentsFromValhallaTrace, segmentsFromOverpassWays, buildMaxspeedQuery, coverage, scaleSegments } from '../shared/maxspeed.js';
import { lineLengthM } from '../shared/polyline.js';
import { useServer, v1 } from './server.js';
import { VALHALLA_BASE } from './routing.js';

/** Pure: Valhalla trace_attributes GET URL (encoded polyline keeps the URL short; GET avoids a CORS preflight). */
export function buildTraceUrl(coords, costing = 'auto') {
  const pts = coords.length > 600 ? simplify(coords, 4) : coords;
  const body = { encoded_polyline: encodePolyline(pts, 6), shape_match: 'map_snap', costing, filters: { attributes: ['edge.speed_limit', 'edge.length'], action: 'include' } };
  return `${VALHALLA_BASE}/trace_attributes?json=${encodeURIComponent(JSON.stringify(body))}`;
}

export async function getSpeedLimits(route, { fetchImpl, mode = 'drive' } = {}) {
  if (route?.speed_limits?.length) return { source: 'route', segments: route.speed_limits };
  const coords = route?.geometry?.coordinates;
  if (!coords || coords.length < 2 || route.fallback) return { source: null, segments: null };
  if (useServer()) {
    try { const r = await v1('/speed-limits', { method: 'POST', body: { coordinates: coords, mode }, timeout: 20000, fetchImpl }); if (r?.segments?.length) return r; } catch { /* go direct */ }
  }
  try {
    const j = await fetchJSON(buildTraceUrl(coords, mode === 'two' ? 'motor_scooter' : 'auto'), { timeout: 15000, ttl: 30 * 60_000, fetchImpl });
    const segs = scaleSegments(segmentsFromValhallaTrace(j), lineLengthM(coords));
    if (segs && coverage(segs) > 0) return { source: 'valhalla', segments: segs };
  } catch { /* try Overpass */ }
  try {
    const q = buildMaxspeedQuery(coords);
    const j = await fetchJSON('https://overpass-api.de/api/interpreter', { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 25000, ttl: 30 * 60_000, fetchImpl });
    const segs = segmentsFromOverpassWays(j, coords);
    if (segs && coverage(segs) > 0) return { source: 'overpass', segments: segs };
  } catch { /* unknown */ }
  return { source: null, segments: null };
}
