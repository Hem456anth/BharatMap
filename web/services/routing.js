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

async function viaOsrm(mode, from, to, o) {
  const json = await fetchJSON(buildRouteUrl(mode, from, to), { timeout: o.timeout, ttl: 5 * 60_000, fetchImpl: o.fetchImpl });
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
      const qs = new URLSearchParams({ mode, from_lat: from.lat.toFixed(6), from_lng: from.lng.toFixed(6), to_lat: to.lat.toFixed(6), to_lng: to.lng.toFixed(6), ...(o.avoidTolls ? { avoid_tolls: '1' } : {}), ...(o.avoidHighways ? { avoid_highways: '1' } : {}) });
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
  return { mode, engine: 'fallback-straight-line', estimate: true, fallback: true, error: err?.message, routes: fallbackRoutes(mode, from, to) };
}
