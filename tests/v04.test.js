// v0.4 unit tests: backend infrastructure (cache, rate limiter, upstream throttle / coalescing / circuit breaker,
// provider fallback), Valhalla parsing, tolls along a route, EV parsing, GTFS loader + RAPTOR planner.
// Fixtures are real captured responses (tests/fixtures/README.md); no network is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { LruCache } from '../server/lib/lru.js';
import { TokenBucketLimiter } from '../server/lib/ratelimit.js';
import { createUpstream, withFallback } from '../server/lib/upstream.js';
import { createProviders, providerConfig } from '../server/providers/index.js';
import { decodePolyline, encodePolyline, simplify, projectOnLine, lineLengthM } from '../shared/polyline.js';
import { buildValhallaRequest, parseValhalla, mapValhallaManeuver } from '../shared/valhalla.js';
import { buildTollQuery, parseTolls, corridorLine } from '../shared/tolls.js';
import { parseOsmCharger, parseOcm, parsePowerKw, parseParking } from '../shared/ev.js';
import { parseCsv, readZip, loadFeed, buildTimetable, toSec } from '../server/transit/gtfs.js';
import { planJourney, activeServices, stopsNear, nextDepartures } from '../shared/transit/raptor.js';
import { packTimetable, unpackTimetable } from '../shared/transit/pack.js';
import { parseOsrm, buildValhallaUrl } from '../web/services/routing.js';
import { haversineKm } from '../shared/geo.js';

const fx = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const clock = (t0 = 1_000_000) => { const c = { t: t0, now: () => c.t, sleep: async (ms) => { c.t += ms; } }; return c; };
const okRes = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

// ---------- cache ----------
test('LRU cache: TTL expiry, LRU eviction order, stats', () => {
  const c = clock();
  const lru = new LruCache({ max: 2, ttlMs: 1000, now: c.now });
  lru.set('a', 1); lru.set('b', 2);
  assert.equal(lru.get('a'), 1);          // a is now most recent
  lru.set('c', 3);                         // evicts b (least recently used)
  assert.equal(lru.get('b'), undefined);
  assert.equal(lru.get('a'), 1); assert.equal(lru.get('c'), 3);
  c.t += 1001;
  assert.equal(lru.get('a'), undefined, 'expired');
  assert.equal(lru.stats.evictions, 1); assert.ok(lru.stats.expired >= 1);
  lru.set('x', 9, 50); c.t += 49; assert.equal(lru.has('x'), true); c.t += 2; assert.equal(lru.has('x'), false);
});

// ---------- rate limiter ----------
test('token bucket: burst then refill, per key, retry-after', () => {
  const c = clock();
  const rl = new TokenBucketLimiter({ capacity: 3, refillPerSec: 1, now: c.now });
  assert.ok(rl.take('ip1').ok && rl.take('ip1').ok && rl.take('ip1').ok);
  const no = rl.take('ip1'); assert.equal(no.ok, false); assert.equal(no.retryAfterMs, 1000);
  assert.ok(rl.take('ip2').ok, 'other key unaffected');
  c.t += 1000; assert.ok(rl.take('ip1').ok, 'refilled one token'); assert.equal(rl.take('ip1').ok, false);
  c.t += 10_000; assert.equal(rl.take('ip1').remaining, 2, 'capped at capacity');
  const small = new TokenBucketLimiter({ capacity: 1, refillPerSec: 1, maxKeys: 2, now: c.now });
  small.take('a'); small.take('b'); small.take('c');
  assert.equal(small.buckets.size, 2, 'bounded memory');
});

// ---------- upstream ----------
test('upstream: identifying User-Agent, 1 req/s throttle, cache, coalescing', async () => {
  const c = clock(); const calls = [];
  const fetchImpl = async (url, o) => { calls.push({ url, t: c.t, ua: o.headers['User-Agent'] }); return okRes({ url }); };
  const u = createUpstream({ name: 't', baseUrl: 'https://x.test', minIntervalMs: 1000, fetchImpl, now: c.now, sleep: c.sleep });
  await u.request('/a'); await u.request('/b'); await u.request('/c');
  assert.deepEqual(calls.map((x) => x.t - calls[0].t), [0, 1000, 2000], 'spaced 1 s apart');
  assert.match(calls[0].ua, /BharatMap\/0\.4/);
  await u.request('/a'); assert.equal(calls.length, 3, 'cache hit');
  const [p, q] = await Promise.all([u.request('/d'), u.request('/d')]);
  assert.deepEqual(p, q); assert.equal(calls.length, 4, 'coalesced'); assert.equal(u.stats.coalesced, 1);
});
test('upstream: timeout and circuit breaker (open → short-circuit → half-open → closed)', async () => {
  const c = clock(); let fail = true; let n = 0;
  const fetchImpl = async () => { n++; if (fail) throw Object.assign(new Error('boom'), { name: 'TypeError' }); return okRes({ ok: 1 }); };
  const u = createUpstream({ name: 'svc', baseUrl: 'https://x.test', failureThreshold: 2, cooldownMs: 5000, fetchImpl, now: c.now, sleep: c.sleep, ttlMs: 0 });
  await assert.rejects(u.request('/1'), /svc_network_error/);
  await assert.rejects(u.request('/2'), /svc_network_error/);
  assert.equal(u.breaker.state, 'open');
  await assert.rejects(u.request('/3'), /svc_circuit_open/); assert.equal(n, 2, 'no upstream call while open');
  c.t += 5000; fail = false;
  assert.deepEqual(await u.request('/4'), { ok: 1 }); assert.equal(u.breaker.state, 'closed');
  // 404 does not trip the breaker
  const u2 = createUpstream({ name: 'nf', baseUrl: 'https://x.test', failureThreshold: 1, fetchImpl: async () => ({ ok: false, status: 404 }), now: c.now, sleep: c.sleep });
  await assert.rejects(u2.request('/x'), /nf_http_404/); assert.equal(u2.breaker.state, 'closed');
  // real timeout path (AbortController)
  const u3 = createUpstream({ name: 'slow', baseUrl: 'https://x.test', timeoutMs: 20, fetchImpl: (url, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
  await assert.rejects(u3.request('/s'), /slow_timeout/);
});
test('withFallback: first success wins, failures recorded, all-fail error', async () => {
  const r = await withFallback([['a', async () => { throw new Error('x'); }], ['b', async () => 42]]);
  assert.equal(r.provider, 'b'); assert.equal(r.value, 42); assert.deepEqual(r.tried, [{ provider: 'a', error: 'x' }]);
  await assert.rejects(withFallback([['a', async () => { throw new Error('x'); }]]), (e) => e.message === 'all_providers_failed' && e.tried.length === 1);
});

// ---------- providers ----------
const VIZ = { lat: 17.7289, lng: 83.305 }, RKB = { lat: 17.714, lng: 83.323 };
function fakeFetch(routes) {
  const log = [];
  const f = async (url, o = {}) => { log.push(`${o.method || 'GET'} ${url}`); for (const [re, h] of routes) if (re.test(url)) return h(url, o); throw new TypeError('fetch failed'); };
  f.log = log; return f;
}
test('provider config: env overrides, public defaults flagged for throttling', () => {
  const d = providerConfig({});
  assert.equal(d.valhalla.public, true); assert.equal(d.osrm.drive.url, 'https://routing.openstreetmap.de/routed-car');
  const s = providerConfig({ VALHALLA_URL: 'http://valhalla:8002', OSRM_URL_FOOT: 'http://osrm-foot:5000', PHOTON_URL: 'http://photon:2322', OCM_API_KEY: 'k' });
  assert.equal(s.valhalla.configured, true); assert.equal(s.osrm.walk.url, 'http://osrm-foot:5000'); assert.equal(s.osrm.walk.public, false); assert.equal(s.photon.public, false); assert.equal(s.ocm.key, 'k');
});
test('providers.route: two-wheeler uses Valhalla motor_scooter; falls back to OSRM (estimate) then straight line', async () => {
  const c = clock();
  const f = fakeFetch([[/valhalla/, () => okRes(fx('valhalla-two-dwarakanagar-rkbeach'))], [/routed-car/, () => okRes(fx('osrm-drive-dwarakanagar-rkbeach'))]]);
  const p = createProviders({ env: {}, fetchImpl: f, now: c.now, sleep: c.sleep });
  const r = await p.route('two', VIZ, RKB);
  assert.equal(r.provider, 'valhalla'); assert.equal(r.estimate, false); assert.equal(r.routes.length, 3);
  assert.match(f.log[0], /POST https:\/\/valhalla1\.openstreetmap\.de\/route/);
  const p2 = createProviders({ env: {}, fetchImpl: fakeFetch([[/routed-car/, () => okRes(fx('osrm-drive-dwarakanagar-rkbeach'))]]), now: c.now, sleep: c.sleep });
  const r2 = await p2.route('two', VIZ, RKB);
  assert.equal(r2.provider, 'osrm'); assert.equal(r2.estimate, true, 'car graph = estimate'); assert.equal(r2.tried[0].provider, 'valhalla');
  const p3 = createProviders({ env: {}, fetchImpl: fakeFetch([]), now: c.now, sleep: c.sleep });
  const r3 = await p3.route('drive', VIZ, RKB);
  assert.equal(r3.fallback, true); assert.equal(r3.engine, 'fallback-straight-line'); assert.equal(r3.tried.length, 2);
});
test('providers.route: drive prefers OSRM unless VALHALLA_URL is self-hosted; avoid tolls goes to Valhalla with use_tolls=0', async () => {
  const c = clock(); let body = null;
  const f = fakeFetch([[/valhalla/, (u, o) => { body = JSON.parse(o.body); return okRes(fx('valhalla-two-dwarakanagar-rkbeach')); }], [/routed-car|osrm/, () => okRes(fx('osrm-drive-dwarakanagar-rkbeach'))]]);
  const p = createProviders({ env: {}, fetchImpl: f, now: c.now, sleep: c.sleep });
  assert.equal((await p.route('drive', VIZ, RKB)).provider, 'osrm');
  const a = await p.route('drive', VIZ, RKB, { avoidTolls: true, avoidHighways: true });
  assert.equal(a.provider, 'valhalla'); assert.deepEqual(body.costing_options, { auto: { use_tolls: 0, use_highways: 0 } }); assert.equal(a.avoid_applied, true);
  const self = createProviders({ env: { VALHALLA_URL: 'http://valhalla:8002' }, fetchImpl: f, now: c.now, sleep: c.sleep });
  const s = await self.route('drive', VIZ, RKB);
  assert.equal(s.provider, 'valhalla'); assert.equal(s.engine, 'valhalla');
  assert.ok(f.log.some((l) => l.startsWith('POST http://valhalla:8002/route')));
});
test('providers.geocode: Photon first, Nominatim fallback; autocomplete never uses Nominatim', async () => {
  const c = clock();
  const f = fakeFetch([[/photon/, () => okRes(fx('photon-kailasa'))], [/nominatim/, () => okRes(fx('nominatim-search-kailasagiri'))]]);
  const p = createProviders({ env: {}, fetchImpl: f, now: c.now, sleep: c.sleep });
  const g = await p.geocode('Kailasa', { lat: 17.72, lng: 83.3, autocomplete: true });
  assert.equal(g.provider, 'photon'); assert.ok(g.items.length >= 2);
  const p2 = createProviders({ env: {}, fetchImpl: fakeFetch([[/nominatim/, () => okRes(fx('nominatim-search-kailasagiri'))]]), now: c.now, sleep: c.sleep });
  const g2 = await p2.geocode('Kailasagiri', {});
  assert.equal(g2.provider, 'nominatim'); assert.ok(g2.items[0].name);
  await assert.rejects(p2.geocode('Kailasa', { autocomplete: true }), /all_providers_failed/);
});
test('providers.nearby: EV via Open Charge Map when keyed (key never in output), OSM fallback with connector details', async () => {
  const c = clock();
  const ocm = [{ ID: 1, AddressInfo: { Title: 'Test Hub', Latitude: 17.73, Longitude: 83.31, Town: 'Visakhapatnam' }, OperatorInfo: { Title: 'Tata Power' }, Connections: [{ ConnectionType: { Title: 'CCS (Type 2)' }, PowerKW: 60, Quantity: 2 }], NumberOfPoints: 2, StatusType: { Title: 'Operational', IsOperational: true }, DataProvider: { Title: 'Open Charge Map Contributors' } }];
  let seen = '';
  const p = createProviders({ env: { OCM_API_KEY: 'secret123' }, fetchImpl: fakeFetch([[/openchargemap/, (u) => { seen = u; return okRes(ocm); }]]), now: c.now, sleep: c.sleep });
  const r = await p.nearby('ev', VIZ, { radiusM: 3000 });
  assert.equal(r.provider, 'openchargemap'); assert.match(seen, /key=secret123/); assert.ok(!JSON.stringify(r).includes('secret123'));
  assert.equal(r.items[0].ev.connectors[0].power_kw, 60); assert.equal(r.items[0].ev.operator, 'Tata Power');
  const p2 = createProviders({ env: {}, fetchImpl: fakeFetch([[/overpass/, () => okRes(fx('overpass-ev-dwarakanagar'))]]), now: c.now, sleep: c.sleep });
  const r2 = await p2.nearby('ev', VIZ, { radiusM: 3000 });
  assert.equal(r2.provider, 'overpass'); assert.ok(r2.items.length > 0); assert.ok(r2.items.every((x) => x.ev && Array.isArray(x.ev.connectors)));
});

// ---------- polyline / valhalla ----------
test('polyline6 round trip, simplify keeps ends, projection along the line', () => {
  const line = [[83.305, 17.7289], [83.31, 17.72], [83.315, 17.718], [83.323, 17.714]];
  assert.deepEqual(decodePolyline(encodePolyline(line)), line);
  const s = simplify(line, 5000); assert.deepEqual(s, [line[0], line[3]]);
  const pr = projectOnLine([83.31, 17.72], line); assert.ok(pr.distM < 1); assert.ok(Math.abs(pr.alongM - lineLengthM(line.slice(0, 2))) < 1);
});
test('Valhalla: request (costing, avoid options, alternates), real motor_scooter response → routes with steps', () => {
  const rq = buildValhallaRequest('two', VIZ, RKB, { avoidTolls: true });
  assert.equal(rq.costing, 'motor_scooter'); assert.equal(rq.costing_options.motor_scooter.use_tolls, 0); assert.equal(rq.alternates, 2);
  assert.equal(buildValhallaRequest('walk', VIZ, RKB, { avoidTolls: true }).costing_options, undefined, 'tolls irrelevant on foot');
  assert.throws(() => buildValhallaRequest('boat', VIZ, RKB), /unknown_mode/);
  assert.match(buildValhallaUrl('bike', VIZ, RKB), /^https:\/\/valhalla1\.openstreetmap\.de\/route\?json=.*bicycle/);
  const routes = parseValhalla(fx('valhalla-two-dwarakanagar-rkbeach'), 'two');
  assert.equal(routes.length, 3);
  const r = routes[0];
  assert.ok(r.distance_m > 3000 && r.distance_m < 6000 && r.duration_s > 300);
  assert.equal(r.steps[0].type, 'depart'); assert.equal(r.steps.at(-1).type, 'arrive');
  assert.ok(r.steps.some((s) => s.type === 'turn' && /left|right/.test(s.modifier)));
  const [lng, lat] = r.geometry.coordinates[0]; assert.ok(Math.abs(lat - 17.7289) < 0.002 && Math.abs(lng - 83.305) < 0.002);
  assert.deepEqual(mapValhallaManeuver({ type: 26 }), { type: 'roundabout', modifier: 'straight' });
  assert.throws(() => parseValhalla({ error_code: 442 }, 'two'), /valhalla_442/);
});

// ---------- tolls ----------
test('tolls: real NH16 route Dwaraka Nagar → Anakapalli has 2 OSM toll plazas, ordered, booths merged, no fees', () => {
  const route = parseOsrm(fx('osrm-drive-dwarakanagar-anakapalli'), 'drive')[0];
  const q = buildTollQuery(route.geometry.coordinates);
  assert.match(q, /barrier"="toll_booth"\]\(around:60,/); assert.match(q, /toll_gantry/); assert.match(q, /\["toll"="yes"\]\(around:15,/);
  assert.ok(corridorLine(route.geometry.coordinates).length <= 180);
  const t = parseTolls(fx('overpass-tolls-dwarakanagar-anakapalli'), route.geometry.coordinates);
  assert.equal(t.count, 2); assert.equal(t.fees, null);
  assert.ok(t.plazas[0].along_m < t.plazas[1].along_m);
  assert.equal(t.plazas[1].name, 'Aganampudi'); assert.ok(t.plazas.every((p) => p.booths >= 1));
  assert.match(t.note, /fees not available/);
  // a booth far from the route is ignored; toll=yes way along the route is measured
  const line = [[83.0, 17.7], [83.01, 17.7], [83.02, 17.7]];
  const synth = { elements: [{ type: 'node', id: 1, lat: 17.71, lon: 83.01, tags: { barrier: 'toll_booth' } }, { type: 'way', id: 2, tags: { highway: 'trunk', toll: 'yes', ref: 'NH16' }, geometry: [{ lat: 17.7, lon: 83.0 }, { lat: 17.7, lon: 83.01 }] }] };
  const s = parseTolls(synth, line);
  assert.equal(s.count, 0, '1.1 km away'); assert.ok(Math.abs(s.toll_road_m - 1060) < 30, `toll road m ${s.toll_road_m}`); assert.deepEqual(s.toll_roads, ['NH16']);
});

// ---------- EV / parking ----------
test('EV: OSM socket tags → connectors/power/operator; OCM parse; parking details', () => {
  assert.equal(parsePowerKw('22 kW'), 22); assert.equal(parsePowerKw('7400 W'), 7.4); assert.equal(parsePowerKw('x'), null);
  const d = parseOsmCharger({ amenity: 'charging_station', operator: 'Tata Power', 'socket:type2_combo': '2', 'socket:type2_combo:output': '60 kW', 'socket:type2': '1', 'socket:type2:output': '22 kW', 'socket:chademo': 'no', capacity: '3', fee: 'yes' });
  assert.deepEqual(d.connectors.map((c) => [c.type, c.count, c.power_kw]), [['CCS2', 2, 60], ['Type 2', 1, 22]]);
  assert.equal(d.max_power_kw, 60); assert.equal(d.operator, 'Tata Power'); assert.equal(d.points, 3);
  const real = fx('overpass-ev-dwarakanagar').elements.map((e) => parseOsmCharger(e.tags || {}));
  assert.ok(real.length > 0 && real.every((x) => Array.isArray(x.connectors)));
  const o = parseOcm([{ ID: 7, AddressInfo: { Title: 'X', Latitude: 17.7, Longitude: 83.3 }, Connections: [{ ConnectionType: { Title: 'Type 2 (Socket Only)' }, PowerKW: 7.4 }] }], VIZ, haversineKm);
  assert.equal(o[0].id, 'ocm:7'); assert.equal(o[0].ev.max_power_kw, 7.4); assert.ok(o[0].distance_m > 0);
  const pk = parseParking({ amenity: 'parking', fee: 'yes', capacity: '120', parking: 'multi-storey' });
  assert.deepEqual([pk.fee, pk.capacity, pk.kind], ['yes', 120, 'multi-storey']);
});

// ---------- GTFS ----------
test('GTFS CSV parser: BOM, quotes, embedded commas/newlines, CRLF, missing trailing newline', () => {
  const rows = parseCsv('\uFEFFa,b,c\r\n1,"x, y",3\r\n2,"he said ""hi""","multi\nline"\n4,,');
  assert.deepEqual(rows, [{ a: '1', b: 'x, y', c: '3' }, { a: '2', b: 'he said "hi"', c: 'multi\nline' }, { a: '4', b: '', c: '' }]);
  assert.equal(toSec('25:10:05'), 90605); assert.equal(toSec(''), null);
});
function zipStore(files) { // tiny ZIP writer (stored + deflate) to test the reader
  const parts = [], central = []; let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text); const data = zlib.deflateRawSync(raw); const nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, data); central.push(ch, nm); off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}
// Small TEST FIXTURE feed (clearly fictional: "Test Line A/B"), used to exercise transfers and calendars.
const FIX = {
  'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon,parent_station\nS1,Alpha,17.40,78.40,\nS2,Beta,17.40,78.42,X\nS2b,Beta,17.4001,78.4201,X\nS3,Gamma,17.40,78.44,\nS4,Delta,17.42,78.42,\n',
  'routes.txt': 'route_id,route_short_name,route_long_name,route_type,route_color\nA,TA,Test Line A,1,FF0000\nB,TB,Test Line B,1,0000FF\n',
  'trips.txt': 'route_id,service_id,trip_id,trip_headsign\nA,WK,a1,Gamma\nA,WK,a2,Gamma\nB,WK,b1,Delta\nB,SU,b2,Delta\n',
  'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\na1,08:00:00,08:00:00,S1,1\na1,08:05:00,08:05:00,S2,2\na1,08:10:00,08:10:00,S3,3\na2,08:30:00,08:30:00,S1,1\na2,08:35:00,08:35:00,S2,2\na2,08:40:00,08:40:00,S3,3\nb1,08:09:00,08:09:00,S2b,1\nb1,08:15:00,08:15:00,S4,2\nb2,08:09:00,08:09:00,S2b,1\nb2,08:15:00,08:15:00,S4,2\n',
  'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20260101,20271231\nSU,0,0,0,0,0,0,1,20260101,20271231\n',
  'calendar_dates.txt': 'service_id,date,exception_type\nWK,20261020,2\n',
};
test('GTFS: zip reader + loader + timetable (patterns, services, same-station transfers)', () => {
  const z = readZip(zipStore(FIX)); assert.equal(z['stops.txt'].toString(), FIX['stops.txt']);
  const tmp = fs.mkdtempSync('/tmp/gtfs-'); fs.writeFileSync(`${tmp}/feed.zip`, zipStore(FIX));
  const tt = buildTimetable(loadFeed(`${tmp}/feed.zip`), { id: 'fixture' });
  assert.equal(tt.patterns.length, 2); assert.equal(tt.patterns[0].trips.length, 2);
  assert.deepEqual(tt.services.WK.remove, ['20261020']);
  const beta = tt.stops.findIndex((s) => s.id === 'S2'), betaB = tt.stops.findIndex((s) => s.id === 'S2b');
  assert.ok(tt.transfers.some(([a, b, sec]) => a === beta && b === betaB && sec >= 120), 'same-station transfer ≥ 2 min');
  assert.throws(() => loadFeed(fs.mkdtempSync('/tmp/empty-')), /gtfs_missing_stops/);
});
test('RAPTOR: walk → ride → transfer → ride → walk; calendar exceptions; no stop nearby', () => {
  const tmp = fs.mkdtempSync('/tmp/gtfs-'); fs.writeFileSync(`${tmp}/f.zip`, zipStore(FIX));
  const tt = buildTimetable(loadFeed(`${tmp}/f.zip`), { id: 'fixture' });
  const from = { lat: 17.4005, lng: 78.4 }, to = { lat: 17.4205, lng: 78.42 };
  const r = planJourney(tt, from, to, { date: '20261019', dow: 0, departSec: 7 * 3600 + 55 * 60 });
  assert.equal(r.itineraries.length, 1);
  const it = r.itineraries[0];
  assert.deepEqual(it.legs.map((l) => l.type), ['walk', 'ride', 'transfer', 'ride', 'walk']);
  assert.equal(it.legs[1].route.short, 'TA'); assert.equal(it.legs[3].route.short, 'TB'); assert.equal(it.transfers, 1); assert.equal(it.scheduled, true);
  assert.equal(it.legs[3].depart_s, 8 * 3600 + 9 * 60);
  // 20 Oct 2026 has a calendar_dates removal for WK → no service
  assert.equal(planJourney(tt, from, to, { date: '20261020', dow: 1, departSec: 7 * 3600 }).reason, 'no_service_on_date');
  assert.deepEqual([...activeServices(tt, '20261025', 6)], ['SU']);
  assert.equal(planJourney(tt, { lat: 18, lng: 79 }, to, { date: '20261019', dow: 0, departSec: 0 }).reason, 'no_stop_near_start');
});
test('RAPTOR on the real HMRL feed: Miyapur → Uppal needs Red → Blue at Ameerpet; pack/unpack is lossless', () => {
  const tt = buildTimetable(loadFeed(new URL('../server/transit/feeds/hmrl', import.meta.url).pathname), { id: 'hmrl' });
  assert.equal(tt.routes.length, 3); assert.ok(tt.stops.length > 100);
  const miyapur = { lat: 17.4966, lng: 78.3731 }, uppal = { lat: 17.4013, lng: 78.5602 };
  const r = planJourney(tt, miyapur, uppal, { date: '20261021', dow: 2, departSec: 9 * 3600 });
  assert.ok(r.itineraries.length >= 1);
  const it = r.itineraries[0];
  const rides = it.legs.filter((l) => l.type === 'ride');
  assert.deepEqual(rides.map((l) => l.route.id), ['RED', 'BLUE']);
  assert.match(rides[0].to.name, /Ameerpet/);
  assert.ok(it.duration_s > 40 * 60 && it.duration_s < 100 * 60, `duration ${it.duration_s}`);
  const near = stopsNear(tt, { lat: 17.4357, lng: 78.4448 }, 300); assert.ok(near.length >= 2);
  const deps = nextDepartures(tt, near[0].i, { date: '20261021', dow: 2, sec: 9 * 3600 }); assert.ok(deps.length >= 2 && deps.every((d) => d.dep_s >= 9 * 3600));
  const back = unpackTimetable(JSON.parse(JSON.stringify(packTimetable(tt))));
  assert.deepEqual(back.patterns, tt.patterns); assert.deepEqual(back.stops, tt.stops);
});
