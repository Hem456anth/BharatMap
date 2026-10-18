// Real points of interest from OpenStreetMap via the Overpass API (ODbL).
// Usage policy: https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
//  - queries are debounced by the caller and de-duplicated/cached here (10 min, rounded bbox)
//  - the bounding box is clamped (max ~8 km across) so a query never scans a whole city
//  - server-side timeout 20 s, client timeout 25 s, result count capped
import { fetchJSON } from './net.js';
import { haversineKm } from '../shared/geo.js';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Category -> OSM tag selectors. Each selector is an Overpass "nwr" filter.
export const POI_CATEGORIES = [
  { id: 'fuel', icon: 'fuel', sel: ['["amenity"="fuel"]'] },
  { id: 'ev', icon: 'ev', sel: ['["amenity"="charging_station"]'] },
  { id: 'atm', icon: 'atm', sel: ['["amenity"="atm"]', '["amenity"="bank"]["atm"="yes"]'] },
  { id: 'metro', icon: 'metro', sel: ['["railway"="station"]["station"~"^(subway|light_rail|monorail)$"]', '["public_transport"="station"]["subway"="yes"]'] },
  { id: 'bus', icon: 'bus', sel: ['["highway"="bus_stop"]', '["amenity"="bus_station"]'] },
  { id: 'rail', icon: 'rail', sel: ['["railway"~"^(station|halt)$"]["station"!~"^(subway|light_rail|monorail)$"]'] },
  { id: 'hospital', icon: 'hospital', sel: ['["amenity"="hospital"]', '["healthcare"="hospital"]'] },
  { id: 'pharmacy', icon: 'pharmacy', sel: ['["amenity"="pharmacy"]'] },
  { id: 'restaurant', icon: 'restaurant', sel: ['["amenity"~"^(restaurant|fast_food)$"]'] },
  { id: 'grocery', icon: 'grocery', sel: ['["shop"~"^(supermarket|convenience|grocery|general)$"]'] },
  { id: 'parking', icon: 'parking', sel: ['["amenity"="parking"]'] },
  { id: 'toilets', icon: 'toilets', sel: ['["amenity"="toilets"]'] },
];
export const CATEGORY_BY_ID = Object.fromEntries(POI_CATEGORIES.map((c) => [c.id, c]));

const KM_PER_DEG_LAT = 110.574;
/** Clamp a bbox {s,w,n,e} to at most maxKm across, centred on `center`. */
export function clampBBox(center, bbox, maxKm = 8) {
  const halfLat = maxKm / 2 / KM_PER_DEG_LAT;
  const halfLng = maxKm / 2 / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const b = bbox || { s: -90, w: -180, n: 90, e: 180 };
  return {
    s: Math.max(b.s, center.lat - halfLat), n: Math.min(b.n, center.lat + halfLat),
    w: Math.max(b.w, center.lng - halfLng), e: Math.min(b.e, center.lng + halfLng),
  };
}
const r4 = (x) => Math.round(x * 1e4) / 1e4;

/** Build an Overpass QL query for one category inside a bbox. Pure (unit-tested). */
export function buildOverpassQuery(categoryId, bbox, { limit = 60, timeout = 20 } = {}) {
  const cat = CATEGORY_BY_ID[categoryId];
  if (!cat) throw new Error(`unknown_category:${categoryId}`);
  const { s, w, n, e } = bbox;
  if (![s, w, n, e].every(Number.isFinite) || s >= n || w >= e) throw new Error('invalid_bbox');
  const bb = `${r4(s)},${r4(w)},${r4(n)},${r4(e)}`;
  const lim = Math.max(1, Math.min(200, Math.floor(limit)));
  return `[out:json][timeout:${timeout}];(${cat.sel.map((f) => `nwr${f}(${bb});`).join('')});out center tags ${lim};`;
}

export function osmAddress(tags = {}) {
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:place'], tags['addr:suburb'], tags['addr:city'], tags['addr:postcode']].filter(Boolean);
  return [...new Set(parts)].join(', ') || tags['addr:full'] || '';
}

/** Convert an Overpass JSON response into place objects sorted by distance from origin. */
export function parseOverpass(json, categoryId, origin) {
  const out = [];
  const seen = new Set();
  for (const el of json?.elements || []) {
    const lat = el.lat ?? el.center?.lat; const lng = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const tags = el.tags || {};
    const id = `osm:${el.type}/${el.id}`;
    if (seen.has(id)) continue; seen.add(id);
    const name = tags.name || tags['name:en'] || tags.brand || tags.operator || '';
    out.push({
      id, source: 'osm', osm_type: el.type, osm_id: el.id, category: categoryId, name, names: pickNames(tags),
      lat, lng, tags, address: osmAddress(tags),
      distance_m: origin ? Math.round(haversineKm(origin, { lat, lng }) * 1000) : null,
    });
  }
  out.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0) || (b.name ? 1 : 0) - (a.name ? 1 : 0));
  return out;
}
function pickNames(tags) {
  const n = {};
  for (const k of Object.keys(tags)) if (k.startsWith('name:')) n[k.slice(5)] = tags[k];
  return n;
}

/** Fetch real POIs for a category around a centre (bbox clamped). */
export async function fetchPois(categoryId, center, viewBBox, { fetchImpl, limit = 60 } = {}) {
  const bbox = clampBBox(center, viewBBox);
  const q = buildOverpassQuery(categoryId, bbox, { limit });
  const json = await fetchJSON(OVERPASS_URL, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 25000, ttl: 10 * 60_000, fetchImpl });
  return { items: parseOverpass(json, categoryId, center), bbox, query: q, timestamp: json?.osm3s?.timestamp_osm_base || null };
}
