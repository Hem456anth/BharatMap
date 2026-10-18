import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, encodeDigipin, decodeDigipin, pointAlong, inIndia } from '../shared/geo.js';
import { parseIndianAddress } from '../shared/address.js';
import { parseQuery, searchMarketplace, assistant } from '../shared/search.js';
import { normalizeQuery, STRINGS, LANGS } from '../shared/i18n.js';
import { priceOrder, assignRider, progress, optimizeStops } from '../shared/logistics.js';
import { BUSINESSES, MOBILITY, RIDERS } from '../shared/seed.js';

const DWARAKA = { lat: 17.7289, lng: 83.305 };

test('haversine: Vizag RTC to RK Beach ~2 km', () => {
  const d = haversineKm({ lat: 17.7215, lng: 83.307 }, { lat: 17.714, lng: 83.323 });
  assert.ok(d > 1.5 && d < 2.2, String(d));
});
test('DIGIPIN matches India Post reference (Dak Bhawan → 39J-49L-L8T4)', () => {
  assert.equal(encodeDigipin(28.622788, 77.213033), '39J-49L-L8T4');
});
test('DIGIPIN round-trip within 5 m', () => {
  const p = decodeDigipin(encodeDigipin(17.7289, 83.305));
  assert.ok(haversineKm(p, DWARAKA) < 0.005);
  assert.equal(decodeDigipin('XXX'), null);
});
test('inIndia rejects outside points', () => { assert.ok(inIndia(DWARAKA)); assert.ok(!inIndia({ lat: 51.5, lng: -0.1 })); });
test('pointAlong interpolates', () => {
  const p = pointAlong([[0, 0], [0, 2]], 0.5); assert.ok(Math.abs(p.lat - 1) < 1e-9);
});

test('address: landmark + locality + pincode resolves at high confidence', () => {
  const r = parseIndianAddress('Shop 4, opp. CMR Central, MVP Colony, Vizag 530017');
  assert.equal(r.components.landmark, 'CMR Central Mall');
  assert.equal(r.components.locality, 'MVP Colony');
  assert.equal(r.components.relation, 'opposite');
  assert.ok(r.best.confidence >= 0.9);
});
test('address: pincode-only and Telugu locality', () => {
  assert.equal(parseIndianAddress('530026').components.locality, 'Gajuwaka');
  assert.equal(parseIndianAddress('గాజువాక').components.locality, 'Gajuwaka');
});
test('address: short ASCII alias does not match inside words', () => {
  const r = parseIndianAddress('beautiful view');
  assert.equal(r.components.landmark, undefined);
});
test('address: DIGIPIN input', () => { assert.equal(parseIndianAddress('my home 39J-49L-L8T4').best.source, 'digipin'); });

test('i18n: all 11 languages have every key', () => {
  assert.equal(LANGS.length, 11);
  const keys = Object.keys(STRINGS.en);
  for (const l of LANGS) for (const k of keys) assert.ok(STRINGS[l.code][k], `${l.code}.${k}`);
});
test('i18n: native query normalisation', () => {
  assert.match(normalizeQuery('టీవీ దగ్గర'), /tv near me/);
  assert.match(normalizeQuery('दूध मेरे पास'), /milk near me/);
  assert.match(normalizeQuery('டிவி அருகில்'), /tv near me/);
});

test('query parsing: price, size, wholesale', () => {
  const q = parseQuery('cheapest 43 inch tv under 30k');
  assert.equal(q.maxPrice, 30000); assert.equal(q.size, '43'); assert.equal(q.sort, 'price');
  assert.ok(parseQuery('bulk led tv suppliers').wholesale);
});
test('killer flow search: "LED TVs near me" returns TV sellers, nearest verified first', () => {
  const r = searchMarketplace(BUSINESSES, 'LED TVs near me', { origin: DWARAKA, radiusKm: 15 });
  assert.ok(r.count >= 3);
  assert.equal(r.results[0].business.id, 'b1');
  for (const x of r.results) for (const p of x.products) assert.equal(p.category, 'tv');
});
test('search filters by size and price cap; in-stock first', () => {
  const r = searchMarketplace(BUSINESSES, 'cheapest 43 inch tv under 30k', { origin: DWARAKA });
  for (const x of r.results) for (const p of x.products) { assert.ok(p.price <= 30000); assert.match(p.name, /43"/); }
  for (const x of r.results) if (x.products.length > 1) assert.ok(x.products[0].stock > 0);
});
test('search re-centres on a named locality', () => {
  const r = searchMarketplace(BUSINESSES, 'led tv in ameerpet', { origin: DWARAKA });
  assert.equal(r.results[0].business.city, 'hyderabad');
});
test('assistant intents', () => {
  const ctx = { origin: DWARAKA, businesses: BUSINESSES, mobility: MOBILITY };
  assert.equal(assistant('nearest ev charging', ctx).intent, 'mobility');
  assert.equal(assistant('directions from RTC complex to RK beach', ctx).intent, 'route');
  assert.equal(assistant('Find LED TV suppliers in Gajuwaka for bulk', ctx).intent, 'supplier_discovery');
  assert.equal(assistant('बिरयानी', ctx).intent, 'product_search');
});

test('pricing: free delivery above ₹999, bulky fee for 43" TV, wholesale tiers', () => {
  const tv = priceOrder([{ product_id: 'p5', qty: 1, unit_price: 47990, name: 'Sony Bravia 43" 4K', category: 'tv' }], 3, 'delivery');
  assert.equal(tv.delivery_fee, 0); assert.equal(tv.handling_fee, 299); assert.equal(tv.total, 48289);
  const milk = priceOrder([{ product_id: 'x', qty: 2, unit_price: 62, name: 'Milk', category: 'dairy' }], 4.2, 'delivery');
  assert.equal(milk.delivery_fee, 25 + 3 * 8);
  const ws = priceOrder([{ product_id: 'p', qty: 5, unit_price: 13990, wholesale_price: 12100, min_wholesale_qty: 5, name: 'LG 32"', category: 'tv' }], 1, 'pickup');
  assert.equal(ws.subtotal, 60500); assert.equal(ws.delivery_fee, 0);
});
test('rider assignment prefers nearest suitable vehicle', () => {
  const pick = assignRider(RIDERS, { lat: 17.7295, lng: 83.3062 }, [{ qty: 1, name: 'Milk', category: 'dairy' }]);
  assert.equal(pick.rider.id, 'r1');
  const bulk = assignRider(RIDERS, { lat: 17.6912, lng: 83.214 }, [{ qty: 6, name: 'LG 32"', category: 'tv', min_wholesale_qty: 5 }]);
  assert.equal(bulk.rider.vehicle, 'mini-truck');
});
test('tracking progress is monotonic and ends delivered', () => {
  const o = { created_ms: 0, fulfilment: 'delivery', status: 'placed', business: { lat: 17.72, lng: 83.30 }, route: { duration_s: 600, geometry: { coordinates: [[83.30, 17.72], [83.31, 17.73]] } } };
  const order = ['placed', 'accepted', 'picked_up', 'out_for_delivery', 'delivered'];
  let last = -1;
  for (let s = 0; s <= 2000; s += 25) { const i = order.indexOf(progress(o, s * 1000, 1).status); assert.ok(i >= last); last = i; }
  assert.equal(last, 4);
});
test('route optimisation never worse than input order', () => {
  const start = { lat: 17.72, lng: 83.30 };
  const stops = [{ lat: 17.80, lng: 83.37 }, { lat: 17.73, lng: 83.31 }, { lat: 17.69, lng: 83.21 }, { lat: 17.74, lng: 83.33 }];
  const naive = stops.reduce((a, s, i) => a + haversineKm(i ? stops[i - 1] : start, s), 0);
  assert.ok(optimizeStops(start, stops).total_km <= naive + 1e-9);
});
