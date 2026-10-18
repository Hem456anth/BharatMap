// v0.3 unit tests: pure map-app logic (no DOM, no network). Fixtures in tests/fixtures are
// real responses captured from the public services on 2026-10-18 (see tests/fixtures/README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOpeningHours, openingStatus } from '../web/lib/opening-hours.js';
import { OffRouteDetector, createTracker, projectOnRoute, cumulative, distM, stepOffsets, pointAtDistance } from '../web/nav/tracker.js';
import { buildInstruction, spokenInstruction, findLandmark, maneuverIcon, roundDistance, formatDistance } from '../web/nav/maneuver.js';
import { detentHeights, snapDetent, clampHeight, stepDetent, cycleDetent } from '../web/ui/sheet-math.js';
import { buildOverpassQuery, clampBBox, parseOverpass, POI_CATEGORIES, fetchPois } from '../web/services/overpass.js';
import { buildRouteUrl, parseOsrm, getRoutes, fallbackRoutes } from '../web/services/routing.js';
import { localResolve, parsePhoton, parseNominatimItem, photonUrl, nominatimReverseUrl, hoursToOsm } from '../web/services/geocode.js';
import { mergeSaved, normalizeSaved, addToList, setShortcut, pushRecent } from '../web/lib/saved-model.js';
import { STRINGS, LANGS, V3_KEYS, tf } from '../shared/i18n.js';

const fx = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const MON_10AM = { day: 0, minutes: 600 };

// ---------- opening_hours ----------
test('opening_hours: 24/7 and plain daily range', () => {
  assert.equal(openingStatus('24/7', MON_10AM).status, 'open');
  assert.equal(openingStatus('09:00-21:00', MON_10AM).status, 'open');
  assert.equal(openingStatus('09:00-21:00', { day: 3, minutes: 21 * 60 }).status, 'closed');
  assert.equal(openingStatus('09:00-21:00', { day: 3, minutes: 22 * 60 }).opensAt, '09:00');
});
test('opening_hours: weekday rules, off days, multiple ranges, overrides', () => {
  const oh = 'Mo-Fr 09:00-13:00,16:00-20:00; Sa 10:00-14:00; Su off';
  assert.equal(openingStatus(oh, { day: 1, minutes: 12 * 60 }).status, 'open');
  assert.equal(openingStatus(oh, { day: 1, minutes: 12 * 60 }).until, '13:00');
  const lunch = openingStatus(oh, { day: 1, minutes: 14 * 60 });
  assert.deepEqual([lunch.status, lunch.opensAt, lunch.opensDay], ['closed', '16:00', 'today']);
  assert.equal(openingStatus(oh, { day: 6, minutes: 11 * 60 }).status, 'closed');
  const sun = openingStatus(oh, { day: 6, minutes: 11 * 60 });
  assert.equal(sun.opensDay, 'tomorrow');
  assert.equal(openingStatus('Mo-Su 08:00-22:00; We off', { day: 2, minutes: 600 }).status, 'closed');
});
test('opening_hours: past midnight and unsupported syntax', () => {
  assert.equal(openingStatus('Mo-Su 18:00-02:00', { day: 2, minutes: 60 }).status, 'open'); // Wed 01:00 from Tue evening
  assert.equal(openingStatus('Mo-Su 18:00-02:00', { day: 2, minutes: 60 }).until, '02:00');
  assert.equal(openingStatus('Mo-Su 18:00-02:00', { day: 2, minutes: 3 * 60 }).status, 'closed');
  for (const raw of ['Mo-Fr 09:00-17:00; PH off', 'sunrise-sunset', 'Jan-Mar Mo 10:00-12:00', '', 'by appointment']) assert.equal(openingStatus(raw, MON_10AM).status, 'unknown', raw);
  assert.equal(parseOpeningHours('Mo,We,Fr 10:00-12:00').length, 1);
  assert.equal(hoursToOsm('10:00-21:30'), 'Mo-Su 10:00-21:30');
});

// ---------- off-route / progress ----------
const drive = parseOsrm(fx('osrm-drive-dwarakanagar-rkbeach'), 'drive');
test('off-route detector needs 3 consecutive fixes beyond 50 m and widens for poor accuracy', () => {
  const d = new OffRouteDetector();
  assert.equal(d.update(80), false); assert.equal(d.update(80), false); assert.equal(d.update(20), false);
  assert.equal(d.update(60), false); assert.equal(d.update(60), false); assert.equal(d.update(60), true);
  const n = new OffRouteDetector();
  for (let i = 0; i < 5; i++) assert.equal(n.update(60, 100), false, 'accuracy 100 m → limit 90 m');
});
test('tracker: on-route progress, step advance, off-route after 3 fixes, arrival', () => {
  const r = drive[0];
  const tr = createTracker(r);
  const cum = cumulative(r.geometry.coordinates);
  const at = (m) => { const p = pointAtDistance(r.geometry.coordinates, cum, m).point; return { lng: p[0], lat: p[1] }; };
  const s0 = tr.update(at(10));
  assert.equal(s0.offRoute, false); assert.ok(s0.offRouteM < 2); assert.ok(s0.stepIndex >= 1);
  const mid = tr.update(at(tr.total / 2));
  assert.ok(mid.stepIndex >= s0.stepIndex); assert.ok(Math.abs(mid.remainingM - tr.total / 2) < 5);
  assert.ok(mid.remainingS > 0 && mid.remainingS < r.duration_s);
  // 3 fixes ~120 m north of the route → off-route
  const far = at(tr.total / 2); far.lat += 0.0011;
  const outs = [tr.update(far), tr.update(far), tr.update(far)].map((s) => s.offRoute);
  assert.deepEqual(outs, [false, false, true]);
  const end = tr.update(at(tr.total - 5));
  assert.equal(end.arrived, true);
  assert.equal(end.stepIndex, r.steps.length - 1);
});
test('projectOnRoute and step offsets', () => {
  const coords = [[83.30, 17.72], [83.31, 17.72], [83.31, 17.73]];
  const cum = cumulative(coords);
  const p = projectOnRoute(coords, cum, [83.305, 17.7203]);
  assert.ok(Math.abs(p.dist - distM([83.305, 17.7203], [83.305, 17.72])) < 0.5);
  assert.deepEqual(stepOffsets([{ distance_m: 100 }, { distance_m: 300 }, { distance_m: 0 }], 800), [0, 200, 800]);
});

// ---------- maneuver text + landmarks ----------
test('maneuver text: en / hi / te turn, roundabout, arrive', () => {
  const turn = { type: 'turn', modifier: 'left', name: 'Beach Road' };
  assert.equal(buildInstruction(turn, 'en'), 'Turn left onto Beach Road');
  assert.equal(buildInstruction(turn, 'hi'), 'Beach Road पर बाएँ मुड़ें');
  assert.equal(buildInstruction(turn, 'te'), 'Beach Road లోకి ఎడమకు తిరగండి');
  assert.equal(buildInstruction({ type: 'turn', modifier: 'slight right' }, 'en'), 'Turn slightly right');
  assert.equal(buildInstruction({ type: 'turn', modifier: 'uturn' }, 'hi'), 'यू-टर्न लें');
  assert.equal(buildInstruction({ type: 'roundabout', exit: 2, name: '' }, 'en'), 'At the roundabout, take exit 2');
  assert.equal(buildInstruction({ type: 'arrive' }, 'te'), 'మీరు మీ గమ్యస్థానానికి చేరుకున్నారు');
  assert.equal(buildInstruction({ type: 'new name', modifier: 'straight', name: 'NH16' }, 'en'), 'Continue on NH16');
  assert.equal(buildInstruction({ type: 'fork', modifier: 'slight left' }, 'en'), 'Keep left');
  assert.equal(maneuverIcon({ type: 'turn', modifier: 'sharp right' }), 'sharp-right');
  assert.equal(maneuverIcon({ type: 'roundabout' }), 'roundabout');
  // untranslated languages fall back to English (TODO in i18n.js)
  assert.equal(buildInstruction(turn, 'ta'), 'Turn left onto Beach Road');
});
test('landmark-enhanced instructions within 150 m only', () => {
  const nearBeach = [83.3232, 17.7149]; // ~100 m from the RK Beach seed landmark
  const lm = findLandmark(nearBeach);
  assert.equal(lm.name, 'RK Beach'); assert.ok(lm.distance_m <= 150);
  assert.equal(findLandmark([83.40, 17.80]), null);
  const step = { type: 'turn', modifier: 'left', location: nearBeach };
  assert.equal(buildInstruction(step, 'en', { landmark: lm }), 'Turn left near RK Beach');
  assert.equal(buildInstruction(step, 'hi', { landmark: lm }), 'RK Beach के पास बाएँ मुड़ें');
  assert.equal(buildInstruction(step, 'te', { landmark: lm }), 'RK Beach దగ్గర ఎడమకు తిరగండి');
  assert.equal(spokenInstruction(step, 200, 'en', { landmark: lm }), 'In 200 metres, turn left near RK Beach');
  assert.equal(spokenInstruction(step, 1240, 'te', { landmark: lm }), '1.2 కిలోమీటర్ల తర్వాత, RK Beach దగ్గర ఎడమకు తిరగండి');
  assert.equal(spokenInstruction(step, 20, 'en'), 'Turn left');
});
test('distance rounding', () => {
  assert.deepEqual(roundDistance(237), { value: 250, unit: 'm' });
  assert.deepEqual(roundDistance(44), { value: 40, unit: 'm' });
  assert.deepEqual(roundDistance(990), { value: 1, unit: 'km' });
  assert.equal(formatDistance(12345), '12 km');
});

// ---------- sheet snap math ----------
test('sheet detents: heights, nearest snap, fling, jump, rubber band, keyboard', () => {
  const h = detentHeights(844);
  assert.deepEqual(h, { peek: 120, half: 422, full: 772 });
  assert.equal(snapDetent(h, 300, 0), 'half');
  assert.equal(snapDetent(h, 200, 0), 'peek');
  assert.equal(snapDetent(h, 430, 0.8), 'full');
  assert.equal(snapDetent(h, 430, -0.8), 'half');
  assert.equal(snapDetent(h, 410, -0.8), 'peek');
  assert.equal(snapDetent(h, 140, 2.5), 'full');
  assert.equal(snapDetent(h, 700, -2.5), 'peek');
  assert.ok(clampHeight(h, 0) >= 80 && clampHeight(h, 0) < 120);
  assert.equal(stepDetent('half', 1), 'full'); assert.equal(stepDetent('peek', -1), 'peek');
  assert.deepEqual(cycleDetent('half', 1), { detent: 'full', dir: 1 });
  assert.deepEqual(cycleDetent('full', 1), { detent: 'half', dir: -1 });
  assert.deepEqual(cycleDetent('half', -1), { detent: 'peek', dir: -1 });
  const small = detentHeights(500);
  assert.ok(small.peek < small.half && small.half < small.full);
});

// ---------- Overpass ----------
test('Overpass query builder: tags, rounded bbox, limit, validation', () => {
  const q = buildOverpassQuery('fuel', { s: 17.71123456, w: 83.29, n: 17.74, e: 83.32 }, { limit: 500 });
  assert.equal(q, '[out:json][timeout:20];(nwr["amenity"="fuel"](17.7112,83.29,17.74,83.32););out center tags 200;');
  assert.match(buildOverpassQuery('atm', { s: 1, w: 2, n: 3, e: 4 }), /\["amenity"="atm"\].*\["amenity"="bank"\]\["atm"="yes"\]/);
  assert.throws(() => buildOverpassQuery('casino', { s: 1, w: 2, n: 3, e: 4 }), /unknown_category/);
  assert.throws(() => buildOverpassQuery('fuel', { s: 3, w: 2, n: 1, e: 4 }), /invalid_bbox/);
  assert.equal(POI_CATEGORIES.length, 13); // v0.4 adds airports
  const big = clampBBox({ lat: 17.72, lng: 83.3 }, { s: 17, w: 82, n: 18.5, e: 84 }, 8);
  assert.ok((big.n - big.s) * 110.574 <= 8.01 && (big.e - big.w) * 111.32 * Math.cos(17.72 * Math.PI / 180) <= 8.01);
});
test('Overpass parse: real fixture → named POIs sorted by distance', async () => {
  const items = parseOverpass(fx('overpass-fuel-dwarakanagar'), 'fuel', { lat: 17.7289, lng: 83.305 });
  assert.ok(items.length >= 10);
  for (let i = 1; i < items.length; i++) assert.ok(items[i].distance_m >= items[i - 1].distance_m);
  assert.ok(items.every((x) => x.id.startsWith('osm:') && x.tags.amenity === 'fuel'));
  let calls = 0;
  const fake = async (url, init) => { calls++; assert.equal(init.method, 'POST'); assert.match(decodeURIComponent(init.body), /amenity"="fuel/); return new Response(JSON.stringify(fx('overpass-fuel-dwarakanagar'))); };
  const a = await fetchPois('fuel', { lat: 17.7289, lng: 83.305 }, null, { fetchImpl: fake });
  const b = await fetchPois('fuel', { lat: 17.7289, lng: 83.305 }, null, { fetchImpl: fake });
  assert.equal(a.items.length, b.items.length); assert.equal(calls, 1, 'second call served from cache');
});

// ---------- routing ----------
test('OSRM: URL per mode, parse alternatives + steps, fallback', async () => {
  const from = { lat: 17.7289, lng: 83.305 }, to = { lat: 17.714, lng: 83.323 };
  assert.equal(buildRouteUrl('walk', from, to), 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/83.305,17.7289;83.323,17.714?alternatives=true&steps=true&overview=full&geometries=geojson');
  assert.match(buildRouteUrl('two', from, to), /routed-car/);
  assert.match(buildRouteUrl('bike', from, to), /routed-bike/);
  assert.ok(drive.length >= 2 && drive.length <= 3);
  assert.equal(drive[0].steps[0].type, 'depart'); assert.equal(drive[0].steps.at(-1).type, 'arrive');
  assert.ok(drive[0].distance_m > 2000 && drive[0].geometry.coordinates.length > 10);
  assert.throws(() => parseOsrm({ code: 'NoRoute' }), /osrm_NoRoute/);
  const two = await getRoutes('two', from, to, { fetchImpl: async () => new Response(JSON.stringify(fx('osrm-drive-dwarakanagar-rkbeach'))) });
  assert.equal(two.estimate, true); assert.equal(two.fallback, false);
  const off = await getRoutes('drive', from, { lat: 17.70, lng: 83.30 }, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(off.fallback, true); assert.equal(off.routes[0].engine, 'fallback-straight-line');
  assert.equal(fallbackRoutes('walk', from, to)[0].steps.length, 2);
});

// ---------- geocoding ----------
test('geocode: local resolver (landmark, seller, DIGIPIN) and Photon/Nominatim parsing', () => {
  const rk = localResolve('RK Beach', { city: 'vizag' });
  assert.equal(rk[0].name, 'RK Beach'); assert.equal(rk[0].source, 'local');
  const seller = localResolve('Vizag Digital', {});
  assert.equal(seller[0].kind, 'seller'); assert.equal(seller[0].seller_id, 'b2');
  assert.equal(localResolve('39J-49L-L8T4')[0].kind, 'digipin');
  const ph = parsePhoton(fx('photon-kailasa'), { lat: 17.7289, lng: 83.305 });
  assert.ok(ph.length >= 1 && ph.every((p) => Number.isFinite(p.lat) && p.id.startsWith('osm:')));
  const rev = parseNominatimItem(fx('nominatim-reverse-dwarakanagar'));
  assert.match(rev.address, /Visakhapatnam/); assert.ok(rev.name);
  assert.match(photonUrl('x', { lat: 17.1, lng: 83.2, lang: 'te' }), /lang=en&bbox=68\.0%2C6\.4%2C97\.5%2C37\.6&lat=17\.1000&lon=83\.2000/);
  assert.match(nominatimReverseUrl(17.7, 83.3, { lang: 'hi' }), /accept-language=hi%2Cen/);
});

// ---------- saved places model ----------
test('saved places: shortcuts, lists, recents, merge', () => {
  let s = normalizeSaved(null);
  assert.deepEqual(s.lists.map((l) => l.id), ['favorites']);
  const p = { id: 'osm:node/1', name: 'HP Petrol Station', lat: 17.72, lng: 83.32 };
  s = setShortcut(s, 'home', p); s = addToList(s, 'favorites', p); s = addToList(s, 'favorites', p);
  assert.equal(s.home.name, 'HP Petrol Station'); assert.equal(s.lists[0].items.length, 1);
  const remote = { ...normalizeSaved(null), work: { ...p, name: 'Office' }, updated_ms: s.updated_ms + 1000 };
  const m = mergeSaved(s, remote);
  assert.equal(m.work.name, 'Office'); assert.equal(m.home.name, 'HP Petrol Station'); assert.equal(m.lists[0].items.length, 1);
  let r = [];
  for (let i = 0; i < 20; i++) r = pushRecent(r, { label: `q${i % 15}` });
  assert.equal(r.length, 12); assert.equal(r[0].label, 'q4');
  assert.equal(normalizeSaved({ home: { name: 'x', lat: 'bad' } }).home, null);
});

// ---------- i18n coverage ----------
test('i18n v0.3: every language has every key; en/hi/te are complete', () => {
  for (const l of LANGS) for (const k of V3_KEYS) assert.ok(STRINGS[l.code][k], `${l.code}.${k}`);
  for (const l of ['hi', 'te']) {
    const same = V3_KEYS.filter((k) => STRINGS[l][k] === STRINGS.en[k] && !/^(Bharat Map|DIGIPIN)$/.test(STRINGS.en[k]));
    assert.deepEqual(same, [], `${l} untranslated`);
  }
  assert.equal(tf('hi', 'closes_at', { t: '21:30' }), '21:30 बजे बंद होगा');
});
