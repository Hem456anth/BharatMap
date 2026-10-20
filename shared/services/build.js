// Service panel builder (docs/re/UI_UX_SPEC_V2.md §2–§4). Pure and synchronous: the app builds the panel instantly
// from what it already has (works offline), async providers (web/services/providers/) fill in departures, ride ETA,
// nearby shops and server-only extras, and the server builds the same panel for GET /api/v1/places/:id/services.
//
// Output (PanelModel):
//   { type, kind, provenance, state, compact: Row[], sections: [{ id, k, rows: Row[] }], actions: Action[],
//     primary, secondary, footer: [{ k|text, label?, provenance? }], safety?: key }
//   Row    = { id, k, value? | vk+vars?, fact?: true } | { …, label: live|scheduled|estimate|linkout|unavailable, source, fetchedAt, … }
//            fact rows are plain map facts (OSM tags) and carry no label; every other row carries exactly one label.
//   Action = { id, kind: linkout|order|ondc|call|emergency|directions|addstop|remember|liststore|ride, k, url?, host?,
//              verified?, provider?, label?, provenance?, needsNet?, disabled? }
// Nothing here invents a fare, price, menu, showtime, stock level, live position or traffic value.
import { pv } from './labels.js';
import { panelTypeFor, stationKind, fuelKind, healthKind, emergencyCapable, secondaryFor } from './panel-types.js';
import {
  cityOf, uberLink, olaLink, rapidoLink, nammaYatriLink, swiggyLink, zomatoLink, bookMyShowLink, districtMovies,
  hmrlWhatsApp, tsavaariSearch, hmrlOfficial, irctc, indiaPostTracking, telLink, osmLinks, EMERGENCY,
} from './linkouts.js';
import { BY_ID, PROVIDERS, linkable, metroFor, busFor } from './catalog.js';
import { appLink, DEEPLINKS } from './deeplinks.js';

/**
 * Link-out action for a catalogue provider: its app hand-off when one is verified (deeplinks.js: APK App Link / documented /
 * declared, assetlinks.json App Link, or a Play Store link with a confirmed package), else the official URL labelled
 * Web-only. Null when not linkable. extra.web forces the official page (e.g. a price page); extra.app adds a separate
 * "Open <app>" action (id suffix -app) for providers whose main action is a web page.
 */
function provAction(id, extra = {}) {
  const p = BY_ID[id];
  if (!linkable(p)) return null;
  const d = DEEPLINKS[id];
  const al = extra.url || extra.web ? null : appLink(id);
  if (extra.app && !al) return null;
  const url = extra.url || al?.url || p.url;
  const dl = al ? { deeplink: al.deeplink } : d && (d.type === 'web' || extra.web) && !extra.url ? { deeplink: { type: 'web', reason: d.type === 'web' ? d.reason : 'Official web page' } } : {};
  return { id: `p-${id}${extra.app ? '-app' : ''}`, kind: 'linkout', k: extra.k || 'sv_open_provider', text: extra.app ? al.deeplink.app : p.name, url, host: al?.deeplink.webUrl ? hostOf(al.deeplink.webUrl) : al?.host || hostOf(url), verified: al ? al.verified : !!p.verified, provider: id, class: p.class, note: extra.note || p.reason || '', label: 'linkout', needsNet: true, ...dl, ...(extra.group ? { group: extra.group } : {}) };
}
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
/** An "Unavailable" row for a provider that cannot be used (reason shown, no link). */
const unavailableRow = (id) => { const p = BY_ID[id]; return { id: `na-${id}`, k: 'sv_provider_na', vk: 'sv_provider_na_v', vars: { name: p.name, reason: p.reason }, provider: id, ...pv(null, 'unavailable', { source: p.reason }) }; };
const pushAll = (P, list) => { for (const a of list) if (a) P.actions.push(a); };

const fact = (id, k, value, extra = {}) => ({ id, k, value: String(value), fact: true, ...extra });
const yesNo = (v) => (v === 'yes' ? 'sv_yes' : v === 'no' ? 'sv_no' : null);
const OSM = { k: 'sv_src_osm' };

function hoursRow(ctx, tags) {
  const st = ctx.hours;
  if (!tags.opening_hours) return { id: 'hours', k: 'sv_hours', vk: 'sv_hours_unmapped', ...pv(null, 'unavailable', { source: 'OpenStreetMap' }) };
  if (tags.opening_hours === '24/7') return { id: 'hours', k: 'sv_hours', vk: 'sv_open_24', ...pv('24/7', 'scheduled', { source: 'OpenStreetMap opening_hours' }) };
  if (!st || st.status === 'unknown') return { id: 'hours', k: 'sv_hours', value: tags.opening_hours, ...pv(tags.opening_hours, 'scheduled', { source: 'OpenStreetMap opening_hours' }) };
  const vk = st.status === 'open' ? (st.until ? 'sv_open_until' : 'sv_open_now') : st.opensAt ? (st.opensDay === 'tomorrow' ? 'sv_closed_opens_tomorrow' : 'sv_closed_opens') : 'sv_closed';
  return { id: 'hours', k: 'sv_hours', vk, vars: { t: st.until || st.opensAt || '' }, ...pv(st.status, 'scheduled', { source: 'OpenStreetMap opening_hours' }) };
}
function paymentFacts(tags) {
  const out = [];
  if (tags['payment:upi'] === 'yes') out.push('UPI');
  if (tags['payment:cash'] === 'yes') out.push('Cash');
  if (tags['payment:cards'] === 'yes' || tags['payment:credit_cards'] === 'yes' || tags['payment:debit_cards'] === 'yes') out.push('Cards');
  return out.length ? [fact('payment', 'sv_payment', out.join(' · '))] : [];
}
function linkAction(id, k, l, extra = {}) {
  return { id, kind: 'linkout', k, url: l.url, host: l.host, verified: !!l.verified, provider: l.provider, note: l.note || '', label: 'linkout', needsNet: true, ...(l.deeplink ? { deeplink: l.deeplink } : {}), ...extra };
}
function sellerOrder(seller) {
  return { id: 'order-demo', kind: 'order', k: 'sv_order_demo', sellerId: seller.id, provenance: 'demo', needsNet: false };
}
function ondcAction(domain) {
  return { id: `ondc-${domain}`, kind: 'ondc', k: 'sv_order_ondc', domain, provenance: 'demo', needsNet: true, prototype: true };
}

/** buildServicePanel(place, ctx) → PanelModel (or null when the place has no panel type: then only Ride is offered). */
export function buildServicePanel(place, ctx = {}) {
  const tags = place.tags || {};
  const seller = ctx.seller || null;
  const type = ctx.forceType || panelTypeFor(tags, { seller, category: place.category });
  const city = cityOf(place);
  const online = ctx.online !== false;
  const cfg = ctx.config || {};
  const P = { type: type || 'none', kind: null, provenance: seller ? 'demo' : null, state: 'ready', compact: [], sections: [], actions: [], primary: null, secondary: secondaryFor(type), footer: [], notices: [] };
  const sec = (id, k, rows) => { const r = rows.filter(Boolean); if (r.length) P.sections.push({ id, k, rows: r }); return r; };
  const phone = String(tags.phone || tags['contact:phone'] || '').split(';')[0].trim();
  const callAction = phone ? { id: 'call', kind: 'call', k: 'sv_call', url: telLink(phone).url, host: 'phone', needsNet: false } : null;
  const osm = osmLinks(tags);
  const websiteLink = osm.find((l) => l.kind === 'website');

  if (type === 'restaurant') {
    const facts = [];
    if (tags.cuisine) facts.push(fact('cuisine', 'sv_cuisine', tags.cuisine.replace(/_/g, ' ').split(';').join(', ')));
    const diet = ['vegetarian', 'vegan', 'jain', 'halal'].filter((d) => /^(yes|only)$/.test(tags[`diet:${d}`] || ''));
    if (diet.length) facts.push(fact('diet', 'sv_diet', diet.join(', ')));
    const svc = [['takeaway', 'sv_takeaway'], ['delivery', 'sv_delivery'], ['outdoor_seating', 'sv_outdoor']].filter(([k]) => tags[k]).map(([k, key]) => ({ k: key, v: yesNo(tags[k]) || tags[k] }));
    for (const s of svc) facts.push({ id: s.k, k: s.k, vk: s.v.startsWith('sv_') ? s.v : null, value: s.v.startsWith('sv_') ? undefined : s.v, fact: true });
    P.compact.push(hoursRow(ctx, tags));
    sec('about', 'sv_about', [hoursRow(ctx, tags), ...facts, ...paymentFacts(tags)]);
    const menu = osm.find((l) => l.kind === 'menu');
    const order = [];
    if (seller) { P.actions.push(sellerOrder(seller)); order.push({ id: 'order', k: 'sv_ordering', vk: 'sv_order_demo_row', fact: true, provenance: 'demo' }); }
    else order.push({ id: 'order', k: 'sv_ordering', vk: 'sv_order_none', ...pv(null, 'unavailable', { source: 'Bharat Map' }) });
    if (menu) { order.push({ id: 'menu', k: 'sv_menu', vk: 'sv_menu_link', vars: { host: menu.host }, ...pv(menu.host, 'linkout', { source: 'OpenStreetMap website:menu' }) }); P.actions.push(linkAction('menu', 'sv_menu_open', menu)); }
    else order.push({ id: 'menu', k: 'sv_menu', vk: 'sv_menu_none', ...pv(null, 'unavailable', { source: 'Bharat Map' }) });
    sec('order', 'sv_order_title', order);
    const res = osm.find((l) => l.kind === 'reserve');
    if (res) P.actions.push(linkAction('reserve', 'sv_reserve', res));
    if (cfg.ondcPrototype) P.actions.push(ondcAction('food'));
    const name = place.name || '';
    // App Links to the apps' home screens (no restaurant-name parameter: the search format is not documented).
    if (name) { P.actions.push(linkAction('swiggy', 'sv_open_swiggy', swiggyLink())); P.actions.push(linkAction('zomato', 'sv_open_zomato', zomatoLink())); }
    pushAll(P, [provAction('magicpin', { group: 'food' }), provAction('dineout', { group: 'reserve' }), provAction('eazydiner', { group: 'reserve' })]);
    P.primary = seller ? 'order-demo' : name ? 'swiggy' : null;
  } else if (type === 'cinema') {
    const f = [];
    if (tags.screen) f.push(fact('screens', 'sv_screens', tags.screen));
    if (tags.wheelchair) f.push({ id: 'wc', k: 'sv_wheelchair', vk: yesNo(tags.wheelchair) || null, value: yesNo(tags.wheelchair) ? undefined : tags.wheelchair, fact: true });
    if (tags.air_conditioning) f.push({ id: 'ac', k: 'sv_ac', vk: yesNo(tags.air_conditioning), fact: true });
    if (tags.parking) f.push(fact('parking', 'sv_parking', tags.parking));
    sec('about', 'sv_facilities', [hoursRow(ctx, tags), ...f]);
    const show = { id: 'showtimes', k: 'sv_showtimes', vk: 'sv_showtimes_none', ...pv(null, 'unavailable', { source: cfg.showtimesFeed ? 'Licensed showtimes feed (configured, adapter not connected)' : 'No licensed showtimes feed' }) };
    P.compact.push(show);
    sec('shows', 'sv_shows_title', [show]);
    if (websiteLink) P.actions.push(linkAction('tickets-site', 'sv_tickets_site', websiteLink));
    P.actions.push(linkAction('bookmyshow', 'sv_open_bms', bookMyShowLink()));
    P.actions.push(linkAction('district', 'sv_open_district', districtMovies()));
    const brand = `${place.name || ''} ${tags.brand || ''} ${tags.operator || ''}`;
    if (/\b(pvr|inox)\b/i.test(brand)) pushAll(P, [provAction('pvr-inox')]);
    if (/cin[eé]polis/i.test(brand)) pushAll(P, [provAction('cinepolis')]);
    P.footer.push({ k: 'sv_district_merged' });
    P.primary = websiteLink ? 'tickets-site' : 'bookmyshow';
  } else if (type === 'station') {
    const kind = stationKind(tags); P.kind = kind;
    const d = ctx.departures;
    const rows = [];
    if (kind === 'metro' || (d && d.status !== 'no_feed')) {
      if (!d || d.status === 'loading') rows.push({ id: 'dep-loading', k: 'sv_departures', vk: 'sv_checking', ...pv(null, 'unavailable', { source: '' }), loading: true });
      else if (d.status === 'ready' && d.next?.length) {
        for (const [i, x] of d.next.entries()) rows.push({ id: `dep-${i}`, k: 'sv_departure', vk: 'sv_dep_row', vars: { time: x.time, line: x.line, headsign: x.headsign }, line: x.line, color: x.color || '', platform: x.platform || '', ...pv(x.time, 'scheduled', { source: d.source || 'GTFS timetable', kind: 'departure' }) });
      } else if (d.status === 'ready') rows.push({ id: 'dep-none', k: 'sv_departures', vk: d.first ? 'sv_dep_none_today_first' : 'sv_dep_none_today', vars: { t: d.first || '' }, ...pv(null, 'scheduled', { source: d.source || 'GTFS timetable' }) });
      else rows.push({ id: 'dep-na', k: 'sv_departures', vk: kind === 'metro' ? 'sv_dep_no_match' : 'sv_dep_no_feed', ...pv(null, 'unavailable', { source: 'No operator feed' }) });
      rows.push({ id: 'live', k: 'sv_live_arrivals', vk: 'sv_live_none', ...pv(null, 'unavailable', { source: 'No GTFS-realtime feed' }) });
    } else rows.push({ id: 'dep-na', k: 'sv_departures', vk: kind === 'rail' ? 'sv_dep_rail' : 'sv_dep_no_feed', ...pv(null, kind === 'rail' ? 'linkout' : 'unavailable', { source: kind === 'rail' ? 'Indian Railways (NTES/IRCTC)' : 'No operator feed' }) });
    P.compact.push(...rows.filter((r) => r.id.startsWith('dep-')).slice(0, 2));
    sec('departures', 'sv_departures_title', rows);
    const info = [];
    if (d?.lines?.length) info.push({ id: 'lines', k: 'sv_lines', value: d.lines.map((l) => l.name).join(' · '), lines: d.lines, fact: true });
    if (d?.interchange) info.push({ id: 'interchange', k: 'sv_interchange', value: d.lines.map((l) => l.name).join(' ↔ '), fact: true });
    if (d?.firstLast) info.push({ id: 'firstlast', k: 'sv_first_last', vk: 'sv_first_last_v', vars: d.firstLast, ...pv(`${d.firstLast.first}–${d.firstLast.last}`, 'scheduled', { source: d.source || 'GTFS timetable' }) });
    if (d && d.status !== 'no_feed' && d.status !== 'loading') {
      if (d.fare?.status === 'ready') info.push({ id: 'fare', k: 'sv_fares', vk: 'sv_fare_table', vars: { n: d.fare.count }, ...pv(d.fare.count, 'scheduled', { source: 'GTFS fare_attributes.txt' }) });
      else info.push({ id: 'fare', k: 'sv_fares', vk: 'sv_fare_none', ...pv(null, 'unavailable', { source: 'No fare table in the GTFS feed' }) });
    }
    if (ctx.walk) info.push({ id: 'walk', k: 'sv_walk', vk: 'sv_walk_v', vars: { min: ctx.walk.min }, ...pv(ctx.walk.min, 'estimate', { source: 'Straight-line distance × 1.3 at 4.5 km/h' }) });
    const op = kind === 'metro' ? metroFor(city) : null;
    if (op) info.unshift({ id: 'operator', k: 'sv_operator', value: op.name, fact: true });
    sec('station', 'sv_station_info', info);
    if (kind === 'metro' && city === 'hyderabad') {
      P.actions.push(linkAction('hmrl-wa', 'sv_ticket_whatsapp', hmrlWhatsApp()));
      P.actions.push(linkAction('tsavaari', 'sv_ticket_tsavaari', tsavaariSearch()));
      P.actions.push(linkAction('hmrl-site', 'sv_ticket_official', hmrlOfficial()));
      P.primary = 'hmrl-wa';
      if (cfg.ondcPrototype) sec('ondc', 'sv_ondc_title', [{ id: 'ondc-metro', k: 'sv_ondc_metro', vk: 'sv_ondc_metro_hyd', ...pv(null, 'unavailable', { source: 'ONDC public-transport network list (Jun 2026)' }) }]);
    } else if (op) {
      // Ticketing only where official e-ticketing exists (ONDC / official app / website); otherwise info only.
      if (op.ticketing) { pushAll(P, [provAction(op.id, { k: op.ticketing === 'ondc' ? 'sv_ticket_ondc_op' : 'sv_ticket_official_op' })]); P.primary = `p-${op.id}`; }
      else { pushAll(P, [provAction(op.id, { k: 'sv_info_provider' })]); sec('ticketing', 'sv_ticketing', [{ id: 'tix', k: 'sv_ticketing', vk: 'sv_ticketing_info_only', vars: { name: op.name }, ...pv(null, 'unavailable', { source: op.reason }) }]); }
    } else if (kind === 'rail') { P.actions.push(linkAction('irctc', 'sv_ticket_irctc', irctc())); P.primary = 'irctc'; }
    else if (kind === 'bus') {
      for (const b of busFor(city)) pushAll(P, [provAction(b.id, { k: b.ticketing ? 'sv_ticket_official_op' : 'sv_info_provider', group: 'bus' })]);
      pushAll(P, [provAction('chalo', { group: 'apps' }), provAction('tummoc', { k: 'sv_info_provider', group: 'apps' })]);
    }
    else if (websiteLink) P.actions.push(linkAction('operator', 'sv_operator_site', websiteLink));
    P.actions.push({ id: 'plan', kind: 'directions', k: 'sv_plan_from_here', mode: 'transit', needsNet: false });
    if (d?.attribution) P.footer.push({ text: d.attribution, k: 'sv_src_timetable', label: 'scheduled', vars: { date: d.feedDate || '' } });
  } else if (type === 'grocery' || type === 'retail') {
    P.compact.push(hoursRow(ctx, tags));
    const rows = [hoursRow(ctx, tags)];
    if (type === 'retail' && tags.shop) rows.push(fact('sells', 'sv_sells', tags.shop.replace(/_/g, ' ')));
    rows.push(...paymentFacts(tags));
    sec('about', 'sv_about', rows);
    const ord = [];
    if (seller) {
      P.actions.push(sellerOrder(seller));
      ord.push({ id: 'order', k: 'sv_ordering', vk: 'sv_order_demo_row', fact: true, provenance: 'demo' });
      ord.push({ id: 'stock', k: 'sv_stock', vk: 'sv_stock_demo', ...pv(null, 'unavailable', { source: 'Bharat Shop (demo)', provenance: 'demo' }) });
    } else {
      ord.push({ id: 'order', k: 'sv_ordering', vk: 'sv_store_not_listed', ...pv(null, 'unavailable', { source: 'Bharat Map' }) });
      ord.push({ id: 'stock', k: 'sv_stock', vk: 'sv_stock_check', ...pv(null, 'unavailable', { source: 'No seller feed' }) });
      P.actions.push({ id: 'list-store', kind: 'liststore', k: 'sv_list_store', needsNet: false });
    }
    sec('order', 'sv_order_title', ord);
    if (cfg.ondcPrototype) P.actions.push(ondcAction('retail'));
    if (type === 'grocery') {
      pushAll(P, ['blinkit', 'zepto', 'instamart', 'flipkart-minutes', 'bigbasket', 'jiomart', 'dmart-ready'].map((id) => provAction(id, { group: 'apps' })));
      if (ctx.nearby?.length) sec('nearby', 'sv_nearby_shops', ctx.nearby.slice(0, 4).map((n, i) => ({ id: `near-${i}`, k: 'sv_nearby_shop', vk: 'sv_nearby_v', vars: { name: n.name, d: n.d }, place: n, ...pv(n.d, 'estimate', { source: 'Offline OSM place index, straight-line distance' }) })));
    }
    P.primary = seller ? 'order-demo' : cfg.ondcPrototype ? `ondc-${type}` : callAction ? 'call' : null;
  } else if (type === 'ride') {
    P.primary = 'uber';
  } else if (type === 'hotel') {
    const f = [];
    if (tags.stars) f.push(fact('stars', 'sv_stars', tags.stars));
    if (tags.checkin || tags.check_in) f.push(fact('checkin', 'sv_checkin', tags.checkin || tags.check_in));
    if (tags.checkout || tags.check_out) f.push(fact('checkout', 'sv_checkout', tags.checkout || tags.check_out));
    for (const [k, key] of [['internet_access', 'sv_wifi'], ['air_conditioning', 'sv_ac'], ['wheelchair', 'sv_wheelchair']]) if (tags[k]) f.push({ id: k, k: key, vk: yesNo(tags[k]), value: yesNo(tags[k]) ? undefined : tags[k], fact: true });
    sec('about', 'sv_about', f);
    const rates = { id: 'rates', k: 'sv_rates', vk: 'sv_rates_none', ...pv(null, 'unavailable', { source: 'No hotel partner API' }) };
    P.compact.push(rates); sec('book', 'sv_book_title', [rates]);
    if (websiteLink) { P.actions.push(linkAction('book-site', 'sv_book_site', websiteLink)); P.primary = 'book-site'; }
    pushAll(P, ['makemytrip', 'booking-com', 'agoda', 'goibibo', 'cleartrip', 'easemytrip'].map((id) => provAction(id, { group: 'book' })));
    pushAll(P, [provAction('incredible-india', { k: 'sv_info_provider', group: 'info' })]);
    if (!P.primary) P.primary = 'p-makemytrip';
  } else if (type === 'fuel') {
    const fk = fuelKind(tags); P.kind = fk;
    if (fk === 'fuel') {
      const fuels = [['fuel:diesel', 'Diesel'], ['fuel:octane_91', 'Petrol 91'], ['fuel:octane_95', 'Petrol 95'], ['fuel:octane_98', 'Petrol 98'], ['fuel:cng', 'CNG'], ['fuel:lpg', 'LPG'], ['fuel:e20', 'E20']].filter(([k]) => tags[k] === 'yes').map(([, n]) => n);
      const rows = [hoursRow(ctx, tags)];
      if (fuels.length) rows.push(fact('fuels', 'sv_fuels', fuels.join(' · ')));
      if (tags.brand || tags.operator) rows.push(fact('brand', 'sv_brand', tags.brand || tags.operator));
      if (tags.compressed_air) rows.push({ id: 'air', k: 'sv_air', vk: yesNo(tags.compressed_air), fact: true });
      if (tags.toilets) rows.push({ id: 'toilets', k: 'sv_toilets', vk: yesNo(tags.toilets), fact: true });
      const price = { id: 'price', k: 'sv_fuel_price', vk: 'sv_fuel_price_none', ...pv(null, 'unavailable', { source: 'No open fuel-price feed' }) };
      rows.push(price); P.compact.push(hoursRow(ctx, tags), price);
      sec('about', 'sv_about', rows);
      const b = `${tags.brand || ''} ${tags.operator || ''} ${place.name || ''}`;
      if (/indian ?oil|iocl/i.test(b)) pushAll(P, [provAction('indianoil', { k: 'sv_iocl_prices', web: true }), provAction('indianoil', { app: true })]);
      if (/\bhp\b|hindustan petroleum|hpcl/i.test(b)) pushAll(P, [provAction('hpcl')]);
      if (/jio.?bp|reliance/i.test(b)) pushAll(P, [provAction('jio-bp')]);
    } else {
      const ev = place.ev || ctx.ev || {};
      const rows = [];
      if (ev.connectors?.length) rows.push(fact('connectors', 'sv_connectors', ev.connectors.map((c) => `${c.type}${c.count ? ` × ${c.count}` : ''}${c.power_kw ? ` · ${c.power_kw} kW` : ''}`).join(', ')));
      if (ev.operator || ev.network) rows.push(fact('operator', 'sv_operator', ev.operator || ev.network));
      if (ev.points) rows.push(fact('points', 'sv_points', ev.points));
      const live = ev.status?.title && ev.fetchedAt && online
        ? { id: 'status', k: 'sv_charger_status', value: ev.status.title, ...pv(ev.status.title, 'live', { source: 'Open Charge Map', fetchedAt: ev.fetchedAt, kind: 'charger' }) }
        : { id: 'status', k: 'sv_charger_status', vk: 'sv_charger_status_none', ...pv(null, 'unavailable', { source: cfg.ocmLive ? 'Open Charge Map (no status for this charger)' : 'Live status needs Open Charge Map' }) };
      rows.push(live); P.compact.push(live);
      sec('about', 'sv_charging', rows);
      if (websiteLink) P.actions.push(linkAction('charge', 'sv_charge_app', websiteLink));
      const op = `${ev.operator || ''} ${ev.network || ''} ${tags.operator || ''} ${tags.brand || ''} ${place.name || ''}`;
      const evIds = ['chargezone', 'statiq', 'tata-ez'];
      const match = evIds.filter((id) => new RegExp({ chargezone: 'charge ?zone', statiq: 'statiq', 'tata-ez': 'tata power|ez ?charge' }[id], 'i').test(op));
      pushAll(P, [...match, ...evIds.filter((x) => !match.includes(x))].map((id) => provAction(id, { group: 'ev' })));
      if (ev.source && /open charge map/i.test(ev.source)) P.footer.push({ text: 'Open Charge Map (CC BY 4.0) and its data providers' });
    }
    P.actions.push({ id: 'addstop', kind: 'addstop', k: 'sv_add_stop', needsNet: false });
  } else if (type === 'parking') {
    const toll = tags.barrier === 'toll_booth';
    const pk = place.parking || {};
    const rows = [];
    const kinds = { surface: 'Surface', 'multi-storey': 'Multi-storey', underground: 'Underground', street_side: 'Street side', rooftop: 'Rooftop' };
    if (tags.parking || pk.kind) rows.push(fact('kind', 'sv_parking_type', kinds[tags.parking || pk.kind] || tags.parking || pk.kind));
    if (tags.fee) rows.push({ id: 'fee', k: 'sv_fee', vk: yesNo(tags.fee), value: yesNo(tags.fee) ? undefined : tags.fee, fact: true });
    if (tags.capacity) rows.push(fact('capacity', 'sv_capacity', tags.capacity));
    if (tags['capacity:motorcar'] || tags['capacity:motorcycle']) rows.push(fact('cap2', 'sv_capacity_2w', tags['capacity:motorcycle'] || '—'));
    if (tags.maxstay) rows.push(fact('maxstay', 'sv_maxstay', tags.maxstay));
    if (tags.covered) rows.push({ id: 'covered', k: 'sv_covered', vk: yesNo(tags.covered), fact: true });
    if (tags.opening_hours) rows.push(hoursRow(ctx, tags));
    const free = { id: 'free', k: 'sv_free_spaces', vk: 'sv_free_none', ...pv(null, 'unavailable', { source: 'No operator occupancy feed' }) };
    rows.push(free); P.compact.push(free);
    if (toll) rows.push({ id: 'tollfee', k: 'sv_toll_fee', vk: 'sv_toll_fee_unknown', ...pv(null, 'unavailable', { source: 'NHAI TIS (fees not available as open data)' }) });
    sec('about', toll ? 'sv_toll_title' : 'sv_parking_title', rows);
    if (toll) pushAll(P, [provAction('nhai', { k: 'sv_nhai_tis', web: true }), provAction('nhai', { app: true }), provAction('highway-delite')]);
    else { P.actions.push({ id: 'remember', kind: 'remember', k: 'sv_remember_parking', needsNet: false }); pushAll(P, [provAction('parkplus'), provAction('parkmate')]); }
  } else if (type === 'health') {
    const hk = healthKind(tags); P.kind = hk;
    const em = emergencyCapable(tags);
    P.actions.push({ id: 'call112', kind: 'emergency', k: 'sv_call_112', url: telLink(EMERGENCY.police_all).url, host: 'phone', needsNet: false, top: em });
    P.actions.push({ id: 'call108', kind: 'emergency', k: 'sv_call_108', url: telLink(EMERGENCY.ambulance).url, host: 'phone', needsNet: false });
    if (em) P.safety = 'sv_safety_112';
    const rows = [hoursRow(ctx, tags)];
    if (tags.emergency) rows.push({ id: 'emergency', k: 'sv_emergency_dept', vk: yesNo(tags.emergency), fact: true });
    if (tags['healthcare:speciality']) rows.push(fact('speciality', 'sv_speciality', tags['healthcare:speciality'].replace(/;/g, ', ')));
    if (hk === 'pharmacy') rows.push({ id: 'stock', k: 'sv_medicine_stock', vk: 'sv_never_inferred', ...pv(null, 'unavailable', { source: 'No pharmacy stock feed' }) });
    if (hk === 'hospital') rows.push({ id: 'beds', k: 'sv_beds', vk: 'sv_never_inferred', ...pv(null, 'unavailable', { source: 'No bed-availability feed' }) });
    P.compact.push(hoursRow(ctx, tags));
    sec('about', 'sv_about', rows);
    pushAll(P, (hk === 'pharmacy' ? ['apollo-pharmacy', 'tata-1mg', 'netmeds'] : ['practo', 'apollo-247', 'esanjeevani']).map((id) => provAction(id, { group: 'health' })));
    pushAll(P, [provAction('112-india', { k: 'sv_info_provider', group: 'info' })]);
    P.primary = em ? 'call112' : callAction ? 'call' : null;
  } else if (type === 'courier') {
    const rows = [hoursRow(ctx, tags)];
    if (tags['addr:postcode']) rows.push(fact('pincode', 'sv_pincode', tags['addr:postcode']));
    else if (ctx.pincode) rows.push({ id: 'pincode', k: 'sv_pincode', value: ctx.pincode.pin, ...pv(ctx.pincode.pin, 'estimate', { source: 'Nearest pincode centroid in the offline OSM index' }) });
    if (ctx.digipin) rows.push(fact('digipin', 'sv_digipin', ctx.digipin));
    rows.push({ id: 'eta', k: 'sv_delivery_estimate', vk: 'sv_delivery_estimate_none', ...pv(null, 'unavailable', { source: 'No courier API connected' }) });
    sec('about', 'sv_about', rows);
    P.compact.push(hoursRow(ctx, tags));
    P.actions.push(linkAction('track', 'sv_track_parcel', indiaPostTracking()));
    P.primary = 'track';
  } else if (type === 'venue') {
    const rows = [hoursRow(ctx, tags)];
    if (tags.religion) rows.push(fact('religion', 'sv_religion', tags.religion));
    if (tags.dress_code) rows.push(fact('dress', 'sv_dress', tags.dress_code));
    if (tags.toilets) rows.push({ id: 'toilets', k: 'sv_toilets', vk: yesNo(tags.toilets), fact: true });
    if (tags.drinking_water) rows.push({ id: 'water', k: 'sv_water', vk: yesNo(tags.drinking_water), fact: true });
    if (tags.wheelchair) rows.push({ id: 'wc', k: 'sv_wheelchair', vk: yesNo(tags.wheelchair) || null, value: yesNo(tags.wheelchair) ? undefined : tags.wheelchair, fact: true });
    rows.push({ id: 'crowd', k: 'sv_crowd', vk: 'sv_crowd_none', ...pv(null, 'unavailable', { source: 'No crowd data source' }) });
    sec('about', 'sv_about', rows);
    P.compact.push(hoursRow(ctx, tags));
    if (websiteLink) { P.actions.push(linkAction('events', 'sv_events_site', websiteLink)); P.primary = 'events'; }
  }

  // Ride: primary on taxi stands, otherwise a secondary service on every card.
  if (type === 'ride' || P.secondary.includes('ride')) P.ride = buildRidePanel(place, ctx);
  if (type === 'ride') { P.sections.push(...P.ride.sections); P.actions.push(...P.ride.actions); P.compact.push(...P.ride.compact); }
  // Admin-verified provider links (server: provider_links table) — Link-out, verified by Bharat Map.
  for (const l of ctx.verifiedLinks || []) P.actions.push(linkAction(`pl-${l.id}`, 'sv_provider_link', { provider: l.provider_id, host: l.host, url: l.url, verified: true, note: 'Verified by Bharat Map' }, { text: l.label || l.provider_id }));
  if (callAction && !P.actions.some((a) => a.id === 'call')) P.actions.push(callAction);
  if (P.provenance === 'demo') P.footer.push({ k: 'prov_demo', provenance: 'demo' });
  P.footer.push(OSM);

  // States (spec §3): no integration = nothing transactable and no link-out except call/website; offline = disable net actions.
  const transact = P.actions.some((a) => ['order', 'ondc', 'linkout', 'emergency'].includes(a.kind));
  if (type && !transact) { P.state = 'no-integration'; P.notices.push(`sv_noint_${type}`); }
  if (!online) {
    P.state = 'offline';
    for (const a of P.actions) if (a.needsNet) { a.disabled = true; a.disabledKey = 'sv_needs_internet'; }
    for (const s of P.sections) for (const r of s.rows) if (r.label === 'live') { r.label = 'unavailable'; r.value = null; r.vk = 'sv_offline_value'; }
  }
  if (ctx.partialFailures?.length) { if (P.state === 'ready') P.state = 'partial'; P.notices.push('sv_partial'); P.failed = ctx.partialFailures; }
  return P;
}

/** Ride panel: ETA from Bharat routing (Estimate, no live traffic), no fare, provider hand-offs. */
export function buildRidePanel(place, ctx = {}) {
  const cfg = ctx.config || {};
  const origin = ctx.origin && ctx.origin.real ? ctx.origin : null;
  const est = ctx.rideEstimate;
  const rows = [];
  if (!est || est.status === 'loading') rows.push({ id: 'eta', k: 'sv_ride_eta', vk: 'sv_checking', ...pv(null, 'unavailable', { source: '' }), loading: true });
  else if (est.status === 'ready') rows.push({ id: 'eta', k: 'sv_ride_eta', vk: est.fallback ? 'sv_ride_eta_straight' : ctx.origin && !ctx.origin.real ? 'sv_ride_eta_centre' : 'sv_ride_eta_v', vars: { min: Math.max(1, Math.round(est.duration_s / 60)), km: (est.distance_m / 1000).toFixed(1) }, ...pv(est.duration_s, 'estimate', { source: est.fallback ? 'Straight-line estimate (routing unreachable)' : `Bharat routing (${est.engine || 'OSRM/Valhalla'}), free-flow, no live traffic` }) });
  else rows.push({ id: 'eta', k: 'sv_ride_eta', vk: 'sv_ride_eta_none', ...pv(null, 'unavailable', { source: 'Routing unavailable' }) });
  rows.push({ id: 'fare', k: 'sv_fare', vk: 'sv_fare_in_app', ...pv(null, 'linkout', { source: 'Ride apps show fares; Bharat Map has no quote' }) });
  rows.push({ id: 'pickup', k: 'sv_pickup', vk: origin ? 'sv_pickup_here' : 'sv_pickup_app', fact: true });
  const dropoff = { lat: place.lat, lng: place.lng, name: place.name || '', address: place.address || '' };
  const actions = [
    linkAction('uber', 'sv_open_uber', uberLink({ pickup: origin ? { lat: origin.lat, lng: origin.lng, name: origin.label || 'My location' } : null, dropoff, clientId: cfg.uberClientId || '' }), { group: 'ride' }),
    linkAction('ola', 'sv_open_ola', olaLink({ pickup: origin, dropoff, xappToken: cfg.olaXappToken || '' }), { group: 'ride' }),
    linkAction('rapido', 'sv_open_rapido', rapidoLink(), { group: 'ride' }),
    linkAction('nammayatri', 'sv_open_nammayatri', nammaYatriLink(), { group: 'ride' }),
  ];
  const city = cityOf(place);
  for (const id of ['bharat-taxi', 'yatri-sathi']) { const p = BY_ID[id]; if (!p.regions || p.regions.includes(city)) { const a = provAction(id, { group: 'ride' }); if (a) actions.push(a); } }
  rows.push(unavailableRow('blusmart'));
  return { sections: [{ id: 'ride', k: 'sv_ride_title', rows }], actions, compact: rows.slice(0, 1) };
}
