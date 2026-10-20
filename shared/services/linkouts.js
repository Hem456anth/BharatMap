// Link-out builders (docs/INTEGRATIONS.md). Every link-out is { provider, host, url, kind, verified, note }:
//   verified=true   the URL format is documented by the provider (Uber universal links, WhatsApp click-to-chat,
//                   Google Maps URLs, Ola web booking WITH an affiliate token, tel:), or comes from OSM tags / an admin-
//                   verified provider link
//   verified=false  a best-effort public web page; INTEGRATIONS.md marks the format "unverified" — the interstitial
//                   says so. We never build item/price URLs (no fabricated menus, fares or stock), only home, city or
//                   name-search pages, and we never claim the provider endorses Bharat Map.
// Pure module: used by the app (web/services/providers/) and the server (/api/v1/places/:id/services).
// App hand-offs (Uber, Swiggy, Zomato, BookMyShow, District, Blinkit, Rapido …) come from shared/services/deeplinks.js:
// documented links, https App Links verified against the APK manifest + the site's assetlinks.json, or a declared
// custom-scheme intent URL with an official https fallback. No query parameters are guessed.
import { appLink, safeIntent } from './deeplinks.js';

export const CITY_SLUGS = {
  vizag: { name: 'Visakhapatnam', bms: 'visakhapatnam', zomato: 'vizag' },
  hyderabad: { name: 'Hyderabad', bms: 'hyderabad', zomato: 'hyderabad' },
  vijayawada: { name: 'Vijayawada', bms: 'vijayawada', zomato: 'vijayawada' },
  guntur: { name: 'Guntur', bms: 'guntur', zomato: 'guntur' },
  tirupati: { name: 'Tirupati', bms: 'tirupati', zomato: 'tirupati' },
  bengaluru: { name: 'Bengaluru', bms: 'bengaluru', zomato: 'bangalore' },
  chennai: { name: 'Chennai', bms: 'chennai', zomato: 'chennai' },
  mumbai: { name: 'Mumbai', bms: 'mumbai', zomato: 'mumbai' },
  delhi: { name: 'Delhi', bms: 'national-capital-region-ncr', zomato: 'ncr' },
  kolkata: { name: 'Kolkata', bms: 'kolkata', zomato: 'kolkata' },
  pune: { name: 'Pune', bms: 'pune', zomato: 'pune' },
};
// Rough city boxes (lng/lat) to name the city of a place for city pages and name+city searches.
const CITY_BOX = {
  noida: [77.28, 28.42, 77.55, 28.66], kochi: [76.2, 9.9, 76.4, 10.1], nagpur: [78.95, 21.05, 79.2, 21.25], ahmedabad: [72.45, 22.9, 72.7, 23.15],
  jaipur: [75.7, 26.8, 75.95, 27.0], lucknow: [80.85, 26.75, 81.05, 26.95], kanpur: [80.2, 26.38, 80.42, 26.55],
  vizag: [83.0, 17.55, 83.5, 17.95], hyderabad: [78.2, 17.2, 78.7, 17.65], vijayawada: [80.5, 16.4, 80.8, 16.65], guntur: [80.35, 16.2, 80.55, 16.4],
  tirupati: [79.3, 13.55, 79.5, 13.75], bengaluru: [77.4, 12.8, 77.85, 13.2], chennai: [80.1, 12.85, 80.35, 13.25], mumbai: [72.75, 18.85, 73.1, 19.3],
  delhi: [76.85, 28.4, 77.4, 28.9], kolkata: [88.2, 22.4, 88.5, 22.7], pune: [73.7, 18.4, 74.0, 18.7],
};
export function cityOf(p) {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  for (const [id, [w, s, e, n]] of Object.entries(CITY_BOX)) if (p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n) return id;
  return null;
}
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const L = (provider, url, kind, verified, note = '') => ({ provider, host: url.startsWith('tel:') ? 'phone' : hostOf(url), url, kind, verified, ...(note ? { note } : {}) });
const r6 = (x) => (Math.round(x * 1e6) / 1e6).toString();

/**
 * Uber universal deep link (documented: https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction).
 * https://m.uber.com/ul/?client_id=…&action=setPickup&pickup[latitude]=…&pickup[longitude]=…&pickup[nickname]=…
 *   &dropoff[latitude]=…&dropoff[longitude]=…&dropoff[nickname]=…&dropoff[formatted_address]=…
 * pickup=my_location when Bharat has no real GPS fix (Uber then uses the phone's location). The universal link opens the
 * app when installed and falls back to mobile web / the store. client_id comes from server config (UBER_CLIENT_ID).
 * No fare: Uber shows it in its own app.
 */
export function uberLink({ pickup = null, dropoff, clientId = '' } = {}) {
  if (!dropoff || !Number.isFinite(dropoff.lat) || !Number.isFinite(dropoff.lng)) throw new Error('dropoff_required');
  const q = [];
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') q.push(`${encodeURIComponent(k).replace(/%5B/g, '[').replace(/%5D/g, ']')}=${encodeURIComponent(String(v))}`); };
  if (clientId) add('client_id', clientId);
  add('action', 'setPickup');
  if (pickup && Number.isFinite(pickup.lat) && Number.isFinite(pickup.lng)) {
    add('pickup[latitude]', r6(pickup.lat)); add('pickup[longitude]', r6(pickup.lng));
    add('pickup[nickname]', (pickup.name || '').slice(0, 60));
  } else add('pickup', 'my_location');
  add('dropoff[latitude]', r6(dropoff.lat)); add('dropoff[longitude]', r6(dropoff.lng));
  add('dropoff[nickname]', (dropoff.name || '').slice(0, 60));
  add('dropoff[formatted_address]', (dropoff.address || '').slice(0, 120));
  const al = appLink('uber', { kind: 'ride', url: `https://m.uber.com/ul/?${q.join('&')}` });
  return { ...L('uber', al.url, 'ride', true, clientId ? al.note : `${al.note} (client_id not configured)`), deeplink: al.deeplink, clientIdConfigured: !!clientId };
}
/**
 * Ola. Documented deep link (https://developers.olacabs.com/docs/deep-linking): book.olacabs.com/?lat&lng&drop_lat&drop_lng&
 * category&utm_source=<XAPP token, mandatory>&dsw=yes — used only when an Ola-issued token is configured. Without one: the
 * book.olacabs.com App Link (assetlinks.json lists com.olacabs.customer), no pickup/drop.
 */
export function olaLink({ pickup = null, dropoff, xappToken = '' } = {}) {
  const al = appLink('ola', { kind: 'ride' });
  if (xappToken && pickup && dropoff) {
    const qs = new URLSearchParams({ lat: r6(pickup.lat), lng: r6(pickup.lng), drop_lat: r6(dropoff.lat), drop_lng: r6(dropoff.lng), category: 'compact', utm_source: xappToken, dsw: 'yes' });
    return { ...L('ola', `https://book.olacabs.com/?${qs}`, 'ride', true, 'Documented Ola deep link (affiliate token configured)'), deeplink: { ...al.deeplink, type: 'documented', prefill: ['pickup lat/lng', 'drop lat/lng'] } };
  }
  return { ...al, note: `${al.note}. Pickup/drop need an Ola affiliate token (not configured)` };
}
/** Rapido: no documented deep link or ride API — the manifest-declared rapido://open entry point (app home, no pickup/drop) with www.rapido.bike as fallback. */
export const rapidoLink = () => appLink('rapido', { kind: 'ride' });
/** Namma Yatri: no public consumer deep-link format (open-source repo checked) — App Link to nammayatri.in (assetlinks.json lists in.juspay.nammayatri). */
export const nammaYatriLink = () => appLink('namma-yatri', { kind: 'ride' });

/** Food: App Links to the Swiggy / Zomato home (no restaurant search parameter: the format is undocumented). Never a menu item or price. */
export const swiggyLink = () => appLink('swiggy', { kind: 'food' });
export const zomatoLink = () => appLink('zomato', { kind: 'food' });
/** Movies: App Links (BookMyShow home, District movies); no showtimes in Bharat Map, no city slug guessed. */
export const bookMyShowLink = () => appLink('bookmyshow', { kind: 'tickets' });
export const districtMovies = () => appLink('district', { kind: 'tickets' });
/** Quick commerce: home pages only — no fabricated product or search-result URLs. All App Links (APK-verified or assetlinks.json). */
export const GROCERY_APPS = {
  blinkit: () => appLink('blinkit', { kind: 'grocery' }),
  zepto: () => appLink('zepto', { kind: 'grocery' }),
  instamart: () => appLink('instamart', { kind: 'grocery' }),
  'flipkart-minutes': () => ({ ...appLink('flipkart-minutes', { kind: 'grocery' }), note: 'App Link to the Flipkart home; Flipkart Minutes is chosen inside Flipkart' }),
  bigbasket: () => appLink('bigbasket', { kind: 'grocery' }),
};
/** Hyderabad Metro ticketing (INTEGRATIONS.md §3): WhatsApp click-to-chat to HMRL's published number, the official TSavaari app (Store link, package confirmed on its Play listing), official FAQ. */
export const hmrlWhatsApp = () => L('hmrl-whatsapp', 'https://wa.me/918341146468?text=Hi', 'tickets', true, 'HMRL WhatsApp ticketing (+91 83411 46468)');
export const tsavaariSearch = () => ({ ...appLink('metro-hyderabad', { kind: 'tickets' }), provider: 'metro-hyderabad' });
export const hmrlOfficial = () => L('ltmetro', 'https://ltmetro.com/faqs/', 'tickets', true, 'Official L&T Metro Hyderabad site');
export const irctc = () => L('irctc', 'https://www.irctc.co.in/', 'tickets', true);
export const indiaPostTracking = () => L('indiapost', 'https://www.indiapost.gov.in/', 'tracking', true, 'Tracking number is entered on India Post (captcha form)');
export const googleMapsDir = (p) => L('google-maps', `https://www.google.com/maps/dir/?api=1&destination=${r6(p.lat)},${r6(p.lng)}`, 'maps', true);
export const telLink = (number, provider = 'phone') => ({ provider, host: 'phone', url: `tel:${String(number).replace(/[^\d+]/g, '')}`, kind: 'call', verified: true });
export const EMERGENCY = { police_all: '112', ambulance: '108' };

/** OSM-tag link-outs (website, website:menu, reservation:url, contact:website) — verified as "from OpenStreetMap". */
export function osmLinks(tags = {}) {
  const out = [];
  const norm = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const pick = (k, kind) => { const v = String(tags[k] || '').split(';')[0].trim(); if (v && /^[\w.-]+\.[a-z]{2,}(\/|$)|^https?:\/\//i.test(v)) { const url = norm(v); if (/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(url)) out.push({ provider: `osm:${k}`, host: hostOf(url), url, kind, verified: true, note: 'From OpenStreetMap' }); } };
  pick('website:menu', 'menu'); pick('reservation:url', 'reserve'); pick('website', 'website'); if (!tags.website) pick('contact:website', 'website');
  return out;
}

/** Is a URL safe to hand to the interstitial (https/http/tel, or an intent URL from deeplinks.js; never javascript:/data:/upi:)? */
export function safeLinkout(u) {
  if (typeof u !== 'string') return false;
  if (/^tel:\+?\d{2,15}$/.test(u)) return true;
  if (u.startsWith('intent:')) return safeIntent(u);
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') && !!x.host && !/\s/.test(u); } catch { return false; }
}
