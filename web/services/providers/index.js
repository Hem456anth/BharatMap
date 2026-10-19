// Client-side service providers for place-card panels. The panel itself is built synchronously by
// shared/services/build.js (works offline); these providers fill in asynchronous parts and each reports its own
// failure so the panel can show the Partial state instead of failing silently:
//   transit   scheduled departures from the bundled on-device HMRL timetable (or the server's GTFS feeds)
//   ride      drive-time ETA from Bharat's own routing (Estimate; never a fare)
//   nearby    nearby grocery shops from the bundled offline OSM POI index
//   server    server-only extras (admin-verified provider links, listing panel type) from /api/v1/places/:id/services
// Registry: PROVIDERS[i] = { id, applies(type, place, env), load(place, env) → Promise<partial ctx> }.
import { fetchJSON } from '../net.js';
import { useServer, v1, serverBase } from '../server.js';
import { getRoutes } from '../routing.js';
import { transitIndex, istNow } from '../transit.js';
import { unpackTimetable } from '../../shared/transit/pack.js';
import { stationDepartures } from '../../shared/services/departures.js';
import { stationKind } from '../../shared/services/panel-types.js';
import { haversineKm } from '../../shared/geo.js';
import { cityOf } from '../../shared/services/linkouts.js';

const tts = new Map();
async function timetable(feed) {
  if (!tts.has(feed.id)) tts.set(feed.id, fetchJSON(`transit/${feed.file}`, { ttl: 0, timeout: 20000 }).then(unpackTimetable));
  return tts.get(feed.id);
}
const inBox = (b, p, m = 0.01) => p.lng >= b[0] - m && p.lat >= b[1] - m && p.lng <= b[2] + m && p.lat <= b[3] + m;
const nowFor = () => (globalThis.__BM_NOW__ ? new Date(globalThis.__BM_NOW__) : new Date());

export const transitProvider = {
  id: 'transit',
  applies: (type) => type === 'station',
  async load(place) {
    // On-device first: works offline and is exactly what the server would compute from the same GTFS.
    const idx = await transitIndex();
    const w = istNow(nowFor());
    for (const f of (idx.feeds || []).filter((x) => inBox(x.bbox, place))) {
      const tt = await timetable(f);
      const d = stationDepartures(tt, place, { date: w.date, dow: w.dow, sec: w.departSec, attribution: f.attribution });
      if (d.status === 'ready') return { departures: { ...d, via: 'device' } };
    }
    if (useServer()) {
      try {
        const r = await v1(`/places/${encodeURIComponent(place.id || 'pin')}/services?lat=${place.lat}&lng=${place.lng}&name=${encodeURIComponent(place.name || '')}&tags=${encodeURIComponent(JSON.stringify(place.tags || {}))}`, { timeout: 10000, ttl: 60_000 });
        const d = r.panel?.sections?.find((s) => s.id === 'departures');
        if (d) return { serverPanel: r.panel };
      } catch { /* fall through */ }
    }
    return { departures: { status: stationKind(place.tags) === 'metro' ? 'no_match' : 'no_feed' } };
  },
};

export const rideProvider = {
  id: 'ride',
  applies: () => true,
  async load(place, env) {
    const o = env.origin;
    if (!o) return { rideEstimate: { status: 'error' } };
    if (haversineKm(o, place) < 0.05) return { rideEstimate: { status: 'ready', duration_s: 60, distance_m: Math.round(haversineKm(o, place) * 1000), engine: 'here', fallback: false } };
    const r = await getRoutes('drive', o, place, { timeout: 12000 });
    const x = r.routes?.[0];
    if (!x) return { rideEstimate: { status: 'error' } };
    return { rideEstimate: { status: 'ready', duration_s: x.duration_s, distance_m: x.distance_m, engine: r.engine, fallback: !!r.fallback } };
  },
};

const poiFiles = new Map();
export const nearbyProvider = {
  id: 'nearby',
  applies: (type) => type === 'grocery',
  async load(place) {
    const region = cityOf(place);
    if (!region) return { nearby: [] };
    if (!poiFiles.has(region)) poiFiles.set(region, fetchJSON(`offline/pois/${region}.json`, { ttl: 0, timeout: 20000 }).catch(() => null));
    const f = await poiFiles.get(region);
    if (!f?.rows) return { nearby: [] };
    const out = [];
    for (const r of f.rows) {
      if (!/^(supermarket|convenience|greengrocer|general|grocery|dairy)$/.test(r[1]) || !r[0] || r[0] === place.name) continue;
      const m = haversineKm(place, { lat: r[2], lng: r[3] }) * 1000;
      if (m > 5 && m <= 1500) out.push({ name: r[0], kind: r[1], lat: r[2], lng: r[3], m });
    }
    out.sort((a, b) => a.m - b.m);
    return { nearby: out.slice(0, 4).map((x) => ({ ...x, d: x.m < 1000 ? `${Math.round(x.m / 10) * 10} m` : `${(x.m / 1000).toFixed(1)} km` })) };
  },
};

export const serverProvider = {
  id: 'server',
  applies: (_type, place, env) => !env.demo && !!env.apiBase && !!place.id && !String(place.id).startsWith('pin:'),
  async load(place, env) {
    const qs = new URLSearchParams({ lat: String(place.lat), lng: String(place.lng), name: place.name || '', tags: JSON.stringify(place.tags || {}) });
    const r = await fetchJSON(`${env.apiBase()}/api/v1/places/${encodeURIComponent(place.id)}/services?${qs}`, { timeout: 8000, ttl: 60_000 });
    return { verifiedLinks: (r.panel?.actions || []).filter((a) => a.id?.startsWith('pl-')).map((a) => ({ id: a.id.slice(3), provider_id: a.provider, host: a.host, url: a.url, label: a.text })), forceType: r.listing ? null : undefined, listing: r.listing };
  },
};

export const PROVIDERS = [transitProvider, rideProvider, nearbyProvider, serverProvider];
export { serverBase };
