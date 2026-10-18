// Adapters for external open services, each with timeout, cache and graceful fallback.
// Public demo servers (router.project-osrm.org, nominatim.openstreetmap.org, overpass-api.de)
// have strict usage policies: OK for development only. Self-host for production (docs/DEPLOYMENT.md).
import { fallbackRoute } from '../../shared/geo.js';

const UA = process.env.HTTP_USER_AGENT || 'BharatMap-MVP/0.1 (dev; contact: set HTTP_USER_AGENT)';
const cache = new Map();
const CACHE_MAX = 2000;
function cacheGet(k) { const v = cache.get(k); if (v && v.exp > Date.now()) return v.val; cache.delete(k); return undefined; }
function cacheSet(k, val, ttlMs) { if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); cache.set(k, { val, exp: Date.now() + ttlMs }); }

async function fetchJson(url, { timeoutMs = 6000, method = 'GET', body } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method, body, signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export const externalEnabled = () => process.env.OFFLINE !== '1';

// profile: driving | bike | truck. OSRM demo only serves car; truck/bike use speed factors
// until a self-hosted Valhalla/GraphHopper with truck costing is configured (VALHALLA_URL).
export async function route(from, to, profile = 'driving') {
  const key = `route:${profile}:${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  const hit = cacheGet(key); if (hit) return hit;
  const speed = { driving: 1, bike: 0.9, truck: 1.45 }[profile] || 1;
  if (externalEnabled()) {
    try {
      const base = process.env.OSRM_URL || 'https://router.project-osrm.org';
      const j = await fetchJson(`${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`);
      const r0 = j.routes?.[0];
      if (r0) {
        const out = { engine: process.env.OSRM_URL ? 'osrm-selfhosted' : 'osrm-public-demo', profile, distance_m: Math.round(r0.distance), duration_s: Math.round(r0.duration * speed), geometry: r0.geometry, truck_restrictions_applied: false };
        cacheSet(key, out, 10 * 60_000);
        return out;
      }
    } catch (e) { /* fall through */ }
  }
  const fb = { ...fallbackRoute(from, to, profile === 'truck' ? 18 : 22), profile };
  return fb;
}

export async function geocodeExternal(q) {
  if (!externalEnabled()) return [];
  const key = `geo:${q.toLowerCase()}`;
  const hit = cacheGet(key); if (hit) return hit;
  try {
    const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
    const j = await fetchJson(`${base}/search?format=jsonv2&countrycodes=in&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`);
    const out = j.map((r) => ({ name: r.display_name, lat: +r.lat, lng: +r.lon, type: r.type, source: 'nominatim', confidence: Math.min(0.9, (r.importance || 0.3) + 0.3) }));
    cacheSet(key, out, 24 * 3600_000);
    return out;
  } catch { return []; }
}

// Live OSM data for EV chargers / parking / fuel near a point via Overpass.
export async function overpassNearby(kind, p, radiusM = 4000) {
  if (!externalEnabled()) return [];
  const tag = { ev: 'amenity=charging_station', parking: 'amenity=parking', fuel: 'amenity=fuel', bus: 'highway=bus_stop' }[kind];
  if (!tag) return [];
  const key = `ovp:${kind}:${p.lat.toFixed(3)},${p.lng.toFixed(3)}:${radiusM}`;
  const hit = cacheGet(key); if (hit) return hit;
  const [k, v] = tag.split('=');
  const ql = `[out:json][timeout:10];nwr["${k}"="${v}"](around:${radiusM},${p.lat},${p.lng});out center 25;`;
  try {
    const base = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
    const j = await fetchJson(base, { method: 'POST', body: `data=${encodeURIComponent(ql)}`, timeoutMs: 12000 });
    const out = (j.elements || []).map((e) => ({ id: `osm:${e.type}/${e.id}`, kind, name: e.tags?.name || e.tags?.operator || `${kind} (OSM)`, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, meta: e.tags?.socket ? undefined : (e.tags?.fee ? `fee: ${e.tags.fee}` : undefined), source: 'openstreetmap (ODbL)' })).filter((x) => x.lat);
    cacheSet(key, out, 6 * 3600_000);
    return out;
  } catch { return []; }
}

// Optional LLM layer (OpenAI-compatible). Only used to re-phrase / extract intent when configured.
export async function llmRewrite(query) {
  const url = process.env.LLM_BASE_URL, key = process.env.LLM_API_KEY;
  if (!url || !key) return null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.LLM_MODEL || 'gpt-4o-mini', temperature: 0, messages: [
        { role: 'system', content: 'Rewrite the user\'s map/shopping request (any Indian language) into a short English search query for an Indian local marketplace. Keep sizes, prices (as "under N"), places, and words like near me, wholesale, cheapest, verified. Output only the query.' },
        { role: 'user', content: String(query).slice(0, 500) }] }),
    });
    clearTimeout(t);
    const j = await r.json();
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}
