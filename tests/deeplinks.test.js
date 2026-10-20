// App deep links (shared/services/deeplinks.js) checked against the manifest inventory extracted from the user-supplied
// APKs (data/deeplinks/apk-manifest-links.json, scripts/extract-deeplinks.py): intent URL building, https fallbacks,
// package match, declared paths only, no guessed parameters, and no upi:// anywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APPS, DEEPLINKS, intentUrl, parseIntentUrl, safeIntent, appLink, openUrlFor, DL_LABEL } from '../shared/services/deeplinks.js';
import { safeLinkout, rapidoLink, uberLink, swiggyLink, zomatoLink, bookMyShowLink, districtMovies, GROCERY_APPS } from '../shared/services/linkouts.js';
import { PROVIDERS, BY_ID, linkable } from '../shared/services/catalog.js';
import { buildServicePanel, buildRidePanel } from '../shared/services/build.js';

const ROOT = new URL('..', import.meta.url).pathname;
const INV = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/deeplinks/apk-manifest-links.json'), 'utf8'));
const byPkg = Object.fromEntries(INV.apps.map((a) => [a.package, a]));
const RAPIDO = 'intent://open#Intent;scheme=rapido;package=com.rapido.passenger;S.browser_fallback_url=https%3A%2F%2Fwww.rapido.bike%2F;end';

/** Android PatternMatcher (PATTERN_SIMPLE_GLOB) → RegExp: '.' any char, '*' repeats the previous char, '\' escapes. */
function globToRe(p) {
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\' && i + 1 < p.length) { re += p[++i].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); continue; }
    re += c === '.' ? '.' : c === '*' ? '*' : c.replace(/[+?^${}()|[\]\\/]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const hostMatches = (decl, host) => decl === host || (decl.startsWith('*.') && (host === decl.slice(2) || host.endsWith(decl.slice(1))));
function pathDeclared(f, p) {
  if (!f.path && !f.pathPrefix && !f.pathPattern && !f.pathAdvancedPattern) return true; // no path restriction
  return (f.path || []).includes(p) || (f.pathPrefix || []).some((x) => p.startsWith(x)) || (f.pathPattern || []).some((x) => globToRe(x).test(p));
}
/** The manifest filters of `pkg` that would accept this https URL as a verified App Link. */
function appLinkFilters(pkg, url) {
  const u = new URL(url);
  return byPkg[pkg].browsableFilters.filter((f) => (f.schemes || []).includes('https') && (f.hosts || []).some((h) => hostMatches(h, u.host)) && pathDeclared(f, u.pathname));
}

test('inventory: every analysed app is in the manifest JSON with the same package, version and signer certificate', () => {
  assert.equal(INV.apps.length, 15);
  for (const [pkg, a] of Object.entries(APPS)) {
    const rec = byPkg[pkg];
    assert.ok(rec, `${pkg} missing from apk-manifest-links.json`);
    assert.ok(rec.versionName.startsWith(a.version), `${pkg} version ${rec.versionName} vs ${a.version}`);
    assert.ok(rec.signers.some((s) => s.sha256 === a.cert), `${pkg} cert`);
  }
  assert.match(INV.scope, /no code, resources or assets/);
  assert.equal(byPkg['net.easypark.android'].skip ? true : false, true, 'EasyPark marked skip');
  assert.ok(INV.otherUploads.every((o) => o.duplicateOf), 'extra uploads are duplicates');
  // Nothing secret-shaped leaks into the inventory (Facebook app ids are redacted).
  assert.ok(!/fb\d{6,}|kakao[0-9a-f]{16,}|line\.\d{6,}/.test(JSON.stringify(INV)));
});

test('intent URL building: exact format, round-trip, package + scheme + https fallback required, payment schemes refused', () => {
  assert.equal(intentUrl({ scheme: 'rapido', host: 'open', pkg: 'com.rapido.passenger', fallback: 'https://www.rapido.bike/' }), RAPIDO);
  const p = parseIntentUrl(RAPIDO);
  assert.deepEqual({ scheme: p.scheme, host: p.host, path: p.path, pkg: p.pkg, fallback: p.fallback, extra: p.extra }, { scheme: 'rapido', host: 'open', path: '', pkg: 'com.rapido.passenger', fallback: 'https://www.rapido.bike/', extra: [] });
  assert.throws(() => intentUrl({ scheme: 'upi', host: 'pay', pkg: 'com.phonepe.app', fallback: 'https://www.phonepe.com/' }), /bad_scheme/);
  for (const s of ['UPI', 'upiGlobal', 'ppe', 'phonepe', 'tez', 'gpay', 'paytmmp', 'javascript', 'intent']) assert.throws(() => intentUrl({ scheme: s, pkg: 'com.rapido.passenger', fallback: 'https://www.rapido.bike/' }), /bad_scheme/, s);
  assert.throws(() => intentUrl({ scheme: 'rapido', pkg: 'com.example.unknown', fallback: 'https://www.rapido.bike/' }), /unknown_package/);
  assert.throws(() => intentUrl({ scheme: 'rapido', pkg: 'com.rapido.passenger' }), /fallback_required/);
  assert.throws(() => intentUrl({ scheme: 'rapido', pkg: 'com.rapido.passenger', fallback: 'http://www.rapido.bike/' }), /fallback_required/);
  assert.throws(() => intentUrl({ scheme: 'rapido', pkg: 'com.rapido.passenger', fallback: 'javascript:alert(1)' }), /fallback_required/);
});

test('safeIntent / safeLinkout: only intent URLs for a known package with its own declared scheme and an https fallback', () => {
  assert.equal(safeIntent(RAPIDO), true); assert.equal(safeLinkout(RAPIDO), true);
  assert.equal(safeIntent(RAPIDO.replace('package=com.rapido.passenger', 'package=com.ubercab')), false, 'package must match the declaring app');
  assert.equal(safeIntent(RAPIDO.replace('scheme=rapido', 'scheme=uber')), false);
  assert.equal(safeIntent(RAPIDO.replace('intent://open', 'intent://pay')), false, 'declared host only');
  assert.equal(safeIntent(RAPIDO.replace(';end', ';component=com.rapido.passenger/.X;end')), false, 'no extra intent fields');
  assert.equal(safeIntent(RAPIDO.replace('https%3A%2F%2Fwww.rapido.bike%2F', 'javascript%3Aalert(1)')), false);
  assert.equal(safeIntent(RAPIDO.replace(/;S\.browser_fallback_url=[^;]*/, '')), false, 'fallback required');
  assert.equal(safeLinkout('intent://pay?pa=x@y#Intent;scheme=upi;package=com.phonepe.app;S.browser_fallback_url=https%3A%2F%2Fwww.phonepe.com%2F;end'), false);
  assert.equal(safeLinkout('upi://pay?pa=x@y&pn=Shop&am=1'), false);
  assert.equal(safeLinkout('intent:#Intent;package=com.rapido.passenger;end'), false);
});

test('every deep link: package in the analysed APKs, https fallback, App Links on declared+autoVerify hosts and paths, no query parameters', () => {
  for (const [id, d] of Object.entries(DEEPLINKS)) {
    assert.ok(APPS[d.pkg] && byPkg[d.pkg], `${id}: package ${d.pkg} not analysed`);
    if (d.type === 'none') { assert.equal(appLink(id), null, `${id}: none builds nothing`); assert.ok(d.reason); continue; }
    const l = appLink(id);
    assert.equal(l.deeplink.package, d.pkg, `${id} package`);
    assert.ok(/^https:\/\//.test(l.deeplink.fallbackUrl), `${id}: https fallback`);
    assert.ok(safeLinkout(l.url), `${id}: safe`);
    if (d.type === 'applink' || d.type === 'documented') {
      const u = new URL(d.url);
      assert.equal(u.search, '', `${id}: no query parameter on the base link`);
      const fs_ = appLinkFilters(d.pkg, d.url);
      assert.ok(fs_.length, `${id}: ${d.url} not declared in ${d.pkg} manifest`);
      assert.ok(byPkg[d.pkg].browsableFilters.some((f) => f.autoVerify && (f.schemes || []).includes('https') && (f.hosts || []).some((h) => hostMatches(h, u.host))), `${id}: host ${u.host} not autoVerify`);
      assert.equal(l.verified, true);
    }
    if (d.type === 'declared') {
      const p = parseIntentUrl(l.url);
      assert.equal(p.pkg, d.pkg, `${id}: intent package`);
      assert.ok(byPkg[d.pkg].browsableFilters.some((f) => (f.schemes || []).includes(p.scheme) && (!p.host || (f.hosts || []).includes(p.host))), `${id}: rapido://${p.host} declared`);
      assert.equal(l.verified, false, `${id}: declared-only is Unverified`);
      assert.equal(l.deeplink.prefill.length, 0, `${id}: no params for declared-only`);
    }
    if (d.type === 'documented') assert.match(d.doc, /^https:\/\//);
  }
  // Agoda's /en-in/ is not a declared path (it would open the browser even with the app installed).
  assert.equal(appLinkFilters('com.agoda.mobile.consumer', 'https://www.agoda.com/en-in/').length, 0);
  assert.equal(appLink('agoda').url, 'https://www.agoda.com/');
});

test('package match: catalogue providers, panel actions and intent URLs all name the app that declares the link', () => {
  for (const p of PROVIDERS) {
    const d = DEEPLINKS[p.id];
    assert.equal(p.deeplink, d ? d.type : null, p.id);
    if (d && d.type !== 'none') assert.equal(p.appPackage, d.pkg, p.id);
  }
  const places = [
    [{ amenity: 'restaurant' }, 'Paradise'], [{ amenity: 'cinema' }, 'PVR'], [{ shop: 'supermarket' }, 'Ratnadeep'], [{ tourism: 'hotel' }, 'Taj'],
    [{ amenity: 'parking' }, 'P1'], [{ amenity: 'pharmacy' }, 'Apollo'], [{ amenity: 'hospital' }, 'KIMS'], [{ amenity: 'taxi' }, 'Stand'],
  ];
  const seen = new Set();
  for (const [tags, name] of places) {
    const P = buildServicePanel({ id: 'osm:node/1', name, lat: 17.4416, lng: 78.4873, tags }, { online: true, origin: { lat: 17.43, lng: 78.44, real: true } });
    for (const a of [...P.actions, ...(P.ride?.actions || [])]) {
      if (!a.deeplink) continue;
      const prov = a.provider;
      assert.ok(DEEPLINKS[prov], `${a.id}: provider ${prov}`);
      assert.equal(a.deeplink.package, DEEPLINKS[prov].pkg, `${a.id} package`);
      if (a.url.startsWith('intent:')) assert.equal(parseIntentUrl(a.url).pkg, DEEPLINKS[prov].pkg);
      assert.ok(safeLinkout(a.url), a.url);
      seen.add(prov);
    }
  }
  for (const id of ['uber', 'rapido', 'swiggy', 'zomato', 'dineout', 'bookmyshow', 'district', 'blinkit', 'instamart', 'agoda', 'makemytrip', 'parkplus', 'apollo-pharmacy', 'tata-1mg', 'apollo-247']) assert.ok(seen.has(id), `panel wires ${id}`);
});

test('rides: only Uber (documented) carries pickup/drop; Rapido opens the app home with a www.rapido.bike fallback', () => {
  const R = buildRidePanel({ lat: 17.3616, lng: 78.4747, name: 'Charminar' }, { origin: { lat: 17.4375, lng: 78.4483, real: true } });
  const uber = R.actions.find((a) => a.id === 'uber'), rap = R.actions.find((a) => a.id === 'rapido');
  assert.equal(uber.deeplink.type, 'documented'); assert.match(uber.url, /pickup\[latitude\]=17\.4375.*dropoff\[latitude\]=17\.3616/);
  assert.ok(uber.deeplink.prefill.length >= 2);
  assert.equal(rap.deeplink.type, 'declared'); assert.equal(rap.url, RAPIDO); assert.equal(rap.verified, false);
  assert.ok(!/17\.|78\./.test(rap.url), 'no coordinates guessed into Rapido');
  for (const a of R.actions) if (a.id !== 'uber') assert.ok(!/lat|lng|latitude|pickup|drop/i.test(new URL(openUrlFor(a) || a.url).search), `${a.id}: no ride params`);
  assert.deepEqual(rapidoLink(), appLink('rapido', { kind: 'ride' }));
  assert.equal(uberLink({ dropoff: { lat: 1, lng: 2 } }).deeplink.package, 'com.ubercab');
});

test('platform choice: intent URLs only on Android, the https fallback everywhere else; App Links are the same everywhere', () => {
  const r = rapidoLink();
  assert.equal(openUrlFor(r, { android: true }), RAPIDO);
  assert.equal(openUrlFor(r, { android: false }), 'https://www.rapido.bike/');
  for (const l of [swiggyLink(), zomatoLink(), bookMyShowLink(), districtMovies(), GROCERY_APPS.blinkit(), GROCERY_APPS.instamart()]) {
    assert.equal(openUrlFor(l, { android: true }), l.url); assert.equal(openUrlFor(l, { android: false }), l.url);
    assert.equal(l.deeplink.type, 'applink'); assert.equal(new URL(l.url).search, '');
  }
  assert.deepEqual(Object.keys(DL_LABEL).sort(), ['applink', 'declared', 'documented']);
});

test('payments: no deep links to PhonePe / Google Pay; EasyPark is not-in-India and never linked', () => {
  assert.equal(DEEPLINKS['phonepe-pg'].type, 'none'); assert.equal(DEEPLINKS['google-pay'].type, 'none');
  assert.equal(appLink('phonepe-pg'), null); assert.equal(appLink('google-pay'), null);
  assert.equal(BY_ID.easypark.class, 'unavailable'); assert.equal(BY_ID.easypark.url, null); assert.equal(BY_ID.easypark.notInIndia, true); assert.equal(linkable(BY_ID.easypark), false);
  assert.equal(appLink('easypark'), null);
  for (const p of PROVIDERS.filter((x) => x.domain === 'payments')) assert.ok(!p.appPackage, `${p.id}: no app hand-off for payments`);
});

test('no upi:// anywhere: source (comments stripped), built panels, catalogue and deep-link table', () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (!/^(vendor|offline|node_modules|transit)$/.test(e.name)) walk(f); } else if (/\.(js|mjs|java|html)$/.test(e.name)) files.push(f); } };
  for (const d of ['shared', 'web', 'server', 'android/app/src/main/java']) walk(path.join(ROOT, d));
  assert.ok(files.length > 50);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');
  for (const f of files) {
    const code = strip(fs.readFileSync(f, 'utf8'));
    assert.ok(!/upi:\/\/[a-z]/i.test(code), `${path.relative(ROOT, f)} builds a upi:// URL`);
    assert.ok(!/scheme=upi/i.test(code), `${path.relative(ROOT, f)} builds an upi intent`);
  }
  const all = JSON.stringify([PROVIDERS, DEEPLINKS, ...['restaurant', 'cinema', 'supermarket', 'hotel', 'parking', 'pharmacy'].map((k) => buildServicePanel({ id: 'osm:node/2', name: 'X', lat: 17.44, lng: 78.48, tags: k === 'supermarket' ? { shop: k } : k === 'hotel' ? { tourism: k } : { amenity: k } }, { online: true }))]);
  assert.ok(!/upi:/i.test(all.replace(/"upi"/g, '').replace(/UPI \(via a gateway\)/g, '')), 'no upi: link in data');
});
