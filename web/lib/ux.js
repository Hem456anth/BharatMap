// v0.7.18 UI/UX pass (pure, unit-tested helpers; no DOM). Written from our own spec in
// re-staging/apple-maps-web/UX_SPEC.md §5–§12 (behaviour only, nothing copied) on top of the "Deccan dusk" identity
// (docs/re/UI_UX_SPEC.md). Used by ui/search.js, ui/place.js, ui/directions.js, ui/states.js, ui/map-health.js.
import { openingStatus, istNow } from './opening-hours.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- A1 tokens (mirrors web/styles.css :root)
export const TYPE_SCALE = { title: 24, h1: 22, h2: 20, body: 17, sec: 15, label: 11 };
export const SPACING = [4, 8, 12, 16, 20, 24, 32];
export const PANEL = { floating: 400, docked: 420, dockedFrom: 1280, floatingFrom: 900, pad: 20 };

// ---------------------------------------------------------------- A7 category colours
/** Category hue tokens. Values chosen for ≥ 3:1 against a white glyph (checked in tests). */
export const CAT_TOKENS = {
  fuel: '#C2410C', ev: '#1E7B4F', money: '#1F5FA8', transit: '#6B2FA0', food: '#B45309', health: '#C92A2A',
  worship: '#8E44AD', shop: '#A16207', stay: '#4338CA', nature: '#2B8A3E', gov: '#495057', edu: '#1971C2',
  water: '#0C8599', parking: '#1D4E89', facility: '#52606D', place: '#5B6170',
};
/** POI category id (services/overpass.js) → hue token name. */
export const CAT_HUE = {
  fuel: 'fuel', ev: 'ev', atm: 'money', metro: 'transit', bus: 'transit', rail: 'transit', airport: 'transit',
  hospital: 'health', pharmacy: 'health', restaurant: 'food', grocery: 'shop', parking: 'parking', toilets: 'facility',
};
export const hueOf = (cat) => CAT_HUE[cat] || (CAT_TOKENS[cat] ? cat : 'place');
/** India-first chip order for the home grid (UX_SPEC §9.1): everyday needs first. */
export const CHIP_ORDER = ['fuel', 'ev', 'atm', 'hospital', 'pharmacy', 'metro', 'bus', 'rail', 'restaurant', 'grocery', 'toilets', 'parking', 'airport'];
/** Groups on the "All categories" page. */
export const CAT_GROUPS = [
  ['cg_travel', ['fuel', 'ev', 'parking', 'metro', 'bus', 'rail', 'airport']],
  ['cg_health', ['hospital', 'pharmacy']],
  ['cg_daily', ['atm', 'restaurant', 'grocery', 'toilets']],
];
/** Hue for an OSM/Photon/offline-index "kind" (autocomplete rows). */
export function hueForKind(kind = '', osmKey = '') {
  const k = String(kind).toLowerCase();
  if (/place_of_worship|temple|mosque|church|gurdwara|shrine/.test(k)) return 'worship';
  if (/hospital|clinic|pharmacy|doctor|health/.test(k)) return 'health';
  if (/restaurant|cafe|fast_food|food|bakery|sweet/.test(k)) return 'food';
  if (/station|bus|metro|rail|halt|aerodrome|airport|transit|subway/.test(k)) return 'transit';
  if (/fuel|petrol/.test(k)) return 'fuel';
  if (/charging/.test(k)) return 'ev';
  if (/atm|bank/.test(k)) return 'money';
  if (/school|college|university|education/.test(k)) return 'edu';
  if (/hotel|hostel|guest_house|resort/.test(k)) return 'stay';
  if (/park|garden|beach|hill|peak|forest|nature|viewpoint/.test(k)) return 'nature';
  if (/lake|river|reservoir|water/.test(k)) return 'water';
  if (/townhall|government|police|post_office|courthouse|office/.test(k) || osmKey === 'office') return 'gov';
  if (/shop|mall|market|supermarket|store/.test(k) || osmKey === 'shop') return 'shop';
  return 'place';
}

/** WCAG contrast ratio of two #RRGGBB colours. */
export function contrast(a, b) {
  const lum = (hex) => {
    const n = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ---------------------------------------------------------------- A6 autocomplete
const fold = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/**
 * Bold only the matched part of `label` (first case/diacritic-insensitive occurrence of the query, else the
 * first query word). Returns escaped HTML. No match → plain escaped label (e.g. a transliteration hit).
 */
export function highlightMatch(label, query) {
  const L = String(label ?? ''); const q = String(query ?? '').trim();
  if (!q || !L) return esc(L);
  const fl = fold(L);
  // fold() can change string length for some characters; only highlight when lengths line up.
  if (fl.length !== L.length) { const i = L.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? esc(L) : `${esc(L.slice(0, i))}<b>${esc(L.slice(i, i + q.length))}</b>${esc(L.slice(i + q.length))}`; }
  let i = fl.indexOf(fold(q)); let n = q.length;
  if (i < 0) {
    const w = fold(q).split(/\s+/).filter((x) => x.length >= 2).sort((a, b) => b.length - a.length)[0];
    if (w) { i = fl.indexOf(w); n = w.length; }
  }
  if (i < 0) return esc(L);
  return `${esc(L.slice(0, i))}<b>${esc(L.slice(i, i + n))}</b>${esc(L.slice(i + n))}`;
}

const SCRIPTS = [
  ['Deva', /[\u0900-\u097F]/, 'देवनागरी'], ['Beng', /[\u0980-\u09FF]/, 'বাংলা'], ['Guru', /[\u0A00-\u0A7F]/, 'ਗੁਰਮੁਖੀ'],
  ['Gujr', /[\u0A80-\u0AFF]/, 'ગુજરાતી'], ['Orya', /[\u0B00-\u0B7F]/, 'ଓଡ଼ିଆ'], ['Taml', /[\u0B80-\u0BFF]/, 'தமிழ்'],
  ['Telu', /[\u0C00-\u0C7F]/, 'తెలుగు'], ['Knda', /[\u0C80-\u0CFF]/, 'ಕನ್ನಡ'], ['Mlym', /[\u0D00-\u0D7F]/, 'മലയാളം'],
  ['Latn', /[A-Za-z]/, 'Latin'],
];
const SCRIPT_LANG = { Deva: 'hi', Beng: 'bn', Guru: 'pa', Gujr: 'gu', Orya: 'or', Taml: 'ta', Telu: 'te', Knda: 'kn', Mlym: 'ml', Latn: 'en' };
/** Dominant script of a string (first Indic script found wins over Latin), or null. */
export function scriptOf(s) {
  const str = String(s || '');
  for (const [code, re] of SCRIPTS) if (code !== 'Latn' && re.test(str)) return code;
  return /[A-Za-z]/.test(str) ? 'Latn' : null;
}
/**
 * Script badge for a suggestion whose shown name and alternate name are in different scripts, e.g. a Latin query
 * "simhachalam" that matched సింహాచలం through transliteration. Returns null when there is nothing to show.
 * → { text: 'సింహాచలం', script: 'Telu', lang: 'te', name: 'తెలుగు' }
 */
export function scriptBadge(label, alt, query = '') {
  if (!alt || alt === label) return null;
  const sa = scriptOf(alt), sl = scriptOf(label);
  if (!sa || sa === sl) return null;
  const qs = scriptOf(query);
  const entry = SCRIPTS.find(([c]) => c === sa);
  // viaTranslit: the query was typed in a different script from the badge (e.g. Latin "simhachalam" → సింహాచలం).
  return { text: String(alt), script: sa, lang: SCRIPT_LANG[sa], name: entry?.[2] || sa, viaTranslit: !!qs && qs !== sa };
}
/** Great-circle distance in metres. */
export function distanceM(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  const R = 6371008.8, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}
/** Compact km/m label for the right-aligned suggestion distance (tabular): 850 m, 4.2 km, 37 km, 1,240 km. */
export function shortDistance(m) {
  if (m == null || !Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 10000) return `${(Math.round(m / 100) / 10).toFixed(1)} km`;
  return `${Math.round(m / 1000).toLocaleString('en-IN')} km`;
}
/** Row type for a suggestion (drives its glyph): 'digipin' | 'pincode' | 'cat' | 'recent' | 'shop' | 'place'. */
export function suggestionType(it) {
  if (it.kind !== 'place') return it.kind;
  const k = it.place?.kind;
  if (k === 'digipin' || k === 'DIGIPIN') return 'digipin';
  if (k === 'postcode' || k === 'pincode') return 'pincode';
  return 'place';
}

// ---------------------------------------------------------------- A2 place card
/**
 * Hours state with the amber "soon" band (UX_SPEC §7.2): 'open' | 'closing_soon' | 'closed' | 'opening_soon' | 'unknown'.
 * soonMin: minutes before a change that count as "soon" (default 60).
 */
export function hoursState(raw, when = new Date(), soonMin = 60) {
  if (!raw) return { state: 'none' };
  const st = openingStatus(raw, when);
  const now = when instanceof Date ? istNow(when) : when;
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  if (st.status === 'open') {
    if (!st.until) return { ...st, state: 'open' };
    const left = (toMin(st.until) - now.minutes + 1440) % 1440 || 1440;
    return { ...st, state: left <= soonMin ? 'closing_soon' : 'open', minutesLeft: left };
  }
  if (st.status === 'closed') {
    if (st.opensAt && (st.opensDay === 'today' || st.opensDay === 'tomorrow')) {
      const wait = st.opensDay === 'today' ? toMin(st.opensAt) - now.minutes : toMin(st.opensAt) + 1440 - now.minutes;
      if (wait > 0 && wait <= soonMin) return { ...st, state: 'opening_soon', minutesToOpen: wait };
    }
    return { ...st, state: 'closed' };
  }
  return { ...st, state: 'unknown' };
}
/** Payment methods from OSM payment:* tags (only those tagged yes). */
export function paymentMethods(tags = {}) {
  const out = [];
  if (tags['payment:upi'] === 'yes' || tags['payment:bhim'] === 'yes') out.push('upi');
  if (tags['payment:cash'] === 'yes' || tags['payment:coins'] === 'yes') out.push('cash');
  if (['payment:cards', 'payment:debit_cards', 'payment:credit_cards', 'payment:visa', 'payment:mastercard', 'payment:rupay'].some((k) => tags[k] === 'yes')) out.push('cards');
  return out;
}
/** "Good to know" amenity facts from OSM tags (value yes/limited/only). Unknown/no values are dropped. */
export const AMENITY_KEYS = [
  ['wheelchair', 'wheelchair'], ['toilets', 'toilets'], ['toilets:wheelchair', 'wheelchair'], ['diet:vegetarian', 'leaf'], ['diet:vegan', 'leaf'],
  ['air_conditioning', 'snow'], ['internet_access', 'wifi'], ['drive_through', 'car'], ['delivery', 'bag'], ['takeaway', 'bag'],
  ['outdoor_seating', 'sun'], ['parking', 'parking'], ['changing_table', 'plus'], ['drinking_water', 'drop'],
];
export function goodToKnow(tags = {}) {
  const out = [];
  for (const [k, ic] of AMENITY_KEYS) {
    const v = String(tags[k] || '').toLowerCase();
    if (!v) continue;
    if (k === 'internet_access' ? /^(yes|wlan|wifi|wired|terminal)$/.test(v) : k === 'parking' ? !!v : /^(yes|limited|only|designated)$/.test(v)) out.push({ key: k, icon: ic, value: v });
  }
  return out;
}
/** Local-script name for the header line (UX_SPEC §9.4 block 1): first name:xx in an Indic script ≠ the shown name. */
export function localScriptName(p, shown) {
  const tags = p.tags || {};
  const cands = [...Object.entries(p.names || {}), ...Object.entries(tags).filter(([k]) => /^name:[a-z]{2}$/.test(k)).map(([k, v]) => [k.slice(5), v])];
  const pref = ['te', 'hi', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or'];
  cands.sort((a, b) => (pref.indexOf(a[0]) + 99) % 99 - (pref.indexOf(b[0]) + 99) % 99);
  for (const [, v] of cands) if (v && v !== shown && scriptOf(v) && scriptOf(v) !== 'Latn' && scriptOf(v) !== scriptOf(shown)) return v;
  return '';
}
/**
 * Which place-card blocks render, in the fixed order (UX_SPEC §9.4). A block is dropped when it has no data.
 * A "lean" card (address only) keeps header + actions + details and gains the "Help complete this place" prompt.
 */
export const BLOCK_ORDER = ['header', 'actions', 'ribbon', 'photos', 'about', 'ratings', 'goodToKnow', 'services', 'also', 'details', 'footer'];
export function placeBlocks(p = {}) {
  const t = p.tags || {};
  const hours = !!t.opening_hours;
  const pay = paymentMethods(t).length > 0;
  const about = !!(t.description || t['description:en']);
  const gtk = goodToKnow(t).length > 0;
  const lean = !hours && !t.phone && !t['contact:phone'] && !t.website && !t['contact:website'] && !about && !gtk && !pay && p.kind !== 'seller';
  const has = {
    header: true, actions: true, ribbon: hours || pay, photos: false /* no open-licence photo source wired yet */, about,
    ratings: Number.isFinite(p.rating), goodToKnow: gtk, services: true, also: p.kind !== 'pin', details: true, footer: true,
  };
  return { blocks: BLOCK_ORDER.filter((b) => has[b]), lean };
}

// ---------------------------------------------------------------- A3 routes
/** Totals for the directions header: { duration_s, distance_m, arrive: Date }. */
export function routeTotals(route, now = Date.now()) {
  if (!route) return null;
  return { duration_s: route.duration_s, distance_m: route.distance_m, arrive: new Date(now + route.duration_s * 1000) };
}
/** Descriptor + badges for a route card (only facts we actually know). */
export function routeDescriptor(r, i, { routes = [], mode = 'drive', avoidTolls = false, avoidHighways = false, avoidApplied = true, estimate = false } = {}) {
  const badges = [];
  if (r.fallback) return { key: 'rd_estimate', badges: [{ key: 'rb_straight', tone: 'warn' }] };
  const fastest = routes.length ? Math.min(...routes.map((x) => x.duration_s)) : r.duration_s;
  const shortest = routes.length ? Math.min(...routes.map((x) => x.distance_m)) : r.distance_m;
  let key = i === 0 || r.duration_s === fastest ? 'rd_fastest' : r.distance_m === shortest ? 'rd_shortest' : 'rd_alternative';
  if ((mode === 'drive' || mode === 'two') && avoidApplied !== false) {
    if (avoidTolls) badges.push({ key: 'rb_no_tolls', tone: 'ok' });
    if (avoidHighways) badges.push({ key: 'rb_no_highways', tone: 'ok' });
  }
  if (mode === 'two' && estimate) badges.push({ key: 'rb_two_est', tone: 'warn' });
  if (Number.isFinite(r.tolls) && r.tolls > 0) badges.push({ key: 'rb_tolls', tone: 'info', n: r.tolls });
  if (i > 0 && Number.isFinite(fastest)) { const extra = Math.round((r.duration_s - fastest) / 60); if (extra > 0) badges.push({ key: 'rb_slower', tone: 'muted', n: extra }); }
  return { key, badges };
}

// ---------------------------------------------------------------- A4 empty / unavailable states
/** Every empty state must carry at least one action. Returns a normalised spec or throws. */
export function emptyState({ icon = 'search', title, body = '', actions = [] }) {
  if (!title) throw new Error('empty_state_title');
  const acts = actions.filter((a) => a && a.id && a.label);
  if (!acts.length) throw new Error('empty_state_needs_action');
  return { icon, title, body, actions: acts.map((a, i) => ({ ...a, primary: a.primary ?? i === 0 })) };
}
export function emptyStateHtml(spec, iconFn = () => '') {
  const s = emptyState(spec);
  return `<div class="state" role="status"><span class="state-ic" aria-hidden="true">${iconFn(s.icon)}</span><b class="state-t">${esc(s.title)}</b>${s.body ? `<p class="state-b">${esc(s.body)}</p>` : ''}<div class="state-acts">${s.actions.map((a) => `<button type="button" class="btn${a.primary ? ' tonal' : ' ghost'}" data-state-act="${esc(a.id)}"${a.data ? ` data-arg="${esc(a.data)}"` : ''}>${a.icon ? iconFn(a.icon) : ''}${esc(a.label)}</button>`).join('')}</div></div>`;
}

// ---------------------------------------------------------------- A5 map health
/**
 * Decide whether to show the map-failure banner. Inputs are observations; output is the banner spec or null.
 * { webgl:false } → 'webgl'; style not loaded after timeoutMs → 'timeout'; ≥ errLimit tile/style errors in 15 s with
 * no working offline fallback → 'tiles'. Actions always include retry; low-bandwidth/offline when they can help.
 */
export function mapHealth({ webgl = true, styleLoaded = true, sinceApplyMs = 0, timeoutMs = 15000, errors = 0, errLimit = 6, offlineActive = false, offlineAvailable = true, lowBw = false, online = true } = {}) {
  let reason = null;
  if (!webgl) reason = 'webgl';
  else if (!styleLoaded && sinceApplyMs >= timeoutMs) reason = 'timeout';
  else if (errors >= errLimit && (!offlineAvailable || offlineActive)) reason = 'tiles';
  if (!reason) return null;
  const actions = ['retry'];
  if (reason !== 'webgl' && !lowBw) actions.push('lowbw');
  if (reason !== 'webgl' && offlineAvailable && !offlineActive) actions.push('offline');
  return { reason, actions, online };
}
