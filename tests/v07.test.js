// v0.7 unit tests: place-card service panels (tag→panel mapping, honesty rules, link builders), provider catalogue +
// generated integration matrix, landmark address resolution, GTFS departures/fares, "Also here", truck costing,
// payment gateway adapters (signatures/checksums computed locally — NOT verified against live gateways), i18n.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { panelTypeFor, PANEL_TYPES, stationKind } from '../shared/services/panel-types.js';
import { buildServicePanel, buildRidePanel } from '../shared/services/build.js';
import { pv, effectiveLabel, mayShowAmount, panelViolations, displayRow, LABELS } from '../shared/services/labels.js';
import { uberLink, olaLink, safeLinkout, swiggyLink, cityOf, hmrlWhatsApp } from '../shared/services/linkouts.js';
import { PROVIDERS, BY_ID, statusOf, linkable, metroFor, busFor } from '../shared/services/catalog.js';
import { matrixMarkdown } from '../scripts/gen-integration-matrix.mjs';
import { resolveLandmarkAddress, extractAnchors } from '../shared/address.js';
import { stationDepartures, gtfsFare, matchStop, lineName } from '../shared/services/departures.js';
import { buildAlsoHereQuery, parseAlsoHere } from '../shared/services/also-here.js';
import { buildValhallaRequest } from '../shared/valhalla.js';
import { unpackTimetable } from '../shared/transit/pack.js';
import { cashfreeAdapter, cashfreeSignature, phonepeAdapter, phonepeWebhookAuth, paytmGenerateSignature, paytmVerifySignature, paytmParamString, paytmAdapter, createPayments, razorpayAdapter } from '../server/payments/index.js';
import { createIntegrations, trafficConfig, stubAdapter } from '../server/integrations/index.js';
import { V7, V7_KEYS, V7_LABEL_KEYS } from '../shared/i18n-v07.js';
import { t, fallbackKeys, LANGS } from '../shared/i18n.js';
import { progress } from '../shared/logistics.js';
import { BUSINESSES } from '../shared/seed.js';

const HMRL = unpackTimetable(JSON.parse(fs.readFileSync(new URL('../web/transit/hmrl.json', import.meta.url), 'utf8')));
const AMEERPET = { id: 'osm:node/1', name: 'Ameerpet', lat: 17.4357214, lng: 78.4447933, tags: { railway: 'station', station: 'subway' } };
const HYD = { lat: 17.4375, lng: 78.4483 };
const SAMPLES = [
  [{ amenity: 'restaurant', cuisine: 'biryani' }, 'restaurant'], [{ amenity: 'fast_food' }, 'restaurant'], [{ amenity: 'cafe' }, 'restaurant'],
  [{ amenity: 'cinema' }, 'cinema'], [{ railway: 'station', station: 'subway' }, 'station'], [{ highway: 'bus_stop' }, 'station'], [{ public_transport: 'platform', bus: 'yes' }, 'station'],
  [{ shop: 'supermarket' }, 'grocery'], [{ shop: 'convenience' }, 'grocery'], [{ amenity: 'taxi' }, 'ride'], [{ tourism: 'hotel' }, 'hotel'], [{ tourism: 'guest_house' }, 'hotel'],
  [{ amenity: 'fuel' }, 'fuel'], [{ amenity: 'charging_station' }, 'fuel'], [{ amenity: 'parking' }, 'parking'], [{ barrier: 'toll_booth' }, 'parking'],
  [{ amenity: 'pharmacy' }, 'health'], [{ amenity: 'hospital', emergency: 'yes' }, 'health'], [{ amenity: 'clinic' }, 'health'],
  [{ shop: 'electronics' }, 'retail'], [{ shop: 'clothes' }, 'retail'], [{ amenity: 'post_office' }, 'courier'], [{ tourism: 'museum' }, 'venue'], [{ amenity: 'place_of_worship' }, 'venue'],
];

test('tag → panel mapping covers all 12 panel types; seller and chip fallbacks', () => {
  const seen = new Set();
  for (const [tags, want] of SAMPLES) { const got = panelTypeFor(tags); assert.equal(got, want, JSON.stringify(tags)); seen.add(got); }
  for (const tp of PANEL_TYPES) assert.ok(seen.has(tp), `sample for ${tp}`);
  assert.equal(panelTypeFor({}, { seller: { category: 'electronics' } }), 'retail');
  assert.equal(panelTypeFor({}, { seller: { category: 'grocery' } }), 'grocery');
  assert.equal(panelTypeFor({}, { category: 'metro' }), 'station');
  assert.equal(panelTypeFor({ highway: 'residential' }), null);
  assert.equal(stationKind({ railway: 'station', station: 'subway' }), 'metro');
  assert.equal(stationKind({ highway: 'bus_stop' }), 'bus');
});

test('honesty: every panel for every sample has zero violations; no amounts without a live quote; no Live without a feed', () => {
  for (const [tags] of SAMPLES) {
    for (const online of [true, false]) {
      const P = buildServicePanel({ id: 'osm:node/5', name: 'Test Place', lat: HYD.lat, lng: HYD.lng, tags }, { online, origin: { ...HYD, real: true }, rideEstimate: { status: 'ready', duration_s: 600, distance_m: 4000, engine: 'valhalla' } });
      assert.deepEqual(panelViolations(P), [], `${JSON.stringify(tags)} online=${online}`);
      const rows = [...P.sections.flatMap((s) => s.rows), ...(P.ride?.sections[0].rows || [])];
      assert.ok(rows.every((r) => LABELS.includes(r.label) || r.fact), 'every non-fact row labelled');
      assert.ok(!rows.some((r) => r.label === 'live'), 'no Live rows without a real-time feed');
      assert.ok(!JSON.stringify(rows).includes('₹'), 'no rupee amounts (fares/prices/menus are never fabricated)');
      if (!online) assert.ok(P.actions.filter((a) => a.kind === 'linkout').every((a) => a.disabled), 'link-outs disabled offline');
    }
  }
  // A "live" value without fetchedAt is downgraded; a stale one too; amounts only for fresh live quotes.
  const now = Date.now();
  assert.equal(effectiveLabel(pv('x', 'live', { source: 's' }), now).label, 'unavailable');
  assert.equal(effectiveLabel(pv('x', 'live', { source: 's', fetchedAt: now - 10 * 60_000, freshForSec: 120 }), now).label, 'unavailable');
  assert.equal(effectiveLabel(pv('x', 'live', { source: 's', fetchedAt: now - 30_000, freshForSec: 120 }), now).label, 'live');
  assert.equal(mayShowAmount(pv('₹120', 'estimate', { fare: 120 }), now), false);
  assert.equal(displayRow({ id: 'a', k: 'k', ...pv('x', 'live', { source: 's', fetchedAt: now - 10 * 60_000, freshForSec: 120 }) }, now).stale, true);
  // Demo provenance can never be Live.
  assert.equal(effectiveLabel(pv('5', 'live', { provenance: 'demo', fetchedAt: now, freshForSec: 60, source: 'demo' }), now).label, 'unavailable');
});

test('restaurant / cinema / grocery / hotel / health panels include the catalogue providers (Swiggy, magicpin, Dineout, PVR INOX, JioMart, DMart Ready, Agoda, Apollo, 112)', () => {
  const ids = (tags, name = 'X', extra = {}) => buildServicePanel({ id: 'osm:node/9', name, lat: HYD.lat, lng: HYD.lng, tags }, { online: true, ...extra }).actions.map((a) => a.id);
  const r = ids({ amenity: 'restaurant' }, 'Paradise');
  for (const id of ['swiggy', 'zomato', 'p-magicpin', 'p-dineout', 'p-eazydiner']) assert.ok(r.includes(id), id);
  const c = ids({ amenity: 'cinema', brand: 'PVR' }, 'PVR Nexus');
  assert.ok(c.includes('p-pvr-inox') && c.includes('bookmyshow') && c.includes('district') && !c.includes('p-cinepolis'));
  const g = ids({ shop: 'supermarket' }, 'Ratnadeep');
  for (const id of ['p-blinkit', 'p-zepto', 'p-instamart', 'p-flipkart-minutes', 'p-bigbasket', 'p-jiomart', 'p-dmart-ready']) assert.ok(g.includes(id), id);
  const h = ids({ tourism: 'hotel' }, 'Taj');
  for (const id of ['p-makemytrip', 'p-booking-com', 'p-agoda', 'p-goibibo', 'p-cleartrip', 'p-easemytrip', 'p-incredible-india']) assert.ok(h.includes(id), id);
  const ph = ids({ amenity: 'pharmacy' }, 'MedPlus');
  for (const id of ['call112', 'p-apollo-pharmacy', 'p-tata-1mg', 'p-netmeds', 'p-112-india']) assert.ok(ph.includes(id), id);
  const hosp = buildServicePanel({ id: 'osm:node/9', name: 'KIMS', lat: HYD.lat, lng: HYD.lng, tags: { amenity: 'hospital', emergency: 'yes' } }, { online: true });
  assert.equal(hosp.safety, 'sv_safety_112'); assert.ok(hosp.actions.some((a) => a.url === 'tel:108') && hosp.actions.some((a) => a.id === 'p-practo'));
  const toll = ids({ barrier: 'toll_booth' }, 'Toll');
  assert.ok(toll.includes('p-nhai') && toll.includes('p-highway-delite'));
  const park = ids({ amenity: 'parking' }, 'P');
  assert.ok(park.includes('p-parkplus') && park.includes('p-parkmate'));
  const ev = ids({ amenity: 'charging_station', operator: 'Tata Power' }, 'EZ');
  assert.deepEqual(ev.filter((x) => /p-(chargezone|statiq|tata-ez)/.test(x)), ['p-tata-ez', 'p-chargezone', 'p-statiq']);
  const fuel = ids({ amenity: 'fuel', brand: 'HP' }, 'HP Petrol Pump');
  assert.ok(fuel.includes('p-hpcl') && !fuel.includes('p-indianoil'));
});

test('ride panel: Estimate ETA, fare Unavailable, Uber deep link, Bharat Taxi/Yatri Sathi by region, BluSmart Unavailable with reason and no link', () => {
  const R = buildRidePanel({ name: 'Charminar', lat: 17.3616, lng: 78.4747 }, { online: true, origin: { ...HYD, real: true }, rideEstimate: { status: 'ready', duration_s: 1500, distance_m: 9000, engine: 'valhalla' } });
  const rows = Object.fromEntries(R.sections[0].rows.map((r) => [r.id, r]));
  assert.equal(rows.eta.label, 'estimate'); assert.ok(['unavailable', 'linkout'].includes(rows.fare.label)); assert.ok(!JSON.stringify(rows.fare).includes('₹'));
  assert.equal(rows['na-blusmart'].label, 'unavailable'); assert.match(rows['na-blusmart'].vars.reason, /Apr 2025/);
  assert.ok(!R.actions.some((a) => a.provider === 'blusmart'));
  assert.ok(!R.actions.some((a) => a.id === 'p-yatri-sathi'), 'Yatri Sathi only in West Bengal');
  const K = buildRidePanel({ name: 'Howrah', lat: 22.585, lng: 88.34 }, { online: true });
  assert.ok(K.actions.some((a) => a.id === 'p-yatri-sathi') && !K.actions.some((a) => a.id === 'p-bharat-taxi'));
  const D = buildRidePanel({ name: 'CP', lat: 28.6315, lng: 77.2167 }, { online: true });
  assert.ok(D.actions.some((a) => a.id === 'p-bharat-taxi'));
  const u = R.actions.find((a) => a.id === 'uber');
  assert.match(u.url, /^https:\/\/m\.uber\.com\/ul\/\?action=setPickup&pickup\[latitude\]=17\.4375&pickup\[longitude\]=78\.4483/);
});

test('Uber universal link: client_id from config, pickup/dropoff lat/lng + nickname, my_location without a fix; Ola needs a token', () => {
  const a = uberLink({ pickup: { lat: 17.43751234, lng: 78.4483, name: 'Ameerpet Metro' }, dropoff: { lat: 17.3616, lng: 78.4747, name: 'Charminar' }, clientId: 'abc123' });
  assert.equal(a.host, 'm.uber.com'); assert.equal(a.verified, true); assert.ok(a.clientIdConfigured);
  assert.match(a.url, /client_id=abc123&action=setPickup&pickup\[latitude\]=17\.437512&pickup\[longitude\]=78\.4483&pickup\[nickname\]=Ameerpet%20Metro&dropoff\[latitude\]=17\.3616/);
  const b = uberLink({ dropoff: { lat: 17.3616, lng: 78.4747, name: 'Charminar' } });
  assert.match(b.url, /pickup=my_location/); assert.ok(!/client_id/.test(b.url));
  assert.throws(() => uberLink({}), /dropoff_required/);
  const o = olaLink({ dropoff: { lat: 17.36, lng: 78.47 } });
  assert.equal(o.url, 'https://book.olacabs.com/'); assert.equal(o.deeplink.type, 'applink'); assert.equal(o.deeplink.prefill.length, 0, 'no pickup/drop without the Ola token');
  assert.equal(olaLink({ dropoff: { lat: 17.36, lng: 78.47 }, pickup: HYD, xappToken: 'T' }).deeplink.type, 'documented');
  assert.match(olaLink({ dropoff: { lat: 17.36, lng: 78.47 }, pickup: HYD, xappToken: 'T' }).url, /^https:\/\/book\.olacabs\.com\/\?/);
  assert.equal(safeLinkout('javascript:alert(1)'), false); assert.equal(safeLinkout('upi://pay?pa=x@y'), false); assert.equal(safeLinkout('https://www.swiggy.com/'), true);
  assert.equal(swiggyLink().url, 'https://www.swiggy.com/'); assert.equal(swiggyLink().deeplink.type, 'applink'); // no guessed search parameter
  assert.equal(hmrlWhatsApp().url, 'https://wa.me/918341146468?text=Hi');
});

test('provider catalogue: every requested provider present, honestly classified; matrix doc is current', () => {
  const need = ['swiggy', 'zomato', 'magicpin', 'ondc-food', 'eazydiner', 'dineout', 'restaurant-website', 'bookmyshow', 'district', 'pvr-inox', 'cinepolis', 'ticketnew', 'paytm-insider',
    'blinkit', 'zepto', 'instamart', 'flipkart-minutes', 'bigbasket', 'jiomart', 'dmart-ready', 'uber', 'ola', 'rapido', 'namma-yatri', 'bharat-taxi', 'yatri-sathi', 'blusmart',
    'metro-hyderabad', 'metro-chennai', 'metro-delhi', 'metro-bengaluru', 'metro-mumbai', 'metro-kochi', 'metro-pune', 'metro-ahmedabad', 'metro-jaipur', 'metro-nagpur', 'metro-lucknow', 'metro-kanpur', 'metro-noida', 'metro-kolkata',
    'chalo', 'tummoc', 'tgsrtc', 'apsrtc', 'ksrtc', 'bmtc', 'tnstc', 'mtc-chennai', 'dtc', 'best', 'pmpml', 'makemytrip', 'booking-com', 'agoda', 'goibibo', 'cleartrip', 'easemytrip', 'incredible-india',
    'parkplus', 'parkmate', 'chargezone', 'statiq', 'tata-ez', 'jio-bp', 'indianoil', 'hpcl', 'nhai', 'highway-delite', 'apollo-pharmacy', 'tata-1mg', 'netmeds', 'practo', 'apollo-247', 'esanjeevani', '112-india',
    'razorpay', 'cashfree', 'phonepe-pg', 'paytm-pg', 'upi', 'google-pay'];
  for (const id of need) assert.ok(BY_ID[id], `missing ${id}`);
  assert.equal(new Set(PROVIDERS.map((p) => p.id)).size, PROVIDERS.length, 'unique ids');
  // TSRTC and TGSRTC are one operator (deduped, alias kept).
  assert.ok(!BY_ID.tsrtc && BY_ID.tgsrtc.aliases.includes('tsrtc'));
  assert.equal(BY_ID.blusmart.class, 'unavailable'); assert.equal(BY_ID.blusmart.url, null); assert.equal(linkable(BY_ID.blusmart), false);
  assert.equal(BY_ID.ticketnew.mergedInto, 'district'); assert.equal(BY_ID['paytm-insider'].mergedInto, 'district');
  assert.match(BY_ID.dineout.url, /swiggy\.com\/dineout/);
  assert.equal(BY_ID['incredible-india'].info, true);
  assert.equal(BY_ID['google-pay'].class, 'unavailable');
  // No fabricated API support: only these are Functional.
  assert.deepEqual(PROVIDERS.filter((p) => p.class === 'functional').map((p) => p.id).sort(), ['112-india', 'india-post', 'metro-hyderabad', 'nhai', 'ocm', 'razorpay']);
  // Ticketing only where official e-ticketing exists; Hyderabad not on ONDC.
  assert.equal(metroFor('hyderabad').ticketing, 'whatsapp'); assert.equal(metroFor('jaipur').ticketing, null); assert.equal(metroFor('kanpur').ticketing, null);
  assert.equal(metroFor('kolkata').ticketing, 'official-app'); assert.equal(metroFor('pune').ticketing, 'ondc');
  assert.deepEqual(busFor('vizag').map((b) => b.id), ['apsrtc']);
  for (const p of PROVIDERS) { assert.ok(['live', 'link-out', 'partner-pending', 'unavailable'].includes(statusOf(p))); assert.ok(p.reason, `${p.id} reason`); if (p.url) assert.ok(safeLinkout(p.url), p.url); }
  assert.equal(fs.readFileSync(new URL('../docs/INTEGRATION_MATRIX.md', import.meta.url), 'utf8'), matrixMarkdown(), 'run: node scripts/gen-integration-matrix.mjs');
  assert.equal(cityOf({ lat: 28.57, lng: 77.36 }), 'noida');
});

test('station panel: Scheduled departures from the bundled HMRL GTFS; WhatsApp ticket; non-Hyderabad metros use catalogue ticketing or info only', () => {
  const d = stationDepartures(HMRL, AMEERPET, { date: '20261021', dow: 2, sec: 10 * 3600 });
  assert.equal(d.status, 'ready'); assert.ok(d.next.length >= 4); assert.ok(d.interchange);
  assert.deepEqual(d.lines.map((l) => l.name).sort(), ['Blue line', 'Red line']);
  assert.ok(d.next.every((x) => x.dep_s >= 36000)); assert.match(d.firstLast.first, /^0[5-7]:/);
  assert.equal(d.fare.status, 'none', 'HMRL feed ships no fare_attributes');
  const P = buildServicePanel(AMEERPET, { online: true, departures: d });
  const dep = P.sections.find((s) => s.id === 'departures').rows;
  assert.ok(dep.filter((r) => r.id.startsWith('dep-')).length >= 2 && dep.filter((r) => r.id.startsWith('dep-')).every((r) => r.label === 'scheduled'));
  assert.equal(dep.find((r) => r.id === 'live').label, 'unavailable');
  assert.equal(P.primary, 'hmrl-wa');
  const fares = P.sections.flatMap((s) => s.rows).find((r) => r.id === 'fare');
  assert.equal(fares?.label, 'unavailable');
  assert.equal(matchStop(HMRL, { lat: 17.0, lng: 78.0, name: 'Nowhere' }), -1);
  assert.equal(lineName({ short: 'C1_RED' }), 'Red line');
  const jp = buildServicePanel({ id: 'osm:node/7', name: 'Chandpole', lat: 26.926, lng: 75.81, tags: { railway: 'station', station: 'subway' } }, { online: true, departures: { status: 'no_feed' } });
  assert.ok(jp.sections.some((s) => s.id === 'ticketing'), 'Jaipur: info only');
  const pu = buildServicePanel({ id: 'osm:node/8', name: 'PCMC', lat: 18.629, lng: 73.80, tags: { railway: 'station', station: 'subway' } }, { online: true, departures: { status: 'no_feed' } });
  assert.equal(pu.primary, 'p-metro-pune');
  const bus = buildServicePanel({ id: 'osm:node/9', name: 'RTC Complex', lat: 17.7243, lng: 83.3070, tags: { highway: 'bus_stop' } }, { online: true, departures: { status: 'no_feed' } });
  assert.ok(bus.actions.some((a) => a.id === 'p-apsrtc') && bus.actions.some((a) => a.id === 'p-chalo'));
});

test('GTFS fares: fare_attributes + fare_rules by zone when the feed has them', () => {
  const tt = { stops: [{ zone: 'A' }, { zone: 'B' }], fares: [{ id: 'F1', price: 10, currency: 'INR' }, { id: 'F2', price: 25, currency: 'INR' }], fareRules: [{ fare: 'F1', origin: 'A', destination: 'A' }, { fare: 'F2', origin: 'A', destination: 'B' }] };
  assert.deepEqual(gtfsFare(tt, 0, 1), { price: 25, currency: 'INR', fare_id: 'F2' });
  assert.equal(gtfsFare({ stops: [] }, 0, 1), null);
});

test('landmark address resolution: anchors (opposite/beside/near) → point between mapped landmarks, explanation and confidence', () => {
  const anchors = extractAnchors('Flat 3, opposite RTC Complex, beside Diamond Park, Dwaraka Nagar, Visakhapatnam 530016').map((a) => a.phrase);
  assert.ok(anchors.some((a) => /RTC Complex/i.test(a)) && anchors.some((a) => /Diamond Park/i.test(a)), anchors.join('|'));
  const places = [{ name: 'RTC Complex', kind: 'bus_station', lat: 17.7243, lng: 83.3070 }, { name: 'Diamond Park', kind: 'commercial', lat: 17.7262, lng: 83.3058 }, { name: 'Diamond Park', kind: 'commercial', lat: 17.69, lng: 83.21 }];
  // Parks/roads/localities are never anchors (a whole park is not a door).
  assert.equal(resolveLandmarkAddress('beside Diamond Park, Dwaraka Nagar', { places: [{ name: 'Diamond Park', kind: 'park', lat: 17.7262, lng: 83.3058 }] }).anchors[0].match, null);
  const r = resolveLandmarkAddress('Flat 3, opposite RTC Complex, beside Diamond Park, Dwaraka Nagar, Visakhapatnam 530016', { places });
  assert.equal(r.best.source, 'landmark-anchors');
  assert.ok(Math.abs(r.best.lat - 17.72525) < 0.002 && Math.abs(r.best.lng - 83.3064) < 0.002, JSON.stringify(r.best));
  assert.ok(r.best.confidence >= 0.6); assert.ok(r.anchors.every((a) => a.match));
  const none = resolveLandmarkAddress('near Unknown Tower, Dwaraka Nagar', { places });
  assert.notEqual(none.best?.source, 'landmark-anchors'); assert.ok(none.explanation.length);
});

test('"Also here": Overpass is_in query and parser (container + named POIs, excludes self)', () => {
  const q = buildAlsoHereQuery({ lat: 17.4415, lng: 78.3830 });
  assert.match(q, /is_in\(17\.441500,78\.383000\)/); assert.match(q, /shop"="mall/);
  const r = parseAlsoHere({ elements: [{ type: 'area', id: 1, tags: { shop: 'mall', name: 'Inorbit Mall' } }, { type: 'node', id: 2, lat: 17.44, lon: 78.38, tags: { name: 'PVR', amenity: 'cinema' } }, { type: 'node', id: 3, lat: 17.44, lon: 78.38, tags: { name: 'Self', shop: 'clothes' } }] }, { name: 'Self' });
  assert.deepEqual(r.container, { name: 'Inorbit Mall', kind: 'mall' }); assert.deepEqual(r.items.map((x) => x.name), ['PVR']);
});

test('truck routing: Valhalla truck costing with dimension defaults and overrides', () => {
  const b = buildValhallaRequest('truck', { lat: 17.7, lng: 83.3 }, { lat: 17.4, lng: 78.4 }, { truck: { height: 4.2, weight: 25, bogus: 9 }, avoidTolls: true });
  assert.equal(b.costing, 'truck');
  const co = b.costing_options.truck;
  assert.equal(co.height, 4.2); assert.equal(co.weight, 25); assert.equal(co.width, 2.5); assert.equal(co.use_tolls, 0); assert.ok(!('bogus' in co));
});

test('payments: gateways enabled only by env keys; signatures/checksums verified (locally computed vectors)', async () => {
  const none = createPayments({ env: {} });
  assert.equal(none.configured(), false); assert.deepEqual(none.publicConfig().gateways, []);
  assert.ok(!JSON.stringify(none.publicConfig()).match(/secret|key_secret/i));
  const env = { CASHFREE_APP_ID: 'cf_app', CASHFREE_SECRET_KEY: 'cf_secret', PHONEPE_CLIENT_ID: 'pp', PHONEPE_CLIENT_SECRET: 'pps', PHONEPE_WEBHOOK_USER: 'u', PHONEPE_WEBHOOK_PASSWORD: 'p', PAYTM_MID: 'MID1', PAYTM_MERCHANT_KEY: '1234567890abcdef' };
  const all = createPayments({ env });
  assert.deepEqual(all.enabled().map((a) => a.id), ['cashfree', 'phonepe', 'paytm']);
  assert.ok(!JSON.stringify(all.publicConfig()).includes('cf_secret') && !JSON.stringify(all.publicConfig()).includes('1234567890abcdef'));
  // Cashfree webhook: base64(HMAC-SHA256(timestamp + raw body)).
  const cf = cashfreeAdapter(env);
  const raw = JSON.stringify({ data: { order: { order_id: 'ord_1_ab' }, payment: { payment_status: 'SUCCESS', cf_payment_id: 99 } } });
  const ok = cf.verifyWebhook(raw, { 'x-webhook-timestamp': '1700000000', 'x-webhook-signature': cashfreeSignature('cf_secret', '1700000000', raw) });
  assert.deepEqual([ok.ok, ok.paid, ok.providerOrderId], [true, true, 'ord_1_ab']);
  assert.equal(cf.verifyWebhook(raw, { 'x-webhook-timestamp': '1700000000', 'x-webhook-signature': cashfreeSignature('wrong', '1700000000', raw) }).ok, false);
  assert.equal(cf.verifyWebhook(`${raw} `, { 'x-webhook-timestamp': '1700000000', 'x-webhook-signature': cashfreeSignature('cf_secret', '1700000000', raw) }).ok, false, 'body tamper');
  // Cashfree verifyClient trusts only a server-side status re-check.
  const cf2 = cashfreeAdapter(env, { fetchImpl: async (url) => ({ ok: true, json: async () => ({ order_status: /ord_paid/.test(url) ? 'PAID' : 'ACTIVE', cf_order_id: 5 }) }) });
  assert.equal((await cf2.verifyClient({ status: 'PAID' }, { providerOrderId: 'ord_unpaid' })).ok, false);
  assert.equal((await cf2.verifyClient({}, { providerOrderId: 'ord_paid' })).ok, true);
  // PhonePe webhook: Authorization = SHA256(user:pass).
  const pp = phonepeAdapter(env);
  const ppRaw = JSON.stringify({ payload: { merchantOrderId: 'ord_2', state: 'COMPLETED' } });
  assert.equal(pp.verifyWebhook(ppRaw, { authorization: phonepeWebhookAuth('u', 'p') }).paid, true);
  assert.equal(pp.verifyWebhook(ppRaw, { authorization: phonepeWebhookAuth('u', 'x') }).ok, false);
  // Paytm checksum (AES-128-CBC over sha256(params|salt)+salt): round trip, tamper and wrong key fail.
  const params = { MID: 'MID1', ORDERID: 'ord_3', TXNAMOUNT: '10.00', STATUS: 'TXN_SUCCESS', TXNID: 't1' };
  const str = paytmParamString(params);
  assert.equal(str, 'MID1|ord_3|TXN_SUCCESS|10.00|t1');
  const sum = paytmGenerateSignature(str, '1234567890abcdef', 'abcd');
  assert.ok(paytmVerifySignature(str, '1234567890abcdef', sum));
  assert.ok(!paytmVerifySignature(str.replace('10.00', '1.00'), '1234567890abcdef', sum));
  assert.ok(!paytmVerifySignature(str, 'fedcba0987654321', sum));
  const pt = paytmAdapter(env);
  assert.equal(pt.verifyWebhook(new URLSearchParams({ ...params, CHECKSUMHASH: sum }).toString(), {}).paid, true);
  assert.equal(pt.verifyWebhook(new URLSearchParams({ ...params, STATUS: 'TXN_SUCCESS', TXNAMOUNT: '99.00', CHECKSUMHASH: sum }).toString(), {}).ok, false);
  // Razorpay adapter wraps the v0.2 implementation; disabled without keys.
  assert.equal(razorpayAdapter({}).enabled, false);
});

test('order → payment separation: pending_payment never moves (no ETA, no position change) until verified', () => {
  const b = BUSINESSES[0];
  const tr = progress({ status: 'pending_payment', fulfilment: 'delivery', created_ms: Date.now() - 3_600_000, business: b, route: { duration_s: 600, geometry: { coordinates: [[b.lng, b.lat], [b.lng + 0.01, b.lat]] } } }, Date.now(), 60);
  assert.deepEqual([tr.status, tr.fraction, tr.eta_s], ['pending_payment', 0, null]);
  assert.equal(progress({ status: 'placed', fulfilment: 'delivery', created_ms: Date.now() - 3_600_000, business: b, route: { duration_s: 600, geometry: { coordinates: [[b.lng, b.lat], [b.lng + 0.01, b.lat]] } } }, Date.now(), 60).status, 'delivered');
  // The client never builds UPI intents.
  for (const f of ['web/ui/payment.js', 'web/app.js', 'server/payments/index.js']) assert.ok(!/['"`]upi:\/\/pay/.test(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')), f);
});

test('integrations registry: status per adapter, env upgrades, traffic only with a key, stubs refuse to run, no secrets exposed', () => {
  const i0 = createIntegrations({ env: {} });
  assert.equal(i0.get('ondc-food').class, 'prototype'); assert.equal(i0.get('traffic').status, 'unavailable'); assert.equal(i0.clientConfig().traffic, null);
  const i1 = createIntegrations({ env: { ONDC_PROTOTYPE: '1', OLA_XAPP_TOKEN: 'tok', TRAFFIC_PROVIDER: 'tomtom', TOMTOM_API_KEY: 'SECRETKEY', UBER_CLIENT_ID: 'uber_pub' } });
  assert.equal(i1.get('ola').class, 'deeplink'); assert.equal(i1.get('traffic').status, 'live'); assert.equal(i1.clientConfig().uberClientId, 'uber_pub');
  assert.ok(!JSON.stringify({ l: i1.list(), c: i1.clientConfig() }).includes('SECRETKEY'));
  assert.equal(trafficConfig({ TRAFFIC_PROVIDER: 'here' }), null);
  assert.match(trafficConfig({ TRAFFIC_PROVIDER: 'here', HERE_API_KEY: 'k' }).tiles(10, 1, 2), /hereapi\.com\/v3\/flow\/mc\/10\/1\/2/);
  assert.throws(() => stubAdapter('shiprocket', {}).run(), /partner_pending:shiprocket:missing_SHIPROCKET_EMAIL/);
  for (const a of i0.list()) assert.ok(['live', 'link-out', 'partner-pending', 'unavailable'].includes(a.status) && Array.isArray(a.ops) && a.auth, a.id);
});

test('i18n v0.7: every key in en/hi/te; honesty labels in all 11 languages; other languages fall back to English (logged)', () => {
  for (const l of ['hi', 'te']) for (const k of V7_KEYS) assert.ok(V7[l][k], `${l}.${k}`);
  for (const l of LANGS.map((x) => x.code)) for (const k of V7_LABEL_KEYS) assert.ok(t(l, k) && t(l, k) !== k, `${l}.${k}`);
  assert.equal(t('te', 'label_scheduled'), 'షెడ్యూల్'); assert.equal(t('hi', 'pay_not_configured'), 'भुगतान सेट नहीं है');
  assert.equal(t('ta', 'pay_title'), 'Secure payment'); assert.ok(fallbackKeys('ta').length > 100); assert.equal(fallbackKeys('hi').length, 0);
  // Every key the panel builder emits exists.
  const src = fs.readFileSync(new URL('../shared/services/build.js', import.meta.url), 'utf8');
  for (const m of src.matchAll(/'(sv_[a-z0-9_]+)'/g)) if (!m[1].endsWith('_')) assert.ok(V7.en[m[1]], m[1]);
});
