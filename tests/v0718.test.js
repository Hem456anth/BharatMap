// v0.7.18 UI/UX pass (A1–A7, A15): design tokens, category hues, autocomplete formatting, place-card block rules and
// hours "soon" states, route descriptors/totals, empty states that always offer an action, map-failure decision,
// strings, service-worker precache and markup. Pure helpers live in web/lib/ux.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TYPE_SCALE, PANEL, CAT_TOKENS, CAT_HUE, hueOf, hueForKind, CHIP_ORDER, CAT_GROUPS, contrast, highlightMatch, scriptOf, scriptBadge,
  distanceM, shortDistance, suggestionType, hoursState, paymentMethods, goodToKnow, localScriptName, placeBlocks, BLOCK_ORDER,
  routeTotals, routeDescriptor, emptyState, emptyStateHtml, mapHealth,
} from '../web/lib/ux.js';
import { POI_CATEGORIES } from '../web/services/overpass.js';
import { V718, V718_KEYS } from '../shared/i18n-v0718.js';
import { t, tf } from '../shared/i18n.js';

const css = fs.readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const at = (h, m, day = 2) => ({ day, minutes: h * 60 + m }); // day 2 = Wednesday (IST)

test('A1 tokens: type scale 24/22/20/17/15/11, spacing rhythm, 420 px docked panel from 1280 px, warm light panel, dark cards darker than the panel', () => {
  assert.deepEqual(Object.values(TYPE_SCALE), [24, 22, 20, 17, 15, 11]);
  for (const [k, v] of [['title', 24], ['h1', 22], ['h2', 20], ['body', 17], ['sec', 15], ['label', 11]]) assert.match(css, new RegExp(`--fs-${k}: ${v}px`));
  for (const v of [4, 8, 12, 16, 20, 24, 32]) assert.match(css, new RegExp(`--sp-\\d: ${v}px`));
  assert.equal(PANEL.docked, 420); assert.equal(PANEL.dockedFrom, 1280);
  assert.match(css, /@media \(min-width: 1280px\) \{\s*:root \{ --panel-w: 420px; \}/);
  assert.match(css, /--panel: #FAF8F4; --card: #FFFFFF/);
  const dark = /\[data-theme=dark\] \{\s*--panel: (#[0-9A-F]{6}); --card: (#[0-9A-F]{6})/i.exec(css);
  assert.ok(dark, 'dark panel/card tokens');
  const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  assert.ok(lum(dark[2]) < lum(dark[1]), 'dark cards are darker than the panel');
  // accent (neel) is only for selection / primary / links / focus: decorative icon tiles are neutral now
  assert.match(css, /\.tile-ic, \.sc-ic, \.row-ic \{ color: var\(--ink2\); \}/);
  assert.match(css, /--accent: var\(--neel\); --primary: var\(--harit\);/);
  // Indic labels are never uppercased
  assert.match(css, /:lang\(te\) \.lbl[^{]*\{ text-transform: none;/);
});

test('A7 category hues: every POI category has a token; white glyphs clear 3:1; the chip grid is India-first with groups', () => {
  for (const c of POI_CATEGORIES) { assert.ok(CAT_HUE[c.id], `hue for ${c.id}`); assert.ok(CAT_TOKENS[hueOf(c.id)], c.id); }
  for (const [k, v] of Object.entries(CAT_TOKENS)) {
    assert.ok(contrast(v, '#FFFFFF') >= 3, `${k} ${v} vs white = ${contrast(v, '#FFFFFF').toFixed(2)}`);
    assert.match(css, new RegExp(`--cat-${k}: ${v};`, 'i'), `css token --cat-${k}`);
  }
  assert.deepEqual([...CHIP_ORDER].sort(), POI_CATEGORIES.map((c) => c.id).sort(), 'grid order covers every category once');
  assert.deepEqual(CHIP_ORDER.slice(0, 5), ['fuel', 'ev', 'atm', 'hospital', 'pharmacy']);
  assert.deepEqual(CAT_GROUPS.flatMap(([, ids]) => ids).sort(), POI_CATEGORIES.map((c) => c.id).sort(), 'All-categories page lists every category once');
  assert.equal(hueForKind('place_of_worship'), 'worship'); assert.equal(hueForKind('hospital'), 'health'); assert.equal(hueForKind('townhall'), 'gov');
  assert.equal(hueForKind('subway_entrance'), 'transit'); assert.equal(hueForKind('something'), 'place');
  assert.match(html, /<div class="cat-grid" id="cats" role="list"/); assert.match(html, /data-view="allcats"/);
});

test('A6 autocomplete: bold only the matched part (escaped), script badge for cross-script hits, km/m distance, DIGIPIN/pincode row types', () => {
  assert.equal(highlightMatch('RK Beach Road', 'beach'), 'RK <b>Beach</b> Road');
  assert.equal(highlightMatch('Kailasagiri', 'KAILASA'), '<b>Kailasa</b>giri');
  assert.equal(highlightMatch('Sri Venkateswara Temple', 'xyz temple'), 'Sri Venkateswara <b>Temple</b>', 'falls back to the longest query word');
  assert.equal(highlightMatch('<img>', 'img'), '&lt;<b>img</b>&gt;', 'escaped');
  assert.equal(highlightMatch('సింహాచలం', 'simhachalam'), 'సింహాచలం', 'no bold when nothing matched (transliteration)');
  assert.equal(highlightMatch('Café Coffee Day', 'cafe'), '<b>Café</b> Coffee Day', 'diacritic-insensitive');
  assert.equal(scriptOf('సింహాచలం'), 'Telu'); assert.equal(scriptOf('दिल्ली'), 'Deva'); assert.equal(scriptOf('Gajuwaka'), 'Latn'); assert.equal(scriptOf('530016'), null);
  const b = scriptBadge('Simhachalam', 'సింహాచలం', 'simhachalam');
  assert.equal(b.text, 'సింహాచలం'); assert.equal(b.lang, 'te'); assert.equal(b.name, 'తెలుగు'); assert.equal(b.viaTranslit, true);
  assert.equal(scriptBadge('Gajuwaka', 'గాజువాక', 'గాజువాక').viaTranslit, false, 'typed in the badge script');
  assert.equal(scriptBadge('Gajuwaka', 'Gajuwaka'), null); assert.equal(scriptBadge('Beach', 'Beach Rd'), null, 'same script');
  const d = distanceM({ lat: 17.7289, lng: 83.305 }, { lat: 17.7142, lng: 83.3239 });
  assert.ok(d > 2500 && d < 2700, String(d));
  assert.equal(shortDistance(842), '840 m'); assert.equal(shortDistance(4234), '4.2 km'); assert.equal(shortDistance(37400), '37 km'); assert.equal(shortDistance(1240000), '1,240 km'); assert.equal(shortDistance(null), '');
  assert.equal(suggestionType({ kind: 'place', place: { kind: 'digipin' } }), 'digipin');
  assert.equal(suggestionType({ kind: 'place', place: { kind: 'postcode' } }), 'pincode');
  assert.equal(suggestionType({ kind: 'cat' }), 'cat');
});

test('A2 hours state: open / closing soon / closed / opening soon (incl. past midnight) and unknown', () => {
  const H = 'Mo-Su 09:00-21:00';
  assert.equal(hoursState(H, at(12, 0)).state, 'open');
  const cs = hoursState(H, at(20, 20)); assert.equal(cs.state, 'closing_soon'); assert.equal(cs.minutesLeft, 40);
  assert.equal(hoursState(H, at(22, 0)).state, 'closed');
  const os = hoursState(H, at(8, 15)); assert.equal(os.state, 'opening_soon'); assert.equal(os.minutesToOpen, 45);
  assert.equal(hoursState(H, at(7, 0)).state, 'closed', '2 h before opening is not "soon"');
  assert.equal(hoursState('Mo-Su 18:00-02:00', at(1, 30)).state, 'closing_soon', 'overnight range closing at 02:00');
  assert.equal(hoursState('Mo-Su 00:30-10:00', at(23, 50, 1)).state, 'opening_soon', 'opens after midnight (tomorrow)');
  assert.equal(hoursState('24/7', at(23, 59)).state, 'open');
  assert.equal(hoursState('sunrise-sunset', at(12, 0)).state, 'unknown');
  assert.equal(hoursState('', at(12, 0)).state, 'none');
  assert.equal(hoursState(H, at(20, 20), 15).state, 'open', 'configurable window');
});

test('A2 place-card blocks: fixed order, dropped when empty; lean card = header + actions + details (+ help prompt); ribbon/payment/good-to-know from OSM tags', () => {
  const rich = { kind: 'poi', tags: { opening_hours: 'Mo-Su 09:00-21:00', phone: '+91 891 000 0000', 'payment:upi': 'yes', 'payment:cash': 'yes', description: 'Seaside', wheelchair: 'limited', 'diet:vegetarian': 'only' } };
  const r = placeBlocks(rich);
  assert.equal(r.lean, false);
  assert.deepEqual(r.blocks, ['header', 'actions', 'ribbon', 'about', 'goodToKnow', 'services', 'also', 'details', 'footer']);
  assert.deepEqual(r.blocks, BLOCK_ORDER.filter((b) => r.blocks.includes(b)), 'order preserved');
  const lean = placeBlocks({ kind: 'poi', tags: {} });
  assert.equal(lean.lean, true);
  assert.ok(!lean.blocks.includes('ribbon') && !lean.blocks.includes('about') && !lean.blocks.includes('goodToKnow') && !lean.blocks.includes('photos'));
  assert.equal(placeBlocks({ kind: 'seller', tags: {} }).lean, false, 'demo sellers are not "lean"');
  assert.equal(placeBlocks({ kind: 'pin', tags: {} }).blocks.includes('also'), false);
  assert.deepEqual(paymentMethods({ 'payment:upi': 'yes', 'payment:cash': 'no', 'payment:rupay': 'yes' }), ['upi', 'cards']);
  assert.deepEqual(goodToKnow({ wheelchair: 'limited', toilets: 'no', internet_access: 'wlan', 'diet:vegetarian': 'only', air_conditioning: 'maybe' }).map((f) => `${f.key}=${f.value}`), ['wheelchair=limited', 'diet:vegetarian=only', 'internet_access=wlan']);
  assert.equal(localScriptName({ tags: { 'name:te': 'సింహాచలం', 'name:hi': 'सिंहाचलम' } }, 'Simhachalam'), 'సింహాచలం', 'Telugu first');
  assert.equal(localScriptName({ tags: { 'name:en': 'Charminar' } }, 'Charminar'), '');
});

test('A3 routes: totals for the header, descriptor + only-known badges, two-wheeler estimate badge only when it is one', () => {
  const routes = [{ duration_s: 1500, distance_m: 9000 }, { duration_s: 1740, distance_m: 8200 }, { duration_s: 1900, distance_m: 9900 }];
  const T = routeTotals(routes[0], Date.parse('2026-10-21T10:00:00+05:30'));
  assert.equal(T.duration_s, 1500); assert.equal(T.distance_m, 9000); assert.equal(T.arrive.toISOString(), '2026-10-21T04:55:00.000Z');
  assert.equal(routeDescriptor(routes[0], 0, { routes }).key, 'rd_fastest');
  const second = routeDescriptor(routes[1], 1, { routes });
  assert.equal(second.key, 'rd_shortest'); assert.deepEqual(second.badges, [{ key: 'rb_slower', tone: 'muted', n: 4 }]);
  assert.equal(routeDescriptor(routes[2], 2, { routes }).key, 'rd_alternative');
  assert.deepEqual(routeDescriptor(routes[0], 0, { routes, avoidTolls: true }).badges.map((b) => b.key), ['rb_no_tolls']);
  assert.deepEqual(routeDescriptor(routes[0], 0, { routes, avoidTolls: true, avoidApplied: false }).badges, [], 'no "avoids tolls" claim when the engine ignored it');
  assert.deepEqual(routeDescriptor(routes[0], 0, { routes, mode: 'two' }).badges, [], 'real 2-wheeler route: no estimate badge');
  assert.deepEqual(routeDescriptor(routes[0], 0, { routes, mode: 'two', estimate: true }).badges.map((b) => b.key), ['rb_two_est']);
  assert.deepEqual(routeDescriptor({ ...routes[0], fallback: true }, 0, { routes }), { key: 'rd_estimate', badges: [{ key: 'rb_straight', tone: 'warn' }] });
  assert.equal(routeDescriptor(routes[0], 0, { routes, mode: 'walk', avoidTolls: true }).badges.length, 0, 'avoid badges only for motor modes');
});

test('A4 empty states: a title and at least one action are mandatory; markup escapes and marks the first action primary', () => {
  assert.throws(() => emptyState({ title: 'Nothing', actions: [] }), /empty_state_needs_action/);
  assert.throws(() => emptyState({ actions: [{ id: 'x', label: 'X' }] }), /empty_state_title/);
  const s = emptyState({ title: 'No places', actions: [{ id: 'area', label: 'Search the map area' }, { id: 'report', label: 'Report' }, { id: '', label: 'dropped' }] });
  assert.deepEqual(s.actions.map((a) => [a.id, a.primary]), [['area', true], ['report', false]]);
  const h = emptyStateHtml({ title: 'No match for “<b>”', body: 'Try <i>', actions: [{ id: 'retry', label: 'Retry' }] });
  assert.match(h, /role="status"/); assert.match(h, /&lt;b&gt;/); assert.match(h, /data-state-act="retry"/); assert.doesNotMatch(h, /<b>”/);
  // every state the UI renders uses an action-bearing spec
  for (const f of ['../web/ui/search.js', '../web/ui/directions.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const chunk of src.split('renderState(').slice(1)) if (!chunk.startsWith('el, spec')) assert.match(chunk.slice(0, 700), /actions(: \[| \})/, `${f}: renderState call has actions`);
    assert.ok((src.match(/renderState\(/g) || []).length >= 2, `${f} renders states`);
  }
});

test('A5 map health: WebGL, style timeout and tile failure without a working offline map show a banner with actions; healthy maps do not', () => {
  assert.equal(mapHealth({}), null);
  assert.deepEqual(mapHealth({ webgl: false }), { reason: 'webgl', actions: ['retry'], online: true });
  assert.equal(mapHealth({ styleLoaded: false, sinceApplyMs: 5000 }), null, 'not yet');
  assert.deepEqual(mapHealth({ styleLoaded: false, sinceApplyMs: 16000 }).actions, ['retry', 'lowbw', 'offline']);
  assert.equal(mapHealth({ errors: 8, offlineAvailable: true, offlineActive: false }), null, 'auto offline fallback gets its chance first');
  assert.deepEqual(mapHealth({ errors: 8, offlineAvailable: false }), { reason: 'tiles', actions: ['retry', 'lowbw'], online: true });
  assert.deepEqual(mapHealth({ errors: 6, offlineActive: true, lowBw: true }).actions, ['retry'], 'offline map also failing; low-bandwidth already on');
  assert.match(html, /id="mapFail" class="map-fail" role="alert" hidden/);
  for (const id of ['mapFailRetry', 'mapFailLowBw', 'mapFailOffline', 'mapFailClose']) assert.match(html, new RegExp(`id="${id}"`));
});

test('A15 interaction states: hover only on pointer devices, press overlay + scale, focus-visible on tiles/chips/cards, selected row bar', () => {
  assert.match(css, /@media \(hover: hover\) \{\s*\.ctile:hover::after/);
  assert.match(css, /--hover: rgba\(27, 29, 42, \.06\); --press: rgba\(27, 29, 42, \.12\);/);
  assert.match(css, /\.ctile:active[^{]*\{ transform: scale\(\.98\); \}/);
  assert.match(css, /\.ctile:focus-visible, \.act:focus-visible, \.route-opt:focus-visible[^{]*\.chip:focus-visible[^{]*\{ outline: 2px solid var\(--focus\)/);
  assert.match(css, /\.suggest li\[aria-selected=true\]::before \{[^}]*width: 4px;[^}]*background: var\(--neel\)/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.ctile:active/);
});

test('v0.7.18 strings: en/hi/te complete, other languages fall back to English; precache + no third-party assets', () => {
  for (const l of ['hi', 'te']) assert.deepEqual(V718_KEYS.filter((k) => !V718[l][k]), [], `${l} complete`);
  assert.equal(t('ta', 'mf_retry'), 'Retry');
  assert.equal(tf('te', 'hs_closes_in', { n: 40 }), '40 నిమిషాల్లో మూస్తారు');
  assert.equal(tf('en', 'st_no_match_t', { q: 'xyz' }), 'No places match “xyz”');
  const sw = fs.readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  for (const f of ['/lib/ux.js', '/ui/states.js', '/ui/map-health.js', '/shared/i18n-v0718.js']) assert.ok(sw.includes(`"${f}"`), `precache ${f}`);
  // clean-room: no Apple names, fonts or assets in the shipped UI
  const shipped = [css, html, ...['ux.js'].map((f) => fs.readFileSync(new URL(`../web/lib/${f}`, import.meta.url), 'utf8'))].join('\n');
  assert.doesNotMatch(shipped, /SF Pro|-apple-system-ui|apple\.com|\.heic|Look Around/i);
});
