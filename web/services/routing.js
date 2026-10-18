// Turn-by-turn routing. Order of engines:
//  - with a Bharat Map server (services/server.js): /api/v1/route (Valhalla ⇄ OSRM with fallbacks, server-side)
//  - direct (no server): Two-wheeler and "avoid tolls / highways" use FOSSGIS Valhalla (valhalla1.openstreetmap.de,
//    costing motor_scooter = a real two-wheeler profile); Drive / Cycle / Walk use FOSSGIS OSRM
//    (routing.openstreetmap.de). If the preferred engine fails, the other is tried; Two-wheeler on OSRM falls back
//    to the car graph and is labelled an estimate. Policies: light interactive use only, 1 req/s — self-host for production.
import { fetchJSON } from './net.js';
import { haversineKm } from '../shared/geo.js';
import { buildValhallaRequest, parseValhalla } from '../shared/valhalla.js';
import { useServer, v1 } from './server.js';
import { parseOsrmLanes, collectOsrmLanes } from '../shared/lanes.js';
import { segmentsFromOsrmAnnotation } from '../shared/maxspeed.js';

export const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de';
/** Pure: GET URL for Valhalla (GET keeps it a CORS "simple request"). */
export function buildValhallaUrl(mode, from, to, opts = {}) {
  return `${VALHALLA_BASE}/route?json=${encodeURIComponent(JSON.stringify(buildValhallaRequest(mode, from, to, opts)))}`;
}

export const ROUTING_BASE = 'https://routing.openstreetmap.de';
export const MODES = {
  drive: { host: 'routed-car', estimate: false, fallbackKmh: 22 },
  two: { host: 'routed-car', estimate: true, fallbackKmh: 25 },
  bike: { host: 'routed-bike', estimate: false, fallbackKmh: 14 },
  walk: { host: 'routed-foot', estimate: false, fallbackKmh: 4.5 },
};

const c6 = (x) => Math.round(x * 1e6) / 1e6;
/** Pure: build the OSRM request URL for a mode. */
export function buildRouteUrl(mode, from, to, { alternatives = true, via = [] } = {}) {
  const m = MODES[mode];
  if (!m) throw new Error(`unknown_mode:${mode}`);
  const pts = [from, ...via, to];
  for (const p of pts) if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) throw new Error('invalid_point');
  const coords = pts.map((p) => `${c6(p.lng)},${c6(p.lat)}`).join(';');
  // OSRM computes alternatives only for two-point routes.
  const qs = `alternatives=${alternatives && !via.length ? 'true' : 'false'}&steps=true&overview=full&geometries=geojson`;
  return `${ROUTING_BASE}/${m.host}/route/v1/driving/${coords}?${qs}`;
}

/** Pure: normalise an OSRM response into our route objects (max 3). Multi-leg routes (stops) are concatenated. */
export function parseOsrm(json, mode) {
  if (json?.code !== 'Ok' || !Array.isArray(json.routes)) throw new Error(`osrm_${json?.code || 'bad_response'}`);
  return json.routes.slice(0, 3).map((r, i) => {
    const legs = r.legs?.length ? r.legs : [{}];
    const raw = []; const legEnds = [];
    legs.forEach((leg, li) => {
      let st = leg.steps || [];
      // Intermediate stops: drop the "arrive" of every leg but the last and the next leg's "depart" becomes a waypoint.
      if (li < legs.length - 1) st = st.filter((s) => s.maneuver?.type !== 'arrive');
      if (li > 0) st = st.map((s) => (s.maneuver?.type === 'depart' ? { ...s, maneuver: { ...s.maneuver, type: 'waypoint' } } : s));
      raw.push(...st); legEnds.push(raw.length);
    });
    const steps = raw.map((s) => {
      const x0 = s.intersections?.[0];
      return {
        type: s.maneuver?.type || 'continue',
        modifier: s.maneuver?.modifier || null,
        exit: s.maneuver?.exit ?? null,
        bearing_before: s.maneuver?.bearing_before ?? null,
        bearing_after: s.maneuver?.bearing_after ?? null,
        location: s.maneuver?.location || null,
        name: s.name || '', ref: s.ref || '', rotary_name: s.rotary_name || '',
        distance_m: s.distance || 0, duration_s: s.duration || 0, mode: s.mode,
        lanes: parseOsrmLanes(x0?.lanes),
        // Junction shape for the schematic diagram: every road bearing at the maneuver point, the way in and out.
        junction: x0 && Array.isArray(x0.bearings) ? { bearings: x0.bearings, in: x0.in ?? null, out: x0.out ?? null } : null,
      };
    });
    return {
      id: `r${i}`, index: i, mode, engine: 'osrm-fossgis',
      distance_m: Math.round(r.distance), duration_s: Math.round(r.duration),
      summary: legs.map((l) => l.summary).filter(Boolean).join(' · '), geometry: r.geometry, steps,
      lanes: collectOsrmLanes(raw),
      speed_limits: segmentsFromOsrmAnnotation(legs),
      stops: legs.length - 1,
    };
  });
}

/** Straight-line estimate used when no routing server is reachable (clearly labelled). */
export function fallbackRoutes(mode, from, to, via = []) {
  const pts = [from, ...via, to];
  let km = 0; for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]) * 1.35;
  const kmh = MODES[mode]?.fallbackKmh || 20;
  return [{
    id: 'r0', index: 0, mode, engine: 'fallback-straight-line', fallback: true,
    distance_m: Math.round(km * 1000), duration_s: Math.round((km / kmh) * 3600), summary: '',
    geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) }, stops: via.length,
    steps: [
      { type: 'depart', modifier: null, location: [from.lng, from.lat], name: '', ref: '', distance_m: Math.round(km * 1000), duration_s: Math.round((km / kmh) * 3600) },
      { type: 'arrive', modifier: null, location: [to.lng, to.lat], name: '', ref: '', distance_m: 0, duration_s: 0 },
    ],
  }];
}

async function viaOsrm(mode, from, to, o) {
  const json = await fetchJSON(buildRouteUrl(mode, from, to, { via: o.via || [] }), { timeout: o.timeout, ttl: 5 * 60_000, fetchImpl: o.fetchImpl });
  return { engine: 'osrm-fossgis', estimate: MODES[mode].estimate, routes: parseOsrm(json, mode), avoid_applied: !(o.avoidTolls || o.avoidHighways) };
}
async function viaValhalla(mode, from, to, o) {
  const json = await fetchJSON(buildValhallaUrl(mode, from, to, o), { timeout: o.timeout, ttl: 5 * 60_000, fetchImpl: o.fetchImpl });
  return { engine: 'valhalla-fossgis', estimate: false, routes: parseValhalla(json, mode, 'valhalla-fossgis'), avoid_applied: true };
}

/** getRoutes(mode, from, to, { avoidTolls, avoidHighways, fetchImpl, timeout }) → { mode, engine, estimate, fallback, routes } */
export async function getRoutes(mode, from, to, opts = {}) {
  const o = { timeout: 12000, ...opts };
  if (useServer()) {
    try {
      const qs = new URLSearchParams({ mode, ...(o.via?.length ? { via: o.via.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(';') } : {}), from_lat: from.lat.toFixed(6), from_lng: from.lng.toFixed(6), to_lat: to.lat.toFixed(6), to_lng: to.lng.toFixed(6), ...(o.avoidTolls ? { avoid_tolls: '1' } : {}), ...(o.avoidHighways ? { avoid_highways: '1' } : {}) });
      const r = await v1(`/route?${qs}`, { timeout: 20000, fetchImpl: o.fetchImpl });
      return { mode, engine: r.engine, provider: r.provider, estimate: !!r.estimate, fallback: !!r.fallback, routes: r.routes, avoid_applied: r.avoid_applied, via: 'server', error: r.error };
    } catch { /* server unreachable: go direct */ }
  }
  const valhallaFirst = mode === 'two' || o.avoidTolls || o.avoidHighways;
  const order = valhallaFirst ? [viaValhalla, viaOsrm] : [viaOsrm, viaValhalla];
  let err;
  for (const fn of order) {
    try { const r = await fn(mode, from, to, o); return { mode, fallback: false, via: 'direct', ...r }; } catch (e) { err = e; }
  }
  return { mode, engine: 'fallback-straight-line', estimate: true, fallback: true, error: err?.message, routes: fallbackRoutes(mode, from, to, o.via || []) };
}
