// Indian Address Intelligence: turns landmark-style addresses
// ("opp. CMR Central, MVP Colony, Vizag 530017") into a ranked location.
// Strategy (deterministic, explainable): DIGIPIN > landmark+locality > locality > pincode > city.
import { LOCALITIES, LANDMARKS, CITIES } from './seed.js';
import { decodeDigipin, haversineKm } from './geo.js';

const RELATIONS = [
  { re: /\b(opp(osite)?\.?|opp to|in front of|samne)(?=\W|$)/i, native: ['ఎదురుగా', 'सामने', 'எதிரில்'], rel: 'opposite', offsetM: 40 },
  { re: /\b(near|beside|next to|adjacent|behind|back side of)\b/i, native: ['పక్కన', 'దగ్గర', 'के पास', 'पास', 'அருகில்'], rel: 'near', offsetM: 150 },
  { re: /\b(above|upstairs|first floor|1st floor)\b/i, native: [], rel: 'same-building', offsetM: 0 },
];
const CITY_ALIASES = { vizag: ['vizag', 'visakhapatnam', 'vishakhapatnam', 'waltair', 'విశాఖపట్నం', 'వైజాగ్'], hyderabad: ['hyderabad', 'hyd', 'secunderabad', 'హైదరాబాద్', 'हैदराबाद'] };

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// ASCII aliases must match on word boundaries ("au" must not match "beautiful");
// Indic-script aliases use substring match (JS \b is ASCII-only).
export function matchIndex(text, alias) {
  if (/^[\x00-\x7f]+$/.test(alias)) {
    const m = new RegExp(`(^|[^a-z0-9])${esc(alias)}(?=$|[^a-z0-9])`, 'i').exec(text);
    return m ? m.index + m[1].length : -1;
  }
  return text.indexOf(alias);
}

function findAlias(text, list) {
  const hits = [];
  for (const item of list) {
    const names = [item.name.toLowerCase(), ...(item.aliases || [])];
    for (const n of names) {
      const idx = matchIndex(text, n.toLowerCase());
      if (idx >= 0) { hits.push({ item, len: n.length, idx }); break; }
    }
  }
  return hits.sort((a, b) => b.len - a.len);
}

export function parseIndianAddress(raw) {
  const text = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const out = { input: raw, components: {}, candidates: [], explanation: [] };
  if (!text) return out;

  const dp = text.match(/\b([2-9cfjklmpt]{3})-?([2-9cfjklmpt]{3})-?([2-9cfjklmpt]{4})\b/i);
  if (dp) {
    const p = decodeDigipin(dp[0]);
    if (p) {
      out.components.digipin = dp[0].toUpperCase();
      out.candidates.push({ ...p, confidence: 0.98, precision_m: 4, source: 'digipin' });
      out.explanation.push('DIGIPIN decoded to a ~4m grid cell.');
    }
  }
  const pin = text.match(/\b([1-9]\d{5})\b/);
  if (pin) out.components.pincode = pin[1];
  const house = text.match(/\b(?:h\.?\s?no\.?|door no\.?|d\.?\s?no\.?|flat|shop|plot)\s*[:#]?\s*([\w\/-]+)/i);
  if (house) out.components.house = house[1];

  let city = null;
  for (const [id, aliases] of Object.entries(CITY_ALIASES)) if (aliases.some((a) => text.includes(a))) city = id;
  if (city) out.components.city = CITIES[city].name;

  const relation = RELATIONS.find((r) => r.re.test(text) || r.native.some((w) => text.includes(w)));
  if (relation) out.components.relation = relation.rel;

  const locHits = findAlias(text, LOCALITIES.filter((l) => !city || l.city === city));
  const lmHits = findAlias(text, LANDMARKS.filter((l) => !city || l.city === city));
  const locality = locHits[0]?.item;
  const landmark = lmHits[0]?.item;
  if (locality) out.components.locality = locality.name;
  if (landmark) out.components.landmark = landmark.name;

  if (landmark) {
    let conf = 0.85;
    if (locality && haversineKm(landmark, locality) < 2.5) { conf = 0.92; out.explanation.push(`Landmark "${landmark.name}" is consistent with locality "${locality.name}".`); }
    else if (locality) { conf = 0.7; out.explanation.push(`Landmark and locality are ${haversineKm(landmark, locality).toFixed(1)} km apart; landmark preferred.`); }
    out.candidates.push({ lat: landmark.lat, lng: landmark.lng, confidence: conf, precision_m: relation?.offsetM ?? 200, source: 'landmark' });
  }
  if (locality) {
    let conf = 0.65;
    if (out.components.pincode && out.components.pincode === locality.pincode) { conf = 0.75; out.explanation.push(`Pincode ${locality.pincode} matches ${locality.name}.`); }
    out.candidates.push({ lat: locality.lat, lng: locality.lng, confidence: conf, precision_m: 800, source: 'locality' });
  }
  if (!locality && out.components.pincode) {
    const byPin = LOCALITIES.find((l) => l.pincode === out.components.pincode);
    if (byPin) { out.candidates.push({ lat: byPin.lat, lng: byPin.lng, confidence: 0.5, precision_m: 2500, source: 'pincode' }); out.components.locality = byPin.name; }
  }
  if (!out.candidates.length && city) {
    out.candidates.push({ ...CITIES[city].center, confidence: 0.2, precision_m: 10000, source: 'city-centroid' });
  }
  out.candidates.sort((a, b) => b.confidence - a.confidence);
  out.best = out.candidates[0] || null;
  if (!out.best) out.explanation.push('No local match; fall back to external geocoder (Nominatim/Photon) if enabled.');
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// v0.7 landmark-anchor resolution: "opposite SBI, beside Reliance Trends, Madhapur" → find each anchor (SBI, Reliance
// Trends) among real mapped places near the locality (the bundled offline OSM index, plus Overpass when online),
// pick the mutually closest set of anchors and return their centroid with an explainable confidence.
// Pure: callers pass the candidate places ({ name, kind, lat, lng, source, id }); see anchorPlacesFromIndex() and
// buildAnchorOverpassQuery()/parseAnchorElements() for the two sources.

/** Brand / short-form aliases common in Indian addresses (anchor phrase → names as mapped in OSM). */
export const BRAND_ALIASES = {
  sbi: ['state bank of india', 'sbi', 'state bank'], hdfc: ['hdfc bank', 'hdfc'], icici: ['icici bank', 'icici'], axis: ['axis bank', 'axis'],
  'canara bank': ['canara bank'], 'union bank': ['union bank of india', 'union bank'], 'andhra bank': ['andhra bank', 'union bank of india'],
  'reliance trends': ['reliance trends', 'trends'], 'reliance fresh': ['reliance fresh'], 'reliance digital': ['reliance digital'], 'reliance smart': ['reliance smart', 'smart point'],
  dmart: ['dmart', 'd mart', 'd-mart', 'avenue supermarts'], more: ['more supermarket', 'more'], 'apollo pharmacy': ['apollo pharmacy', 'apollo pharmacies'], medplus: ['medplus'],
  rtc: ['rtc', 'bus station', 'bus stand'], kfc: ['kfc'], mcdonalds: ["mcdonald's", 'mcdonalds'], dominos: ["domino's", 'dominos'], 'cafe coffee day': ['cafe coffee day', 'ccd'],
  'indian oil': ['indian oil', 'iocl'], 'bharat petroleum': ['bharat petroleum', 'bpcl'], 'hp petrol': ['hindustan petroleum', 'hp'],
};
const REL_WORDS = [
  ['opposite', /\b(?:opp(?:osite)?\.?(?:\s+to)?|in front of|samne)(?=\s|$)/i, 40], ['near', /\b(?:beside|next to|adjacent to|adjacent|near(?:by)?|behind|back side of|besides|close to)(?=\s|$)/i, 80],
];
const NATIVE_REL = [['ఎదురుగా', 'opposite', 40], ['सामने', 'opposite', 40], ['పక్కన', 'near', 80], ['దగ్గర', 'near', 80], ['के पास', 'near', 80], ['पास', 'near', 80]];
const norm = (s) => String(s || '').toLowerCase().normalize('NFC').replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}&]+/gu, ' ').trim();

/** Split an address into anchor clauses: [{ phrase, relation, offsetM }]. "opposite SBI, beside Reliance Trends" → 2 anchors. */
export function extractAnchors(raw) {
  const out = [];
  const segs = String(raw || '').split(/[,;\n]|\s+and\s+|\s+&\s+/i).map((s) => s.trim()).filter(Boolean);
  for (const seg of segs) {
    // A segment may hold several relations ("opp SBI beside Trends"): split before each relation word.
    const parts = []; let rest = seg;
    for (;;) {
      let first = null;
      for (const [rel, re, off] of REL_WORDS) { const m = re.exec(rest); if (m && (!first || m.index < first.m.index)) first = { rel, m, off }; }
      if (!first) { if (parts.length) parts[parts.length - 1].phrase += ` ${rest}`; break; }
      if (parts.length) parts[parts.length - 1].phrase += ` ${rest.slice(0, first.m.index)}`;
      parts.push({ relation: first.rel, offsetM: first.off, phrase: '' });
      rest = rest.slice(first.m.index + first.m[0].length);
    }
    for (const p of parts) { const phrase = p.phrase.replace(/\s+/g, ' ').replace(/^(the|to)\s+/i, '').trim(); if (phrase.length >= 2) out.push({ phrase, relation: p.relation, offsetM: p.offsetM }); }
    if (!parts.length) for (const [w, rel, off] of NATIVE_REL) {
      const i = seg.indexOf(w); if (i > 0) { const phrase = seg.slice(0, i).trim(); if (phrase) out.push({ phrase, relation: rel, offsetM: off }); break; }
    }
  }
  return out;
}
/** Names an anchor phrase may appear under in OSM (brand aliases expanded). */
export function anchorNames(phrase) {
  const p = norm(phrase);
  const names = new Set([p]);
  for (const [k, list] of Object.entries(BRAND_ALIASES)) if (k === p || list.includes(p)) for (const n of list) names.add(norm(n));
  return [...names].filter((n) => n.length >= 2);
}
/** Does a mapped place name match an anchor phrase? Whole-token containment of any alias (so "sbi" ≠ "sbi colony park" unless no better). */
export function anchorScore(placeName, phrase) {
  const name = norm(placeName); if (!name) return 0;
  let best = 0;
  for (const a of anchorNames(phrase)) {
    if (name === a) best = Math.max(best, 1);
    else if (` ${name} `.includes(` ${a} `)) best = Math.max(best, a.split(' ').length >= 2 ? 0.85 : name.split(' ').length <= 3 ? 0.7 : 0.4);
  }
  return best;
}
const NON_ANCHOR_KINDS = /^(residential|footway|path|primary|secondary|tertiary|trunk|road|street|neighbourhood|suburb|locality|administrative|park|water|stream)$/;

/**
 * resolveLandmarkAddress(raw, { places, radiusKm, center }) → { best, anchors, locality, explanation, base }
 * places: candidate mapped places (offline index rows near the locality and/or Overpass results).
 */
export function resolveLandmarkAddress(raw, { places = [], radiusKm = 2.5, center = null } = {}) {
  const base = parseIndianAddress(raw);
  const out = { input: raw, best: base.best, anchors: [], locality: base.components.locality || null, explanation: [], base };
  const loc = center || (base.components.locality ? LOCALITIES.find((l) => l.name === base.components.locality) : null);
  // Strip locality / city words that trail an anchor clause ("beside Trends Madhapur" → "Trends").
  const areaWords = [...LOCALITIES.flatMap((l) => [l.name, ...(l.aliases || [])]), ...Object.values(CITY_ALIASES).flat()].map((w) => w.toLowerCase()).filter((w) => /^[\x00-\x7f]+$/.test(w)).sort((a, b) => b.length - a.length);
  const anchors = extractAnchors(raw).map((a) => {
    let ph = a.phrase;
    for (const w of areaWords) { const i = matchIndex(ph.toLowerCase(), w); if (i > 0) { ph = ph.slice(0, i).trim(); break; } }
    return { ...a, phrase: ph.replace(/\b\d{6}\b/, '').trim() || a.phrase };
  }).filter((a) => !areaWords.includes(a.phrase.toLowerCase()));
  if (!anchors.length) { out.explanation.push('No landmark clause (opposite / beside / near …) found.'); return out; }
  if (!loc) { out.explanation.push('Anchors found, but no known locality to search around; add the area name.'); out.anchors = anchors.map((a) => ({ ...a, match: null, candidates: 0 })); return out; }
  const near = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && haversineKm(loc, p) <= radiusKm && !NON_ANCHOR_KINDS.test(p.kind || ''));
  const cands = anchors.map((a) => near.map((p) => ({ p, s: anchorScore(p.name, a.phrase) })).filter((x) => x.s >= 0.4)
    .sort((x, y) => y.s - x.s || haversineKm(loc, x.p) - haversineKm(loc, y.p)).slice(0, 12));
  const found = anchors.map((a, i) => ({ a, c: cands[i] })).filter((x) => x.c.length);
  out.anchors = anchors.map((a, i) => ({ ...a, candidates: cands[i].length, match: null }));
  if (!found.length) { out.explanation.push(`None of the landmarks (${anchors.map((a) => a.phrase).join(', ')}) is mapped within ${radiusKm} km of ${loc.name}.`); return out; }
  // Choose one candidate per found anchor minimising total pairwise distance (small sets: exhaustive up to 12^3).
  let bestSet = null, bestCost = Infinity;
  const pick = (i, chosen) => {
    if (i === found.length) {
      let cost = 0; for (let x = 0; x < chosen.length; x++) for (let y = x + 1; y < chosen.length; y++) cost += haversineKm(chosen[x].p, chosen[y].p);
      cost -= chosen.reduce((s, c) => s + c.s, 0) * 0.05; // prefer exact name matches on ties
      if (cost < bestCost) { bestCost = cost; bestSet = [...chosen]; }
      return;
    }
    for (const c of found[i].c) { chosen.push(c); pick(i + 1, chosen); chosen.pop(); }
  };
  pick(0, []);
  const lat = bestSet.reduce((s, c) => s + c.p.lat, 0) / bestSet.length, lng = bestSet.reduce((s, c) => s + c.p.lng, 0) / bestSet.length;
  const spreadM = Math.max(0, ...bestSet.map((c) => haversineKm({ lat, lng }, c.p) * 1000));
  const maxPairM = Math.max(0, ...bestSet.flatMap((a, i) => bestSet.slice(i + 1).map((b) => haversineKm(a.p, b.p) * 1000)));
  let conf;
  if (bestSet.length >= 2) conf = maxPairM <= 150 ? 0.9 : maxPairM <= 400 ? 0.78 : maxPairM <= 1000 ? 0.6 : 0.45;
  else { const n = found[0].c.filter((c) => c.s >= found[0].c[0].s).length; conf = n === 1 ? 0.7 : Math.max(0.4, 0.7 - 0.08 * (n - 1)); }
  const missing = anchors.length - found.length;
  conf = Math.max(0.3, conf - 0.1 * missing) * Math.min(1, bestSet.reduce((s, c) => s + c.s, 0) / bestSet.length + 0.1);
  const relOff = Math.max(...found.map((f) => f.a.offsetM));
  const precision = Math.round(Math.max(30, spreadM) + relOff);
  found.forEach((f, i) => { const idx = anchors.indexOf(f.a); out.anchors[idx].match = { name: bestSet[i].p.name, kind: bestSet[i].p.kind || '', lat: bestSet[i].p.lat, lng: bestSet[i].p.lng, source: bestSet[i].p.source || 'index', id: bestSet[i].p.id || null }; });
  out.explanation.push(`${bestSet.length} of ${anchors.length} landmark(s) found near ${loc.name}: ${bestSet.map((c) => `${c.p.name} (${c.p.source || 'index'})`).join(', ')}.`);
  if (bestSet.length >= 2) out.explanation.push(`Anchors are ${Math.round(maxPairM)} m apart; the point is their midpoint.`);
  if (missing) out.explanation.push(`${missing} landmark(s) not found on the map; confidence reduced.`);
  const cand = { lat: +lat.toFixed(6), lng: +lng.toFixed(6), confidence: +conf.toFixed(2), precision_m: precision, source: 'landmark-anchors' };
  out.best = base.best?.source === 'digipin' ? base.best : cand;
  out.candidates = [cand, ...(base.candidates || [])].sort((a, b) => b.confidence - a.confidence);
  return out;
}

/** Rows of the bundled offline index (web/offline/search/index.json: [name, kind, lat, lng, …]) near a point. */
export function anchorPlacesFromIndex(ix, center, radiusKm = 3) {
  const out = [];
  const dLat = radiusKm / 110.574, dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (const r of ix?.places || []) {
    if (Math.abs(r[2] - center.lat) > dLat || Math.abs(r[3] - center.lng) > dLng) continue;
    out.push({ name: r[0], kind: r[1], lat: r[2], lng: r[3], source: 'offline-index' });
  }
  return out;
}
/** Overpass QL for anchors around a locality (name / brand / operator regex, case-insensitive). */
export function buildAnchorOverpassQuery(phrases, center, radiusM = 2500) {
  const names = [...new Set(phrases.flatMap(anchorNames))].map((n) => n.replace(/[^\p{L}\p{N} &-]/gu, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
  if (!names.length) return null;
  const re = names.join('|').replace(/"/g, '');
  const a = `around:${Math.round(radiusM)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
  return `[out:json][timeout:20];(nwr(${a})["name"~"${re}",i];nwr(${a})["brand"~"${re}",i];);out center tags 200;`;
}
/** Overpass JSON → candidate places. */
export function parseAnchorElements(json) {
  return (json?.elements || []).map((e) => ({ name: e.tags?.name || e.tags?.brand || '', kind: e.tags?.amenity || e.tags?.shop || e.tags?.office || '', lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, source: 'overpass', id: `osm:${e.type}/${e.id}` }))
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
