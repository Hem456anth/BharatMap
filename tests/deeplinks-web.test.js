// App hand-offs for providers without a user APK (shared/services/deeplinks-web.js): every catalogue provider is
// classified, every non-web provider has a confirmed package + an https fallback, App Links match the recorded
// assetlinks.json, Store links are the documented market://details intent with a play.google.com fallback, and no
// query parameter is ever guessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEEPLINKS, WEB_APPS, APPS, appLink, appMeta, storeIntentUrl, parseIntentUrl, safeIntent, openUrlFor, DL_LABEL, PLAY_PKG, PLAY_DOC, playUrl } from '../shared/services/deeplinks.js';
import { WEB_DEEPLINKS } from '../shared/services/deeplinks-web.js';
import { safeLinkout, olaLink, nammaYatriLink, tsavaariSearch, GROCERY_APPS } from '../shared/services/linkouts.js';
import { PROVIDERS, BY_ID } from '../shared/services/catalog.js';
import { buildServicePanel, buildRidePanel } from '../shared/services/build.js';
import { V7 } from '../shared/i18n-v07.js';

const ROOT = new URL('..', import.meta.url).pathname;
const AL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/deeplinks/assetlinks-web.json'), 'utf8'));
const byHost = Object.fromEntries(AL.hosts.map((h) => [h.host, h]));
const WEB = Object.entries(WEB_DEEPLINKS);
const PKG_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const FP_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const hostOf = (u) => new URL(u).host;
const site = (h) => h.replace(/^(www|m|english|book|lucknow|kanpur)\./, '');
/** Registrable domain (gov.in / co.in / org.in aware). */
const reg = (h) => h.split('.').slice(/\.(gov|co|org|net)\.in$/.test(h) ? -3 : -2).join('.');

test('every catalogue provider has exactly one hand-off classification; web entries never shadow an APK entry', () => {
  for (const p of PROVIDERS) {
    const d = DEEPLINKS[p.id];
    assert.ok(d, `${p.id}: no deep-link classification`);
    assert.ok(['documented', 'applink', 'declared', 'store', 'web', 'none'].includes(d.type), `${p.id}: ${d.type}`);
    assert.equal(p.deeplink, d.type, p.id); assert.equal(p.deeplinkSource, d.source, p.id);
  }
  assert.equal(Object.keys(DEEPLINKS).length, PROVIDERS.length, 'no stray deep-link ids');
  for (const [id] of WEB) assert.notEqual(DEEPLINKS[id].source, 'apk', `${id} must not override the APK analysis`);
  for (const id of ['uber', 'swiggy', 'zomato', 'district', 'bookmyshow', 'blinkit', 'makemytrip', 'agoda', 'parkplus', 'apollo-247', 'apollo-pharmacy', 'tata-1mg', 'rapido']) assert.equal(DEEPLINKS[id].source, 'apk', id);
});

test('each non-web provider has a confirmed package (format, app metadata, Play developer) and an https fallback', () => {
  for (const [id, d] of WEB.filter(([, x]) => ['applink', 'store'].includes(x.type))) {
    assert.match(d.pkg, PKG_RE, `${id}: package format`);
    assert.ok(WEB_APPS[d.pkg] && WEB_APPS[d.pkg].app && WEB_APPS[d.pkg].developer, `${id}: ${d.pkg} metadata`);
    assert.ok(!APPS[d.pkg], `${id}: ${d.pkg} would belong to the APK table`);
    const l = appLink(id);
    assert.equal(l.deeplink.package, d.pkg, `${id}: package on the link`);
    assert.equal(l.deeplink.source, d.source);
    assert.match(l.deeplink.fallbackUrl, /^https:\/\//, `${id}: https fallback`);
    assert.ok(safeLinkout(l.url), `${id}: interstitial accepts ${l.url}`);
    assert.ok(d.evidence && d.evidence.length > 20, `${id}: evidence recorded`);
    assert.equal(l.verified, true);
  }
  for (const pkg of Object.keys(WEB_APPS)) assert.ok(Object.values(DEEPLINKS).some((d) => d.pkg === pkg), `${pkg} metadata is used`);
  assert.equal(appMeta('com.ubercab').app, 'Uber'); assert.equal(appMeta('com.zeptoconsumerapp').app, 'Zepto'); assert.equal(appMeta('com.example.nope'), null);
});

test('App Links: the recorded assetlinks.json of that exact host lists the package with handle_all_urls and well-formed fingerprints; the page is the catalogue site', () => {
  assert.match(AL.scope, /no APK download, no decompiling/);
  const applinks = WEB.filter(([, x]) => x.type === 'applink');
  assert.ok(applinks.length >= 15);
  for (const [id, d] of applinks) {
    assert.equal(d.source, 'assetlinks');
    const u = new URL(d.url);
    assert.equal(u.protocol, 'https:'); assert.equal(u.search, '', `${id}: no query parameter`); assert.equal(u.hash, '');
    assert.equal(u.host, d.assetHost, `${id}: link host = verified host`);
    const rec = byHost[d.assetHost];
    assert.ok(rec, `${id}: ${d.assetHost} fetched`);
    assert.equal(rec.result, 'assetlinks', `${id}: ${d.assetHost} → ${rec.result}`);
    const st = rec.android.filter((a) => a.package === d.pkg && a.handle_all_urls);
    assert.ok(st.length, `${id}: ${d.pkg} with handle_all_urls on ${d.assetHost}`);
    assert.ok(st.some((a) => a.sha256.some((f) => FP_RE.test(f))), `${id}: a well-formed SHA-256 fingerprint`);
    assert.equal(site(hostOf(BY_ID[id].url)), site(u.host), `${id}: catalogue site ${BY_ID[id].url} vs ${d.url}`);
    const l = appLink(id);
    assert.equal(l.url, d.url); assert.equal(l.deeplink.pathConfirmed, false, `${id}: no APK, path not confirmed`);
    assert.equal(openUrlFor(l, { android: true }), d.url); assert.equal(openUrlFor(l, { android: false }), d.url);
  }
  // Hosts that serve no assetlinks are never App Links.
  for (const h of AL.hosts.filter((x) => x.result !== 'assetlinks')) assert.ok(!applinks.some(([, d]) => d.assetHost === h.host), h.host);
});

test('Store links: documented market://details intent → Play Store package, play.google.com fallback, official website off Android; nothing else in the URL', () => {
  const stores = WEB.filter(([, x]) => x.type === 'store');
  assert.ok(stores.length >= 35);
  for (const [id, d] of stores) {
    const l = appLink(id);
    assert.equal(l.url, `intent://details?id=${d.pkg}#Intent;scheme=market;package=${PLAY_PKG};S.browser_fallback_url=${encodeURIComponent(playUrl(d.pkg))};end`, id);
    const p = parseIntentUrl(l.url);
    assert.deepEqual([p.scheme, p.pkg, p.host, p.path, p.extra.length], ['market', PLAY_PKG, `details?id=${d.pkg}`, '', 0], id);
    assert.equal(p.fallback, playUrl(d.pkg)); assert.equal(l.deeplink.fallbackUrl, playUrl(d.pkg));
    assert.equal(l.deeplink.doc, PLAY_DOC);
    assert.equal(l.deeplink.webUrl, d.web); assert.equal(new URL(d.web).protocol, 'https:'); assert.equal(new URL(d.web).search, '', `${id}: web URL has no query`);
    assert.equal(reg(hostOf(d.web)), reg(hostOf(BY_ID[id].url)), `${id}: website on the catalogue's official domain`);
    assert.equal(openUrlFor(l, { android: true }), l.url); assert.equal(openUrlFor(l, { android: false }), d.web);
    assert.ok(['official-site', 'play-listing'].includes(d.source), id);
    if (d.source === 'official-site') assert.match(d.confirmUrl, /^https:\/\//, `${id}: official page cited`);
    assert.equal(l.deeplink.prefill.length, 0);
  }
  assert.throws(() => storeIntentUrl('com.example.unknown'), /unknown_package/);
  assert.throws(() => storeIntentUrl('com.net.pvr&x=1'), /unknown_package/);
});

test('safeIntent: Play intents only for Store-classified packages with the exact play.google.com fallback', () => {
  const good = appLink('metro-delhi').url;
  assert.equal(safeIntent(good), true); assert.equal(safeLinkout(good), true);
  assert.equal(safeIntent(good.replace('com.sraoss.dmrc', 'com.evil.app')), false, 'unknown package');
  assert.equal(safeIntent(good.replace(/S\.browser_fallback_url=[^;]*/, `S.browser_fallback_url=${encodeURIComponent('https://evil.example/')}`)), false, 'fallback must be the Play page');
  assert.equal(safeIntent(good.replace(';end', ';component=com.android.vending/.X;end')), false, 'no extra fields');
  assert.equal(safeIntent(good.replace(`package=${PLAY_PKG}`, 'package=com.rapido.passenger')), false, 'Play scheme only to the Play Store');
  assert.equal(safeIntent(good.replace('details?id=', 'search?q=')), false, 'details pages only');
  // An App Link package is not a Store package.
  assert.equal(safeIntent(`intent://details?id=com.zeptoconsumerapp#Intent;scheme=market;package=${PLAY_PKG};S.browser_fallback_url=${encodeURIComponent(playUrl('com.zeptoconsumerapp'))};end`), false);
});

test('no guessed query parameters anywhere in the web-verified table or built panels (only Ola with a configured token, per its docs)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'shared/services/deeplinks-web.js'), 'utf8');
  for (const m of src.matchAll(/'(https:\/\/[^']+)'/g)) assert.ok(!/[?&][a-z_]+=/i.test(m[1]), `query in ${m[1]}`);
  for (const [id, d] of WEB) if (d.url) assert.equal(new URL(d.url).search, '', id);
  const o = olaLink({ pickup: { lat: 17.43, lng: 78.44 }, dropoff: { lat: 17.36, lng: 78.47 } });
  assert.equal(o.url, 'https://book.olacabs.com/'); assert.equal(o.deeplink.type, 'applink'); assert.equal(o.deeplink.package, 'com.olacabs.customer');
  const ot = olaLink({ pickup: { lat: 17.43, lng: 78.44 }, dropoff: { lat: 17.36, lng: 78.47 }, xappToken: 'TOKEN' });
  assert.equal(ot.deeplink.type, 'documented'); assert.equal(ot.deeplink.doc, 'https://developers.olacabs.com/docs/deep-linking');
  assert.deepEqual([...new URL(ot.url).searchParams.keys()].sort(), ['category', 'drop_lat', 'drop_lng', 'dsw', 'lat', 'lng', 'utm_source'], 'only documented Ola params');
  assert.equal(nammaYatriLink().url, 'https://nammayatri.in/');
  for (const k of ['zepto', 'flipkart-minutes', 'bigbasket']) { const l = GROCERY_APPS[k](); assert.equal(new URL(l.url).search, ''); assert.equal(l.deeplink.type, 'applink'); }
  const places = [[{ amenity: 'restaurant' }, 'Paradise'], [{ amenity: 'cinema', brand: 'PVR' }, 'PVR Inorbit'], [{ shop: 'supermarket' }, 'Ratnadeep'], [{ tourism: 'hotel' }, 'Taj'],
    [{ amenity: 'parking' }, 'P1'], [{ barrier: 'toll_booth' }, 'Toll'], [{ amenity: 'pharmacy' }, 'Apollo'], [{ amenity: 'hospital' }, 'KIMS'], [{ amenity: 'fuel', brand: 'Indian Oil' }, 'IOCL'],
    [{ amenity: 'fuel', brand: 'Jio-bp' }, 'Jio-bp'], [{ amenity: 'charging_station', operator: 'Tata Power' }, 'EZ'], [{ highway: 'bus_stop' }, 'RTC']];
  for (const [tags, name] of places) {
    const P = buildServicePanel({ id: 'osm:node/1', name, lat: 17.4416, lng: 78.4873, tags }, { online: true, departures: { status: 'no_feed' } });
    for (const a of P.actions.filter((x) => x.kind === 'linkout' && x.deeplink)) {
      assert.ok(safeLinkout(a.url), a.url);
      const open = openUrlFor(a, { android: false });
      if (a.deeplink.type !== 'documented' && !/wa\.me/.test(open)) assert.equal(new URL(open).search, '', `${a.id}: ${open}`);
    }
  }
});

test('panels: Store / App Link / Web-only labels reach the actions; IndianOil and NHAI keep their web page and add the app', () => {
  const ids = (P) => Object.fromEntries(P.actions.map((a) => [a.id, a]));
  const hosp = ids(buildServicePanel({ id: 'osm:node/2', name: 'KIMS', lat: 17.44, lng: 78.48, tags: { amenity: 'hospital' } }, { online: true }));
  assert.equal(hosp['p-practo'].deeplink.type, 'applink'); assert.equal(hosp['p-practo'].deeplink.package, 'com.practo.fabric');
  assert.equal(hosp['p-esanjeevani'].deeplink.type, 'web'); assert.equal(hosp['p-esanjeevani'].url, BY_ID.esanjeevani.url); assert.ok(hosp['p-esanjeevani'].deeplink.reason);
  assert.equal(hosp['p-112-india'].deeplink.type, 'store');
  const fuel = ids(buildServicePanel({ id: 'osm:node/3', name: 'IOCL', lat: 17.44, lng: 78.48, tags: { amenity: 'fuel', brand: 'Indian Oil' } }, { online: true }));
  assert.equal(fuel['p-indianoil'].url, BY_ID.indianoil.url, 'price page stays the web page'); assert.equal(fuel['p-indianoil'].deeplink.type, 'web');
  assert.equal(fuel['p-indianoil-app'].deeplink.type, 'store'); assert.equal(fuel['p-indianoil-app'].text, 'IndianOil ONE');
  const jio = ids(buildServicePanel({ id: 'osm:node/4', name: 'Jio-bp', lat: 17.44, lng: 78.48, tags: { amenity: 'fuel', brand: 'Jio-bp' } }, { online: true }));
  assert.equal(jio['p-jio-bp'].deeplink.type, 'web'); assert.equal(jio['p-jio-bp'].url, 'https://www.jiobp.com/');
  const toll = ids(buildServicePanel({ id: 'osm:node/5', name: 'Toll', lat: 17.44, lng: 78.48, tags: { barrier: 'toll_booth' } }, { online: true }));
  assert.equal(toll['p-nhai'].url, 'http://tis.nhai.gov.in/'); assert.equal(toll['p-nhai-app'].deeplink.package, 'com.nhai.rajmargyatra');
  const met = ids(buildServicePanel({ id: 'osm:node/6', name: 'Rajiv Chowk', lat: 28.6328, lng: 77.2197, tags: { railway: 'station', station: 'subway' } }, { online: true, departures: { status: 'no_feed' } }));
  assert.equal(met['p-metro-delhi'].deeplink.package, 'com.sraoss.dmrc'); assert.equal(met['p-metro-delhi'].host, 'www.delhimetrorail.com', 'card names the operator site; the interstitial explains Play vs website');
  const hyd = ids(buildServicePanel({ id: 'osm:node/7', name: 'Ameerpet', lat: 17.4357, lng: 78.4448, tags: { railway: 'station', station: 'subway', network: 'Hyderabad Metro' } }, { online: true, departures: { status: 'no_feed' } }));
  assert.equal(hyd.tsavaari.deeplink.package, 'com.minfy.tsavaari'); assert.ok(!/store\/search/.test(hyd.tsavaari.url), 'no Play search link any more');
  assert.equal(tsavaariSearch().deeplink.type, 'store');
  const R = ids(buildRidePanel({ lat: 17.3616, lng: 78.4747, name: 'Charminar' }, { origin: { lat: 17.4375, lng: 78.4483, real: true } }));
  assert.equal(R.ola.deeplink.type, 'applink'); assert.equal(R.nammayatri.deeplink.package, 'in.juspay.nammayatri');
  const K = ids(buildRidePanel({ name: 'Howrah', lat: 22.585, lng: 88.34 }, { online: true }));
  assert.equal(K['p-yatri-sathi'].deeplink.package, 'in.juspay.jatrisaathi');
});

test('interstitial labels exist (en/hi/te) for every type; the native opener allows the Play Store only for market://details', () => {
  for (const k of [...Object.values(DL_LABEL), 'lo_dl_store_app', 'lo_dl_store_android', 'lo_dl_store_other', 'lo_dl_web_note', 'lo_dl_applink_web_note']) {
    for (const lang of ['en', 'hi', 'te']) assert.ok(V7[lang][k], `${lang}.${k}`);
  }
  for (const lang of ['en', 'hi', 'te']) for (const v of ['{app}', '{pkg}', '{web}']) assert.ok(V7[lang].lo_dl_store_app.includes(v), `${lang} lo_dl_store_app ${v}`);
  const java = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/com/indiamapos/app/ExternalAppPlugin.java'), 'utf8');
  assert.match(java, /"com\.rapido\.passenger", PLAY/); assert.match(java, /"market"\.equals\(scheme\)/); assert.match(java, /"details"\.equals\(data\.getHost\(\)\)/);
  assert.match(java, /https:\/\/play\.google\.com\/store\/apps\/details\?id=/);
  const ui = fs.readFileSync(path.join(ROOT, 'web/ui/linkout.js'), 'utf8');
  assert.match(ui, /data-dl-store-dest/); assert.match(ui, /data-dl-web/); assert.match(ui, /data-dl-assetlinks/);
});

test('classification counts (docs/re/DEEPLINKS.md table) — update both when a provider changes', () => {
  const c = {}; for (const [, d] of WEB) c[d.type] = (c[d.type] || 0) + 1;
  assert.deepEqual(c, { applink: 18, web: 8, store: 41, none: 8 });
  const src = {}; for (const [, d] of WEB.filter(([, x]) => x.type === 'store')) src[d.source] = (src[d.source] || 0) + 1;
  assert.deepEqual(src, { 'play-listing': 19, 'official-site': 22 });
  // None of the web-only/none entries carries a package Bharat could open.
  for (const [id, d] of WEB.filter(([, x]) => ['web', 'none'].includes(x.type))) { assert.equal(appLink(id), null, id); assert.ok(d.reason, id); assert.ok(!BY_ID[id].appPackage, id); }
});
