// Provider abstraction for Bharat Map's own map services (/api/v1/*). Every upstream is configurable by env;
// unset means the public OSM-community instance (development use only, throttled to 1 req/s, identifying UA).
//   VALHALLA_URL                    routing (auto, motor_scooter = real two-wheeler, bicycle, pedestrian; alternates; avoid tolls/highways)
//   OSRM_URL_CAR / _BIKE / _FOOT     OSRM per profile (OSRM_URL = car, legacy). Default FOSSGIS routing.openstreetmap.de
//   PHOTON_URL, NOMINATIM_URL        geocoding (type-ahead / search + reverse)
//   OVERPASS_URL                     POIs, toll plazas, EV fallback
//   OCM_API_KEY (+ OCM_URL)          Open Charge Map (EV); the key stays on the server
import { segmentsFromValhallaEdges, segmentsFromOverpass, buildRoadHintsQuery, mergeHintSegments, scaleHintSegments, hintEvents } from '../../shared/roadhints.js';
import { createUpstream, withFallback } from '../lib/upstream.js';
import { buildValhallaRequest, parseValhalla } from '../../shared/valhalla.js';
import { parseOsrm, fallbackRoutes } from '../../web/services/routing.js';
import { photonUrl, parsePhoton, nominatimSearchUrl, nominatimReverseUrl, parseNominatimItem, PHOTON, NOMINATIM } from '../../web/services/geocode.js';
import { buildOverpassQuery, parseOverpass, CATEGORY_BY_ID } from '../../web/services/overpass.js';
import { buildTollQuery, parseTolls } from '../../shared/tolls.js';
import { parseOcm, parseOsmCharger, parseParking } from '../../shared/ev.js';
import { haversineKm } from '../../shared/geo.js';
import { segmentsFromValhallaTrace, segmentsFromOverpassWays, buildMaxspeedQuery, coverage, scaleSegments } from '../../shared/maxspeed.js';
import { lineLengthM, simplify } from '../../shared/polyline.js';

export const MODES = ['drive', 'two', 'bike', 'walk', 'truck'];
const PUBLIC = {
  valhalla: 'https://valhalla1.openstreetmap.de',
  osrm: { drive: 'https://routing.openstreetmap.de/routed-car', bike: 'https://routing.openstreetmap.de/routed-bike', walk: 'https://routing.openstreetmap.de/routed-foot' },
  photon: PHOTON, nominatim: NOMINATIM, overpass: 'https://overpass-api.de/api/interpreter', ocm: 'https://api.openchargemap.io/v3',
};

export function providerConfig(env = process.env) {
  const osrmEnv = { drive: env.OSRM_URL_CAR || env.OSRM_URL, bike: env.OSRM_URL_BIKE, walk: env.OSRM_URL_FOOT };
  return {
    valhalla: { url: env.VALHALLA_URL || PUBLIC.valhalla, public: !env.VALHALLA_URL, configured: !!env.VALHALLA_URL },
    osrm: Object.fromEntries(['drive', 'bike', 'walk'].map((m) => [m, { url: osrmEnv[m] || PUBLIC.osrm[m], public: !osrmEnv[m], maxspeed: !!osrmEnv[m] && env.OSRM_MAXSPEED === '1' }])),
    photon: { url: env.PHOTON_URL || PUBLIC.photon, public: !env.PHOTON_URL },
    nominatim: { url: env.NOMINATIM_URL || PUBLIC.nominatim, public: !env.NOMINATIM_URL },
    overpass: { url: env.OVERPASS_URL || PUBLIC.overpass, public: !env.OVERPASS_URL },
    ocm: { url: env.OCM_URL || PUBLIC.ocm, key: env.OCM_API_KEY || '', public: true },
    offline: env.OFFLINE === '1',
  };
}

export function createProviders({ env = process.env, fetchImpl, now, sleep, timeoutMs } = {}) {
  const cfg = providerConfig(env);
  const mk = (name, c, extra = {}) => createUpstream({ name, baseUrl: c.url, minIntervalMs: c.public ? 1000 : 0, fetchImpl, now, sleep, timeoutMs: timeoutMs || extra.timeoutMs || 10_000, ...extra });
  const up = {
    valhalla: mk('valhalla', cfg.valhalla, { ttlMs: 5 * 60_000 }),
    osrm: Object.fromEntries(Object.entries(cfg.osrm).map(([m, c]) => [m, mk(`osrm-${m}`, c, { ttlMs: 5 * 60_000 })])),
    photon: mk('photon', cfg.photon, { ttlMs: 30 * 60_000, timeoutMs: 8000 }),
    nominatim: mk('nominatim', cfg.nominatim, { ttlMs: 24 * 3600_000 }),
    overpass: mk('overpass', cfg.overpass, { ttlMs: 10 * 60_000, timeoutMs: 25_000 }),
    ocm: mk('ocm', cfg.ocm, { ttlMs: 6 * 3600_000 }),
  };
  // Public instances run at 1 req/s, so requests should not hold the throttle queue when offline mode is on.
  const offline = () => { if (cfg.offline) { const e = new Error('offline_mode'); throw e; } };

  async function viaValhalla(mode, from, to, opts) {
    offline();
    const body = JSON.stringify(buildValhallaRequest(mode, from, to, opts));
    const j = await up.valhalla.request('/route', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    return { engine: cfg.valhalla.public ? 'valhalla-fossgis' : 'valhalla', estimate: false, routes: parseValhalla(j, mode, cfg.valhalla.public ? 'valhalla-fossgis' : 'valhalla'), avoid_applied: true };
  }
  async function viaOsrm(mode, from, to, opts) {
    offline();
    if (mode === 'truck') throw new Error('osrm_no_truck_profile'); // OSRM has no truck costing: never pretend a car route is a truck route
    const prof = mode === 'two' ? 'drive' : mode;
    const c6 = (x) => Math.round(x * 1e6) / 1e6;
    const via = opts.via || [];
    const path = `/route/v1/driving/${[from, ...via, to].map((p) => `${c6(p.lng)},${c6(p.lat)}`).join(';')}?alternatives=${via.length ? 'false' : 'true'}&steps=true&overview=full&geometries=geojson${cfg.osrm[prof].maxspeed ? '&annotations=maxspeed' : ''}`;
    const j = await up.osrm[prof].request(path);
    const routes = parseOsrm(j, mode).map((r) => ({ ...r, engine: cfg.osrm[prof].public ? 'osrm-fossgis' : 'osrm' }));
    return { engine: routes[0]?.engine, estimate: mode === 'two', routes, avoid_applied: !(opts.avoidTolls || opts.avoidHighways) };
  }

  /** Route with fallbacks: Valhalla ⇄ OSRM, then a labelled straight-line estimate. */
  async function route(mode, from, to, opts = {}) {
    if (!MODES.includes(mode)) throw new Error(`unknown_mode:${mode}`);
    const valhallaFirst = cfg.valhalla.configured || mode === 'two' || mode === 'truck' || opts.avoidTolls || opts.avoidHighways;
    const steps = valhallaFirst ? [['valhalla', () => viaValhalla(mode, from, to, opts)], ['osrm', () => viaOsrm(mode, from, to, opts)]]
      : [['osrm', () => viaOsrm(mode, from, to, opts)], ['valhalla', () => viaValhalla(mode, from, to, opts)]];
    try {
      const r = await withFallback(steps);
      return { mode, provider: r.provider, ...r.value, fallback: false, tried: r.tried };
    } catch (e) {
      return { mode, provider: 'straight-line', engine: 'fallback-straight-line', estimate: true, fallback: true, routes: fallbackRoutes(mode === 'truck' ? 'drive' : mode, from, to, opts.via || []).map((r) => ({ ...r, mode })), tried: e.tried || [], error: 'routing_unavailable' };
    }
  }

  async function geocode(q, { lat, lng, lang = 'en', limit = 6, autocomplete = false } = {}) {
    offline();
    const origin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    const photon = async () => { const items = parsePhoton(await up.photon.request(photonUrl(q, { lat, lng, lang, limit }).slice(PHOTON.length)), origin); if (!items.length && !autocomplete) throw new Error('no_results'); return items; };
    const nominatim = async () => (await up.nominatim.request(nominatimSearchUrl(q, { lang, limit: Math.min(limit, 10) }).slice(NOMINATIM.length))).map(parseNominatimItem).filter(Boolean)
      .map((x) => ({ ...x, distance_m: origin ? Math.round(haversineKm(origin, x) * 1000) : null }));
    // Type-ahead never goes to Nominatim (its policy forbids autocomplete).
    const r = await withFallback(autocomplete ? [['photon', photon]] : [['photon', photon], ['nominatim', nominatim]]);
    return { provider: r.provider, items: r.value, tried: r.tried };
  }
  async function reverse(lat, lng, { lang = 'en' } = {}) {
    offline();
    const j = await up.nominatim.request(nominatimReverseUrl(lat, lng, { lang }).slice(NOMINATIM.length));
    return { provider: 'nominatim', item: parseNominatimItem(j) };
  }

  async function overpass(q) {
    offline();
    return up.overpass.request('', { method: 'POST', body: `data=${encodeURIComponent(q)}` });
  }
  function bboxAroundM(c, radiusM) {
    const dLat = radiusM / 110574, dLng = radiusM / (111320 * Math.cos((c.lat * Math.PI) / 180));
    return { s: c.lat - dLat, n: c.lat + dLat, w: c.lng - dLng, e: c.lng + dLng };
  }
  function enrich(items, cat) {
    return items.map((x) => (cat === 'ev' ? { ...x, ev: parseOsmCharger(x.tags) } : cat === 'parking' ? { ...x, parking: parseParking(x.tags) } : x));
  }
  async function nearby(cat, center, { radiusM = 3000, limit = 60 } = {}) {
    if (!CATEGORY_BY_ID[cat]) throw new Error(`unknown_category:${cat}`);
    const r = Math.max(200, Math.min(radiusM, 5000));
    if (cat === 'ev' && cfg.ocm.key) {
      try {
        const qs = new URLSearchParams({ key: cfg.ocm.key, latitude: center.lat.toFixed(4), longitude: center.lng.toFixed(4), distance: String(r / 1000), distanceunit: 'KM', maxresults: String(limit), compact: 'false', verbose: 'false', countrycode: 'IN' });
        const list = await up.ocm.request(`/poi/?${qs}`, { cacheKey: `ocm ${center.lat.toFixed(3)},${center.lng.toFixed(3)} ${r} ${limit}` });
        const items = parseOcm(list, center, haversineKm).sort((a, b) => a.distance_m - b.distance_m);
        return { provider: 'openchargemap', items, attribution: 'Open Charge Map (CC BY 4.0) and its data providers' };
      } catch { /* fall back to OSM */ }
    }
    const q = buildOverpassQuery(cat, bboxAroundM(center, r), { limit });
    const j = await overpass(q);
    return { provider: 'overpass', items: enrich(parseOverpass(j, cat, center), cat), timestamp: j?.osm3s?.timestamp_osm_base || null, attribution: '© OpenStreetMap contributors (ODbL)' };
  }
  async function tolls(coords) {
    const j = await overpass(buildTollQuery(coords));
    return { provider: 'overpass', ...parseTolls(j, coords), attribution: '© OpenStreetMap contributors (ODbL)' };
  }

  /** Speed limits along a line: Valhalla trace_attributes (edge.speed_limit) → Overpass maxspeed tags. */
  async function speedLimits(coords, { mode = 'drive' } = {}) {
    offline();
    const pts = coords.length > 600 ? simplify(coords, 4) : coords;
    const total = lineLengthM(coords);
    try {
      const body = JSON.stringify({ shape: pts.map(([lng, lat]) => ({ lat, lon: lng })), shape_match: 'map_snap', costing: mode === 'two' ? 'motor_scooter' : 'auto', filters: { attributes: ['edge.speed_limit', 'edge.length'], action: 'include' } });
      const j = await up.valhalla.request('/trace_attributes', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
      const segs = scaleSegments(segmentsFromValhallaTrace(j), total);
      if (segs && coverage(segs) > 0) return { source: 'valhalla', segments: segs, coverage: coverage(segs) };
    } catch { /* fall through */ }
    const j = await overpass(buildMaxspeedQuery(coords));
    const segs = segmentsFromOverpassWays(j, coords);
    return { source: segs && coverage(segs) > 0 ? 'overpass' : null, segments: segs && coverage(segs) > 0 ? segs : null, coverage: segs ? coverage(segs) : 0 };
  }

  // v0.6 India road hints: Valhalla edges (bridge / road class / use) + Overpass tag-only facts (shared/roadhints.js).
  async function roadHints(coords, { mode = 'drive' } = {}) {
    offline();
    const pts = coords.length > 600 ? simplify(coords, 4) : coords;
    const total = lineLengthM(coords);
    let vSegs = null, oSegs = null;
    try {
      const body = JSON.stringify({ shape: pts.map(([lng, lat]) => ({ lat, lon: lng })), shape_match: 'map_snap', costing: mode === 'two' ? 'motor_scooter' : 'auto', filters: { attributes: ['edge.length', 'edge.bridge', 'edge.road_class', 'edge.use', 'edge.names', 'edge.traversability'], action: 'include' } });
      vSegs = scaleHintSegments(segmentsFromValhallaEdges(await up.valhalla.request('/trace_attributes', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })), total);
    } catch { /* Overpass only */ }
    try { oSegs = segmentsFromOverpass(await overpass(buildRoadHintsQuery(coords, { full: !vSegs })), coords, { structure: !vSegs }); } catch { /* none */ }
    const segs = mergeHintSegments(vSegs, oSegs);
    return { source: vSegs && oSegs ? 'valhalla+overpass' : vSegs ? 'valhalla' : oSegs ? 'overpass' : null, segments: segs, events: hintEvents(segs) };
  }

  function status() {
    const s = (u, c) => ({ url: c.public ? c.url : '(self-hosted)', public: c.public, breaker: u.breaker.state, stats: u.stats, cache: u.cache.size });
    return {
      valhalla: s(up.valhalla, cfg.valhalla),
      osrm: Object.fromEntries(Object.entries(up.osrm).map(([m, u]) => [m, s(u, cfg.osrm[m])])),
      photon: s(up.photon, cfg.photon), nominatim: s(up.nominatim, cfg.nominatim), overpass: s(up.overpass, cfg.overpass),
      ocm: { configured: !!cfg.ocm.key, breaker: up.ocm.breaker.state },
      offline: cfg.offline,
    };
  }
  return { route, geocode, reverse, nearby, tolls, overpass, speedLimits, roadHints, status, cfg, upstreams: up };
}
