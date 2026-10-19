// GTFS static loader (https://gtfs.org/schedule/reference/): reads a feed from a .zip, a directory of .txt
// files, or .txt.gz files; parses agency/stops/routes/trips/stop_times/calendar/calendar_dates/feed_info and
// compiles a compact timetable (shared/transit/raptor.js format) used by the journey planner.
// No dependencies: CSV parser and a minimal ZIP reader (stored + deflate) built on node:zlib.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { haversineKm } from '../../shared/geo.js';

/** Pure: RFC 4180 CSV → array of objects keyed by the header row (BOM, CRLF, quotes, embedded commas). */
export function parseCsv(text) {
  const s = String(text).replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** Minimal ZIP reader: returns { 'stops.txt': Buffer, ... } (methods 0 = stored, 8 = deflate). */
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip_eocd_not_found');
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip_bad_central_dir');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const lnameLen = buf.readUInt16LE(local + 26), lextraLen = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lnameLen + lextraLen, local + 30 + lnameLen + lextraLen + csize);
    out[path.basename(name)] = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : (() => { throw new Error(`zip_method_${method}`); })();
  }
  return out;
}

const FILES = ['agency', 'stops', 'routes', 'trips', 'stop_times', 'calendar', 'calendar_dates', 'feed_info', 'fare_attributes', 'fare_rules'];
/** Load a feed from a .zip file or a directory (x.txt or x.txt.gz). */
export function loadFeed(src) {
  const files = {};
  if (fs.statSync(src).isFile()) {
    const z = readZip(fs.readFileSync(src));
    for (const f of FILES) if (z[`${f}.txt`]) files[f] = z[`${f}.txt`].toString('utf8');
  } else {
    for (const f of FILES) {
      const p = path.join(src, `${f}.txt`);
      if (fs.existsSync(p)) files[f] = fs.readFileSync(p, 'utf8');
      else if (fs.existsSync(`${p}.gz`)) files[f] = zlib.gunzipSync(fs.readFileSync(`${p}.gz`)).toString('utf8');
    }
  }
  for (const req of ['stops', 'routes', 'trips', 'stop_times']) if (!files[req]) throw new Error(`gtfs_missing_${req}.txt`);
  if (!files.calendar && !files.calendar_dates) throw new Error('gtfs_missing_calendar');
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, parseCsv(v)]));
}

export const toSec = (hms) => { const m = /^(\d{1,3}):(\d\d):(\d\d)$/.exec(hms || ''); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };

/**
 * Compile a parsed feed into the compact timetable used by shared/transit/raptor.js:
 * stops (only those served), routes, services, patterns (unique stop sequences per route) with trips sorted by
 * first departure, and footpath transfers (same parent station or ≤ transferRadiusM).
 */
export function buildTimetable(feed, { id = 'feed', name = '', attribution = '', transferRadiusM = 250, walkMps = 1.2 } = {}) {
  const stopRows = new Map(feed.stops.map((s) => [s.stop_id, s]));
  const routeIdx = new Map(); const routes = [];
  for (const r of feed.routes) { routeIdx.set(r.route_id, routes.length); routes.push({ id: r.route_id, short: r.route_short_name || '', long: r.route_long_name || '', type: Number(r.route_type), color: r.route_color ? `#${r.route_color}` : '', text: r.route_text_color ? `#${r.route_text_color}` : '' }); }
  const tripMeta = new Map(feed.trips.map((t) => [t.trip_id, t]));
  const byTrip = new Map();
  for (const st of feed.stop_times) {
    let a = byTrip.get(st.trip_id); if (!a) byTrip.set(st.trip_id, (a = []));
    a.push([Number(st.stop_sequence), st.stop_id, toSec(st.arrival_time) ?? toSec(st.departure_time), toSec(st.departure_time) ?? toSec(st.arrival_time)]);
  }
  const stopIdx = new Map(); const stops = [];
  const sIdx = (sid) => {
    if (stopIdx.has(sid)) return stopIdx.get(sid);
    const s = stopRows.get(sid) || {}; const parent = s.parent_station ? stopRows.get(s.parent_station) : null;
    stopIdx.set(sid, stops.length);
    stops.push({ id: sid, name: s.stop_name || parent?.stop_name || sid, lat: +s.stop_lat, lng: +s.stop_lon, parent: s.parent_station || '', platform: s.platform_code || '', ...(s.zone_id ? { zone: s.zone_id } : {}) });
    return stops.length - 1;
  };
  const patMap = new Map(); const patterns = [];
  for (const [tripId, list] of byTrip) {
    const meta = tripMeta.get(tripId); if (!meta || !routeIdx.has(meta.route_id)) continue;
    list.sort((x, y) => x[0] - y[0]);
    if (list.some((x) => x[2] == null)) continue; // untimed stops: skip trip (no interpolation in this loader)
    const seq = list.map((x) => sIdx(x[1]));
    const key = `${meta.route_id}|${seq.join(',')}`;
    let p = patMap.get(key);
    if (!p) { p = { route: routeIdx.get(meta.route_id), headsign: meta.trip_headsign || '', stops: seq, trips: [] }; patMap.set(key, p); patterns.push(p); }
    const arr = list.map((x) => x[2]), dep = list.map((x) => x[3]);
    const tr = { id: tripId, service: meta.service_id, d: dep };
    if (arr.some((v, i) => v !== dep[i])) tr.a = arr;
    p.trips.push(tr);
  }
  for (const p of patterns) p.trips.sort((x, y) => x.d[0] - y.d[0]);
  const services = {};
  for (const c of feed.calendar || []) services[c.service_id] = { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => c[d] === '1' ? 1 : 0), start: c.start_date, end: c.end_date, add: [], remove: [] };
  for (const d of feed.calendar_dates || []) {
    const s = services[d.service_id] || (services[d.service_id] = { days: [0, 0, 0, 0, 0, 0, 0], start: '00000000', end: '99999999', add: [], remove: [] });
    (d.exception_type === '1' ? s.add : s.remove).push(d.date);
  }
  // Footpaths between served stops: same parent station (interchange) or within transferRadiusM.
  const transfers = [];
  const order = stops.map((_, i) => i).sort((a, b) => stops[a].lat - stops[b].lat);
  const winDeg = Math.max(transferRadiusM, 600) / 110574;
  for (let x = 0; x < order.length; x++) {
    for (let y = x + 1; y < order.length && stops[order[y]].lat - stops[order[x]].lat <= winDeg; y++) {
      const i = order[x], j = order[y];
      const same = stops[i].parent && stops[i].parent === stops[j].parent;
      const dM = haversineKm(stops[i], stops[j]) * 1000;
      if (!(same || dM <= transferRadiusM)) continue;
      const sec = Math.round(Math.max(same ? 120 : 60, (dM * 1.3) / walkMps + 60));
      transfers.push([i, j, sec], [j, i, sec]);
    }
  }
  const fi = (feed.feed_info || [])[0] || {};
  const ag = (feed.agency || [])[0] || {};
  // v0.7: GTFS fares (fare_attributes.txt + fare_rules.txt) when the feed has them; HMRL's bundled feed does not.
  const fares = (feed.fare_attributes || []).map((f) => ({ id: f.fare_id, price: Number(f.price), currency: f.currency_type || 'INR' })).filter((f) => f.id && Number.isFinite(f.price));
  const fareRules = (feed.fare_rules || []).map((r) => ({ fare: r.fare_id, route: r.route_id || '', origin: r.origin_id || '', destination: r.destination_id || '' }));
  return { version: 1, id, name: name || ag.agency_name || id, attribution, agency: ag.agency_name || '', timezone: ag.agency_timezone || 'Asia/Kolkata',
    valid: { start: fi.feed_start_date || '', end: fi.feed_end_date || '' }, stops, routes, services, patterns, transfers, ...(fares.length ? { fares, fareRules } : {}) };
}

/** Load every feed under a directory: each subfolder or .zip is one feed (attribution from ATTRIBUTION.txt if present). */
export function loadFeedsDir(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (!(e.isDirectory() || e.name.endsWith('.zip'))) continue;
    const id = e.name.replace(/\.zip$/, '');
    try {
      const attrFile = e.isDirectory() ? path.join(p, 'ATTRIBUTION.txt') : p.replace(/\.zip$/, '.ATTRIBUTION.txt');
      const attribution = fs.existsSync(attrFile) ? fs.readFileSync(attrFile, 'utf8').split('\n')[0].trim() : '';
      out.push(buildTimetable(loadFeed(p), { id, attribution }));
    } catch (err) { out.push({ id, error: err.message }); }
  }
  return out;
}
