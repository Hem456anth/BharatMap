// v0.8 (CoMaps-inspired items, docs/re/COMAPS_TEARDOWN.md): GPX/KML import-export, track recording model,
// list editor model, "Suggest an edit" OSM note, strings, service-worker precache and markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toGPX, toKML, parseGeoFile, parseXml, detectFormat, escXml, listToDoc, docToListItems, safeFileName, GEO_LIMITS } from '../shared/geoformats.js';
import { createTrack, addFix, pauseTrack, resumeTrack, stopTrack, trackStats, trackToGeoJSON, trackToDoc, trackFromImport, normalizeTracks, distM } from '../web/lib/track-model.js';
import { normalizeSaved, addToList, createList, renameList, moveItem, updateItem, deleteList, cleanPlace, mergeSaved } from '../web/lib/saved-model.js';
import { EDIT_FIELDS, validateField, normalizePhone, diffEdit, buildEditNotePayload, osmRef, canSuggestEdit } from '../shared/osm-edit.js';
import { OSM_NOTES_URL } from '../shared/community.js';
import { V8, V8_KEYS } from '../shared/i18n-v08.js';
import { t } from '../shared/i18n.js';

const fx = (f) => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const T0 = Date.parse('2026-10-18T00:30:00Z');

// ---------------------------------------------------------------- GPX / KML
test('GPX import: waypoints (entity, Telugu), route points, 2-segment track with ele/time; invalid latitude dropped', () => {
  const d = parseGeoFile(fx('vizag-beach-walk-SYNTHETIC.gpx'), 'walk.gpx');
  assert.equal(d.format, 'gpx'); assert.equal(d.name, 'Vizag beach walk');
  assert.deepEqual(d.waypoints.map((w) => w.name), ['Kali Temple & beach entrance', 'విశాఖ మ్యూజియం', 'INS Kursura Submarine Museum']);
  assert.equal(d.waypoints[0].desc, 'Meet here at 6 AM');
  assert.equal(d.waypoints[0].lat, 17.7145); assert.equal(d.waypoints[0].lng, 83.3234);
  assert.equal(d.tracks.length, 1); assert.equal(d.tracks[0].name, 'Morning walk');
  assert.deepEqual(d.tracks[0].segments.map((s) => s.length), [3, 2]);
  assert.equal(d.tracks[0].segments[0][1].ele, 5.5); assert.equal(d.tracks[0].segments[0][0].time, T0);
  assert.ok(d.warnings.includes('invalid_points:1'));
});

test('KML import: Folder points, CDATA HTML stripped, LineString, gx:Track with times', () => {
  const d = parseGeoFile(fx('hyderabad-places-SYNTHETIC.kml'), 'hyd.kml');
  assert.equal(d.format, 'kml'); assert.equal(d.name, 'Hyderabad weekend');
  assert.deepEqual(d.waypoints.map((w) => w.name), ['Charminar', 'Golconda Fort']);
  assert.equal(d.waypoints[0].desc, 'Iconic monument &amp; market'); // CDATA is literal; tags stripped
  assert.equal(d.waypoints[1].lat, 17.3833);
  assert.deepEqual(d.tracks.map((x) => [x.name, x.segments[0].length]), [['Necklace Road drive', 3], ['Metro ride', 2]]);
  assert.equal(d.tracks[1].segments[0][0].ele, 510); assert.equal(d.tracks[1].segments[0][1].time, Date.parse('2026-10-19T04:05:00Z'));
});

test('GPX/KML export round-trips through the importer (names escaped, notes kept, segments kept)', () => {
  const doc = { name: 'A & B <list>', waypoints: [{ name: 'Tea "stall" & co', lat: 17.72, lng: 83.31, note: 'ask for <ginger> tea' }, { name: 'బీచ్', lat: 17.71, lng: 83.32 }],
    tracks: [{ name: 'Ride', segments: [[{ lat: 17.7, lng: 83.3, ele: 3, time: T0 }, { lat: 17.701, lng: 83.301, ele: 4, time: T0 + 60000 }], [{ lat: 17.71, lng: 83.31, time: T0 + 600000 }, { lat: 17.711, lng: 83.311, time: T0 + 660000 }]] }] };
  const gpx = toGPX(doc);
  assert.match(gpx, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<gpx version="1\.1"/);
  assert.match(gpx, /<name>Tea &quot;stall&quot; &amp; co<\/name>/);
  assert.ok(!/<ginger>/.test(gpx));
  const g = parseGeoFile(gpx, 'x.gpx');
  assert.equal(g.name, 'A & B <list>');
  assert.deepEqual(g.waypoints.map((w) => [w.name, w.lat, w.lng]), [['Tea "stall" & co', 17.72, 83.31], ['బీచ్', 17.71, 83.32]]);
  assert.equal(g.waypoints[0].desc, 'ask for <ginger> tea');
  assert.deepEqual(g.tracks[0].segments.map((s) => s.length), [2, 2]);
  assert.equal(g.tracks[0].segments[0][1].time, T0 + 60000);
  const kml = toKML(doc);
  assert.match(kml, /<kml xmlns="http:\/\/www\.opengis\.net\/kml\/2\.2">/);
  const k = parseGeoFile(kml, 'x.kml');
  assert.deepEqual(k.waypoints.map((w) => w.name), ['Tea "stall" & co', 'బీచ్']);
  assert.equal(k.tracks.length, 2, 'one LineString per segment');
  assert.equal(k.tracks[0].segments[0][0].ele, 3, 'segment with elevation → 3-D');
  assert.equal(k.tracks[1].segments[0][0].ele, undefined, 'segment without elevation → 2-D');
});

test('importer safety: DTD/ENTITY rejected (no XXE / billion laughs), malformed XML, KMZ, unknown format, empty, size limit', () => {
  const xxe = '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx><wpt lat="1" lon="1"><name>&x;</name></wpt></gpx>';
  assert.throws(() => parseGeoFile(xxe, 'a.gpx'), /dtd_not_allowed/);
  assert.throws(() => parseGeoFile('<gpx><wpt lat="17" lon="83"><name>x</wpt></gpx>', 'a.gpx'), /bad_xml/);
  assert.throws(() => parseGeoFile('<gpx><wpt lat="17" lon="83"><name>x</name></wpt>', 'a.gpx'), /bad_xml/);
  assert.throws(() => parseGeoFile('PK\u0003\u0004…', 'trip.kmz'), /kmz_not_supported/);
  assert.throws(() => parseGeoFile('{"type":"FeatureCollection"}', 'a.json'), /unsupported_format/);
  assert.throws(() => parseGeoFile('<gpx version="1.1"></gpx>', 'a.gpx'), /empty/);
  assert.throws(() => parseGeoFile(`<gpx>${' '.repeat(100)}</gpx>`, 'a.gpx', { ...GEO_LIMITS, maxBytes: 50 }), /too_large/);
  // unknown named entities are never expanded; numeric references are decoded
  const r = parseXml('<a>&foo; &#x0C35;&#3093;</a>');
  assert.equal(r.children[0].text, '&foo; వక');
  assert.equal(detectFormat('<?xml version="1.0"?><kml>', ''), 'kml');
  assert.equal(escXml('a\u0001b&'), 'ab&amp;');
});

test('importer limits: waypoint and track-point caps truncate with a warning', () => {
  const pts = Array.from({ length: 30 }, (_, i) => `<trkpt lat="17.${String(i).padStart(2, '0')}" lon="83.3"/>`).join('');
  const w = Array.from({ length: 12 }, (_, i) => `<wpt lat="17.${i + 10}" lon="83.3"/>`).join('');
  const d = parseGeoFile(`<gpx>${w}<trk><trkseg>${pts}</trkseg></trk></gpx>`, 'a.gpx', { ...GEO_LIMITS, maxWaypoints: 5, maxTrackPoints: 10 });
  assert.equal(d.waypoints.length, 5); assert.equal(d.tracks[0].segments[0].length, 10);
  assert.ok(d.warnings.includes('waypoints_truncated') && d.warnings.includes('trackpoints_truncated'));
});

test('saved list ↔ GPX: list export carries address + note; import gives stable pin ids and notes', () => {
  const list = { name: 'Food', items: [{ id: 'osm:node/1', name: 'Dosa', lat: 17.72, lng: 83.31, address: 'Siripuram', note: 'try the ghee roast' }] };
  const doc = listToDoc(list);
  assert.equal(doc.waypoints[0].desc, 'Siripuram'); assert.equal(doc.waypoints[0].note, 'try the ghee roast');
  const back = docToListItems(parseGeoFile(toGPX(doc), 'f.gpx'));
  assert.deepEqual(back, [{ id: 'pin:17.72000,83.31000', name: 'Dosa', lat: 17.72, lng: 83.31, note: 'Siripuram\ntry the ghee roast' }]);
  assert.equal(safeFileName('Vizag / Food & చాయ్', 'gpx'), 'Vizag-Food-చాయ్.gpx');
  assert.equal(safeFileName('../../etc', 'kml'), 'etc.kml');
});

// ---------------------------------------------------------------- track recording
const fix = (lat, lng, s, extra = {}) => ({ lat, lng, accuracy: 8, ts: T0 + s * 1000, ...extra });
test('track model: accuracy, min-distance, jump filters; pause starts a new segment; stats; stop', () => {
  let tr = createTrack({ now: T0 });
  let r = addFix(tr, fix(17.7145, 83.3234, 0, { altitude: 4 })); assert.ok(r.added); tr = r.track;
  r = addFix(tr, fix(17.71451, 83.32341, 5)); assert.equal(r.reason, 'too_close');
  r = addFix(tr, fix(17.7150, 83.3240, 10, { accuracy: 120 })); assert.equal(r.reason, 'inaccurate');
  r = addFix(tr, fix(17.80, 83.40, 12)); assert.equal(r.reason, 'jump', '~12 km in 12 s');
  r = addFix(tr, fix(17.7152, 83.3248, 60, { altitude: 9 })); assert.ok(r.added); tr = r.track;
  r = addFix(tr, { lat: NaN, lng: 1 }); assert.equal(r.reason, 'invalid');
  tr = pauseTrack(tr); assert.equal(addFix(tr, fix(17.716, 83.326, 70)).reason, 'paused');
  tr = resumeTrack(tr); assert.equal(tr.segments.length, 2);
  tr = addFix(tr, fix(17.7172, 83.3289, 600)).track;
  tr = addFix(tr, fix(17.7180, 83.3307, 780)).track;
  const s = trackStats(tr, T0 + 800_000);
  const seg1 = distM({ lat: 17.7145, lng: 83.3234 }, { lat: 17.7152, lng: 83.3248 });
  const seg2 = distM({ lat: 17.7172, lng: 83.3289 }, { lat: 17.7180, lng: 83.3307 });
  assert.equal(s.distance_m, Math.round(seg1 + seg2), 'the paused gap is not counted');
  assert.equal(s.points, 4); assert.equal(s.ascent_m, 5); assert.ok(s.avg_speed_mps > 0);
  const done = stopTrack(tr, T0 + 800_000);
  assert.equal(done.ended_ms, T0 + 800_000); assert.equal(addFix(done, fix(17.72, 83.33, 900)).reason, 'ended');
  const gj = trackToGeoJSON(done);
  assert.equal(gj.features[0].geometry.type, 'MultiLineString'); assert.equal(gj.features[0].geometry.coordinates.length, 2);
  // export → import keeps the shape
  const back = parseGeoFile(toGPX(trackToDoc({ ...done, name: 'Walk' })), 't.gpx');
  assert.deepEqual(back.tracks[0].segments.map((x) => x.length), [2, 2]);
  const imp = trackFromImport(back.tracks[0], { now: T0 });
  assert.equal(imp.started_ms, T0); assert.equal(imp.ended_ms, T0 + 780_000);
});

test('track model: long stop still leaves a point after maxGapMs; point cap; normalizeTracks keeps the newest', () => {
  let tr = createTrack({ now: T0 });
  tr = addFix(tr, fix(17.7, 83.3, 0)).track;
  assert.ok(addFix(tr, fix(17.70001, 83.3, 61)).added, 'stationary for > 60 s');
  let small = createTrack({ now: T0 }); small = addFix(small, fix(17.7, 83.3, 0), { maxPoints: 1 }).track;
  assert.equal(addFix(small, fix(17.71, 83.3, 100), { maxPoints: 1 }).reason, 'full');
  const many = Array.from({ length: 35 }, (_, i) => ({ id: `t${i}`, name: '', started_ms: i, segments: [[{ lat: 1, lng: 1 }]] }));
  const n = normalizeTracks([...many, null, { id: 'x' }]);
  assert.equal(n.length, 30); assert.equal(n[0].id, 't34');
});

// ---------------------------------------------------------------- list editor
test('list editor model: rename, reorder, edit name + note, delete; Favourites cannot be renamed or deleted', () => {
  let s = normalizeSaved(null);
  s = createList(s, 'Trip'); const id = s.lists[1].id;
  for (const [i, n] of ['A', 'B', 'C'].entries()) s = addToList(s, id, { id: `p${i}`, name: n, lat: 17 + i / 100, lng: 83 });
  assert.deepEqual(s.lists[1].items.map((x) => x.name), ['C', 'B', 'A']);
  s = moveItem(s, id, 0, 2); assert.deepEqual(s.lists[1].items.map((x) => x.name), ['B', 'A', 'C']);
  s = moveItem(s, id, 2, -5); assert.deepEqual(s.lists[1].items.map((x) => x.name), ['C', 'B', 'A']);
  assert.equal(moveItem(s, id, 7, 0), s, 'bad index ignored');
  s = renameList(s, id, '  Goa   2026 '); assert.equal(s.lists[1].name, 'Goa 2026');
  assert.equal(renameList(s, id, '   '), s); assert.equal(renameList(s, 'favorites', 'X'), s);
  s = updateItem(s, id, 'p1', { name: ' Beach  shack ', note: 'Sunset at 6' });
  const b = s.lists[1].items.find((x) => x.id === 'p1');
  assert.equal(b.name, 'Beach shack'); assert.equal(b.note, 'Sunset at 6'); assert.equal(b.lat, 17.01, 'coordinates unchanged');
  s = updateItem(s, id, 'p1', { note: '' }); assert.equal('note' in s.lists[1].items.find((x) => x.id === 'p1'), false);
  assert.equal(cleanPlace({ id: 'z', lat: 1, lng: 2, note: 'x'.repeat(900) }).note.length, 500);
  assert.equal(normalizeSaved(JSON.parse(JSON.stringify(updateItem(s, id, 'p0', { note: 'kept' })))).lists[1].items.find((x) => x.id === 'p0').note, 'kept', 'notes survive storage');
  assert.ok(mergeSaved(s, normalizeSaved(null)).lists.some((l) => l.name === 'Goa 2026'));
  assert.equal(deleteList(s, 'favorites'), s); assert.equal(deleteList(s, id).lists.length, 1);
});

// ---------------------------------------------------------------- suggest an edit
test('osm-edit: field validation and normalisation (Indian phone numbers, URLs, hours, enums)', () => {
  assert.equal(normalizePhone('98765 43210'), '+91 98765 43210');
  assert.equal(normalizePhone('09876543210'), '+919876543210', 'trunk 0: ambiguous, kept ungrouped');
  assert.equal(normalizePhone('+91-98765-43210'), '+91 98765 43210');
  assert.equal(normalizePhone('0891 2345678'), '+918912345678');
  assert.equal(normalizePhone('12ab'), null);
  assert.deepEqual(validateField('phone', '9876543210; 0891-2345678'), { value: '+91 98765 43210; +918912345678' });
  assert.deepEqual(validateField('website', 'example.in/shop/'), { value: 'https://example.in/shop' });
  assert.deepEqual(validateField('website', 'javascript:alert(1)'), { error: 'invalid_url' });
  assert.deepEqual(validateField('website', 'https://user:pw@example.in'), { error: 'invalid_url' });
  assert.deepEqual(validateField('opening_hours', 'Mo-Sa 09:00-21:00; Su off'), { value: 'Mo-Sa 09:00-21:00; Su off' });
  assert.deepEqual(validateField('opening_hours', '<script>'), { error: 'invalid_hours' });
  assert.deepEqual(validateField('wheelchair', 'maybe'), { error: 'invalid_value' });
  assert.deepEqual(validateField('name', 'x'.repeat(121)), { error: 'too_long' });
  assert.deepEqual(validateField('shop', 'x'), { error: 'unknown_field' });
  assert.deepEqual(validateField('name', '  '), { value: '' });
  assert.ok(EDIT_FIELDS.some((f) => f.key === 'name:te'));
});

test('osm-edit: diff only reports real changes; note text links the element and lists old → new', () => {
  const tags = { name: 'Sri Sai Tiffins', phone: '+91 98765 43210', website: 'https://saitiffins.in', opening_hours: 'Mo-Su 06:00-11:00' };
  const { changes, errors } = diffEdit(tags, { name: 'Sri Sai Tiffins', phone: '9876543210', website: 'saitiffins.in', opening_hours: 'Mo-Su 06:00-12:00', 'name:te': 'శ్రీ సాయి టిఫిన్స్', wheelchair: '' });
  assert.deepEqual(errors, {});
  assert.deepEqual(changes, [{ key: 'name:te', from: '', to: 'శ్రీ సాయి టిఫిన్స్' }, { key: 'opening_hours', from: 'Mo-Su 06:00-11:00', to: 'Mo-Su 06:00-12:00' }]);
  assert.deepEqual(diffEdit(tags, { website: 'nope' }).errors, { website: 'invalid_url' });
  const removed = diffEdit(tags, { phone: '' }).changes; assert.deepEqual(removed, [{ key: 'phone', from: '+91 98765 43210', to: '' }]);
  const place = { osm_type: 'node', osm_id: 123456, name: 'Sri Sai Tiffins', lat: 17.7231, lng: 83.3012 };
  const p = buildEditNotePayload({ place, changes: [...changes, ...removed], comment: 'Opens later on Sundays' });
  assert.equal(p.url, OSM_NOTES_URL);
  assert.match(p.text, /^\[Place details update\] Sri Sai Tiffins\nhttps:\/\/www\.openstreetmap\.org\/node\/123456\n/);
  assert.match(p.text, /- opening_hours: "Mo-Su 06:00-11:00" → "Mo-Su 06:00-12:00"/);
  assert.match(p.text, /- name:te: \(none\) → "శ్రీ సాయి టిఫిన్స్"/);
  assert.match(p.text, /- phone: "\+91 98765 43210" → \(remove\)/);
  assert.match(p.text, /Comment: Opens later on Sundays/);
  assert.match(p.text, /anonymous/);
  const body = new URLSearchParams(p.body); assert.equal(body.get('lat'), '17.723100'); assert.equal(body.get('lon'), '83.301200');
  assert.throws(() => buildEditNotePayload({ place, changes: [], comment: 'ok' }), /no_changes/);
  assert.throws(() => buildEditNotePayload({ place: { ...place, osm_type: 'area' }, changes }), /invalid_place/);
  assert.throws(() => buildEditNotePayload({ place: { ...place, osm_id: -4 }, changes }), /invalid_place/);
  assert.throws(() => buildEditNotePayload({ place: { ...place, lat: 99 }, changes }), /invalid_point/);
});

test('osm-edit: OSM element from Overpass fields or Photon/Nominatim ids; pins and demo sellers excluded', () => {
  assert.deepEqual(osmRef({ osm_type: 'way', osm_id: 42 }), { osm_type: 'way', osm_id: 42 });
  assert.deepEqual(osmRef({ id: 'osm:relation/7' }), { osm_type: 'relation', osm_id: 7 });
  assert.equal(canSuggestEdit({ id: 'pin:17.7,83.3' }), false);
  assert.equal(canSuggestEdit({ id: 'seller:s1', kind: 'seller' }), false);
  assert.equal(canSuggestEdit({ id: 'nominatim:99' }), false);
});

test('community service: edit suggestion posts one anonymous note and shares the notes rate limit', async () => {
  globalThis.localStorage ??= (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  const { sendOsmEditSuggestion, sendOsmNote } = await import('../web/services/community.js');
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, text: async () => JSON.stringify({ properties: { id: 777 } }) }; };
  const now = Date.parse('2026-10-20T08:00:00Z');
  const r = await sendOsmEditSuggestion({ place: { osm_type: 'node', osm_id: 5, name: 'X', lat: 17.7, lng: 83.3 }, changes: [{ key: 'name', from: 'X', to: 'Y' }] }, { fetchImpl, now });
  assert.equal(r.id, 777); assert.equal(r.url, 'https://www.openstreetmap.org/note/777');
  assert.equal(calls[0].url, `${OSM_NOTES_URL}.json`); assert.equal(calls[0].init.method, 'POST');
  assert.ok(!('Authorization' in calls[0].init.headers), 'anonymous');
  await assert.rejects(() => sendOsmNote({ lat: 17.7, lng: 83.3, category: 'wrong_name', text: 'wrong name here' }, { fetchImpl, now: now + 1000 }), /rate_limited/);
});

// ---------------------------------------------------------------- strings, precache, markup
test('v0.8 strings: en/hi/te complete, other languages fall back to English, import error codes all have copy', () => {
  for (const l of ['hi', 'te']) for (const k of V8_KEYS) assert.ok(V8[l][k], `${l}.${k}`);
  assert.equal(t('ta', 'track_start'), 'Start recording');
  for (const code of ['kmz_not_supported', 'unsupported_format', 'empty', 'too_large', 'bad_xml', 'dtd_not_allowed']) assert.ok(V8.en[`import_err_${code}`], code);
  for (const f of EDIT_FIELDS) assert.ok(V8.en[`edit_field_${f.key}`], f.key);
  for (const e of ['invalid_url', 'invalid_phone', 'invalid_hours', 'too_long', 'invalid_value']) assert.ok(V8.en[`edit_err_${e}`], e);
});

test('v0.8 modules are precached by the service worker and the markup carries the new controls', () => {
  const sw = fs.readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  for (const m of ['/shared/geoformats.js', '/shared/osm-edit.js', '/shared/i18n-v08.js', '/lib/track-model.js', '/lib/file-io.js', '/ui/tracks.js', '/ui/osm-edit.js']) assert.ok(sw.includes(`"${m}"`), m);
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  for (const id of ['importGeo', 'openTracks', 'listEdit', 'listGpx', 'listKml', 'listEditBar', 'trackStart', 'trackList', 'itemDlg', 'editDlg', 'editSend']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('data-view="tracks"'));
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.dependencies['@capacitor/filesystem'], 'Filesystem plugin for the native share-sheet export');
});
