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
