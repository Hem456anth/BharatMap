// Generates docs/INTEGRATION_MATRIX.md from shared/services/catalog.js (+ server adapter specifics).
// `npm test` (tests/v07.test.js) fails if the committed file is out of date: run `node scripts/gen-integration-matrix.mjs`.
import fs from 'node:fs';
import { PROVIDERS, CLASS_LABEL, statusOf } from '../shared/services/catalog.js';
import { DEEPLINKS, APPS, appLink } from '../shared/services/deeplinks.js';

const DOMAIN = { food: 'Food', movies: 'Movies & events', grocery: 'Grocery & quick commerce', ride: 'Rides', transit: 'Transit (metro, bus, rail)', hotel: 'Hotels & stays', parking: 'Parking & tolls', fuel: 'Fuel', ev: 'EV charging', health: 'Health & emergency', courier: 'Courier & post', payments: 'Payments (server/payments/)' };
const TICKET = { ondc: 'ONDC buyer apps + official app', 'official-app': 'Official app', whatsapp: 'Official WhatsApp + app', website: 'Official website/app' };
const esc = (s) => String(s || '').replace(/\|/g, '\\|');
const DLT = { documented: 'Documented', applink: 'App Link', declared: 'Declared · Unverified', none: 'None' };
const dlCell = (p) => { const d = DEEPLINKS[p.id]; if (!d) return '—'; return d.type === 'none' ? `None${d.notInIndia ? ' (not in India)' : ''}` : `${DLT[d.type]} \`${d.pkg}\``; };
export function matrixMarkdown() {
  const counts = {}; for (const p of PROVIDERS) counts[p.class] = (counts[p.class] || 0) + 1;
  const out = [];
  out.push('# Integration matrix (generated)', '');
  out.push('Generated from `shared/services/catalog.js` by `node scripts/gen-integration-matrix.mjs`. Do not edit by hand: `npm test` checks this file is current.', '');
  out.push('Classes: **Functional** works end to end in Bharat Map · **Deep link** documented URL format hands off with context · **Prototype** adapter exists behind config, not connected to the real network / not verified live · **Partner-pending** API exists but needs a contract or approval we do not have · **Link-out** official site/app only · **Unavailable** not usable (reason shown, no link) · **Demo** Bharat\'s fictional data.', '');
  out.push('Adapter status (`GET /api/v1/integrations`): Functional/Demo → `live`, Deep link/Link-out → `link-out`, Prototype/Partner-pending → `partner-pending`, Unavailable → `unavailable`. Env-configurable upgrades (e.g. `ONDC_PROTOTYPE=1`, `OLA_XAPP_TOKEN`, payment keys, `TRAFFIC_PROVIDER`) are applied at runtime by `server/integrations/index.js`.', '');
  out.push(`Totals: ${Object.entries(CLASS_LABEL).map(([k, v]) => `${v} ${counts[k] || 0}`).join(' · ')} · **${PROVIDERS.length} providers**.`, '');
  out.push('"Link checked" = official URL confirmed from an official/primary source (docs/INTEGRATIONS.md sources or the 20 Oct 2026 check); "not re-fetched" = official domain from general knowledge, flagged as unverified in the link-out interstitial.', '');
  for (const [d, title] of Object.entries(DOMAIN)) {
    const list = PROVIDERS.filter((p) => p.domain === d); if (!list.length) continue;
    out.push(`## ${title}`, '');
    const transit = d === 'transit';
    out.push(transit ? '| Provider | Class | Status | Ticketing (official only) | Official link | Link checked | Why |' : '| Provider | Class | Status | Official link | Link checked | App deep link | Why |');
    out.push(transit ? '|---|---|---|---|---|---|---|' : '|---|---|---|---|---|---|---|');
    for (const p of list) {
      const link = p.url ? `<${p.url}>` : '—';
      const chk = !p.url ? '—' : p.verified ? 'yes' : 'not re-fetched';
      const tk = transit ? ` ${p.ticketing ? TICKET[p.ticketing] : 'Info only'} |` : '';
      out.push(`| ${esc(p.name)} | ${CLASS_LABEL[p.class]} | \`${statusOf(p)}\` |${tk} ${link} | ${chk} |${transit ? '' : ` ${dlCell(p)} |`} ${esc(p.reason)} |`);
    }
    out.push('');
  }
  out.push('## App deep links (from the user-supplied APKs)', '');
  out.push('From `shared/services/deeplinks.js`; evidence in `docs/re/DEEPLINKS.md` and `data/deeplinks/apk-manifest-links.json` (AndroidManifest intent-filters + signer certificates only). **Documented** = public developer docs (may carry context) · **App Link** = https URL on an `autoVerify` host whose `assetlinks.json` lists the package + APK certificate, declared path only, no query parameters (opens the app, else the same page on the web) · **Declared · Unverified** = custom-scheme entry point seen only in the manifest, sent as an Android intent URL with `package=` and an official https `browser_fallback_url` (opens the app home) · **None** = no link built.', '');
  out.push('| Provider | App (package, version analysed) | Type | Bharat opens | Web fallback | Prefill |', '|---|---|---|---|---|---|');
  for (const [id, d] of Object.entries(DEEPLINKS)) {
    const a = APPS[d.pkg]; const l = appLink(id);
    const opens = l ? (l.url.startsWith('intent:') ? `\`${l.url}\`` : `<${l.url}>${d.type === 'documented' ? ' + documented params' : ''}`) : '—';
    out.push(`| ${esc(id)} | ${esc(a.app)} \`${d.pkg}\` ${esc(a.version)} | ${DLT[d.type]}${d.notInIndia ? ' (not in India)' : ''} | ${opens} | ${l ? `<${l.deeplink.fallbackUrl}>` : '—'} | ${l && l.deeplink.prefill.length ? esc(l.deeplink.prefill.join('; ')) : d.type === 'none' ? esc(d.reason) : 'nothing'} |`);
  }
  out.push('');
  out.push('## Maps, traffic and platform', '');
  out.push('| Capability | Class | Notes |', '|---|---|---|');
  out.push('| OSM tiles / POIs / geocoding (OpenFreeMap, Overpass, Nominatim, Photon) | Functional | Open data with attribution; offline PMTiles + offline POI index for the pilot cities |');
  out.push('| Routing (Valhalla / OSRM) incl. **truck** costing | Functional | `GET /api/v1/route?mode=truck&truck_height=…` uses Valhalla truck costing; OSRM has no truck profile, so a truck request never falls back to a car route (straight-line Estimate instead) |');
  out.push('| Toll plazas on route | Functional | OSM `barrier=toll_booth`; **fee unknown** (no open fee data) |');
  out.push('| Live traffic (TomTom / HERE) | Unavailable unless `TRAFFIC_PROVIDER` + key | Server tile proxy `/api/v1/traffic/tiles/{z}/{x}/{y}.png` (≤ 2 min cache); otherwise the app says "Live traffic unavailable" |');
  out.push('| "Also here" (OSM containment) | Functional (online) | Overpass `is_in` → named POIs inside the same building/mall/station |');
  out.push('| Place photos (Wikidata / Commons) | Unavailable | No offline Commons fixtures in this build; no photos are shown rather than unlicensed ones |');
  out.push('| Reviews / ratings | Unavailable | No licensed source; never invented |');
  out.push('');
  return out.join('\n');
}
if (import.meta.url === `file://${process.argv[1]}`) { fs.writeFileSync(new URL('../docs/INTEGRATION_MATRIX.md', import.meta.url), matrixMarkdown()); console.log('wrote docs/INTEGRATION_MATRIX.md'); }
