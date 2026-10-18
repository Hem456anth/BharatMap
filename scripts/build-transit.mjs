// Compile bundled GTFS feeds (server/transit/feeds/*) into compact timetables for the client
// (web/transit/<id>.json + web/transit/index.json), so Transit works on-device without a server.
// Run after replacing a feed: node scripts/build-transit.mjs
import fs from 'node:fs';
import { loadFeedsDir } from '../server/transit/gtfs.js';
import { packTimetable } from '../shared/transit/pack.js';
const out = 'web/transit'; fs.mkdirSync(out, { recursive: true });
const index = [];
for (const tt of loadFeedsDir('server/transit/feeds')) {
  if (tt.error) { console.error(`skip ${tt.id}: ${tt.error}`); continue; }
  const json = JSON.stringify(packTimetable(tt));
  fs.writeFileSync(`${out}/${tt.id}.json`, json);
  const lats = tt.stops.map((s) => s.lat), lngs = tt.stops.map((s) => s.lng);
  index.push({ id: tt.id, name: tt.name, attribution: tt.attribution, valid: tt.valid, bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], file: `${tt.id}.json`, bytes: json.length, stops: tt.stops.length, routes: tt.routes.length });
  console.log(`${tt.id}: ${tt.stops.length} stops, ${tt.patterns.length} patterns, ${(json.length / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(`${out}/index.json`, `${JSON.stringify({ feeds: index, note: 'Scheduled times from GTFS, not live.' }, null, 1)}\n`);
