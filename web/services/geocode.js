// Geocoding: local first (seed landmarks/localities, pincodes, DIGIPIN — no network),
// then Photon (type-ahead) and Nominatim (search + reverse) for everything else.
// Policies: https://operations.osmfoundation.org/policies/nominatim/ (max 1 req/s, no bulk, cache results)
//           https://photon.komoot.io (fair use; debounce type-ahead)
// Only the typed text or the tapped coordinate is sent; never account data.
import { fetchJSON } from './net.js';
import { searchPlaces } from '../shared/search.js';
import { parseIndianAddress } from '../shared/address.js';
import { BUSINESSES } from '../shared/seed.js';
import { haversineKm } from '../shared/geo.js';
import { useServer, v1 } from './server.js';

export const NOMINATIM = 'https://nominatim.openstreetmap.org';
export const PHOTON = 'https://photon.komoot.io';
const INDIA_BBOX = '68.0,6.4,97.5,37.6';

/** Pure: saved places (Home, Work, every list) whose name or address matches — works fully offline (v0.4). */
export function savedResolve(q, saved) {
  const lq = String(q || '').trim().toLowerCase();
  if (lq.length < 2 || !saved) return [];
  const all = [saved.home && { ...saved.home, _sc: 'home' }, saved.work && { ...saved.work, _sc: 'work' }, ...(saved.lists || []).flatMap((l) => l.items || [])].filter(Boolean);
  const seen = new Set(); const out = [];
  for (const p of all) {
    if (!Number.isFinite(p.lat) || seen.has(p.id)) continue;
    const hay = `${p.name || ''} ${p.address || ''} ${p._sc || ''}`.toLowerCase();
    if (hay.includes(lq)) { seen.add(p.id); out.push({ ...p, id: p.id || `saved:${p.lat},${p.lng}`, source: 'saved', kind: 'saved' }); }
  }
  return out;
}

/** Local resolver (offline): saved places, seed landmarks/localities, demo sellers, pincode, DIGIPIN. */
export function localResolve(q, { city, origin, businesses = BUSINESSES, saved = null } = {}) {
  const s = String(q || '').trim();
  if (s.length < 2) return [];
  const out = [...savedResolve(s, saved)];
  for (const p of searchPlaces(s, undefined)) {
    out.push({ id: `local:${p.kind}:${p.name}`, source: 'local', kind: p.kind, name: p.name, lat: p.lat, lng: p.lng, address: [p.pincode, p.city === 'vizag' ? 'Visakhapatnam' : 'Hyderabad'].filter(Boolean).join(' · '), city: p.city });
  }
  const lq = s.toLowerCase();
  for (const b of businesses) {
    if (b.name.toLowerCase().includes(lq)) out.push({ id: `seller:${b.id}`, source: 'seller', kind: 'seller', seller_id: b.id, name: b.name, lat: b.lat, lng: b.lng, address: b.address, city: b.city, tags: { phone: b.phone, opening_hours: hoursToOsm(b.hours) } });
  }
  if (!out.length) {
    const a = parseIndianAddress(s);
    if (a.best && a.best.confidence >= 0.6) out.push({ id: `local:addr:${s}`, source: 'local', kind: a.best.source, name: s, lat: a.best.lat, lng: a.best.lng, address: Object.values(a.components || {}).join(', '), confidence: a.best.confidence });
  }
  // Prefer the current city, then nearest.
  return out.map((x) => ({ ...x, distance_m: origin ? Math.round(haversineKm(origin, x) * 1000) : null }))
    .sort((a, b) => (b.city === city) - (a.city === city) || (a.distance_m ?? 0) - (b.distance_m ?? 0)).slice(0, 8);
}
// Seed hours are "10:00-21:30" (every day) → OSM syntax "Mo-Su 10:00-21:30".
export function hoursToOsm(h) { return /^\d\d:\d\d-\d\d:\d\d$/.test(h || '') ? `Mo-Su ${h}` : h || ''; }

const photonLang = (l) => (['en', 'de', 'fr', 'it'].includes(l) ? l : 'en');
/** Pure: Photon autocomplete URL biased to a location and limited to India. */
export function photonUrl(q, { lat, lng, lang = 'en', limit = 6 } = {}) {
  const p = new URLSearchParams({ q: String(q).slice(0, 200), limit: String(limit), lang: photonLang(lang), bbox: INDIA_BBOX });
  if (Number.isFinite(lat) && Number.isFinite(lng)) { p.set('lat', lat.toFixed(4)); p.set('lon', lng.toFixed(4)); }
  return `${PHOTON}/api/?${p}`;
}
export function parsePhoton(json, origin) {
  return (json?.features || []).map((f) => {
    const pr = f.properties || {}; const [lng, lat] = f.geometry?.coordinates || [];
    const addr = [pr.housenumber, pr.street, pr.district || pr.locality, pr.city, pr.state, pr.postcode].filter(Boolean);
    return { id: `osm:${({ N: 'node', W: 'way', R: 'relation' })[pr.osm_type] || 'node'}/${pr.osm_id}`, source: 'photon', kind: pr.osm_value || pr.type || 'place', osm_key: pr.osm_key, name: pr.name || addr.slice(0, 2).join(' '), lat, lng, address: [...new Set(addr)].join(', '), distance_m: origin && Number.isFinite(lat) ? Math.round(haversineKm(origin, { lat, lng }) * 1000) : null };
  }).filter((x) => Number.isFinite(x.lat) && x.name);
}
export async function photonSearch(q, opts = {}) {
  if (useServer()) {
    try {
      const qs = new URLSearchParams({ q, autocomplete: '1', lang: opts.lang || 'en', ...(Number.isFinite(opts.lat) ? { lat: opts.lat.toFixed(4), lng: opts.lng.toFixed(4) } : {}) });
      return (await v1(`/geocode?${qs}`, { timeout: 8000, ttl: 30 * 60_000, fetchImpl: opts.fetchImpl })).items || [];
    } catch { /* go direct */ }
  }
  const json = await fetchJSON(photonUrl(q, opts), { timeout: 8000, ttl: 30 * 60_000, fetchImpl: opts.fetchImpl });
  return parsePhoton(json, Number.isFinite(opts.lat) ? { lat: opts.lat, lng: opts.lng } : null);
}

export function nominatimSearchUrl(q, { lang = 'en', limit = 5, viewbox } = {}) {
  const p = new URLSearchParams({ format: 'jsonv2', q: String(q).slice(0, 200), countrycodes: 'in', limit: String(limit), addressdetails: '1', 'accept-language': `${lang},en` });
  if (viewbox) p.set('viewbox', viewbox);
  return `${NOMINATIM}/search?${p}`;
}
export function nominatimReverseUrl(lat, lng, { lang = 'en' } = {}) {
  const p = new URLSearchParams({ format: 'jsonv2', lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: '18', addressdetails: '1', extratags: '1', 'accept-language': `${lang},en` });
  return `${NOMINATIM}/reverse?${p}`;
}
export function parseNominatimItem(j) {
  if (!j || j.error || !j.lat) return null;
  const a = j.address || {};
  const name = j.name || a.amenity || a.shop || a.building || a.road || (j.display_name || '').split(',')[0];
  return {
    id: j.osm_type ? `osm:${j.osm_type}/${j.osm_id}` : `nominatim:${j.place_id}`, source: 'nominatim', kind: j.type || j.category || 'place', category_osm: j.category,
    name, lat: Number(j.lat), lng: Number(j.lon), address: j.display_name || '', tags: { ...(j.extratags || {}) },
  };
}
export async function nominatimSearch(q, opts = {}) {
  if (useServer()) {
    try { return (await v1(`/geocode?${new URLSearchParams({ q, lang: opts.lang || 'en' })}`, { timeout: 12000, ttl: 60 * 60_000, fetchImpl: opts.fetchImpl })).items || []; } catch { /* go direct */ }
  }
  const json = await fetchJSON(nominatimSearchUrl(q, opts), { timeout: 10000, ttl: 60 * 60_000, fetchImpl: opts.fetchImpl });
  return (Array.isArray(json) ? json : []).map(parseNominatimItem).filter(Boolean);
}
export async function reverseGeocode(lat, lng, opts = {}) {
  if (useServer()) {
    try { return (await v1(`/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&lang=${opts.lang || 'en'}`, { timeout: 12000, ttl: 60 * 60_000, fetchImpl: opts.fetchImpl })).item; } catch { /* go direct */ }
  }
  const json = await fetchJSON(nominatimReverseUrl(lat, lng, opts), { timeout: 10000, ttl: 60 * 60_000, fetchImpl: opts.fetchImpl });
  return parseNominatimItem(json);
}

/** Full geocode for a submitted query: local → Nominatim. */
export async function geocode(q, opts = {}) {
  const local = localResolve(q, opts);
  if (local.length) return { source: 'local', items: local };
  try { return { source: 'nominatim', items: await nominatimSearch(q, opts) }; } catch (e) { return { source: 'none', items: [], error: e.message }; }
}
