// Station panel data from a GTFS timetable (compact format, shared/transit/raptor.js): match an OSM station to a GTFS
// stop (≤ 50 m, or ≤ 250 m with a shared name token), then next 3 scheduled departures per direction, lines serving it,
// interchange, first/last train and the fare table (fare_attributes.txt) if the feed has one. Everything is SCHEDULED.
import { haversineKm } from '../geo.js';
import { stopsNear, nextDepartures, fmtTime, activeServices } from '../transit/raptor.js';

const tokens = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9\u0900-\u0dff]+/).filter((w) => w.length >= 3 && !['metro', 'station', 'line', 'red', 'blue', 'green'].includes(w));
/** Index of the GTFS stop matching an OSM station, or -1. */
export function matchStop(tt, place) {
  const near = stopsNear(tt, place, 250);
  const pt = tokens(place.name);
  for (const { i, m } of near) {
    if (m <= 50) return i;
    const st = tokens(tt.stops[i].name);
    if (pt.some((w) => st.includes(w))) return i;
  }
  return -1;
}
export function lineName(r) {
  const m = /^(?:C\d_)?([A-Z]{3,})$/.exec(r.short || '');
  if (m) return `${m[1][0]}${m[1].slice(1).toLowerCase()} line`;
  return r.short || r.long || r.id;
}

/** stationDepartures(tt, place, { date, dow, sec }) → departures model for buildServicePanel ctx.departures. */
export function stationDepartures(tt, place, { date, dow, sec, attribution = tt.attribution, perDirection = 3 } = {}) {
  const i = matchStop(tt, place);
  if (i < 0) return { status: 'no_match', attribution };
  const stop = tt.stops[i];
  const same = tt.stops.map((s, k) => (k === i || (stop.parent && s.parent === stop.parent) ? k : -1)).filter((k) => k >= 0);
  // Lines serving the station (all platforms).
  const routeIds = new Set();
  tt.patterns.forEach((p) => { if (p.stops.some((s) => same.includes(s))) routeIds.add(p.route); });
  const lines = [...routeIds].map((ri) => ({ id: tt.routes[ri].id, name: lineName(tt.routes[ri]), color: tt.routes[ri].color || '' }));
  const all = nextDepartures(tt, i, { date, dow, sec, limit: 40 });
  // Next N per direction (headsign).
  const byDir = new Map();
  for (const d of all) { const k = `${d.route.id}|${d.headsign}`; const a = byDir.get(k) || []; if (a.length < perDirection) a.push(d); byDir.set(k, a); }
  const next = [...byDir.values()].flat().sort((a, b) => a.dep_s - b.dep_s).slice(0, perDirection * 2)
    .map((d) => ({ time: fmtTime(d.dep_s), dep_s: d.dep_s, line: lineName(d.route), color: d.route.color || '', headsign: d.headsign, platform: d.platform || '' }));
  // First / last departure today (any direction) for the "first/last train" row.
  const services = activeServices(tt, date, dow);
  let first = Infinity, last = -1;
  for (const p of tt.patterns) p.stops.forEach((s, pos) => { if (!same.includes(s) || pos === p.stops.length - 1) return; for (const tr of p.trips) if (services.has(tr.service)) { first = Math.min(first, tr.d[pos]); last = Math.max(last, tr.d[pos]); } });
  const firstLast = Number.isFinite(first) && last >= 0 ? { first: fmtTime(first), last: fmtTime(last) } : null;
  const fare = tt.fares?.length ? { status: 'ready', count: tt.fares.length } : { status: 'none' };
  return {
    status: 'ready', stop: { id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng, distance_m: Math.round(haversineKm(place, stop) * 1000) },
    next, lines, interchange: lines.length > 1, firstLast, first: next.length ? null : firstLast?.first || null, fare, attribution, feedDate: tt.valid?.start || '', source: `${tt.name || tt.id} GTFS timetable`,
  };
}

/** GTFS fare lookup (fare_attributes + fare_rules by origin/destination zone). Returns { price, currency } or null. */
export function gtfsFare(tt, fromStopIdx, toStopIdx) {
  if (!tt.fares?.length) return null;
  const zf = tt.stops[fromStopIdx]?.zone, zt = tt.stops[toStopIdx]?.zone;
  const rule = (tt.fareRules || []).find((r) => (!r.origin || r.origin === zf) && (!r.destination || r.destination === zt));
  const f = rule ? tt.fares.find((x) => x.id === rule.fare) : tt.fares.length === 1 && !(tt.fareRules || []).length ? tt.fares[0] : null;
  return f ? { price: f.price, currency: f.currency, fare_id: f.id } : null;
}
