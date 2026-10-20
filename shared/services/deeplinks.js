// App deep links, from the user-supplied APKs (docs/re/DEEPLINKS.md, data/deeplinks/apk-manifest-links.json).
// Interoperability only: every entry below is backed by the app's AndroidManifest intent-filters (VIEW + BROWSABLE),
// the signer certificate of the APK we were given, and — for https App Links — the site's own
// /.well-known/assetlinks.json listing that package with that certificate (checked 20 Oct 2026).
//
// type (what kind of hand-off this is):
//   documented  the provider publishes developer docs for the link format (Uber universal links). Only these may
//               carry context such as pickup/drop.
//   applink     an https URL on a domain the app declares with android:autoVerify AND the site's assetlinks.json
//               names the package + certificate: opens the app when installed, otherwise the same page on the web.
//               We only use a path the manifest declares, and NO query parameters (none are documented).
//   declared    a custom-scheme entry point seen only in the manifest (params unknown). Built as an Android intent
//               URL with package= and S.browser_fallback_url=<official https>, so it opens the app's home screen or
//               the official website. Labelled Unverified in the interstitial.
//   none        no deep link is built (payments apps: UPI is only used inside a gateway checkout; not-in-India apps).
// Never: upi:// (or any payment scheme), guessed parameters, item/price/fare URLs.

/** Manifest facts of the APKs analysed (package → version, signer cert SHA-256). Checked against the JSON by tests. */
export const APPS = {
  'com.ubercab': { app: 'Uber', version: '4.652.10004', cert: '4003231ab42feb8d955e62fdfaa4fad59567054b9c6bbc3d950299ddfc268392' },
  'in.swiggy.android': { app: 'Swiggy', version: '4.119.1', cert: '402d9c9c97a0a8a5821a5dee526941f1929a72c6cfafef153b9602c6e9e15904' },
  'com.application.zomato': { app: 'Zomato', version: '19.9.6', cert: '37722d88cc9f04f83ff7beca291858e5b0cea8d39250d12932b389ffa6313845' },
  'com.application.zomato.district': { app: 'District', version: '2.75.0', cert: 'a81d49ec84db1b0a939cb49d5464071ea1ff66d6c44999359986d0dbde0a6011' },
  'com.bt.bms': { app: 'BookMyShow', version: '18.2.8', cert: 'd016b5d6df662c7ae92ba56805084cb242c111bd29dc4785a9dfd2254a9c1170' },
  'com.grofers.customerapp': { app: 'Blinkit', version: '18.39.0', cert: 'b4d580bd0ce35d980c150be0e260eac60027983a83bd698fe48a65ebee2859d4' },
  'com.rapido.passenger': { app: 'Rapido', version: '8.130.0', cert: '433534d070c7bda70ef11f60d46574fd1fc77c61d7debdd49db3a5a78d3dc075' },
  'com.agoda.mobile.consumer': { app: 'Agoda', version: '14.38.0', cert: '957755b4adada734e6bcfb0eea1a079f544e6f8ef287a24af839212f10138e1c' },
  'com.makemytrip': { app: 'MakeMyTrip', version: '11.9.1', cert: '178563ed8eca0f4f108be18e2f7e266d524124141118fd208711dbfbf6061e62' },
  'com.ovunque.parkwheels': { app: 'Park+', version: '6.2.79', cert: '8f21157e14aa3d32e7632f0e2d2e9d0b5bbc9d39c8266aac27e9ab6f032c87be' },
  'com.apollo.patientapp': { app: 'Apollo 24|7', version: '9.9.1', cert: '201b1de1a515f9178191fba48a4712b8f0859d36e745f7b0b0e7a1e407213475' },
  'com.aranoah.healthkart.plus': { app: 'Tata 1mg', version: '20.7.0', cert: '2e4e0fcbf92adab3aadc6b58ed194d01bdc4243fdecee68609f6a5c2a008ba2a' },
  'com.phonepe.app': { app: 'PhonePe', version: '26.09.25.0', cert: '5335bc4961580b2e39cfe661355386636840686ad00b8dc16061d22236aa7d13' },
  'com.google.android.apps.nbu.paisa.user': { app: 'Google Pay', version: '352.1.1', cert: 'c17b8e3e427bfcd99cc65ec24ff53ae917424292d723615b74636468e3223c0b' },
  'net.easypark.android': { app: 'EasyPark', version: '26.40.1', cert: '0639fa559a0571df5d38d716dd670757043033cdd5e719150f3cb87270fa4cfc' },
};

const ASSET_CHECK = 'assetlinks.json lists the package + APK signer cert (checked 20 Oct 2026)';
/**
 * Deep link per catalogue provider id. `manifest` names the declaring filter so docs/tests can trace it:
 *   { host, path|pathPrefix|pathPattern, autoVerify } for App Links, { scheme, host } for declared custom schemes.
 */
export const DEEPLINKS = {
  uber: { pkg: 'com.ubercab', type: 'documented', url: 'https://m.uber.com/ul/', fallback: 'https://m.uber.com/', prefill: ['pickup lat/lng + nickname', 'drop lat/lng + nickname + address'],
    doc: 'https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction', manifest: { host: 'm.uber.com', pathPrefix: '/ul/', autoVerify: true }, evidence: `Uber developer docs; ${ASSET_CHECK} (m.uber.com)` },
  swiggy: { pkg: 'in.swiggy.android', type: 'applink', url: 'https://www.swiggy.com/', prefill: [], manifest: { host: 'www.swiggy.com', pathPattern: '/', autoVerify: true }, evidence: `${ASSET_CHECK} (www.swiggy.com)` },
  instamart: { pkg: 'in.swiggy.android', type: 'applink', url: 'https://www.swiggy.com/instamart', prefill: [], manifest: { host: 'www.swiggy.com', pathPattern: '/instamart', autoVerify: true }, evidence: `${ASSET_CHECK} (www.swiggy.com)` },
  dineout: { pkg: 'in.swiggy.android', type: 'applink', url: 'https://www.swiggy.com/dineout', prefill: [], manifest: { host: 'www.swiggy.com', pathPattern: '/dineout', autoVerify: true }, evidence: `${ASSET_CHECK} (www.swiggy.com)` },
  zomato: { pkg: 'com.application.zomato', type: 'applink', url: 'https://www.zomato.com/', prefill: [], manifest: { host: 'www.zomato.com', path: '(any)', autoVerify: true }, evidence: `${ASSET_CHECK} (www.zomato.com)` },
  bookmyshow: { pkg: 'com.bt.bms', type: 'applink', url: 'https://in.bookmyshow.com/', prefill: [], manifest: { host: 'in.bookmyshow.com', path: '(any)', autoVerify: true }, evidence: `${ASSET_CHECK} (in.bookmyshow.com)` },
  district: { pkg: 'com.application.zomato.district', type: 'applink', url: 'https://www.district.in/movies/', prefill: [], manifest: { host: 'www.district.in', path: '(any)', autoVerify: true }, evidence: `${ASSET_CHECK} (www.district.in)` },
  blinkit: { pkg: 'com.grofers.customerapp', type: 'applink', url: 'https://blinkit.com/', prefill: [], manifest: { host: 'blinkit.com', path: '/', autoVerify: true }, evidence: `${ASSET_CHECK} (blinkit.com)` },
  agoda: { pkg: 'com.agoda.mobile.consumer', type: 'applink', url: 'https://www.agoda.com/', prefill: [], manifest: { host: 'www.agoda.com', pathPattern: '/', autoVerify: true }, evidence: `${ASSET_CHECK} (www.agoda.com); /en-in/ is NOT a declared path, so the root is used` },
  makemytrip: { pkg: 'com.makemytrip', type: 'applink', url: 'https://www.makemytrip.com/hotels/', prefill: [], manifest: { host: 'www.makemytrip.com', pathPrefix: '/hotels', autoVerify: true }, evidence: `${ASSET_CHECK} (www.makemytrip.com)` },
  parkplus: { pkg: 'com.ovunque.parkwheels', type: 'applink', url: 'https://parkplus.io/parking', prefill: [], manifest: { host: 'parkplus.io', pathPrefix: '/parking', autoVerify: true }, evidence: `${ASSET_CHECK} (parkplus.io); /home is declared too but 404s on the web, so /parking is used` },
  'apollo-247': { pkg: 'com.apollo.patientapp', type: 'applink', url: 'https://www.apollo247.com/doctors', prefill: [], manifest: { host: 'www.apollo247.com', pathPrefix: '/doctors', autoVerify: true }, evidence: `${ASSET_CHECK} (www.apollo247.com); the root path is not declared` },
  'apollo-pharmacy': { pkg: 'com.apollo.patientapp', type: 'applink', url: 'https://www.apollopharmacy.in/search-medicines', prefill: [], manifest: { host: 'www.apollopharmacy.in', pathPrefix: '/search-medicines', autoVerify: true }, evidence: `${ASSET_CHECK} (www.apollopharmacy.in); handled by the Apollo 24|7 app` },
  'tata-1mg': { pkg: 'com.aranoah.healthkart.plus', type: 'applink', url: 'https://www.1mg.com/search/all', prefill: [], manifest: { host: '*.1mg.com', pathPrefix: '/search/all', autoVerify: true }, evidence: `${ASSET_CHECK} (1mg.com, www.1mg.com); the root path is not declared` },
  rapido: { pkg: 'com.rapido.passenger', type: 'declared', scheme: 'rapido', host: 'open', fallback: 'https://www.rapido.bike/', prefill: [], manifest: { scheme: 'rapido', host: 'open', autoVerify: false },
    evidence: 'Manifest only (rapido://open on SplashActivity). No public Rapido developer docs; www.rapido.bike is not an App Link (http-only filter, no autoVerify) — opens the app home, no pickup/drop' },
  'phonepe-pg': { pkg: 'com.phonepe.app', type: 'none', reason: 'Payments run only inside a gateway checkout (server/payments/). The app declares UPI and PhonePe payment schemes; Bharat Map never builds links to them' },
  'google-pay': { pkg: 'com.google.android.apps.nbu.paisa.user', type: 'none', reason: 'UPI-only app (UPI, gpay and tez schemes); appears as a UPI app inside the gateway checkout. No deep link is built' },
  easypark: { pkg: 'net.easypark.android', type: 'none', notInIndia: true, reason: 'Not an India service (not on the requested list); analysed only, never linked' },
};

const FORBIDDEN_SCHEMES = /^(upi|upiglobal|ppe|phonepe|paytmmp|tez|gpay|bbps|bharatconnect|upimeta|javascript|data|file|content|intent)$/i;
const enc = (s) => encodeURIComponent(s);
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const isHttps = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && !!x.host && !/\s/.test(u); } catch { return false; } };

/** Android intent URL: intent://HOST/PATH#Intent;scheme=…;package=…;S.browser_fallback_url=…;end (Chrome + our native opener). */
export function intentUrl({ scheme, host = '', path = '', pkg, fallback }) {
  if (!scheme || !/^[a-z][a-z0-9+.-]*$/i.test(scheme) || FORBIDDEN_SCHEMES.test(scheme)) throw new Error('bad_scheme');
  if (!pkg || !APPS[pkg]) throw new Error('unknown_package');
  if (!isHttps(fallback)) throw new Error('fallback_required');
  return `intent://${host}${path}#Intent;scheme=${scheme};package=${pkg};S.browser_fallback_url=${enc(fallback)};end`;
}

/** Parse an intent URL built above → { scheme, host, path, pkg, fallback } or null. */
export function parseIntentUrl(u) {
  const m = /^intent:\/\/([^#]*)#Intent;(.*);end$/.exec(String(u || ''));
  if (!m) return null;
  const kv = {};
  for (const part of m[2].split(';')) { const i = part.indexOf('='); if (i > 0) kv[part.slice(0, i)] = part.slice(i + 1); }
  let fallback = '';
  try { fallback = decodeURIComponent(kv['S.browser_fallback_url'] || ''); } catch { return null; }
  const hp = m[1]; const slash = hp.indexOf('/');
  return { scheme: kv.scheme || '', host: slash < 0 ? hp : hp.slice(0, slash), path: slash < 0 ? '' : hp.slice(slash), pkg: kv.package || '', fallback, extra: Object.keys(kv).filter((k) => !['scheme', 'package', 'S.browser_fallback_url'].includes(k)) };
}

/** An intent URL is safe when it targets a known package with one of ITS declared schemes, has an https fallback, and nothing else. */
export function safeIntent(u) {
  const p = parseIntentUrl(u);
  if (!p || p.extra.length || !APPS[p.pkg] || !p.scheme || FORBIDDEN_SCHEMES.test(p.scheme) || !isHttps(p.fallback)) return false;
  return Object.values(DEEPLINKS).some((d) => d.type === 'declared' && d.pkg === p.pkg && d.scheme === p.scheme && (d.host || '') === p.host);
}

/**
 * Link object for a provider's app hand-off ({ provider, host, url, kind, verified, note, deeplink }) or null.
 *   url       what Bharat opens: the https App Link / documented link, or the intent URL for declared entry points
 *   deeplink  { type, package, app, fallbackUrl, prefill, evidence, doc? } — the interstitial shows type + fallback
 * `url` override is only accepted for the documented type (e.g. Uber with pickup/drop).
 */
export function appLink(providerId, { kind = 'linkout', url: override = null } = {}) {
  const d = DEEPLINKS[providerId];
  if (!d || d.type === 'none') return null;
  const meta = APPS[d.pkg];
  const base = { type: d.type, package: d.pkg, app: meta.app, prefill: d.prefill || [], evidence: d.evidence, ...(d.doc ? { doc: d.doc } : {}) };
  if (d.type === 'declared') {
    const url = intentUrl({ scheme: d.scheme, host: d.host || '', pkg: d.pkg, fallback: d.fallback });
    return { provider: providerId, host: hostOf(d.fallback), url, kind, verified: false, note: `Opens the ${meta.app} app (entry point declared in its manifest, parameters unknown); without the app: ${hostOf(d.fallback)}`, deeplink: { ...base, fallbackUrl: d.fallback } };
  }
  const url = d.type === 'documented' && override ? override : d.url;
  if (!isHttps(url) || hostOf(url) !== hostOf(d.url)) throw new Error('applink_host_mismatch');
  return { provider: providerId, host: hostOf(url), url, kind, verified: true, note: d.type === 'documented' ? `Documented ${meta.app} link: opens the app if installed, otherwise ${hostOf(d.fallback || url)}` : `App Link: opens the ${meta.app} app if installed, otherwise this page on ${hostOf(url)}`, deeplink: { ...base, fallbackUrl: d.fallback || url } };
}

/** Which URL to actually open on this platform: intent URLs only where Android can resolve them; elsewhere the https fallback. */
export function openUrlFor(link, { android = false } = {}) {
  if (!link?.url) return null;
  if (link.url.startsWith('intent://')) return android ? link.url : (link.deeplink?.fallbackUrl || parseIntentUrl(link.url)?.fallback || null);
  return link.url;
}

/** Interstitial label: Documented | App Link | Declared (Unverified) | null for plain web link-outs. */
export const DL_LABEL = { documented: 'lo_dl_documented', applink: 'lo_dl_applink', declared: 'lo_dl_declared' };
