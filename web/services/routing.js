// Turn-by-turn routing via the FOSSGIS OSRM servers (routing.openstreetmap.de, OSM data, ODbL).
// Policy: https://routing.openstreetmap.de/about.html — light, interactive use only; heavy use => self-host OSRM.
// Two-wheeler has no public open profile, so it uses the car graph and is labelled as an estimate.
import { fetchJSON } from './net.js';
import { haversineKm } from '../shared/geo.js';

export const ROUTING_BASE = 'https://routing.openstreetmap.de';
export const MODES = {
  drive: { host: 'routed-car', estimate: false, fallbackKmh: 22 },
  two: { host: 'routed-car', estimate: true, fallbackKmh: 25 },
  bike: { host: 'routed-bike', estimate: false, fallbackKmh: 14 },
  walk: { host: 'routed-foot', estimate: false, fallbackKmh: 4.5 },
};

const c6 = (x) => Math.round(x * 1e6) / 1e6;
/** Pure: build the OSRM request URL for a mode. */
export function buildRouteUrl(mode, from, to, { alternatives = true } = {}) {
  const m = MODES[mode];
  if (!m) throw new Error(`unknown_mode:${mode}`);
  for (const p of [from, to]) if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) throw new Error('invalid_point');
  const coords = `${c6(from.lng)},${c6(from.lat)};${c6(to.lng)},${c6(to.lat)}`;
  const qs = `alternatives=${alternatives ? 'true' : 'false'}&steps=true&overview=full&geometries=geojson`;
  return `${ROUTING_BASE}/${m.host}/route/v1/driving/${coords}?${qs}`;
}

/** Pure: normalise an OSRM response into our route objects (max 3). */
export function parseOsrm(json, mode) {
  if (json?.code !== 'Ok' || !Array.isArray(json.routes)) throw new Error(`osrm_${json?.code || 'bad_response'}`);
  return json.routes.slice(0, 3).map((r, i) => {
    const leg = r.legs?.[0] || {};
    const steps = (leg.steps || []).map((s) => ({
      type: s.maneuver?.type || 'continue',
      modifier: s.maneuver?.modifier || null,
      exit: s.maneuver?.exit ?? null,
      bearing_after: s.maneuver?.bearing_after ?? null,
      location: s.maneuver?.location || null,
      name: s.name || '', ref: s.ref || '', rotary_name: s.rotary_name || '',
      distance_m: s.distance || 0, duration_s: s.duration || 0, mode: s.mode,
    }));
    return {
      id: `r${i}`, index: i, mode, engine: 'osrm-fossgis',
      distance_m: Math.round(r.distance), duration_s: Math.round(r.duration),
      summary: leg.summary || '', geometry: r.geometry, steps,
    };
  });
}

/** Straight-line estimate used when no routing server is reachable (clearly labelled). */
export function fallbackRoutes(mode, from, to) {
  const km = haversineKm(from, to) * 1.35;
  const kmh = MODES[mode]?.fallbackKmh || 20;
  return [{
    id: 'r0', index: 0, mode, engine: 'fallback-straight-line', fallback: true,
    distance_m: Math.round(km * 1000), duration_s: Math.round((km / kmh) * 3600), summary: '',
    geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
    steps: [
      { type: 'depart', modifier: null, location: [from.lng, from.lat], name: '', ref: '', distance_m: Math.round(km * 1000), duration_s: Math.round((km / kmh) * 3600) },
      { type: 'arrive', modifier: null, location: [to.lng, to.lat], name: '', ref: '', distance_m: 0, duration_s: 0 },
    ],
  }];
}

export async function getRoutes(mode, from, to, { fetchImpl, timeout = 12000 } = {}) {
  const m = MODES[mode];
  try {
    const json = await fetchJSON(buildRouteUrl(mode, from, to), { timeout, ttl: 5 * 60_000, fetchImpl });
    return { mode, estimate: m.estimate, fallback: false, routes: parseOsrm(json, mode) };
  } catch (e) {
    return { mode, estimate: true, fallback: true, error: e.message, routes: fallbackRoutes(mode, from, to) };
  }
}
