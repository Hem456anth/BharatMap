// Builds offline search index v2 from data already in the repo (no network):
//   web/offline/pois/<region>.json            bundled place index (real OSM names from the bundled PMTiles)
//   scripts/search-data/osm-extras/<region>.json     OSM native-script names + pincode centroids (scripts/fetch-osm-search-extras.mjs)
// Outputs:
//   web/offline/search/index.json   compact token index for the app/WebView (shared/search-index.js) — offline in the APK
//   data/search.db                  SQLite FTS5 table for the server (node:sqlite) when FTS5 is available
// Run: node scripts/build-search-index.mjs
import fs from 'node:fs';
import { buildSearchIndex, kindWeight } from '../shared/search-index.js';
import { latinFold } from '../shared/translit.js';
import { buildFtsDb } from '../server/lib/search-fts.js';

const meta = JSON.parse(fs.readFileSync('web/offline/regions.json', 'utf8'));
const regions = Object.keys(meta.regions);
const places = []; const pins = [];
const near = (a, b, m) => Math.abs(a.lat - b.lat) * 111000 < m && Math.abs(a.lng - b.lng) * 106000 < m;
let enriched = 0, added = 0;
for (const id of regions) {
  const f = `web/offline/pois/${id}.json`;
  if (!fs.existsSync(f)) continue;
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')).rows;
  const start = places.length;
  for (const r of rows) {
    const names = {}; if (r[4]) names.hi = r[4]; if (r[5]) names.te = r[5];
    places.push({ name: r[0], kind: r[1], lat: r[2], lng: r[3], region: id, names });
  }
  // bucket for merging extras by folded name
  const byName = new Map();
  for (let i = start; i < places.length; i++) { const k = latinFold(places[i].name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(places[i]); }
  const xf = `scripts/search-data/osm-extras/${id}.json`;
  if (!fs.existsSync(xf)) continue;
  const x = JSON.parse(fs.readFileSync(xf, 'utf8'));
  const seenExtra = new Set();
  for (const e of x.names) {
    if (!e.name) continue;
    const nat = Object.fromEntries(Object.entries(e).filter(([k]) => /^(te|hi|ta|kn|ml|mr|bn|gu|pa|or)$/.test(k)));
    const keys = [latinFold(e.name), e.en ? latinFold(e.en) : null, e.alt ? latinFold(e.alt) : null].filter(Boolean);
    const match = keys.flatMap((k) => byName.get(k) || []).find((p) => near(p, e, 400));
    if (match) { Object.assign(match.names, nat); if (e.kind && kindWeight(e.kind) > kindWeight(match.kind) && /^(suburb|city|town|village|locality|quarter|neighbourhood)$/.test(e.kind)) match.kind = e.kind; if (e.alt && !match.alt) match.alt = e.alt.split(';')[0]; enriched++; continue; }
    const dk = `${latinFold(e.name)}|${Math.round(e.lat * 300)}|${Math.round(e.lng * 300)}`;
    if (seenExtra.has(dk)) continue; seenExtra.add(dk);
    const p = { name: e.name.split(';')[0], kind: e.kind || 'place', lat: e.lat, lng: e.lng, region: id, names: nat, alt: e.alt ? e.alt.split(';')[0] : undefined };
    places.push(p); added++;
    const k = latinFold(p.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p);
  }
  for (const [pin, lat, lng, n] of x.pincodes || []) pins.push([pin, lat, lng, n, regions.indexOf(id)]);
}
const ix = buildSearchIndex(places, pins, { regions, built: new Date().toISOString().slice(0, 10) });
ix.regionNames = regions.map((r) => meta.regions[r].name);
fs.mkdirSync('web/offline/search', { recursive: true });
const json = JSON.stringify(ix);
fs.writeFileSync('web/offline/search/index.json', json);
const withNative = places.filter((p) => Object.keys(p.names).length).length;
console.log(`index v2: ${places.length} places (${withNative} with native-script names; ${enriched} enriched, ${added} added from OSM), ${pins.length} pincodes, ${ix.keys.length} tokens, ${(json.length / 1048576).toFixed(2)} MB`);
try {
  fs.mkdirSync('data', { recursive: true });
  const r = buildFtsDb(ix, 'data/search.db');
  console.log(`data/search.db: FTS5 ${r.rows} rows, ${(fs.statSync('data/search.db').size / 1048576).toFixed(2)} MB`);
} catch (e) { console.log(`FTS5 db skipped: ${e.message}`); }
