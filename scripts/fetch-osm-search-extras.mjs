// Fetches the OpenStreetMap extras that the offline search index v2 needs and that the bundled PMTiles do not carry:
//   1. native-script names (name:te, name:hi, plus name:ta/kn/ml/mr/bn/gu/pa/or) of named features in each bundled region
//   2. pincode centroids: the median position of every feature tagged addr:postcode / postal_code in the region
// Output (committed, so the build is reproducible without network): scripts/search-data/osm-extras/<region>.json
// Source: Overpass API (OpenStreetMap data © OpenStreetMap contributors, ODbL). Run occasionally, not in CI:
//   node scripts/fetch-osm-search-extras.mjs            all regions in web/offline/regions.json
//   node scripts/fetch-osm-search-extras.mjs vizag      one region
//   OVERPASS=https://overpass.private.coffee/api/interpreter node scripts/fetch-osm-search-extras.mjs
import fs from 'node:fs';

const OVERPASS = (process.env.OVERPASS || 'https://overpass.private.coffee/api/interpreter,https://overpass-api.de/api/interpreter').split(',');
const LANGS = ['te', 'hi', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or'];
const meta = JSON.parse(fs.readFileSync('web/offline/regions.json', 'utf8'));
const want = process.argv.slice(2);
fs.mkdirSync('scripts/search-data/osm-extras', { recursive: true });

async function overpass(q) {
  let last;
  for (const url of OVERPASS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'BharatMap-build/0.5 (offline search index)' }, signal: AbortSignal.timeout(200_000) });
        const txt = await r.text();
        if (!r.ok) throw new Error(`${r.status} ${txt.slice(0, 80)}`);
        return txt;
      } catch (e) { last = e; await new Promise((res) => setTimeout(res, 3000)); }
    }
  }
  throw last;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

for (const [id, r] of Object.entries(meta.regions)) {
  if (want.length && !want.includes(id)) continue;
  const [w, s, e, n] = r.bbox; const bb = `${s},${w},${n},${e}`;
  const t0 = Date.now();
  // 1. native-script names
  const nameQ = `[out:json][timeout:180];(${LANGS.map((l) => `nwr["name:${l}"](${bb});`).join('')});out center tags qt;`;
  const nj = JSON.parse(await overpass(nameQ));
  const names = [];
  for (const el of nj.elements || []) {
    const tg = el.tags || {}; const lat = el.lat ?? el.center?.lat; const lng = el.lon ?? el.center?.lon;
    if (lat == null) continue;
    const kind = tg.place || tg.amenity || tg.tourism || tg.railway || tg.highway || tg.leisure || tg.shop || tg.historic || tg.building || tg.boundary || tg.natural || tg.landuse || '';
    const row = { name: tg.name || tg['name:en'] || '', en: tg['name:en'] || '', kind, lat: +lat.toFixed(5), lng: +lng.toFixed(5), osm: `${el.type[0]}${el.id}` };
    for (const l of LANGS) if (tg[`name:${l}`]) row[l] = tg[`name:${l}`];
    if (tg.alt_name) row.alt = tg.alt_name;
    if (tg.postal_code || tg['addr:postcode']) row.pin = tg.postal_code || tg['addr:postcode'];
    names.push(row);
  }
  // 2. pincodes (CSV keeps the response small)
  const pinQ = `[out:csv(::lat,::lon,"addr:postcode","postal_code";false;"|")][timeout:180];(nwr["addr:postcode"](${bb});nwr["postal_code"](${bb}););out center qt;`;
  const csv = await overpass(pinQ);
  const byPin = new Map();
  for (const line of csv.split('\n')) {
    const [lat, lng, a, b] = line.split('|');
    const pin = String(a || b || '').replace(/\s+/g, '').trim();
    if (!/^[1-9]\d{5}$/.test(pin) || !lat) continue;
    if (!byPin.has(pin)) byPin.set(pin, { lat: [], lng: [] });
    byPin.get(pin).lat.push(+lat); byPin.get(pin).lng.push(+lng);
  }
  const pincodes = [...byPin].map(([pin, v]) => [pin, +median(v.lat).toFixed(5), +median(v.lng).toFixed(5), v.lat.length]).sort((x, y) => x[0].localeCompare(y[0]));
  fs.writeFileSync(`scripts/search-data/osm-extras/${id}.json`, JSON.stringify({ region: id, source: 'OpenStreetMap via Overpass API', attribution: '© OpenStreetMap contributors (ODbL)', fetched: new Date().toISOString(), names, pincodes }));
  console.log(`${id}: ${names.length} native-script names, ${pincodes.length} pincodes (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
