// Scheduled transit journeys. With a Bharat Map server: /api/v1/transit/plan (HMRL + any GTFS dropped on the
// server, e.g. TGSRTC). Without: the bundled compact HMRL timetable (web/transit/hmrl.json, ≈160 KB) is planned
// on-device with the same RAPTOR code. Times are SCHEDULED (GTFS), never live.
import { fetchJSON } from './net.js';
import { useServer, v1 } from './server.js';
import { planJourney } from '../shared/transit/raptor.js';
import { unpackTimetable } from '../shared/transit/pack.js';

const tts = new Map();
let index = null;
export async function transitIndex(fetchImpl) {
  if (!index) index = await fetchJSON('transit/index.json', { ttl: 0, timeout: 10000, fetchImpl }).catch(() => ({ feeds: [] }));
  return index;
}
const inBox = (b, p, m = 0.02) => p.lng >= b[0] - m && p.lat >= b[1] - m && p.lng <= b[2] + m && p.lat <= b[3] + m;
async function timetable(feed, fetchImpl) {
  if (!tts.has(feed.id)) tts.set(feed.id, fetchJSON(`transit/${feed.file}`, { ttl: 0, timeout: 20000, fetchImpl }).then(unpackTimetable));
  return tts.get(feed.id);
}
/** Current date / day-of-week / seconds in Asia/Kolkata (feeds are IST). */
export function istNow(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}${p.month}${p.day}`, dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday), departSec: (+p.hour % 24) * 3600 + +p.minute * 60 + +p.second };
}

/** planTransit(from, to) → { itineraries, reason?, attribution, via } */
export async function planTransit(from, to, { now = globalThis.__BM_NOW__ ? new Date(globalThis.__BM_NOW__) : new Date(), fetchImpl } = {}) {
  if (useServer()) {
    try {
      const w0 = istNow(now); const hh = String(Math.floor(w0.departSec / 3600)).padStart(2, '0'), mm = String(Math.floor(w0.departSec / 60) % 60).padStart(2, '0');
      const r = await v1(`/transit/plan?from_lat=${from.lat.toFixed(6)}&from_lng=${from.lng.toFixed(6)}&to_lat=${to.lat.toFixed(6)}&to_lng=${to.lng.toFixed(6)}&date=${w0.date.slice(0, 4)}-${w0.date.slice(4, 6)}-${w0.date.slice(6)}&time=${hh}:${mm}`, { timeout: 15000, ttl: 60_000, fetchImpl });
      return { ...r, attribution: r.itineraries?.[0]?.attribution || '', via: 'server' };
    } catch { /* fall through to on-device */ }
  }
  const idx = await transitIndex(fetchImpl);
  const feeds = idx.feeds.filter((f) => inBox(f.bbox, from) && inBox(f.bbox, to));
  if (!feeds.length) return { itineraries: [], reason: 'no_feed_covers_trip', via: 'device' };
  const w = istNow(now);
  let best = { itineraries: [], reason: 'no_trip_found' };
  for (const f of feeds) {
    const tt = await timetable(f, fetchImpl);
    const r = planJourney(tt, from, to, w);
    if (r.itineraries.length) best = { ...r, attribution: f.attribution, feed: f.id };
    else if (best.reason === 'no_trip_found') best.reason = r.reason || 'no_trip_found';
  }
  return { ...best, when: w, via: 'device', scheduled: true };
}
