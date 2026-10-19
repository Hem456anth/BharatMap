// Offline search index v2 (pure; shared by the build script, the server and the app).
// One compact token index over every bundled place (all 11 offline regions), native-script names from OSM
// (name:te / name:hi / …), pincode centroids and DIGIPIN decoding. Works with no network in the APK.
//
// Token spaces (one sorted key array, prefixed so a binary-searched prefix scan stays in one space):
//   "l" + latin word    readable Latin (Indic names transliterated by shared/translit.js) — prefix matching
//   "n" + native word   the name as written (any script), lower-cased — prefix matching while typing in Telugu etc.
//   "p" + phonetic key  loose phonetic key per word and for the whole name joined ("Rushi Konda" = "Rushikonda")
// Postings are delta-encoded place ids. The server builds the same data into SQLite FTS5 (scripts/build-search-index.mjs).
import { latinFold, phoneticKey, hasIndic, toLatin } from './translit.js';
import { decodeDigipin } from './geo.js';

export const INDEX_VERSION = 2;
const KIND_WEIGHT = { aerodrome: 3, station: 2.5, bus_station: 2, attraction: 2.2, hospital: 2, university: 2, college: 1.6, stadium: 1.8, mall: 1.8, park: 1.4, place_of_worship: 1.6, beach: 2, museum: 2, zoo: 2, suburb: 2, neighbourhood: 1.5, locality: 1.4, quarter: 1.5, town: 2, city: 2.4, village: 1.2, peak: 1.4, bus_stop: 0.8, administrative: 0.6 };
export const kindWeight = (k) => KIND_WEIGHT[k] || 1;

const nativeWords = (s) => String(s || '').toLowerCase().normalize('NFC').split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
const latinWords = (s) => latinFold(s).split(' ').filter(Boolean);

/** All index tokens of one place (names = every variant: OSM name, name:en, alt_name, name:te, name:hi, …). */
export function placeTokens(names) {
  const toks = new Set();
  for (const nm of names) {
    if (!nm) continue;
    const lw = latinWords(nm);
    for (const w of lw) toks.add(`l${w}`);
    for (const w of lw) { const k = phoneticKey(w); if (k) toks.add(`p${k}`); }
    if (lw.length > 1 && lw.length <= 4) { const j = phoneticKey(lw.join('')); if (j) toks.add(`p${j}`); }
    if (hasIndic(nm)) for (const w of nativeWords(nm)) toks.add(`n${w}`);
  }
  return toks;
}

/**
 * Build the compact index. places: [{ name, kind, lat, lng, region, names: {te,hi,…}, alt, pin }]
 * pincodes: [[pin, lat, lng, count, region]]. Returns a JSON-serialisable object.
 */
export function buildSearchIndex(places, pincodes = [], { regions = [], built = null } = {}) {
  const tokMap = new Map();
  const rows = places.map((p, id) => {
    const names = [p.name, p.alt, ...Object.values(p.names || {})];
    for (const t of placeTokens(names)) { if (!tokMap.has(t)) tokMap.set(t, []); tokMap.get(t).push(id); }
    const n = p.names && Object.keys(p.names).length ? p.names : 0;
    return [p.name, p.kind, p.lat, p.lng, Math.max(0, regions.indexOf(p.region)), n, p.alt || 0];
  });
  const keys = [...tokMap.keys()].sort();
  const post = keys.map((k) => { const ids = tokMap.get(k); return ids.map((v, i) => (i ? v - ids[i - 1] : v)); });
  return { v: INDEX_VERSION, built, attribution: '© OpenStreetMap contributors (ODbL) · Protomaps', regions, places: rows, keys, post, pins: pincodes };
}

/** Lower-bound binary search. */
function lb(keys, x) { let lo = 0, hi = keys.length; while (lo < hi) { const m = (lo + hi) >> 1; if (keys[m] < x) lo = m + 1; else hi = m; } return lo; }
function ids(ix, i) { const out = []; let v = 0; for (const d of ix.post[i]) { v += d; out.push(v); } return out; }
/** Ids for tokens equal to (exact) or starting with (prefix) `tok`, capped. */
function lookup(ix, tok, { prefix = true, cap = 4000 } = {}) {
  const out = new Map(); // id → exact?
  let i = lb(ix.keys, tok);
  for (; i < ix.keys.length; i++) {
    const k = ix.keys[i];
    if (k === tok) { for (const id of ids(ix, i)) out.set(id, true); continue; }
    if (!prefix || !k.startsWith(tok)) break;
    for (const id of ids(ix, i)) if (!out.has(id)) out.set(id, false);
    if (out.size > cap) break;
  }
  return out;
}

const R = 6371;
const km = (a, b) => { const d2r = Math.PI / 180; const x = (b.lng - a.lng) * d2r * Math.cos(((a.lat + b.lat) / 2) * d2r); const y = (b.lat - a.lat) * d2r; return Math.hypot(x, y) * R; };

export const DIGIPIN_RE = /^[2-9CFJKLMPT]{3}-?[2-9CFJKLMPT]{3}-?[2-9CFJKLMPT]{4}$/i;
export const PIN_RE = /^[1-9]\d{5}$/;

/** Pincode lookup: centroid of OSM features carrying that postcode. */
export function lookupPincode(ix, pin) {
  const p = String(pin || '').replace(/\s+/g, '');
  if (!PIN_RE.test(p)) return null;
  const hit = (ix.pins || []).find((r) => r[0] === p);
  return hit ? { id: `pin-${p}`, name: p, kind: 'postcode', lat: hit[1], lng: hit[2], address: `PIN ${p} · ${ix.regionNames?.[hit[4]] || ix.regions?.[hit[4]] || ''}`.replace(/ · $/, ''), source: 'offline-pincode', samples: hit[3] } : null;
}
/** DIGIPIN (India Post) → the centre of its ~4 m cell. */
export function lookupDigipin(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!DIGIPIN_RE.test(c)) return null;
  const p = decodeDigipin(c); if (!p) return null;
  const pretty = c.replace(/-/g, '').replace(/^(...)(...)(....)$/, '$1-$2-$3');
  return { id: `digipin-${pretty}`, name: pretty, kind: 'digipin', lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), address: 'DIGIPIN', source: 'digipin' };
}

/** Readable display names of a row: { name, names: {te, hi, …} }. */
function rowNames(row) { return [row[0], row[6] || '', ...Object.values(row[5] || {})].filter(Boolean); }

/**
 * Search. Every query word must match a token of the place (Latin prefix, native prefix, or phonetic key),
 * or the whole query must match a whole name phonetically ("rushikonda" ↔ "ఋషి కొండ").
 * Score = per-word match quality + whole-name bonuses, × kind weight, minus a distance nudge from `near`.
 */
export function searchOffline(ix, query, { near = null, limit = 8 } = {}) {
  const raw = String(query || '').trim();
  if (!ix || raw.length < 2) return [];
  const out = [];
  const dig = lookupDigipin(raw); if (dig) out.push(dig);
  const pinTok = raw.match(/(?:^|\s)([1-9]\d{5})(?:\s|$)/);
  if (pinTok) { const p = lookupPincode(ix, pinTok[1]); if (p) out.push(p); }
  if (dig || PIN_RE.test(raw.replace(/\s+/g, ''))) return out.slice(0, limit);

  const lws = latinWords(raw); const nws = hasIndic(raw) ? nativeWords(raw) : [];
  if (!lws.length) return out;
  const qFold = lws.join(' ');
  const qKey = phoneticKey(lws.join(''));
  const perWord = lws.map((w, i) => {
    const m = new Map(); // id → best score for this word
    const add = (map, exact, part) => { for (const [id, ex] of map) { const s = ex ? exact : part; if (s > (m.get(id) || 0)) m.set(id, s); } };
    add(lookup(ix, `l${w}`, { prefix: w.length >= 2 }), 4, 3);
    if (nws[i]) add(lookup(ix, `n${nws[i]}`), 4.5, 3.5);
    const k = phoneticKey(w);
    if (k) add(lookup(ix, `p${k}`, { prefix: k.length >= 3 }), 2.6, 1.6);
    return m;
  });
  // whole-query phonetic (handles spacing differences)
  const whole = qKey.length >= 3 ? lookup(ix, `p${qKey}`, { prefix: qKey.length >= 4 }) : new Map();
  const cand = new Map();
  if (perWord.length) {
    const [first, ...rest] = [...perWord].sort((a, b) => a.size - b.size);
    for (const [id, s] of first) {
      let tot = s; let ok = true;
      for (const m of rest) { const v = m.get(id); if (!v) { ok = false; break; } tot += v; }
      if (ok) cand.set(id, tot / perWord.length);
    }
  }
  for (const [id, ex] of whole) cand.set(id, Math.max(cand.get(id) || 0, ex ? 3.2 : 2.2));
  return rankCandidates(ix, raw, cand, { near, limit, out });
}

/** Query parts used for ranking (also used by the server's FTS5 path). */
export function queryParts(raw) {
  const lws = latinWords(raw); const nws = hasIndic(raw) ? nativeWords(raw) : [];
  return { lws, nws, qFold: lws.join(' '), qKey: phoneticKey(lws.join('')), keys: lws.map(phoneticKey) };
}
/**
 * Rank candidate place ids (Map id → base score 0..4.5) and format results. Shared by the token index (above)
 * and the server's SQLite FTS5 candidate retrieval (server/lib/search-fts.js).
 */
export function rankCandidates(ix, raw, cand, { near = null, limit = 8, out = [] } = {}) {
  const { nws, qFold, qKey } = queryParts(raw);
  const scored = [];
  for (const [id, base] of cand) {
    const row = ix.places[id];
    let bonus = 0;
    for (const nm of rowNames(row)) {
      const f = latinFold(nm);
      if (f === qFold) bonus = Math.max(bonus, 6);
      else if (f.startsWith(qFold)) bonus = Math.max(bonus, 3.5);
      else if (phoneticKey(f.replace(/ /g, '')) === qKey) bonus = Math.max(bonus, 4.5);
      if (nws.length && nm.toLowerCase().normalize('NFC') === raw.toLowerCase().normalize('NFC')) bonus = Math.max(bonus, 7);
    }
    const p = { lat: row[2], lng: row[3] };
    const d = near ? km(near, p) : null;
    // places that OSM mappers named in Indian scripts are the notable ones (temples, suburbs, stations)
    const notable = row[5] && Object.keys(row[5]).length ? 1.25 : 1;
    const score = (base + bonus) * kindWeight(row[1]) * notable - (d != null ? Math.min(4, d / 6) : 0);
    scored.push({ id, score, d });
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set();
  for (const s of scored) {
    const row = ix.places[s.id];
    const key = `${latinFold(row[0])}|${row[1]}|${Math.round(row[2] * 200)}|${Math.round(row[3] * 200)}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ id: `off-${row[2]},${row[3]}`, name: row[0], kind: row[1], lat: row[2], lng: row[3], names: row[5] || {}, alt: row[6] || undefined,
      region: ix.regions?.[row[4]], distance_m: s.d != null ? Math.round(s.d * 1000) : null, source: 'offline-index-v2', score: +s.score.toFixed(2) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Name to show for a result in the UI language (native name when OSM has one, else the default name). */
export function displayName(place, lang) { return (lang && lang !== 'en' && place?.names?.[lang]) || place?.name || ''; }
/** Romanised form of a native-script query (shown as "Showing results for …" hint). */
export function romanise(q) { return hasIndic(q) ? toLatin(q) : q; }
