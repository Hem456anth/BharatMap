// Offline maps: vector tiles for the pilot cities ship inside the app as PMTiles archives
// (OpenStreetMap data via Protomaps, ODbL), with fonts and sprites bundled, so the map
// renders with no network at all. The whole archive is read into memory once (4–9 MB),
// which avoids relying on HTTP Range support in the Android WebView's asset server.
import { PMTiles, FileSource, Protocol, layers, namedFlavor } from './vendor/offline-deps.mjs';

let protocol = null; const loaded = new Map(); let regions = null;
const base = () => location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');

export async function offlineRegions() {
  if (!regions) regions = await (await fetch('offline/regions.json')).json();
  return regions;
}
export async function offlineStyle(maplibregl, city, lang = 'en', flavor = 'light') {
  const meta = await offlineRegions();
  const region = meta.regions[city];
  if (!region) throw new Error(`no_offline_region:${city}`);
  if (!protocol) { protocol = new Protocol(); maplibregl.addProtocol('pmtiles', protocol.tile); }
  if (!loaded.has(region.file)) {
    const r = await fetch(`offline/${region.file}`);
    if (!r.ok) throw new Error(`offline_region_missing:${region.file}`);
    const file = new File([await r.blob()], region.file);
    const archive = new PMTiles(new FileSource(file));
    protocol.add(archive); loaded.set(region.file, archive);
  }
  // Protomaps flavour supports en/hi (+ others); Indic scripts without a flavour fall back to the default name.
  const supported = ['en', 'hi', 'mr', 'ne', 'ur'];
  return {
    version: 8,
    glyphs: `${base()}offline/fonts/{fontstack}/{range}.pbf`,
    sprite: `${base()}offline/sprites/${flavor === 'dark' ? 'dark' : 'light'}`,
    sources: { protomaps: { type: 'vector', url: `pmtiles://${region.file}`, attribution: meta.attribution } },
    layers: layers('protomaps', namedFlavor(flavor === 'dark' ? 'dark' : 'light'), { lang: supported.includes(lang) ? lang : 'en' }),
  };
}
export function insideRegion(meta, city, p) {
  const b = meta?.regions?.[city]?.bbox; if (!b || !p) return false;
  return p.lng >= b[0] && p.lat >= b[1] && p.lng <= b[2] && p.lat <= b[3];
}
