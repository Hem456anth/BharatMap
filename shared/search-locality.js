// v0.7.20 (G2) locality-aware search over the offline index (pure; shared by the app and the server).
// Indian queries name a place AND where it is: "Al-Shifa Hospital, Perinthalmanna", "Apollo Hospitals, Jubilee Hills",
// "Apollo hospital koramangala". The plain token search (shared/search-index.js) needs every word in the place's own
// name, so the locality either kills the match or is ignored and every same-named place in India comes back
// (Organic Maps #10566, OsmAnd #16127 — re-staging/competitor-2026-11/GAPS_RANKED.md G2).
//
// Here the query is split into a NAME part and LOCALITY context:
//   • comma form  "name, locality[, city][, state]"  — every part after the first is context;
//   • tail form   "name locality"                    — the last 1–2 words are tried as a locality, used only when they
//                                                      resolve to a locality row AND a name match lies inside it.
// Context parts are resolved (most general first) against index rows of kind city/town/village/suburb/neighbourhood/
// locality/quarter/hamlet (exact fold, phonetic key or edit distance 1), state / country names are ignored and a
// 6-digit PIN resolves to its centroid. Name matches are then re-ranked by distance to the locality: inside its radius
// a strong boost, outside a penalty growing with distance. A place whose own name carries the locality gets a bonus.
import { searchOffline, lookupPincode, lookupDigipin, kindWeight, PIN_RE } from './search-index.js';
import { latinFold, phoneticKey } from './translit.js';

export const LOCALITY_KINDS = new Set(['city', 'town', 'village', 'suburb', 'neighbourhood', 'locality', 'quarter', 'hamlet', 'borough', 'postcode']);
/** Search radius (km) around a resolved locality, by kind. */
export const LOCALITY_RADIUS_KM = { city: 15, town: 8, borough: 6, village: 4, suburb: 4, locality: 3, neighbourhood: 2.5, quarter: 2.5, hamlet: 2, postcode: 4 };
// Context words that never narrow the search (states / UTs / country) — ignored instead of failing the query.
export const IGNORED_CONTEXT = new Set(['india', 'bharat', 'andhra pradesh', 'ap', 'telangana', 'ts', 'kerala', 'karnataka', 'tamil nadu', 'tn', 'maharashtra', 'delhi ncr',
  'west bengal', 'wb', 'gujarat', 'rajasthan', 'punjab', 'haryana', 'uttar pradesh', 'up', 'madhya pradesh', 'mp', 'bihar', 'odisha', 'orissa', 'goa', 'assam', 'jharkhand',
  'chhattisgarh', 'uttarakhand', 'himachal pradesh', 'jammu and kashmir', 'ladakh', 'puducherry', 'pondicherry', 'chandigarh', 'sikkim', 'tripura', 'meghalaya', 'manipur',
  'mizoram', 'nagaland', 'arunachal pradesh', 'district', 'dist', 'mandal']);

/** Optimal-string-alignment edit distance with an early exit above `max` (returns max + 1). */
export function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v); rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

/** Split a query into { name, context: [most specific … most general], form: 'comma'|'none' }. */
export function parseLocalityQuery(raw) {
  const s = String(raw || '').trim();
  if (!s.includes(',')) return { name: s, context: [], form: 'none' };
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  const [name, ...rest] = parts;
  const context = rest.filter((p) => PIN_RE.test(p.replace(/\s+/g, '')) || !IGNORED_CONTEXT.has(latinFold(p)));
  return { name: name || '', context, form: 'comma' };
}

const km = (a, b) => { const d2r = Math.PI / 180; const x = (b.lng - a.lng) * d2r * Math.cos(((a.lat + b.lat) / 2) * d2r); const y = (b.lat - a.lat) * d2r; return Math.hypot(x, y) * 6371; };

/** How well a locality row's name matches the context text: 3 exact · 2 phonetic · 1 edit distance 1 · 0 none. */
function nameMatch(rowName, ctxFold) {
  const f = latinFold(rowName);
  if (f === ctxFold) return 3;
  if (f.replace(/ /g, '') === ctxFold.replace(/ /g, '')) return 3;
  if (phoneticKey(f.replace(/ /g, '')) === phoneticKey(ctxFold.replace(/ /g, ''))) return 2;
  if (ctxFold.length >= 5 && editDistance(f, ctxFold, 1) <= 1) return 1;
  return 0;
}

/** Resolve one context string to a locality { name, kind, lat, lng, radius_km, match } (or null). anchor = a point to prefer. */
export function resolveLocality(ix, text, { anchor = null } = {}) {
  const t = String(text || '').trim(); if (!t) return null;
  const pin = t.replace(/\s+/g, '');
  if (PIN_RE.test(pin)) { const p = lookupPincode(ix, pin); return p ? { name: p.name, kind: 'postcode', lat: p.lat, lng: p.lng, radius_km: LOCALITY_RADIUS_KM.postcode, match: 3 } : null; }
  const fold = latinFold(t); if (fold.length < 3) return null;
  const hits = searchOffline(ix, t, { limit: 60 }).filter((h) => LOCALITY_KINDS.has(h.kind));
  let best = null;
  for (const h of hits) {
    const m = nameMatch(h.name, fold); if (!m) continue;
    const d = anchor ? km(anchor, h) : 0;
    const score = m * 10 + kindWeight(h.kind) * 2 - (anchor ? Math.min(25, d / 4) : 0);
    if (!best || score > best.score) best = { name: h.name, kind: h.kind, lat: h.lat, lng: h.lng, radius_km: LOCALITY_RADIUS_KM[h.kind] || 4, match: m, score };
  }
  if (!best) return null;
  delete best.score; return best;
}

/** Resolve all context parts, most general first, each anchoring the next. Returns the most specific locality or null. */
export function resolveContext(ix, context, { near = null } = {}) {
  let anchor = near, found = null, unresolved = [];
  for (const part of [...context].reverse()) {
    const loc = resolveLocality(ix, part, { anchor });
    if (loc) { found = loc; anchor = loc; } else unresolved.push(part);
  }
  return found ? { ...found, unresolved } : null;
}

/** Re-rank name matches around a locality. */
function rankAround(results, loc, { near = null, limit = 8 } = {}) {
  const locFold = latinFold(loc.name);
  const scored = results.map((r) => {
    const d = km(loc, r); const rad = loc.radius_km;
    let boost = d <= rad ? 6 + 10 * Math.exp(-d / Math.min(2, rad / 3)) : -Math.min(12, (d / rad) * 1.5); // closest to the locality wins
    if (locFold.length >= 4 && latinFold(r.name).includes(locFold)) boost += 3; // "Apollo Hospitals, Tondiarpet"
    return { ...r, score: +(r.score + boost).toFixed(2), locality_km: +d.toFixed(2), inside: d <= rad,
      distance_m: near ? Math.round(km(near, r) * 1000) : r.distance_m };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Locality-aware search: { results, locality } where locality = { name, kind, radius_km, form, unresolved } or null.
 * Without a usable locality it is exactly searchOffline (same ranking as before).
 */
export function searchWithLocality(ix, query, { near = null, limit = 8 } = {}) {
  const raw = String(query || '').trim();
  if (!ix || raw.length < 2) return { results: [], locality: null };
  if (lookupDigipin(raw) || PIN_RE.test(raw.replace(/\s+/g, ''))) return { results: searchOffline(ix, raw, { near, limit }), locality: null };
  const p = parseLocalityQuery(raw);
  if (p.form === 'comma' && p.name.length >= 2) {
    const loc = p.context.length ? resolveContext(ix, p.context, { near }) : null;
    if (!loc) return { results: searchOffline(ix, p.name, { near, limit }), locality: null, ignored: p.context };
    const pool = searchOffline(ix, p.name, { near: loc, limit: 300, cap: 12000 }).filter((r) => r.kind !== 'digipin' && r.kind !== 'postcode');
    return { results: rankAround(pool, loc, { near, limit }), locality: { name: loc.name, kind: loc.kind, radius_km: loc.radius_km, form: 'comma', unresolved: loc.unresolved } };
  }
  // Tail form: "apollo hospital koramangala" — try the last 2, then the last 1 word(s) as the locality.
  const plain = searchOffline(ix, raw, { near, limit });
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && !/,/.test(raw)) {
    for (const n of [2, 1]) {
      if (words.length - n < 1) continue;
      const ctxText = words.slice(-n).join(' '); const name = words.slice(0, -n).join(' ');
      if (latinFold(ctxText).length < 4 || latinFold(name).length < 2) continue;
      const loc = resolveLocality(ix, ctxText, { anchor: near });
      if (!loc || loc.match < 2) continue; // tail form needs an exact/phonetic locality name
      const pool = searchOffline(ix, name, { near: loc, limit: 300, cap: 12000 }).filter((r) => r.kind !== 'digipin' && r.kind !== 'postcode');
      const ranked = rankAround(pool, loc, { near, limit });
      if (!ranked.length || (plain.length && !ranked.some((r) => r.inside))) continue; // no plain match at all → the locality reading is the only one
      // Keep exact whole-query matches (a place literally named "… Koramangala") ahead of the re-ranked list.
      const keep = plain.filter((r) => latinFold(r.name) === latinFold(raw));
      const seen = new Set(keep.map((r) => r.id));
      return { results: [...keep, ...ranked.filter((r) => !seen.has(r.id))].slice(0, limit), locality: { name: loc.name, kind: loc.kind, radius_km: loc.radius_km, form: 'tail', unresolved: [] } };
    }
  }
  return { results: plain, locality: null };
}

/** Same contract as searchOffline (array of results), locality-aware. */
export function searchOfflineSmart(ix, query, opts = {}) { return searchWithLocality(ix, query, opts).results; }
