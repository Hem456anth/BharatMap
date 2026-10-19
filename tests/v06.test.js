// v0.6 unit tests: device tiers, transliteration + offline search v2 (bundled index, real OSM data), FTS5 server path,
// India road hints (real Valhalla/Overpass fixtures + a labelled synthetic restriction fixture), Indic voice picker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectTier, tierPolicy, resolveTier, bandwidthManualFor, readDeviceSignals, labelMinzoomShift } from '../web/lib/device-tier.js';
import { bandwidthPolicy } from '../web/lib/bandwidth.js';
import { toLatin, fromLatin, phoneticKey, phoneticWords, hasIndic, latinFold } from '../shared/translit.js';
import { searchOffline, buildSearchIndex, lookupPincode, lookupDigipin, displayName } from '../shared/search-index.js';
import { encodeDigipin } from '../shared/geo.js';
import { createFtsSearch, ftsQuery } from '../server/lib/search-fts.js';
import { parseConditional, restrictionsFromTags, flagsFromTags, parseWidth, segmentsFromValhallaEdges, segmentsFromOverpass, mergeHintSegments, hintEvents, hintAt, restrictionAt, hintKey, restrictionLabel, buildRoadHintsQuery, scaleHintSegments } from '../shared/roadhints.js';
import { indicVoices, chooseVoice, normaliseVoices, guidanceLang, setStoredVoice, storedVoice, INDIC_LANGS, SAMPLE_PHRASES } from '../web/nav/voices.js';
import { lineLengthM } from '../shared/polyline.js';
import { STRINGS, V6_KEYS } from '../shared/i18n.js';
import { openingStatus } from '../web/lib/opening-hours.js';

const fx = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));
const IX = JSON.parse(fs.readFileSync(new URL('../web/offline/search/index.json', import.meta.url), 'utf8'));
const VIZAG = { lat: 17.7289, lng: 83.305 };
const HYD = { lat: 17.4375, lng: 78.4483 };

// ---------- 2. device tiers ----------
test('device tier: a 2 GB phone is low; 8 GB / 8 cores is high; unknown signals are mid', () => {
  assert.equal(detectTier({ memoryGb: 2, cores: 8, effectiveType: '4g' }).tier, 'low');
  assert.equal(detectTier({ memoryGb: 1, cores: 4 }).tier, 'low');
  assert.equal(detectTier({ memoryGb: 4, cores: 2 }).tier, 'low');
  assert.equal(detectTier({ memoryGb: 3, cores: 4 }).tier, 'low');
  assert.equal(detectTier({ memoryGb: 8, cores: 4, effectiveType: '2g' }).tier, 'low');
  assert.equal(detectTier({ memoryGb: 4, cores: 8, saveData: true }).tier, 'low');
  assert.equal(detectTier({ memoryGb: 8, cores: 8, effectiveType: '4g' }).tier, 'high');
  assert.equal(detectTier({ memoryGb: null, cores: 12 }).tier, 'high');
  assert.equal(detectTier({ memoryGb: 4, cores: 8, effectiveType: '4g' }).tier, 'mid');
  assert.equal(detectTier({ memoryGb: 8, cores: 8, effectiveType: '3g' }).tier, 'mid');
  assert.equal(detectTier({}).tier, 'mid');
  assert.match(detectTier({ memoryGb: 2, cores: 8 }).reasons.join(), /memory 2 GB/);
});
test('device tier: low disables 3D/terrain/prefetch, thins labels and forces low-bandwidth; manual override wins', () => {
  const low = tierPolicy('low');
  assert.equal(low.allow3D, false); assert.equal(low.allowTerrain, false); assert.equal(low.prefetch, false); assert.equal(low.forceLowBandwidth, true);
  assert.ok(low.labelDensity < 1); assert.equal(labelMinzoomShift(low.labelDensity), 1); assert.equal(labelMinzoomShift(1), 0);
  assert.equal(tierPolicy('high').allowTerrain, true);
  const sig = readDeviceSignals({ deviceMemory: 2, hardwareConcurrency: 8, connection: { effectiveType: '4g', saveData: false } });
  assert.deepEqual(sig, { memoryGb: 2, cores: 8, effectiveType: '4g', saveData: false });
  const r = resolveTier(sig, 'auto'); assert.equal(r.tier, 'low'); assert.equal(r.detected, 'low');
  const forced = resolveTier(sig, 'high'); assert.equal(forced.tier, 'high'); assert.equal(forced.detected, 'low'); assert.equal(forced.manual, 'high');
  assert.equal(resolveTier(sig, 'bogus').manual, 'auto');
  // low tier turns low-bandwidth mode on (reason device-tier) unless the user explicitly turned it off
  assert.equal(bandwidthManualFor(r, 'auto'), 'on'); assert.equal(bandwidthManualFor(r, 'off'), 'off'); assert.equal(bandwidthManualFor(forced, 'auto'), 'auto');
  const bw = bandwidthPolicy({ effectiveType: '4g' }, 'tier');
  assert.equal(bw.active, true); assert.equal(bw.reason, 'device-tier'); assert.equal(bw.allow3D, false); assert.equal(bw.prefetchRoute, false);
});

// ---------- 3. transliteration ----------
test('transliteration: Telugu/Devanagari/Tamil/Kannada → Latin, and one phonetic key for every spelling', () => {
  assert.equal(toLatin('సింహాచలం'), 'simhaachalam');
  assert.equal(toLatin('విశాఖపట్నం'), 'vishaakhapatnam');
  assert.equal(toLatin('गाजुवाका'), 'gaajuvaakaa');
  assert.ok(hasIndic('సింహాచలం') && !hasIndic('Simhachalam'));
  const same = (a, b) => assert.equal(phoneticKey(a), phoneticKey(b), `${a} ~ ${b}`);
  same('Simhachalam', 'సింహాచలం'); same('Simhachalam', 'सिंहाचलम'); same('Visakhapatnam', 'విశాఖపట్నం'); same('Visakhapatnam', 'विशाखापट्टनम');
  same('Gajuwaka', 'గాజువాక'); same('Kailasagiri', 'कैलाशगिरि'); same('Kanchipuram', 'காஞ்சிபுரம்'); same('Bengaluru', 'ಬೆಂಗಳೂರು'); same('Charminar', 'చార్మినార్'); same('Vijayawada', 'विजयवाड़ा');
  assert.notEqual(phoneticKey('Gajuwaka'), phoneticKey('Kailasagiri'));
  assert.deepEqual(phoneticWords('ఋషి కొండ'), ['rs', 'knd']);
  assert.equal(latinFold('Śrī  Rāma'), 'sri rama');
  assert.equal(fromLatin('simhachalam', 'te'), 'సింహచలం');
  assert.equal(fromLatin('gajuwaka', 'te'), 'గజువక');
  assert.equal(fromLatin('ram', 'hi'), 'रम्');
});

// ---------- 3. offline search v2 (bundled index = real OSM data) ----------
test('offline search v2: bundled index covers all 11 regions with native names and pincodes', () => {
  assert.equal(IX.v, 2); assert.equal(IX.regions.length, 11);
  assert.ok(IX.places.length > 55000, `${IX.places.length} places`);
  assert.ok(IX.places.filter((p) => p[5] && p[5].te).length > 1000, 'Telugu names');
  assert.ok(IX.places.filter((p) => p[5] && p[5].hi).length > 1000, 'Hindi names');
  assert.ok(IX.pins.length > 100, 'pincodes');
  assert.equal(IX.keys.length, IX.post.length);
  for (let i = 1; i < 500; i++) assert.ok(IX.keys[i - 1] < IX.keys[i], 'sorted keys');
});
const top = (q, near) => searchOffline(IX, q, { near, limit: 5 })[0];
test('offline search v2: Latin query "simhachalam" → the place OSM names సింహాచలం (top hit)', () => {
  const h = top('simhachalam', VIZAG);
  assert.equal(h.names.te, 'సింహాచలం'); assert.match(h.name, /Simhachalam/);
});
test('offline search v2: Telugu query సింహాచలం and Hindi सिंहाचलम → Simhachalam (Indic queries match Latin names)', () => {
  assert.match(top('సింహాచలం', VIZAG).name, /Simhachalam/);
  assert.match(top('सिंहाचलम', VIZAG).name, /Simhachalam/);
});
test('offline search v2: Telugu గాజువాక → Gajuwaka; Latin "gajuwaka" shows గాజువాక', () => {
  assert.equal(top('గాజువాక', VIZAG).name, 'Gajuwaka');
  const g = top('gajuwaka', VIZAG); assert.equal(g.name, 'Gajuwaka'); assert.equal(displayName(g, 'te'), 'గాజువాక'); assert.equal(displayName(g, 'en'), 'Gajuwaka');
});
test('offline search v2: Telugu చార్మినార్ and Latin "charminar" → Charminar, Hyderabad', () => {
  for (const q of ['చార్మినార్', 'charminar', 'चारमीनार']) { const h = top(q, HYD); assert.match(h.name, /^Charminar/, q); assert.equal(h.region, 'hyderabad'); }
});
test('offline search v2: spacing and spelling variants — "rushikonda" ↔ ఋషి కొండ, "vizag steel", "kailasgiri"', () => {
  assert.equal(top('ఋషికొండ', VIZAG).name, 'Rushikonda');
  assert.equal(top('rushikonda', VIZAG).names.te, 'ఋషి కొండ');
  assert.equal(top('vizag steel', VIZAG).name, 'Visakhapatnam Steel Plant');
  assert.match(top('kailasgiri', VIZAG).name, /Kailasagiri/);
  assert.match(top('విశాఖపట్నం', VIZAG).name, /Visakhapatnam/);
});
test('offline search v2: pincode and DIGIPIN lookups work offline', () => {
  const p = top('530016', VIZAG); assert.equal(p.kind, 'postcode'); assert.ok(Math.abs(p.lat - 17.72) < 0.05 && Math.abs(p.lng - 83.3) < 0.06, JSON.stringify(p));
  assert.equal(lookupPincode(IX, '999999'), null); assert.equal(lookupPincode(IX, 'abc'), null);
  const code = encodeDigipin(17.7289, 83.305);
  const d = top(code, VIZAG); assert.equal(d.kind, 'digipin'); assert.ok(Math.abs(d.lat - 17.7289) < 0.0001 && Math.abs(d.lng - 83.305) < 0.0001);
  assert.equal(lookupDigipin('hello'), null);
  assert.deepEqual(searchOffline(IX, 'x'), []);
});
test('offline search v2: buildSearchIndex on a tiny list (prefix, native, phonetic, distance ranking)', () => {
  const ix = buildSearchIndex([
    { name: 'Simhachalam', kind: 'suburb', lat: 17.77, lng: 83.24, region: 'vizag', names: { te: 'సింహాచలం' } },
    { name: 'Simhapuri Hospital', kind: 'hospital', lat: 14.44, lng: 79.98, region: 'x', names: {} },
    { name: 'Gajuwaka', kind: 'suburb', lat: 17.68, lng: 83.21, region: 'vizag', names: {} },
  ], [['530026', 17.69, 83.21, 4, 0]], { regions: ['vizag', 'x'] });
  assert.equal(searchOffline(ix, 'simha', { near: VIZAG })[0].name, 'Simhachalam');
  assert.equal(searchOffline(ix, 'సింహా')[0].name, 'Simhachalam');
  assert.equal(searchOffline(ix, 'गाजुवाका')[0].name, 'Gajuwaka');
  assert.equal(searchOffline(ix, '530026')[0].kind, 'postcode');
});
test('offline search v2: server path uses SQLite FTS5 and agrees with the on-device index', async () => {
  const dbFile = `${process.env.TMPDIR || '/tmp'}/bm-search-test-${process.pid}.db`;
  const s = createFtsSearch({ indexFile: new URL('../web/offline/search/index.json', import.meta.url).pathname, dbFile });
  for (const [q, near] of [['simhachalam', VIZAG], ['గాజువాక', VIZAG], ['charminar', HYD], ['सिंहाचलम', VIZAG]]) {
    const a = (await s.search(q, { near, limit: 3 }))[0]; const b = top(q, near);
    assert.equal(a.name, b.name, q);
  }
  assert.equal(s.mode, 'fts5');
  assert.match(ftsQuery('simha nagar'), /latin:"simha"\* OR .*AND/);
  fs.rmSync(dbFile, { force: true });
});

// ---------- 4. India road hints ----------
test('road hints: parse conditional restrictions, odd-even notes, width', () => {
  assert.deepEqual(parseConditional('no @ (Mo-Sa 08:00-11:00); destination @ (22:00-06:00)'), [{ value: 'no', condition: 'Mo-Sa 08:00-11:00' }, { value: 'destination', condition: '22:00-06:00' }]);
  assert.deepEqual(parseConditional(''), []);
  const r = restrictionsFromTags({ 'hgv:conditional': 'no @ (08:00-22:00)', 'motor_vehicle:conditional': 'yes @ (Su)', note: 'Odd-even scheme on weekdays' });
  assert.equal(r.length, 2); assert.equal(r[0].key, 'hgv:conditional'); assert.equal(r[1].oddEven, true);
  assert.equal(restrictionsFromTags({ 'oneway:conditional': 'yes @ (Mo-Fr 07:00-10:00)' })[0].value, 'yes');
  assert.equal(parseWidth('3.5'), 3.5); assert.equal(parseWidth('3 m'), 3); assert.equal(parseWidth("10'"), 3.05); assert.equal(parseWidth('wide'), null);
  assert.deepEqual(Object.values(flagsFromTags({ highway: 'primary', bridge: 'yes' })).slice(0, 3), [true, false, false]);
  assert.equal(flagsFromTags({ highway: 'service' }).service, true);
  assert.equal(flagsFromTags({ highway: 'service', service: 'parking_aisle' }).service, false);
  assert.equal(flagsFromTags({ highway: 'residential', lanes: '1' }).narrow, true);
  assert.equal(flagsFromTags({ highway: 'residential', lanes: '1', oneway: 'yes' }).narrow, false);
  assert.equal(flagsFromTags({ highway: 'unclassified', width: '3' }).narrow, true);
  assert.equal(flagsFromTags({ highway: 'residential', bridge: 'yes' }).flyover, false);
  assert.equal(restrictionLabel({ oddEven: true }), 'odd_even'); assert.equal(restrictionLabel({ key: 'hgv:conditional', value: 'no' }), 'no_entry');
});
test('road hints: real Valhalla trace (Dwaraka Nagar → Anakapalli, NH16) finds the Port Main Road Flyover', () => {
  const route = fx('osrm-drive-dwarakanagar-anakapalli').routes[0];
  const total = lineLengthM(route.geometry.coordinates);
  const segs = scaleHintSegments(segmentsFromValhallaEdges(fx('valhalla-roadhints-dwarakanagar-anakapalli')), total);
  const ev = hintEvents(segs);
  const fly = ev.filter((e) => e.type === 'flyover');
  assert.ok(fly.length >= 3, `${fly.length} flyovers`);
  assert.ok(fly[0].atM > 2000 && fly[0].atM < 3000 && fly[0].toM - fly[0].atM > 2000, JSON.stringify(fly[0])); // Port Main Road Flyover ≈ 2.6 km
  assert.ok(ev.every((e) => e.type !== 'narrow'), 'Valhalla lane_count never makes a narrow hint');
  const h = hintAt(ev, fly[0].atM - 300); assert.equal(h.type, 'flyover'); assert.equal(h.inM, 300); assert.equal(hintKey(h), 'hint_flyover');
  assert.equal(hintAt(ev, fly[0].atM + 100), null, 'no "take the flyover" while on it');
  assert.equal(hintAt(ev, 0, { aheadM: 400 }), null);
});
test('road hints: Overpass next to Valhalla adds tag facts only (no parallel-road false positives)', () => {
  const route = fx('osrm-drive-dwarakanagar-anakapalli').routes[0]; const c = route.geometry.coordinates;
  const ov = fx('overpass-roadhints-dwarakanagar-anakapalli');
  const tagOnly = segmentsFromOverpass(ov, c);
  assert.ok(tagOnly.every((s) => !s.flyover && !s.service));
  const full = segmentsFromOverpass(ov, c, { structure: true });
  assert.ok(full.some((s) => s.flyover));
  const merged = mergeHintSegments(scaleHintSegments(segmentsFromValhallaEdges(fx('valhalla-roadhints-dwarakanagar-anakapalli')), lineLengthM(c)), tagOnly);
  assert.ok(hintEvents(merged).some((e) => e.type === 'flyover'));
  assert.match(buildRoadHintsQuery(c), /bridge.*service.*lanes"="1.*conditional/);
  assert.match(buildRoadHintsQuery(c, { full: true }), /highway"~/);
});
test('road hints: synthetic restriction fixture → time-restriction badge and narrow/service hints with IST evaluation', () => {
  const route = fx('osrm-drive-dwarakanagar-rkbeach').routes[0]; const c = route.geometry.coordinates;
  const segs = segmentsFromOverpass(fx('overpass-roadhints-synthetic-rkbeach'), c, { structure: true });
  const ev = hintEvents(segs);
  const types = new Set(ev.map((e) => e.type));
  assert.ok(types.has('restriction') && types.has('narrow') && types.has('service'), [...types].join());
  const r = ev.find((e) => e.type === 'restriction');
  assert.equal(restrictionAt(ev, r.atM - 100).restriction.condition, 'Mo-Sa 08:00-11:00');
  assert.equal(openingStatus(r.restriction.condition, { day: 0, minutes: 9 * 60 }).status, 'open'); // Monday 09:00 → in force
  assert.equal(openingStatus(r.restriction.condition, { day: 6, minutes: 9 * 60 }).status, 'closed'); // Sunday → not in force
  assert.ok(ev.some((e) => e.type === 'restriction' && e.restriction.oddEven), 'odd-even note');
});
test('road hints: i18n keys in en/hi/te', () => {
  for (const k of ['hint_flyover', 'hint_service', 'hint_narrow', 'restr_title', 'restr_odd_even', 'restr_active', 'guidance_voice', 'device_tier']) {
    for (const l of ['en', 'hi', 'te']) assert.ok(STRINGS[l][k] && (l === 'en' || STRINGS[l][k] !== STRINGS.en[k]), `${l}.${k}`);
  }
  assert.ok(V6_KEYS.length > 30);
});

// ---------- 5. Indic voice picker ----------
const VOICES = [
  { voiceURI: 'en-US-x', name: 'English US', lang: 'en-US' }, { voiceURI: 'en-IN-1', name: 'English India', lang: 'en-IN' },
  { voiceURI: 'te-IN-1', name: 'Telugu (India)', lang: 'te-IN', localService: true }, { voiceURI: 'hi-IN-1', name: 'Hindi', lang: 'hi-IN' },
  { voiceURI: 'ta-IN-1', name: 'Tamil', lang: 'ta_IN' }, { voiceURI: 'fr-1', name: 'French', lang: 'fr-FR' }, { voiceURI: 'kn-1', name: 'Kannada', lang: 'kn-IN' },
];
test('voice picker: filters to Indic languages (+ English India fallback) in te, hi, ta, kn … order', () => {
  const g = indicVoices(VOICES);
  assert.deepEqual(g.map((x) => x.code), ['te', 'hi', 'ta', 'kn', 'en']);
  assert.deepEqual(g.at(-1).voices.map((v) => v.id), ['en-IN-1']);
  assert.ok(!g.some((x) => x.voices.some((v) => v.lang === 'fr-FR')));
  assert.equal(normaliseVoices(VOICES)[4].code, 'ta');
  assert.deepEqual(indicVoices([]), []);
  assert.equal(INDIC_LANGS.length, 10);
  for (const l of [...INDIC_LANGS, 'en']) assert.ok(SAMPLE_PHRASES[l], l);
});
test('voice picker: persisted choice sets the guidance language and is used; missing voice falls back', () => {
  const mem = new Map(); const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  assert.equal(storedVoice(st), null); assert.equal(guidanceLang('en', storedVoice(st)), 'en');
  setStoredVoice(normaliseVoices(VOICES)[2], st);
  assert.deepEqual(storedVoice(st), { id: 'te-IN-1', lang: 'te', name: 'Telugu (India)' });
  assert.equal(guidanceLang('en', storedVoice(st)), 'te');
  assert.equal(chooseVoice(VOICES, 'te', storedVoice(st)).id, 'te-IN-1');
  assert.equal(chooseVoice(VOICES, 'hi', storedVoice(st)).id, 'hi-IN-1');
  assert.equal(chooseVoice(VOICES, 'ml', null), null);
  assert.equal(chooseVoice(VOICES, 'en', null).id, 'en-IN-1');
  setStoredVoice(null, st); assert.equal(storedVoice(st), null);
});
