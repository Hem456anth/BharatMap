// Unified search + AI-assistant intent engine (deterministic, explainable,
// runs offline). The server can optionally layer an LLM on top (see server/ai.js).
import { haversineKm } from './geo.js';
import { normalizeQuery } from './i18n.js';
import { LOCALITIES, LANDMARKS } from './seed.js';
import { parseIndianAddress, matchIndex } from './address.js';

const STOP = new Set(['near', 'me', 'in', 'at', 'the', 'a', 'an', 'for', 'show', 'find', 'buy', 'best', 'shops', 'shop', 'stores', 'store', 'sellers', 'with', 'and', 'of', 'to', 'i', 'want', 'need', 'get', 'where', 'can', 'is', 'nearby', 'available', 'please', 'under', 'below', 'less', 'than', 'within', 'km', 'rs', 'inr', 'from', 'some', 'any', 'order', 'deliver', 'delivery', 'cheap', 'cheapest', 'verified', 'wholesale', 'supplier', 'suppliers', 'bulk', 'lowest', 'price', 'budget', 'open', 'now', 'stock', 'distributor', 'manufacturer', 'manufacturers', 'inch', 'inches', 'sale', 'sell', 'selling', 'stockist']);
const SYN = { tvs: 'tv', televisions: 'tv', leds: 'led', phones: 'mobile', mobiles: 'mobile', medicines: 'medicine', tshirts: 'tshirt', 't-shirts': 'tshirt', 't-shirt': 'tshirt', chargers: 'charger', bulbs: 'bulb' };

export function parseQuery(raw) {
  const q = normalizeQuery(raw);
  const intent = {
    raw, normalized: q, nearMe: /\bnear me\b|\bnearby\b|\baround me\b/.test(q),
    sort: /\b(cheap|cheapest|lowest price|budget)\b/.test(q) ? 'price' : 'relevance',
    wholesale: /\b(wholesale|bulk|supplier|suppliers|distributor|manufacturer|manufacturers)\b/.test(q),
    verifiedOnly: /\bverified\b/.test(q), inStockOnly: /\bin stock\b|\bavailable\b/.test(q),
    maxPrice: null, radiusKm: null, size: null, terms: [],
  };
  const price = q.match(/\b(?:under|below|less than|upto|up to|max|within)\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?\b/);
  if (price) {
    let v = parseFloat(price[1]);
    if (/k|thousand/.test(price[2] || '')) v *= 1000;
    if (/lakh|^l$/.test(price[2] || '')) v *= 100000;
    intent.maxPrice = v;
  }
  const rad = q.match(/\bwithin\s*(\d+(?:\.\d+)?)\s*km\b/);
  if (rad) { intent.radiusKm = parseFloat(rad[1]); if (intent.maxPrice === parseFloat(rad[1])) intent.maxPrice = null; }
  const size = q.match(/\b(\d{2})\s*(?:"|inch|inches|in\b|”)/);
  if (size) intent.size = size[1];
  // "in Gajuwaka" / "near Ameerpet": re-centre the search on that locality.
  for (const l of LOCALITIES) {
    const alias = [l.name.toLowerCase(), ...l.aliases].find((a) => matchIndex(q, a) >= 0);
    if (alias) { intent.locality = { name: l.name, lat: l.lat, lng: l.lng, city: l.city }; intent._strip = alias; break; }
  }
  const qTerms = intent._strip ? q.split(intent._strip).join(' ') : q;
  intent.terms = qTerms.replace(/[₹"”,.?!]/g, ' ').split(/\s+/)
    .map((w) => SYN[w] || w).filter((w) => w && !STOP.has(w) && !/^\d+(k)?$/.test(w));
  return intent;
}

function categoryHit(p, terms) {
  return terms.some((t) => p.category === t || p.tags.includes(t));
}

function scoreProduct(p, biz, terms) {
  if (!terms.length) return 0.1;
  const hay = `${p.name} ${p.brand} ${p.category} ${p.tags.join(' ')} ${biz.category} ${biz.type}`.toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (matchIndex(hay, t) >= 0) s += 1;
    else if (t.length > 3 && hay.includes(t.slice(0, -1))) s += 0.5;
  }
  return s / terms.length;
}

// businesses: array with nested products (seed shape or DB-hydrated shape)
export function searchMarketplace(businesses, raw, opts = {}) {
  const intent = parseQuery(raw);
  const origin = intent.locality || opts.origin || null;
  const radiusKm = intent.radiusKm || opts.radiusKm || (origin ? 15 : Infinity);
  const out = [];
  for (const b of businesses) {
    const distance_km = origin ? haversineKm(origin, b) : null;
    if (origin && distance_km > radiusKm) continue;
    if (intent.verifiedOnly && !b.verified) continue;
    if (intent.wholesale && !['wholesaler', 'manufacturer'].includes(b.type) && !b.products.some((p) => p.wholesale_price)) continue;
    const matches = [];
    for (const p of b.products) {
      let sc = scoreProduct(p, b, intent.terms);
      if (sc < 0.5) continue;
      if (intent.size && !new RegExp(`\\b${intent.size}\\s*(\"|”|inch)`, 'i').test(p.name)) continue;
      if (intent.maxPrice && p.price > intent.maxPrice) continue;
      if (intent.inStockOnly && p.stock <= 0) continue;
      matches.push({ ...p, _cat: categoryHit(p, intent.terms), score: +sc.toFixed(2), discount_pct: p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0 });
    }
    const nameHit = intent.terms.length && intent.terms.every((t) => b.name.toLowerCase().includes(t));
    if (!matches.length && !nameHit) continue;
    const inStock = (x) => (x.stock > 0 ? 0 : 1);
    matches.sort((a, b2) => inStock(a) - inStock(b2) || (intent.sort === 'price' ? a.price - b2.price : b2.score - a.score || a.price - b2.price));
    const best = matches[0];
    const eta_min = distance_km != null ? Math.round(12 + distance_km * 3.2) : null; // pick+pack 12 min + ~19 km/h urban (assumed)
    const rank = (best?.score || 0.6) * 2 + (b.verified ? 0.4 : 0) + b.rating / 10 + (best?.stock > 0 ? 0.5 : -1) - (distance_km || 0) * 0.08;
    out.push({
      business: { id: b.id, name: b.name, type: b.type, category: b.category, lat: b.lat, lng: b.lng, address: b.address, verified: b.verified, rating: b.rating, hours: b.hours, delivery: b.delivery, pickup: b.pickup, city: b.city },
      distance_km: distance_km != null ? +distance_km.toFixed(2) : null, eta_min, products: matches, rank: +rank.toFixed(3),
    });
  }
  // Strict mode: when some products match a category/tag exactly (e.g. "tv"),
  // drop loose matches (e.g. "TV installation") so "cheap tv" never returns a service.
  if (out.some((r) => r.products.some((p) => p._cat))) {
    for (const r of out) r.products = r.products.filter((p) => p._cat);
    for (let i = out.length - 1; i >= 0; i--) if (!out[i].products.length) out.splice(i, 1);
  }
  for (const r of out) for (const p of r.products) delete p._cat;
  out.sort((a, b) => (intent.sort === 'price' ? (a.products[0]?.price ?? 1e12) - (b.products[0]?.price ?? 1e12) : b.rank - a.rank));
  const prices = out.flatMap((r) => r.products.map((p) => p.price));
  return {
    intent: { ...intent, _strip: undefined }, origin, count: out.length, results: out,
    price_range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  };
}

export function searchPlaces(raw, cityId) {
  const q = String(raw || '').toLowerCase();
  if (q.length < 2) return [];
  const pool = [...LOCALITIES.map((l) => ({ ...l, kind: 'locality' })), ...LANDMARKS.map((l) => ({ ...l, kind: 'landmark' }))];
  return pool.filter((p) => (!cityId || p.city === cityId) && [p.name.toLowerCase(), ...(p.aliases || [])].some((a) => a.includes(q) || q.includes(a)))
    .slice(0, 8).map(({ name, kind, city, lat, lng, pincode }) => ({ name, kind, city, lat, lng, pincode }));
}

export function searchMobility(mobility, kind, origin, limit = 5) {
  return mobility.filter((m) => !kind || m.kind === kind)
    .map((m) => ({ ...m, distance_km: origin ? +haversineKm(origin, m).toFixed(2) : null }))
    .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0)).slice(0, limit);
}

// ---- AI Map Assistant: natural language -> intent -> tool call -> grounded reply
export function assistant(raw, ctx) {
  const q = normalizeQuery(raw);
  const origin = ctx.origin;
  const route = q.match(/(?:route|directions?|way|how (?:do i|to) (?:get|go|reach))\s*(?:from\s+(.+?))?\s*to\s+(.+)$/);
  if (route) {
    const to = parseIndianAddress(route[2]).best;
    const from = route[1] ? parseIndianAddress(route[1]).best : origin;
    if (to && from) return { intent: 'route', reply: `Routing to ${route[2].trim()}.`, action: { type: 'route', from, to } };
    return { intent: 'route', reply: `I couldn't place "${route[2]}". Try a landmark, locality, pincode or DIGIPIN.`, action: null };
  }
  const mob = [['ev charging', 'ev'], ['charger', 'ev'], ['parking', 'parking'], ['metro', 'metro'], ['railway', 'rail'], ['train', 'rail'], ['bus', 'bus'], ['airport', 'airport'], ['toll', 'toll']]
    .find(([w]) => q.includes(w));
  if (mob && !/\b(tv|mobile|milk|biryani|medicine)\b/.test(q)) {
    const items = searchMobility(ctx.mobility, mob[1], origin, 3);
    const top = items[0];
    return { intent: 'mobility', reply: top ? `Nearest ${mob[0]}: ${top.name}${top.distance_km != null ? `, ${top.distance_km} km away` : ''}${top.meta ? ` (${top.meta})` : ''}.` : `No ${mob[0]} data in this area yet.`, action: { type: 'mobility', items } };
  }
  if (/\d{6}|digipin|address|locate|where is|opp|near .*(colony|nagar|road)/.test(q) && !/\b(tv|buy|price)\b/.test(q)) {
    const r = parseIndianAddress(raw);
    if (r.best) return { intent: 'geocode', reply: `Located with ${Math.round(r.best.confidence * 100)}% confidence (±${r.best.precision_m} m, via ${r.best.source}).`, action: { type: 'geocode', result: r } };
  }
  const res = searchMarketplace(ctx.businesses, raw, { origin, radiusKm: ctx.radiusKm });
  if (!res.count) return { intent: 'search', reply: `Nothing matched "${raw}" nearby. Try a wider radius or a simpler term.`, action: { type: 'search', result: res } };
  const top = res.results[0];
  const p = top.products[0];
  const kind = res.intent.wholesale ? 'supplier' : 'seller';
  const reply = p
    ? `${res.count} ${kind}${res.count > 1 ? 's' : ''} found${res.price_range ? `, ₹${res.price_range.min.toLocaleString('en-IN')}–₹${res.price_range.max.toLocaleString('en-IN')}` : ''}. Best pick: ${top.business.name}${top.business.verified ? ' (verified)' : ''} – ${p.name} at ₹${p.price.toLocaleString('en-IN')}${p.wholesale_price ? ` (wholesale ₹${p.wholesale_price.toLocaleString('en-IN')} for ${p.min_wholesale_qty}+)` : ''}${top.distance_km != null ? `, ${top.distance_km} km, ~${top.eta_min} min delivery` : ''}.`
    : `${res.count} businesses found. Top: ${top.business.name}.`;
  return { intent: res.intent.wholesale ? 'supplier_discovery' : 'product_search', reply, action: { type: 'search', result: res } };
}
