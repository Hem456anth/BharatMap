// Transit service: loads every GTFS feed found in the bundled feeds folder (HMRL, with attribution) and in
// TRANSIT_FEEDS_DIR (default data/gtfs — drop TGSRTC or any other GTFS .zip/folder there and restart).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFeedsDir } from './gtfs.js';
import { planJourney, stopsNear, nextDepartures, ymd } from '../../shared/transit/raptor.js';
import { haversineKm } from '../../shared/geo.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export function createTransit({ dirs = [path.join(HERE, 'feeds'), process.env.TRANSIT_FEEDS_DIR || path.join(HERE, '../../data/gtfs')] } = {}) {
  let feeds = null; const errors = [];
  const load = () => {
    if (feeds) return feeds;
    feeds = [];
    for (const d of dirs) for (const tt of loadFeedsDir(d)) { if (tt.error) errors.push(tt); else feeds.push(tt); }
    return feeds;
  };
  // "Now" in the feed's timezone (all bundled feeds are Asia/Kolkata).
  function istNow(d = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
    const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
    return { date: `${p.year}${p.month}${p.day}`, dow, sec: (+p.hour % 24) * 3600 + +p.minute * 60 + +p.second };
  }
  function when({ date, time } = {}) {
    const now = istNow();
    let d = now.date, dow = now.dow, sec = now.sec;
    if (/^\d{4}-\d\d-\d\d$/.test(date || '')) { const dt = new Date(`${date}T12:00:00Z`); d = ymd(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())); dow = (dt.getUTCDay() + 6) % 7; }
    if (/^\d\d:\d\d$/.test(time || '')) sec = +time.slice(0, 2) * 3600 + +time.slice(3) * 60;
    return { date: d, dow, departSec: sec };
  }
  function feedFor(p) { return load().filter((tt) => stopsNear(tt, p, 3000).length).sort((a, b) => a.stops.length - b.stops.length); }
  return {
    feeds: () => load().map((tt) => ({ id: tt.id, name: tt.name, attribution: tt.attribution, valid: tt.valid, stops: tt.stops.length, routes: tt.routes.length, patterns: tt.patterns.length })),
    errors: () => errors.map((e) => ({ id: e.id, error: e.error })),
    plan(from, to, opts = {}) {
      const w = when(opts);
      const cands = load().filter((tt) => stopsNear(tt, from, 1500).length && stopsNear(tt, to, 1500).length);
      if (!cands.length) return { scheduled: true, itineraries: [], reason: load().length ? 'no_feed_covers_trip' : 'no_feed_loaded', feeds: this.feeds(), when: w };
      const results = cands.map((tt) => ({ tt, r: planJourney(tt, from, to, w) }));
      const its = results.flatMap(({ tt, r }) => r.itineraries.map((it) => ({ ...it, attribution: tt.attribution, feed_name: tt.name })));
      its.sort((a, b) => a.arrive_s - b.arrive_s);
      return { scheduled: true, label: 'Scheduled times (GTFS), not live', when: w, itineraries: its.slice(0, 3), reason: its.length ? undefined : results[0].r.reason || 'no_trip_found' };
    },
    stops(p, { radiusM = 1200, limit = 8 } = {}) {
      const w = when();
      return feedFor(p).flatMap((tt) => {
        const seen = new Set();
        return stopsNear(tt, p, radiusM).filter(({ i }) => { const k = tt.stops[i].parent || tt.stops[i].id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit)
          .map(({ i, m }) => ({ id: tt.stops[i].parent || tt.stops[i].id, name: tt.stops[i].name, lat: tt.stops[i].lat, lng: tt.stops[i].lng, distance_m: Math.round(m), feed: tt.id, attribution: tt.attribution,
            departures: nextDepartures(tt, i, { date: w.date, dow: w.dow, sec: w.departSec, limit: 4 }) }));
      }).sort((a, b) => a.distance_m - b.distance_m).slice(0, limit);
    },
    nearestKm: (p) => Math.min(...load().flatMap((tt) => tt.stops.map((s) => haversineKm(p, s))), Infinity),
    istNow,
  };
}
