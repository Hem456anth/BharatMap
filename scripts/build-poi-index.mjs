// Builds the bundled offline place index (web/offline/pois/<region>.json) from the bundled PMTiles regions.
// Every entry is a real named feature from the OpenStreetMap-derived Protomaps tiles (layers "pois" and "places"),
// read at the region's max zoom, de-duplicated by name + kind + ~100 m cell. No network access needed.
//   node scripts/build-poi-index.mjs            all regions in web/offline/regions.json
//   node scripts/build-poi-index.mjs vizag      one region
// Output row: [name, kind, lat, lng, name_hi, name_te, layer]   (layer: 0 = poi, 1 = place)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';

class NodeFileSource {
  constructor(path) { this.path = path; this.fd = fs.openSync(path, 'r'); }
  getKey() { return this.path; }
  async getBytes(offset, length) { const b = Buffer.alloc(length); fs.readSync(this.fd, b, 0, length, offset); return { data: b.buffer.slice(b.byteOffset, b.byteOffset + length) }; }
}
const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };
const SKIP_KINDS = new Set(['building', 'address', 'neighbourhood_unknown']);

const meta = JSON.parse(fs.readFileSync('web/offline/regions.json', 'utf8'));
const want = process.argv.slice(2);
fs.mkdirSync('web/offline/pois', { recursive: true });
const summary = {};
for (const [id, r] of Object.entries(meta.regions)) {
  if (want.length && !want.includes(id)) continue;
  const pm = new PMTiles(new NodeFileSource(`web/offline/${r.file}`));
  const h = await pm.getHeader();
  const z = h.maxZoom;
  const [w, s, e, n] = r.bbox;
  const rows = new Map();
  for (let x = lon2x(w, z); x <= lon2x(e, z); x++) {
    for (let y = lat2y(n, z); y <= lat2y(s, z); y++) {
      const t = await pm.getZxy(z, x, y);
      if (!t?.data) continue;
      let buf = Buffer.from(t.data);
      if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
      const vt = new VectorTile(new Pbf(buf));
      for (const [layer, li] of [['pois', 0], ['places', 1]]) {
        const L = vt.layers[layer]; if (!L) continue;
        for (let i = 0; i < L.length; i++) {
          const f = L.feature(i); const p = f.properties;
          if (!p.name || SKIP_KINDS.has(p.kind)) continue;
          const gj = f.toGeoJSON(x, y, z); let c = gj.geometry.coordinates;
          if (gj.geometry.type !== 'Point') { const flat = JSON.stringify(c).match(/-?\d+\.?\d*/g).map(Number); let sx = 0, sy = 0, k = 0; for (let j = 0; j < flat.length; j += 2) { sx += flat[j]; sy += flat[j + 1]; k++; } c = [sx / k, sy / k]; }
          const [lng, lat] = c;
          if (lng < w || lng > e || lat < s || lat > n) continue;
          const key = `${p.name}|${p.kind}|${lat.toFixed(3)},${lng.toFixed(3)}`;
          if (rows.has(key)) continue;
          rows.set(key, [String(p.name), String(p.kind || ''), Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5, p['name:hi'] || '', p['name:te'] || '', li]);
        }
      }
    }
  }
  const out = { region: id, name: r.name, source: `${meta.source}; layers pois+places at z${z}`, attribution: '© OpenStreetMap contributors (ODbL) · Protomaps', fields: ['name', 'kind', 'lat', 'lng', 'name_hi', 'name_te', 'layer'], rows: [...rows.values()] };
  fs.writeFileSync(`web/offline/pois/${id}.json`, JSON.stringify(out));
  summary[id] = out.rows.length;
  console.log(id, out.rows.length, 'places', `${(fs.statSync(`web/offline/pois/${id}.json`).size / 1e6).toFixed(2)} MB`);
}
