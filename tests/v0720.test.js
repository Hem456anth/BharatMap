// v0.7.20 unit tests — competitor gaps G1 (main-roads guardrails), G2 (locality-aware, typo-tolerant search), G6 (add a
// missing place), G7 (arrival / get-off alarms), G8 (incidents along the route + "Still there?"), G9 (exact pickup
// hand-off), G10 (no silent reroutes, voice choice kept). Real captured fixtures + the bundled offline index; no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildValhallaRequest, MAIN_ROADS, mainRoadsApplies } from '../shared/valhalla.js';
import { mainRoadsPref, setMainRoadsPref, MAIN_ROADS_DEFAULT } from '../shared/guardrails.js';
import { createProviders } from '../server/providers/index.js';
import { getRoutes } from '../web/services/routing.js';
import { searchOffline, buildSearchIndex, typoVariants } from '../shared/search-index.js';
import { searchWithLocality, parseLocalityQuery, resolveLocality, editDistance } from '../shared/search-locality.js';
import { createFtsSearch } from '../server/lib/search-fts.js';
import { createProximityAlarm, distanceM, ALARM_RADIUS_M } from '../shared/alarms.js';
import { incidentsOnRoute, createRouteAlerts, routeBbox, projectPoint } from '../shared/route-alerts.js';
import { applyLocalVote, INCIDENT_TTL_MS } from '../shared/community.js';
import { describePoint, pickupText, handoffPlan } from '../shared/handoff.js';
import { uberLink } from '../shared/services/linkouts.js';
import { buildRidePanel } from '../shared/services/build.js';
import { fasterRouteOffer, rerouteOptions, autoAcceptFaster, setAutoAcceptFaster } from '../shared/reroute.js';
import { setStoredVoice, storedVoice, chooseVoice } from '../web/nav/voices.js';
import { buildMissingPlaceNote, PLACE_KINDS } from '../shared/osm-edit.js';
import { encodeDigipin, haversineKm } from '../shared/geo.js';
import { V720, V720_KEYS } from '../shared/i18n-v0720.js';
import { t, tf } from '../shared/i18n.js';

const fx = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));
const IX = JSON.parse(fs.readFileSync(new URL('../web/offline/search/index.json', import.meta.url), 'utf8'));
const VIZ = { lat: 17.7289, lng: 83.305 }, RKB = { lat: 17.714, lng: 83.323 };
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const clock = (t0 = 1_000_000) => { const c = { t: t0, now: () => c.t, sleep: async (ms) => { c.t += ms; } }; return c; };
const okRes = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const near = (a, b, km) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180)) <= km;

// ---------- G1 main-roads guardrails ----------
test('G1: "Prefer main roads" → documented Valhalla costing options for auto and motor_scooter; nothing for walk/bike', () => {
  const car = buildValhallaRequest('drive', VIZ, RKB, { mainRoads: true });
  assert.deepEqual(car.costing_options.auto, MAIN_ROADS.auto);
  assert.equal(car.costing_options.auto.use_living_streets <= 0.1, true); assert.equal(car.costing_options.auto.use_tracks, 0);
  assert.ok(car.costing_options.auto.service_penalty >= 60 && car.costing_options.auto.service_factor > 1);
  assert.equal(car.costing_options.auto.exclude_unpaved, true);
  const two = buildValhallaRequest('two', VIZ, RKB, { mainRoads: true, avoidTolls: true });
  assert.equal(two.costing_options.motor_scooter.top_speed, 60, 'India 2W top speed kept');
  assert.equal(two.costing_options.motor_scooter.use_tolls, 0, 'avoid tolls kept');
  assert.equal(two.costing_options.motor_scooter.use_primary, 0.8);
  assert.equal(buildValhallaRequest('drive', VIZ, RKB).costing_options, undefined, 'default request unchanged');
  assert.equal(buildValhallaRequest('walk', VIZ, RKB, { mainRoads: true }).costing_options, undefined);
  assert.equal(mainRoadsApplies('bike'), false); assert.equal(mainRoadsApplies('two'), true);
});
test('G1: preference defaults (2W on, car off) and persistence per mode', () => {
  const s = memStore();
  assert.equal(mainRoadsPref('two', s), MAIN_ROADS_DEFAULT.two); assert.equal(mainRoadsPref('drive', s), false); assert.equal(mainRoadsPref('walk', s), false);
  setMainRoadsPref('drive', true, s); setMainRoadsPref('two', false, s);
  assert.equal(mainRoadsPref('drive', s), true); assert.equal(mainRoadsPref('two', s), false);
  setMainRoadsPref('walk', true, s); assert.equal(mainRoadsPref('walk', s), false, 'never for walk');
});
test('G1: server routes main-roads requests to Valhalla first; an OSRM fallback is labelled main_roads_applied=false', async () => {
  const c = clock(); let body = null;
  const f = async (u, o = {}) => { if (/valhalla/.test(u)) { body = JSON.parse(o.body); return okRes(fx('valhalla-two-dwarakanagar-rkbeach')); } if (/routed-car/.test(u)) return okRes(fx('osrm-drive-dwarakanagar-rkbeach')); throw new TypeError('x'); };
  const p = createProviders({ env: {}, fetchImpl: f, now: c.now, sleep: c.sleep });
  const a = await p.route('drive', VIZ, RKB, { mainRoads: true });
  assert.equal(a.provider, 'valhalla'); assert.equal(a.main_roads_applied, true); assert.equal(body.costing_options.auto.service_factor, MAIN_ROADS.auto.service_factor);
  const noV = async (u) => { if (/routed-car/.test(u)) return okRes(fx('osrm-drive-dwarakanagar-rkbeach')); throw new TypeError('down'); };
  const b = await createProviders({ env: {}, fetchImpl: noV, now: c.now, sleep: c.sleep }).route('drive', VIZ, RKB, { mainRoads: true });
  assert.equal(b.provider, 'osrm'); assert.equal(b.main_roads_applied, false);
  const d = await createProviders({ env: {}, fetchImpl: noV, now: c.now, sleep: c.sleep }).route('drive', VIZ, RKB);
  assert.equal(d.main_roads_applied, true, 'not requested → nothing to report');
});
test('G1: client (no server) — main roads makes drive Valhalla-first; OSRM fallback honestly flagged', async () => {
  const calls = [];
  const both = async (u) => { calls.push(u); return { ok: true, status: 200, json: async () => (/valhalla/.test(u) ? fx('valhalla-two-dwarakanagar-rkbeach') : fx('osrm-drive-dwarakanagar-rkbeach')) }; };
  const r = await getRoutes('drive', { lat: 17.7291, lng: 83.3052 }, RKB, { fetchImpl: both, mainRoads: true });
  assert.equal(r.engine, 'valhalla-fossgis'); assert.equal(r.main_roads_applied, true);
  assert.match(decodeURIComponent(calls[0]), /"service_penalty":120/);
  const noV = async (u) => { if (/valhalla/.test(u)) throw new TypeError('down'); return { ok: true, status: 200, json: async () => fx('osrm-drive-dwarakanagar-rkbeach') }; };
  const o = await getRoutes('drive', { lat: 17.7292, lng: 83.3053 }, RKB, { fetchImpl: noV, mainRoads: true });
  assert.equal(o.engine, 'osrm-fossgis'); assert.equal(o.main_roads_applied, false);
});

// ---------- G2 locality-aware, typo-tolerant search ----------
test('G2: query parsing — name vs locality, states/country ignored, PIN kept', () => {
  assert.deepEqual(parseLocalityQuery('Al-Shifa Hospital, Perinthalmanna, Kerala'), { name: 'Al-Shifa Hospital', context: ['Perinthalmanna'], form: 'comma' });
  assert.deepEqual(parseLocalityQuery('Apollo, 500033, India').context, ['500033']);
  assert.equal(parseLocalityQuery('Apollo Hospital').form, 'none');
  assert.equal(editDistance('perinthalmanna', 'perintalmanna'), 1); assert.equal(editDistance('apolo', 'apollo'), 1); assert.equal(editDistance('abcd', 'wxyz', 1), 2);
  assert.ok(typoVariants('apolo').has('apollo'));
});
test('G2: the Organic Maps #10566 pattern — "Al-Shifa Hospital, Perinthalmanna" picks the one in that town (synthetic index)', () => {
  // SYNTHETIC places (names from the issue, positions illustrative): three same-named hospitals + the towns.
  const places = [
    { name: 'Al-Shifa Hospital', kind: 'hospital', lat: 8.52, lng: 76.94, region: 'x' },
    { name: 'Al-Shifa Hospital', kind: 'hospital', lat: 10.976, lng: 76.226, region: 'x' },
    { name: 'Al Shifa Hospital', kind: 'hospital', lat: 28.56, lng: 77.28, region: 'x' },
    { name: 'Perinthalmanna', kind: 'town', lat: 10.9765, lng: 76.2254, region: 'x' },
    { name: 'Thiruvananthapuram', kind: 'city', lat: 8.5241, lng: 76.9366, region: 'x' },
  ];
  const ix = buildSearchIndex(places, [], { regions: ['x'] });
  const r = searchWithLocality(ix, 'Al-Shifa Hospital, Perinthalmanna, Kerala', { limit: 3 });
  assert.equal(r.locality.name, 'Perinthalmanna'); assert.equal(r.results[0].lat, 10.976);
  const typo = searchWithLocality(ix, 'Al Shifa Hospitl, Perintalmanna', { limit: 3 });
  assert.equal(typo.results[0].lat, 10.976, 'typos in name and locality');
  const tail = searchWithLocality(ix, 'al shifa hospital perinthalmanna', { limit: 3 });
  assert.equal(tail.locality?.form, 'tail'); assert.equal(tail.results[0].lat, 10.976);
  const tvm = searchWithLocality(ix, 'Al-Shifa Hospital, Thiruvananthapuram', { limit: 1 });
  assert.equal(tvm.results[0].lat, 8.52);
});
test('G2: golden queries on the bundled OSM index (real data)', () => {
  const jh = searchWithLocality(IX, 'Apollo Hospitals, Jubilee Hills', { near: VIZ, limit: 3 });
  assert.equal(jh.locality.name, 'Jubilee Hills'); assert.ok(near(jh.results[0], { lat: 17.4308, lng: 78.4103 }, 3), JSON.stringify(jh.results[0]));
  const sec = searchWithLocality(IX, 'Apolo Hospital, Secunderabad', { limit: 3 });
  assert.equal(sec.locality.kind, 'city'); assert.ok(near(sec.results[0], { lat: 17.4337, lng: 78.5007 }, 1.5), `nearest Apollo to Secunderabad: ${JSON.stringify(sec.results[0])}`);
  const tp = searchWithLocality(IX, 'Apollo Hospitals, Tondiarpet, Chennai, Tamil Nadu', { limit: 1 });
  assert.match(tp.results[0].name, /Tondiarpet/);
  const pd = searchWithLocality(IX, 'hospital, Pendurthi', { near: { lat: 17.4375, lng: 78.4483 }, limit: 3 });
  assert.ok(pd.results.every((x) => near(x, { lat: 17.8229, lng: 83.2049 }, 8)), 'hospitals in Pendurthi, not near the map centre in Hyderabad');
  const pin = searchWithLocality(IX, 'Apollo, 500033', { limit: 1 });
  assert.equal(pin.locality.kind, 'postcode'); assert.ok(near(pin.results[0], { lat: 17.4149, lng: 78.4132 }, 4));
  assert.equal(resolveLocality(IX, 'Koramangala').kind, 'suburb');
});
test('G2: typo tolerance + existing behaviour unchanged for plain queries', () => {
  assert.equal(searchOffline(IX, 'gajuwak', { near: VIZ })[0].name, 'Gajuwaka', 'prefix still wins');
  assert.equal(searchOffline(IX, 'kailasgiri', { near: VIZ })[0].name.startsWith('Kailasagiri'), true, 'one deletion');
  assert.equal(searchOffline(IX, 'simhachalm', { near: VIZ })[0].name, 'Simhachalam', 'one deletion at the end');
  assert.deepEqual(searchOffline(IX, 'xqzvbk'), [], 'nonsense still finds nothing');
  for (const q of ['simhachalam', 'Kailasagiri', 'rushikonda beach', 'charminar']) assert.deepEqual(searchWithLocality(IX, q, { near: VIZ, limit: 3 }).results.map((x) => x.id), searchOffline(IX, q, { near: VIZ, limit: 3 }).map((x) => x.id), q);
});
test('G2: server search (FTS5) gives the same locality-aware answer as the device, and typo fallback', async () => {
  const dbFile = `${process.env.TMPDIR || '/tmp'}/bm-search-v0720-${process.pid}.db`;
  const s = createFtsSearch({ indexFile: new URL('../web/offline/search/index.json', import.meta.url).pathname, dbFile });
  for (const q of ['Apollo Hospitals, Jubilee Hills', 'hospital, Pendurthi', 'kailasgiri']) {
    const a = (await s.search(q, { near: VIZ, limit: 3 }))[0]; const b = searchWithLocality(IX, q, { near: VIZ, limit: 3 }).results[0];
    assert.equal(a.id, b.id, q);
  }
  fs.rmSync(dbFile, { force: true });
});

// ---------- G7 alarms ----------
test('G7: proximity alarm fires once after 2 fixes inside the radius; inaccurate / stale fixes ignored', () => {
  const stop = { lat: 17.4375, lng: 78.4483 }; // Ameerpet
  const a = createProximityAlarm({ target: stop, kind: 'metro', label: 'Ameerpet' });
  assert.equal(a.radiusM, ALARM_RADIUS_M.metro);
  const now = 1_000_000;
  assert.equal(a.update({ lat: 17.46, lng: 78.44, accuracy: 10, ts: now }, now).fire, false, '2.6 km away');
  assert.equal(a.update({ lat: 17.444, lng: 78.448, accuracy: 1500, ts: now }, now).ignored, 'accuracy');
  assert.equal(a.update({ lat: 17.444, lng: 78.448, accuracy: 10, ts: now - 120_000 }, now).ignored, 'stale');
  assert.equal(a.update({ lat: 17.444, lng: 78.448, accuracy: 10, ts: now }, now).fire, false, 'first fix inside');
  const r = a.update({ lat: 17.443, lng: 78.448, accuracy: 10, ts: now }, now);
  assert.equal(r.fire, true); assert.ok(r.distanceM < 1000);
  assert.equal(a.update({ lat: 17.4376, lng: 78.4483, accuracy: 5, ts: now }, now).fire, false, 'only once');
  const b = createProximityAlarm({ target: stop, radiusM: 300 }); b.cancel(); assert.equal(b.update({ ...stop, accuracy: 5 }).fire, false);
  assert.throws(() => createProximityAlarm({ target: { lat: 'x' } }), /invalid_target/);
  assert.ok(Math.abs(distanceM(VIZ, RKB) - haversineKm(VIZ, RKB) * 1000) < 5, 'matches haversine at city scale');
});

// ---------- G8 incidents along the route ----------
test('G8: incidents within 50 m of the route, announced once ≤ 500 m ahead, then "Still there?" after passing', () => {
  const coords = [[83.30, 17.72], [83.31, 17.72], [83.32, 17.72]]; // ~2.1 km east-west
  const inc = [{ id: 'a', type: 'waterlogging', lat: 17.7202, lng: 83.305 }, { id: 'b', type: 'pothole', lat: 17.725, lng: 83.315 }, { id: 'c', type: 'closure', lat: 17.7199, lng: 83.315 }];
  const on = incidentsOnRoute(inc, coords);
  assert.deepEqual(on.map((x) => x.id), ['a', 'c'], 'b is 550 m off the road');
  assert.ok(Math.abs(on[0].along - 530) < 15, `along ${on[0].along}`);
  const al = createRouteAlerts(); al.setItems(on);
  let r = al.update(0, 0); assert.equal(r.announce.length, 0, '530 m ahead: not yet');
  r = al.update(100, 1); assert.deepEqual(r.announce.map((x) => x.id), ['a']); assert.ok(r.announce[0].aheadM <= 500);
  r = al.update(120, 2); assert.equal(r.announce.length, 0, 'once');
  r = al.update(on[0].along + 50, 3); assert.equal(r.ask.id, 'a', 'asked after passing');
  assert.equal(al.answer().id, 'a'); assert.equal(al.asking, null);
  r = al.update(on[0].along + 60, 4); assert.equal(r.ask, null, 'never asked twice');
  const al2 = createRouteAlerts({ askForS: 20 }); al2.setItems(on); al2.update(on[0].along + 50, 0);
  assert.equal(al2.update(on[0].along + 70, 25_000).expired, true, 'unanswered chip expires');
  const bb = routeBbox(coords); assert.ok(bb.w < 83.30 && bb.e > 83.32 && bb.n > 17.72);
  assert.ok(projectPoint(coords, [83.31, 17.7205]).dist < 60);
});
test('G8: device-only votes follow the server rules (still there extends ≤ 2 h; two "gone" more than "still there" remove)', () => {
  const now = 10_000_000; const inc = { id: 'x', created_ms: now - 60 * 60_000, expires_ms: now + 60 * 60_000, up: 0, down: 0 };
  const up = applyLocalVote(inc, 'up', now); assert.equal(up.up, 1); assert.equal(up.expires_ms, now + 90 * 60_000);
  const capped = applyLocalVote({ ...inc, expires_ms: now + INCIDENT_TTL_MS - 60_000 }, 'up', now); assert.equal(capped.expires_ms, now + INCIDENT_TTL_MS);
  const d1 = applyLocalVote(inc, 'down', now); assert.equal(d1.down, 1); assert.ok(!d1.removed);
  assert.deepEqual(applyLocalVote(d1, 'down', now), { id: 'x', removed: true });
  assert.throws(() => applyLocalVote(inc, 'meh', now), /invalid_vote/);
});

// ---------- G9 exact pickup hand-off ----------
test('G9: pickup text carries 6-decimal pin, DIGIPIN, landmark and an OSM link; Uber link carries them in documented fields', () => {
  const p = { lat: 17.437512, lng: 78.448311, name: 'My location' };
  const d = describePoint(p, { landmark: { name: 'Ameerpet Metro', distance_m: 40 } });
  assert.equal(d.lat6, '17.437512'); assert.equal(d.digipin, encodeDigipin(p.lat, p.lng)); assert.match(d.line, /^DIGIPIN .+ · near Ameerpet Metro \(40 m\)$/);
  const txt = pickupText({ pickup: p, dropoff: { lat: 17.3616, lng: 78.4747, name: 'Charminar' }, pickupLandmark: { name: 'Ameerpet Metro', distance_m: 40 } });
  assert.match(txt, /Pickup: My location\n17\.437512, 78\.448311\nDIGIPIN: .+\nLandmark: near Ameerpet Metro \(40 m\)\nhttps:\/\/www\.openstreetmap\.org\/\?mlat=17\.437512/);
  assert.match(txt, /Drop: Charminar/);
  const u = decodeURIComponent(uberLink({ pickup: { ...p, address: d.line }, dropoff: { lat: 17.3616, lng: 78.4747 } }).url);
  assert.match(u, /pickup\[latitude\]=17\.437512&pickup\[longitude\]=78\.448311/); assert.match(u, /pickup\[formatted_address\]=DIGIPIN /);
  assert.equal(handoffPlan('uber', { pickup: p }).mode, 'link'); assert.equal(handoffPlan('rapido', { pickup: p }).mode, 'clipboard');
  assert.equal(handoffPlan('ola', { pickup: p }).mode, 'clipboard'); assert.equal(handoffPlan('ola', { pickup: p, olaToken: true }).mode, 'link');
  assert.equal(handoffPlan('uber', { pickup: null }), null);
});
test('G9: ride panel — every hand-off has a plan when the pickup is a real fix; copy tool for drivers; none without a fix', () => {
  const R = buildRidePanel({ lat: 17.3616, lng: 78.4747, name: 'Charminar' }, { origin: { lat: 17.4375, lng: 78.4483, real: true, label: 'Your location' }, pickupLandmark: { name: 'Ameerpet Metro', distance_m: 30 } });
  for (const a of R.actions) assert.ok(a.handoff && /DIGIPIN/.test(a.handoff.text), `${a.id} hand-off`);
  assert.equal(R.actions.find((a) => a.id === 'uber').handoff.mode, 'link'); assert.equal(R.actions.find((a) => a.id === 'rapido').handoff.mode, 'clipboard');
  assert.match(decodeURIComponent(R.actions.find((a) => a.id === 'uber').url), /pickup\[formatted_address\]=DIGIPIN .* · near Ameerpet Metro/);
  assert.equal(R.tools[0].kind, 'copy'); assert.match(R.tools[0].copyText, /Landmark: near Ameerpet Metro/);
  const N = buildRidePanel({ lat: 17.3616, lng: 78.4747, name: 'Charminar' }, {});
  assert.ok(N.actions.every((a) => !a.handoff)); assert.deepEqual(N.tools, []);
});

// ---------- G10 no silent reroutes, voice choice kept ----------
test('G10: faster route is offered only for ≥ 2 min and ≥ 10 %; auto-accept is opt-in; reroute keeps the trip options', () => {
  assert.deepEqual(fasterRouteOffer(1200, { duration_s: 1000 }), { offer: true, savedS: 200 });
  assert.equal(fasterRouteOffer(1200, { duration_s: 1100 }).offer, false, '100 s');
  assert.equal(fasterRouteOffer(7200, { duration_s: 6700 }).offer, false, '500 s but < 10 %');
  assert.equal(fasterRouteOffer(1200, { duration_s: 500, fallback: true }).offer, false, 'never a straight-line estimate');
  assert.equal(fasterRouteOffer(NaN, { duration_s: 1 }).offer, false);
  const s = memStore(); assert.equal(autoAcceptFaster(s), false); setAutoAcceptFaster(true, s); assert.equal(autoAcceptFaster(s), true);
  assert.deepEqual(rerouteOptions({ mode: 'two', mainRoads: true, avoidTolls: true, dest: {} }), { mainRoads: true, avoidTolls: true, avoidHighways: false });
});
test('G10: the chosen guidance voice survives a device without it (fallback per utterance, choice not erased)', () => {
  const s = memStore();
  setStoredVoice({ id: 'te-IN-x-tem-local', lang: 'te-IN', name: 'Telugu' }, s);
  const list = [{ voiceURI: 'en-IN-1', name: 'English India', lang: 'en-IN' }];
  assert.equal(chooseVoice(list, 'te', storedVoice(s)), null, 'no Telugu voice now');
  assert.deepEqual(storedVoice(s), { id: 'te-IN-x-tem-local', lang: 'te', name: 'Telugu' }, 'still stored');
  const back = [...list, { voiceURI: 'te-IN-x-tem-local', name: 'Telugu', lang: 'te-IN' }];
  assert.equal(chooseVoice(back, 'te', storedVoice(s)).id, 'te-IN-x-tem-local', 'used again when it comes back');
});

// ---------- G6 add a missing place ----------
test('G6: missing place → structured OSM note with suggested tags, validated phone/hours/website, DIGIPIN + landmark', () => {
  const n = buildMissingPlaceNote({ lat: 17.7289, lng: 83.305, name: 'Sri Sai Kirana', kind: 'kirana', phone: '98765 43210', opening_hours: 'Mo-Sa 08:00-21:00', website: 'srisai.example', digipin: '422-5L8-K8M6', landmark: 'RTC Complex', note: 'Opposite the bus stop' });
  assert.match(n.text, /^\[Missing place\] Sri Sai Kirana/); assert.match(n.text, /name=Sri Sai Kirana/); assert.match(n.text, /shop=convenience/);
  assert.match(n.text, /phone=\+91 98765 43210/); assert.match(n.text, /opening_hours=Mo-Sa 08:00-21:00/); assert.match(n.text, /website=https:\/\/srisai\.example/);
  assert.match(n.text, /Location: DIGIPIN 422-5L8-K8M6 · near RTC Complex/); assert.match(n.text, /anonymous/);
  assert.match(n.body, /lat=17\.728900&lon=83\.305000/);
  const temple = buildMissingPlaceNote({ lat: 17.7, lng: 83.3, name: 'Temple X', kind: 'temple' });
  assert.match(temple.text, /amenity=place_of_worship\n  religion=hindu/);
  assert.throws(() => buildMissingPlaceNote({ lat: 17.7, lng: 83.3, name: 'x', kind: 'shop' }), /name_required/);
  assert.throws(() => buildMissingPlaceNote({ lat: 17.7, lng: 83.3, name: 'Shop', kind: 'casino' }), /invalid_kind/);
  assert.throws(() => buildMissingPlaceNote({ lat: 17.7, lng: 83.3, name: 'Shop', kind: 'shop', phone: 'abc' }), /invalid_phone/);
  assert.throws(() => buildMissingPlaceNote({ lat: 99, lng: 83.3, name: 'Shop', kind: 'shop' }), /invalid_point/);
  assert.ok(Object.keys(PLACE_KINDS).length >= 15);
});

// ---------- strings ----------
test('v0.7.20 strings: en/hi/te complete, other languages fall back to English, templates fill', () => {
  for (const l of ['hi', 'te']) assert.deepEqual(V720_KEYS.filter((k) => !V720[l][k]), [], `${l} complete`);
  for (const k of Object.keys(PLACE_KINDS)) assert.ok(V720.en[`mpk_${k}`], `kind label ${k}`);
  assert.equal(t('ta', 'mr_toggle'), 'Prefer main roads');
  assert.equal(tf('en', 'fr_offer', { n: 4 }), 'Faster route · saves 4 min');
  assert.equal(tf('te', 'fr_offer', { n: 4 }), 'వేగవంతమైన మార్గం · 4 ని ఆదా');
  const sw = fs.readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  for (const f of ['/shared/search-locality.js', '/shared/alarms.js', '/shared/route-alerts.js', '/shared/reroute.js', '/shared/handoff.js', '/shared/guardrails.js', '/shared/i18n-v0720.js', '/nav/alarms.js', '/lib/clipboard.js']) assert.ok(sw.includes(`"${f}"`), `precache ${f}`);
});

// ---------- G3 (partial) Bengaluru Namma Metro — unofficial ODbL GTFS, bundled, labelled ----------
test('G3: Bengaluru metro (unofficial ODbL GTFS) planned on-device, attribution says unofficial + approximated; Hyderabad unchanged', async () => {
  const { planTransit } = await import('../web/services/transit.js');
  const fetchImpl = async (u) => ({ ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(new URL(`../web/${u}`, import.meta.url))) });
  const wed9 = new Date('2026-10-21T09:00:00+05:30');
  const blr = await planTransit({ lat: 12.9958, lng: 77.7579 }, { lat: 12.9757, lng: 77.5729 }, { now: wed9, fetchImpl }); // Whitefield → Majestic
  assert.ok(blr.itineraries.length >= 1, blr.reason); assert.equal(blr.feed, 'bmrcl');
  assert.match(blr.attribution, /Unofficial .*ODbL.*approximated/);
  const ride = blr.itineraries[0].legs.find((l) => l.type === 'ride');
  assert.equal(ride.route.short, 'Purple'); assert.match(ride.to.name, /Majestic/);
  const hyd = await planTransit({ lat: 17.4966, lng: 78.3731 }, { lat: 17.4013, lng: 78.5602 }, { now: wed9, fetchImpl });
  assert.equal(hyd.feed, 'hmrl'); assert.ok(hyd.itineraries.length >= 1);
  const attr = fs.readFileSync(new URL('../server/transit/feeds/bmrcl/ATTRIBUTION.txt', import.meta.url), 'utf8');
  assert.match(attr, /ODbL 1\.0/); assert.match(attr, /share-alike/);
});
