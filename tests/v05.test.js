// v0.5 unit tests: lane parser (OSRM + Valhalla), maxspeed parsing + route speed-limit segments + overspeed logic,
// NOAA sunrise/sunset, deep-link parser + share/list links, OSM note payload + rate limit, incident expiry/confidence,
// junction diagram, navigation sound cues, offline place index, privacy model, multi-stop OSRM URL/parse, i18n v0.5.
// Real captured fixtures: osrm-drive-silkboard-ecity.json (OSRM, Bengaluru, lanes at the Hosur Road fork) and
// valhalla-trace-silkboard-ecity.json (Valhalla trace_attributes edge.speed_limit), see tests/fixtures/README.md.
// Synthetic inputs below are labelled and follow the documented OSRM / Valhalla / OSM formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOsrmLanes, collectOsrmLanes, parseValhallaLanes, laneHintUseful, laneStripHtml, laneSvg } from '../shared/lanes.js';
import { parseMaxspeed, osrmMaxspeedKmh, segmentsFromOsrmAnnotation, segmentsFromValhallaTrace, segmentsFromOverpassWays, buildMaxspeedQuery, limitAt, coverage, mergeSegments, scaleSegments, createOverspeedMonitor, speedKmhFromFixes } from '../shared/maxspeed.js';
import { sunTimes, isDaytime, navStyleFor, julianDay } from '../shared/sun.js';
import { parseDeepLink, buildShareLinks, encodeList, decodeList, buildListLink } from '../shared/deeplink.js';
import { buildNotePayload, parseNoteResponse, noteRateLimit, validateIncident, isExpired, activeIncidents, confidence, minutesLeft, expiresAt, INCIDENT_TTL_MS, NOTE_CATEGORIES } from '../shared/community.js';
import { isComplexJunction, junctionSvg, geometryAround } from '../web/nav/junction.js';
import { SOUND_CUES, cueDuration, createSounds } from '../web/nav/sounds.js';
import { buildIndex, searchIndex, landmarkNear, norm } from '../web/lib/offline-index.js';
import { classifyStorage, buildExport, keysToDelete } from '../web/lib/privacy-model.js';
import { parseOsrm, buildRouteUrl, fallbackRoutes } from '../web/services/routing.js';
import { buildValhallaRequest, parseValhalla } from '../shared/valhalla.js';
import { buildTraceUrl } from '../web/services/speed.js';
import { cumulative, projectOnRoute, createTracker } from '../web/nav/tracker.js';
import { lineLengthM } from '../shared/polyline.js';
import { STRINGS, LANGS, V5_KEYS } from '../shared/i18n.js';
import { buildInstruction, maneuverIcon } from '../web/nav/maneuver.js';

const fx = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));

// ---------- lanes ----------
test('lanes: OSRM intersections → lanes (real Bengaluru fork fixture: 2 straight valid, right not valid)', () => {
  const r = parseOsrm(fx('osrm-drive-silkboard-ecity'), 'drive')[0];
  assert.equal(r.lanes.length, 1);
  const l = r.lanes[0];
  assert.deepEqual(l.lanes.map((x) => x.valid), [true, true, false]);
  assert.deepEqual(l.lanes.map((x) => x.indications[0]), ['straight', 'straight', 'right']);
  assert.equal(l.stepIndex, 2); assert.equal(l.maneuver, false);
  assert.ok(laneHintUseful(l.lanes));
  // along-route position of the lane intersection
  const c = r.geometry.coordinates; const along = projectOnRoute(c, cumulative(c), l.location, null).along;
  assert.ok(along > 2900 && along < 3000, `along ${along}`);
});
test('lanes: parser edge cases + unknown indications normalised; Valhalla bitmasks', () => {
  assert.equal(parseOsrmLanes(undefined), null); assert.equal(parseOsrmLanes([]), null);
  assert.deepEqual(parseOsrmLanes([{ indications: ['left', 'straight'], valid: true }, { indications: [], valid: false }, { indications: ['weird'], valid: true }]),
    [{ indications: ['left', 'straight'], valid: true }, { indications: ['none'], valid: false }, { indications: ['none'], valid: true }]);
  // Synthetic Valhalla maneuver.lanes (documented bit flags: 2 through, 8 left, 64 right)
  assert.deepEqual(parseValhallaLanes([{ directions: 8 }, { directions: 2 | 64, valid: 2, active: 2 }, { directions: 64, valid: 64 }]),
    [{ indications: ['left'], valid: false }, { indications: ['straight', 'right'], valid: true }, { indications: ['right'], valid: true }]);
  assert.equal(laneHintUseful([{ valid: true }, { valid: true }]), false);
  assert.equal(collectOsrmLanes([{ intersections: [{ location: [1, 2], lanes: [{ indications: ['left'], valid: true }] }, { location: [1, 3] }] }]).length, 1);
});
test('lanes: strip HTML marks valid lanes and has an accessible description; original SVG arrows', () => {
  const html = laneStripHtml([{ indications: ['left'], valid: false }, { indications: ['straight'], valid: true }], 'straight', { label: 'Lanes' });
  assert.equal((html.match(/class="lane ok"/g) || []).length, 1);
  assert.match(html, /aria-label="Lanes: 1: left, 2: straight ✓"/);
  assert.match(laneSvg({ indications: ['left', 'straight'], valid: true }), /<svg class="lane-svg"[^>]*>(<path[^>]+>){2}<\/svg>/);
  assert.equal(laneStripHtml(null), '');
});

// ---------- maxspeed ----------
test('maxspeed: "50", "50 mph", "IN:urban", lists, none/signals/walk, numbers', () => {
  assert.equal(parseMaxspeed('50').kmh, 50);
  assert.deepEqual([parseMaxspeed('50 mph').kmh, parseMaxspeed('50 mph').unit], [80, 'mph']);
  const z = parseMaxspeed('IN:urban'); assert.equal(z.kmh, null); assert.equal(z.implicit, 'IN:urban');
  assert.equal(parseMaxspeed('IN:rural').kmh, null);
  assert.equal(parseMaxspeed('60;40').kmh, 40);
  assert.equal(parseMaxspeed('80 km/h').kmh, 80);
  assert.equal(parseMaxspeed('none').kmh, null); assert.equal(parseMaxspeed('signals').kmh, null); assert.equal(parseMaxspeed('walk').kmh, null);
  assert.equal(parseMaxspeed('').kmh, null); assert.equal(parseMaxspeed(null).kmh, null); assert.equal(parseMaxspeed('999').kmh, null);
  assert.equal(parseMaxspeed(30).kmh, 30);
  assert.equal(osrmMaxspeedKmh({ speed: 30, unit: 'mph' }), 48); assert.equal(osrmMaxspeedKmh({ unknown: true }), null); assert.equal(osrmMaxspeedKmh({ none: true }), null);
});
test('maxspeed: Valhalla trace_attributes (real fixture) → segments; limitAt; coverage; scaled to the route', () => {
  const r = parseOsrm(fx('osrm-drive-silkboard-ecity'), 'drive')[0];
  const total = lineLengthM(r.geometry.coordinates);
  const segs = scaleSegments(segmentsFromValhallaTrace(fx('valhalla-trace-silkboard-ecity')), total);
  assert.ok(Math.abs(segs.at(-1).toM - total) < 1);
  assert.equal(limitAt(segs, 100), 40); assert.equal(limitAt(segs, 500), 80); assert.equal(limitAt(segs, 1200), 60);
  assert.equal(limitAt(segs, 9000), null, 'Hewlett Packard Avenue has no limit in OSM → unknown');
  const cov = coverage(segs); assert.ok(cov > 0.8 && cov < 0.86, `coverage ${cov}`);
  assert.equal(limitAt(null, 10), null); assert.equal(limitAt(segs, NaN), null);
});
test('maxspeed: OSRM annotation (synthetic, OSRM format), merge, Overpass ways matched to the route', () => {
  const legs = [{ annotation: { distance: [100, 50, 200], maxspeed: [{ speed: 50, unit: 'km/h' }, { speed: 50, unit: 'km/h' }, { unknown: true }] } }];
  assert.deepEqual(segmentsFromOsrmAnnotation(legs), [{ fromM: 0, toM: 150, kmh: 50 }, { fromM: 150, toM: 350, kmh: null }]);
  assert.equal(segmentsFromOsrmAnnotation([{ annotation: { distance: [1] } }]), null);
  assert.deepEqual(mergeSegments([{ fromM: 0, toM: 1, kmh: 30 }, { fromM: 1, toM: 2, kmh: 30 }, { fromM: 2, toM: 2, kmh: 5 }]), [{ fromM: 0, toM: 2, kmh: 30 }]);
  const coords = [[78.40, 17.40], [78.401, 17.40], [78.402, 17.40], [78.403, 17.40]];
  const ways = { elements: [{ type: 'way', tags: { maxspeed: '40' }, geometry: [{ lat: 17.40001, lon: 78.3995 }, { lat: 17.40001, lon: 78.4015 }] }, { type: 'way', tags: { maxspeed: 'IN:urban' }, geometry: [{ lat: 17.4, lon: 78.4015 }, { lat: 17.4, lon: 78.404 }] }] };
  const segs = segmentsFromOverpassWays(ways, coords);
  assert.equal(limitAt(segs, 50), 40); assert.equal(limitAt(segs, 250), null, 'implicit IN:urban is not turned into a number');
  assert.match(buildMaxspeedQuery(coords), /way\(around:20,17\.40000,78\.40000,.*\)\["highway"\]\["maxspeed"\];out tags geom;/);
  assert.match(decodeURIComponent(buildTraceUrl(coords)), /trace_attributes\?json=.*"edge\.speed_limit"/);
});
test('overspeed: >10 % for 2 s chimes once, stays over, re-arms only after 10 s at/below the limit', () => {
  let t = 0; const m = createOverspeedMonitor({ now: () => t });
  assert.equal(m.update(87, 80).over, false, '87 ≤ 88 is within tolerance');
  let r = m.update(90, 80); assert.equal(r.over, false, 'needs 2 s');
  t = 2100; r = m.update(91, 80); assert.deepEqual([r.over, r.chime], [true, true]);
  t = 3000; r = m.update(95, 80); assert.deepEqual([r.over, r.chime], [true, false]);
  t = 4000; r = m.update(78, 80); assert.equal(r.over, false);
  t = 6200; m.update(95, 80); t = 8300; r = m.update(95, 80); assert.deepEqual([r.over, r.chime], [true, false], 'not re-armed yet');
  t = 9000; m.update(70, 80); t = 19500; m.update(70, 80); t = 20000; m.update(95, 80); t = 22100; r = m.update(95, 80); assert.equal(r.chime, true, 're-armed');
  assert.deepEqual(m.update(120, null), { over: false, chime: false, ratio: null }, 'unknown limit → never over');
  assert.equal(m.update(null, 80).over, false);
});
test('speed from fixes: GPS speed (m/s) or derived from two fixes; null when implausible', () => {
  assert.equal(speedKmhFromFixes({ speed: 10 }), 36);
  const v = speedKmhFromFixes({ lat: 17.0009, lng: 78, ts: 10_000 }, { lat: 17, lng: 78, ts: 0 });
  assert.ok(v > 35 && v < 37, `${v}`);
  assert.equal(speedKmhFromFixes({ lat: 17, lng: 78, ts: 100 }, { lat: 17, lng: 78, ts: 0 }), null);
  assert.equal(speedKmhFromFixes({ lat: 18, lng: 78, ts: 2000 }, { lat: 17, lng: 78, ts: 0 }), null);
});
test('tracker exposes along-route distance for speed-limit lookup', () => {
  const r = parseOsrm(fx('osrm-drive-silkboard-ecity'), 'drive')[0];
  const tr = createTracker(r); const c = r.geometry.coordinates;
  const st = tr.update({ lat: c[10][1], lng: c[10][0], accuracy: 5 });
  assert.ok(Math.abs(st.along - cumulative(c)[10]) < 2);
});

// ---------- sunrise / sunset (NOAA) ----------
test('sun: NOAA sunrise/sunset within ~2 min of published values; polar cases; day/night style', () => {
  assert.equal(julianDay(2000, 1, 1), 2451544.5);
  const ist = (d) => d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const h = sunTimes(new Date('2026-10-19T06:00:00Z'), 17.385, 78.4867); // Hyderabad
  assert.match(ist(h.sunrise), /^06:(0[7-9]|1[0-2])$/); assert.match(ist(h.sunset), /^17:(49|5[0-4])$/);
  const d = sunTimes(new Date('2026-06-21T00:00:00Z'), 28.6139, 77.209); // New Delhi, June solstice: 05:23 / 19:21 IST
  assert.match(ist(d.sunrise), /^05:2[1-5]$/); assert.match(ist(d.sunset), /^19:(19|2[0-3])$/);
  assert.equal(sunTimes(new Date('2026-06-21T12:00:00Z'), 78, 15).polar, 'day');
  assert.equal(sunTimes(new Date('2026-12-21T12:00:00Z'), 78, 15).polar, 'night');
  assert.equal(isDaytime(new Date('2026-10-19T08:00:00Z'), 17.385, 78.48), true);  // 13:30 IST
  assert.equal(isDaytime(new Date('2026-10-19T16:00:00Z'), 17.385, 78.48), false); // 21:30 IST
  assert.equal(isDaytime(new Date('2026-10-18T23:00:00Z'), 17.385, 78.48), false); // 04:30 IST
  assert.equal(navStyleFor('night', new Date('2026-10-19T08:00:00Z'), 17, 78), 'night');
  assert.equal(navStyleFor('auto', new Date('2026-10-19T16:00:00Z'), 17.385, 78.48), 'night');
  assert.equal(navStyleFor('auto', new Date(), NaN, NaN), 'day');
});

// ---------- deep links ----------
test('deep links: geo: URIs, bharatmap://, https share links, search, directions, invalid input', () => {
  assert.deepEqual(parseDeepLink('geo:17.714,83.323'), { kind: 'place', lat: 17.714, lng: 83.323, name: '', zoom: 16, inIndia: true });
  assert.deepEqual(parseDeepLink('geo:0,0?q=17.714,83.323(RK Beach)'), { kind: 'place', lat: 17.714, lng: 83.323, name: 'RK Beach', zoom: 16, inIndia: true });
  assert.equal(parseDeepLink('geo:17.7,83.3?q=17.714%2C83.323%28RK%20Beach%29&z=12').zoom, 12);
  assert.deepEqual(parseDeepLink('geo:0,0?q=Charminar'), { kind: 'search', query: 'Charminar' });
  assert.equal(parseDeepLink('geo:17.7,83.3;u=35').lat, 17.7);
  const p = parseDeepLink('bharatmap://place?lat=17.4375&lon=78.4483&name=Ameerpet');
  assert.deepEqual([p.kind, p.lat, p.lng, p.name], ['place', 17.4375, 78.4483, 'Ameerpet']);
  const d = parseDeepLink('bharatmap://directions?lat=17.714&lon=83.323&name=RK%20Beach&mode=walk');
  assert.deepEqual([d.kind, d.mode, d.to.name], ['directions', 'walk', 'RK Beach']);
  assert.equal(parseDeepLink('bharatmap://directions?lat=17.7&lon=83.3&mode=rocket').mode, 'drive');
  assert.deepEqual(parseDeepLink('bharatmap://search?q=petrol'), { kind: 'search', query: 'petrol' });
  assert.equal(parseDeepLink('https://maps.example.org/?lat=17.7&lon=83.3&name=X').kind, 'place');
  assert.equal(parseDeepLink('geo:51.5,-0.12').inIndia, false);
  assert.equal(parseDeepLink('bharatmap://place?lat=999&lon=1'), null);
  assert.equal(parseDeepLink('javascript:alert(1)'), null);
  assert.equal(parseDeepLink(''), null); assert.equal(parseDeepLink(null), null);
  assert.equal(parseDeepLink('bharatmap://place?lat=17.7&lon=83.3&name=<b>x</b>').name, 'bx/b');
  assert.deepEqual(parseDeepLink('bharatmap://live?id=AbC123xyz'), { kind: 'live', id: 'AbC123xyz' });
  assert.equal(parseDeepLink('bharatmap://live?id=../../x'), null);
});
test('deep links: share links (geo + app + https) and list links round-trip (Unicode names)', () => {
  const s = buildShareLinks({ lat: 17.7140001, lng: 83.323, name: 'RK Beach' }, { webBase: 'https://bm.example.org/' });
  assert.equal(s.geo, 'geo:17.714,83.323?q=17.714,83.323(RK%20Beach)');
  assert.equal(s.app, 'bharatmap://place?lat=17.714&lon=83.323&name=RK+Beach');
  assert.equal(s.web, 'https://bm.example.org/?lat=17.714&lon=83.323&name=RK+Beach');
  assert.equal(buildShareLinks({ lat: 1, lng: 2 }, { webBase: 'http://insecure' }).web, null);
  for (const u of [s.geo, s.app, s.web]) { const p = parseDeepLink(u); assert.deepEqual([p.lat, p.lng, p.name], [17.714, 83.323, 'RK Beach']); }
  const list = { name: 'విశాఖ బీచ్‌లు', items: [{ name: 'RK Beach', lat: 17.714, lng: 83.323 }, { name: 'Bad', lat: NaN, lng: 1 }] };
  const dec = decodeList(encodeList(list)); assert.equal(dec.name, list.name); assert.equal(dec.items.length, 1);
  const l = buildListLink(list); assert.equal(parseDeepLink(l.app).kind, 'list');
  assert.equal(decodeList('not-base64!!'), null);
});

// ---------- OSM notes + incidents ----------
test('OSM note payload: categories, validation, text, rate limit, response parsing', () => {
  const p = buildNotePayload({ lat: 17.714, lng: 83.323, category: 'closed_road', text: '  Beach road   closed for Navy Day  rehearsal ' });
  assert.equal(p.url, 'https://api.openstreetmap.org/api/0.6/notes');
  const q = new URLSearchParams(p.body);
  assert.equal(q.get('lat'), '17.714000'); assert.equal(q.get('lon'), '83.323000');
  assert.match(q.get('text'), /^\[Closed road\] Beach road closed for Navy Day rehearsal\n\n— reported in Bharat Map 0\.5 \(anonymous\)$/);
  assert.deepEqual(Object.keys(NOTE_CATEGORIES), ['wrong_road', 'missing_place', 'closed_road', 'wrong_name']);
  assert.throws(() => buildNotePayload({ lat: 17, lng: 83, category: 'spam', text: 'hello world' }), /invalid_category/);
  assert.throws(() => buildNotePayload({ lat: 17, lng: 83, category: 'wrong_name', text: 'x' }), /text_too_short/);
  assert.throws(() => buildNotePayload({ lat: 95, lng: 83, category: 'wrong_name', text: 'hello world' }), /invalid_point/);
  assert.equal(parseNoteResponse('{"type":"Feature","properties":{"id":123}}'), 123);
  assert.equal(parseNoteResponse('<osm><note><id>77</id></note></osm>'), 77);
  const now = 10_000_000;
  assert.deepEqual(noteRateLimit([], now), { ok: true, waitMs: 0 });
  assert.equal(noteRateLimit([now - 30_000], now).ok, false);
  assert.equal(noteRateLimit([now - 3000_000, now - 2000_000, now - 1000_000], now).ok, false, '3 per hour');
  assert.equal(noteRateLimit([now - 4000_000, now - 2000_000], now).ok, true);
});
test('incidents: validation, 2-hour expiry, confidence from votes, minutes left', () => {
  assert.equal(validateIncident({ type: 'pothole', lat: 17.7, lng: 83.3 }).value.type, 'pothole');
  assert.equal(validateIncident({ type: 'ufo', lat: 17.7, lng: 83.3 }).error, 'invalid_type');
  assert.equal(validateIncident({ type: 'police', lat: 'x', lng: 83.3 }).error, 'invalid_point');
  assert.equal(validateIncident({ type: 'closure', lat: 17, lng: 83, note: 'a'.repeat(500) }).value.note.length, 140);
  const t0 = 1_000_000; const inc = { created_ms: t0, expires_ms: expiresAt(t0) };
  assert.equal(INCIDENT_TTL_MS, 7_200_000);
  assert.equal(isExpired(inc, t0 + 7_199_999), false); assert.equal(isExpired(inc, t0 + 7_200_000), true);
  assert.equal(isExpired({ created_ms: t0 }, t0 + 7_200_001), true);
  assert.equal(activeIncidents([inc, { created_ms: t0 - 8_000_000 }], t0).length, 1);
  assert.equal(minutesLeft(inc, t0 + 60_000), 119);
  assert.deepEqual([confidence(0, 0), confidence(1, 0), confidence(3, 0), confidence(1, 3)], ['low', 'medium', 'high', 'low']);
});

// ---------- junction view ----------
test('junction view: complex maneuvers only; SVG from real fork geometry, heading-up, arrow head', () => {
  const r = parseOsrm(fx('osrm-drive-silkboard-ecity'), 'drive')[0];
  const fork = r.steps.find((s) => s.type === 'fork');
  assert.ok(isComplexJunction(fork)); assert.equal(isComplexJunction({ type: 'turn', modifier: 'right' }), false);
  assert.ok(isComplexJunction({ type: 'roundabout' })); assert.ok(isComplexJunction({ type: 'turn', modifier: 'sharp left' }));
  const svg = junctionSvg(fork, r.geometry.coordinates);
  assert.match(svg, /^<svg class="junction-svg" viewBox="0 0 120 120"/);
  assert.match(svg, /class="jv-route"/); assert.match(svg, /<polygon points="[\d.,\s-]+" class="jv-head"\/>/);
  assert.equal(fork.junction.bearings.length >= 2, true);
  const g = geometryAround(r.geometry.coordinates, fork.location);
  assert.ok(g.length > 3 && g.some(([x, y]) => Math.hypot(x, y) > 40));
  // first point (approach) is below the centre after heading-up rotation
  const m = svg.match(/<path d="M([\d.]+) ([\d.]+)/); assert.ok(Number(m[2]) > 60, 'approach from the bottom');
  assert.equal(junctionSvg({}, []), '');
  assert.match(junctionSvg({ type: 'roundabout', location: [0, 0], bearing_before: 0, bearing_after: 90 }, null), /jv-ring/);
});

// ---------- sounds ----------
test('navigation sound cues: all six defined, short, muted respected', () => {
  assert.deepEqual(Object.keys(SOUND_CUES).sort(), ['approach', 'arrival', 'gps_back', 'gps_lost', 'overspeed', 'reroute']);
  for (const k of Object.keys(SOUND_CUES)) assert.ok(cueDuration(k) > 0.1 && cueDuration(k) < 0.7, k);
  let muted = true; const s = createSounds({ isMuted: () => muted });
  assert.equal(s.play('arrival'), false); muted = false;
  assert.equal(s.play('arrival'), true); assert.deepEqual(s.log, ['arrival']); // no AudioContext in Node: logged, silent
  assert.equal(s.play('nope'), false);
});

// ---------- offline index ----------
test('offline place index: bundled real OSM names (Vizag), prefix search, distance ranking, landmarks', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../web/offline/pois/vizag.json', import.meta.url)));
  assert.ok(j.rows.length > 3000 && /OpenStreetMap/.test(j.attribution));
  const ix = buildIndex(j.rows);
  const k = searchIndex(ix, 'kailas', { near: { lat: 17.72, lng: 83.3 } });
  assert.ok(k.some((x) => /Kailasagiri/.test(x.name)), JSON.stringify(k.map((x) => x.name)));
  assert.ok(searchIndex(ix, 'king george').some((x) => x.name === 'King George Hospital'));
  assert.equal(searchIndex(ix, 'k').length, 0);
  assert.equal(norm('  Dr. B.R. Ambedkar  '), 'dr b r ambedkar');
  const lm = landmarkNear(ix, [83.3155, 17.7215], { maxM: 300 });
  assert.ok(!lm || (lm.name && lm.distance_m <= 300));
  const regions = JSON.parse(fs.readFileSync(new URL('../web/offline/regions.json', import.meta.url)));
  for (const id of Object.keys(regions.regions)) assert.ok(fs.existsSync(new URL(`../web/offline/pois/${id}.json`, import.meta.url)), `index for ${id}`);
  assert.ok(Object.keys(regions.regions).length >= 11 && regions.regions.vijayawada);
});

// ---------- privacy model ----------
test('privacy model: groups storage, export excludes the sign-in token, delete list', () => {
  const e = { 'bm-saved-v1': '{"home":null}', 'bm-recents-v1': '[]', 'mapos-token': 'secret', 'bm-theme': 'dark', 'other-app': 'x', 'bm-notes-history': '[1]' };
  const g = classifyStorage(e);
  assert.deepEqual(g.map((x) => x.id), ['saved', 'recents', 'reports', 'account', 'settings']);
  assert.ok(g.every((x) => x.bytes > 0));
  const ex = buildExport(e, { now: new Date('2026-10-19T00:00:00Z') });
  assert.deepEqual(ex.data['bm-saved-v1'], { home: null }); assert.equal(ex.data['mapos-token'], undefined); assert.equal(ex.data['other-app'], undefined);
  assert.deepEqual(keysToDelete(e).sort(), ['bm-notes-history', 'bm-recents-v1', 'bm-saved-v1', 'bm-theme', 'mapos-token']);
});

// ---------- multi-stop ----------
test('multi-stop: OSRM URL with via points (no alternatives), Valhalla locations, parsed waypoints, fallback through stops', () => {
  const u = buildRouteUrl('drive', { lat: 17.72, lng: 83.30 }, { lat: 17.71, lng: 83.32 }, { via: [{ lat: 17.75, lng: 83.31 }] });
  assert.match(u, /driving\/83\.3,17\.72;83\.31,17\.75;83\.32,17\.71\?alternatives=false/);
  const v = buildValhallaRequest('two', { lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { via: [{ lat: 5, lng: 6 }] });
  assert.equal(v.locations.length, 3); assert.equal(v.alternates, 0);
  // Synthetic 2-leg OSRM response (OSRM format) → one arrive, one waypoint
  const leg = (a, b) => ({ summary: 'X', steps: [{ maneuver: { type: 'depart', location: a }, distance: 10, intersections: [] }, { maneuver: { type: 'arrive', location: b }, distance: 0, intersections: [] }] });
  const r = parseOsrm({ code: 'Ok', routes: [{ distance: 20, duration: 4, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] }, legs: [leg([0, 0], [1, 1]), leg([1, 1], [2, 2])] }] }, 'drive')[0];
  assert.deepEqual(r.steps.map((s) => s.type), ['depart', 'waypoint', 'arrive']); assert.equal(r.stops, 1);
  assert.equal(maneuverIcon({ type: 'waypoint' }), 'arrive');
  assert.equal(buildInstruction({ type: 'waypoint' }, 'en'), 'You have reached your stop');
  const fb = fallbackRoutes('drive', { lat: 17.7, lng: 83.3 }, { lat: 17.8, lng: 83.4 }, [{ lat: 17.75, lng: 83.2 }]);
  assert.equal(fb[0].geometry.coordinates.length, 3);
  // Valhalla multi-leg: real fixture still parses (single leg) with lanes/speed fields present
  const vr = parseValhalla(fx('valhalla-two-dwarakanagar-rkbeach'), 'two')[0];
  assert.ok(Array.isArray(vr.lanes)); assert.equal(vr.stops, 0);
});

// ---------- i18n ----------
test('i18n v0.5: en/hi/te complete for every v0.5 key; other languages fall back to English', () => {
  for (const l of ['en', 'hi', 'te']) for (const k of V5_KEYS) assert.ok(STRINGS[l][k] != null && STRINGS[l][k] !== '', `${l}.${k}`);
  assert.notEqual(STRINGS.hi.privacy_dash, STRINGS.en.privacy_dash); assert.notEqual(STRINGS.te.inc_pothole, STRINGS.en.inc_pothole);
  assert.equal(STRINGS.ta.privacy_dash, STRINGS.en.privacy_dash);
  assert.equal(LANGS.length, 11);
});
