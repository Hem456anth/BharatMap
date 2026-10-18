// Request-interception layer for browser E2E: the CI/sandbox browser has no internet, so calls to
// Overpass / OSRM / Nominatim / Photon are answered from real captured fixtures (tests/fixtures).
// Every other third-party request is aborted, so a test never silently depends on the network.
import fs from 'node:fs';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8');
const CAT_FIXTURE = [
  [/amenity"="fuel/, 'overpass-fuel-dwarakanagar'], [/charging_station/, 'overpass-ev-dwarakanagar'], [/amenity"="parking/, 'overpass-parking-dwarakanagar'],
  [/railway"~"\^\(station\|halt\)/, 'overpass-rail-dwarakanagar'], [/subway/, 'overpass-metro-ameerpet'], [/bus_stop/, 'overpass-bus-dwarakanagar'],
];

export async function installNetworkFixtures(ctx, { log = [], fail = {} } = {}) {
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body });
  await ctx.route(/^https:\/\/overpass-api\.de\//, async (route) => {
    const body = decodeURIComponent(route.request().postData() || '').replace(/^data=/, '');
    log.push(`overpass ${body.slice(0, 80)}`);
    if (fail.overpass) return route.abort('internetdisconnected');
    const hit = CAT_FIXTURE.find(([re]) => re.test(body));
    // Metro query around Vizag returns the (real) empty result; around Hyderabad the Ameerpet fixture.
    if (hit && hit[1] === 'overpass-metro-ameerpet' && /\(17\.7/.test(body)) return json(route, '{"version":0.6,"elements":[]}');
    return json(route, hit ? fx(hit[1]) : '{"version":0.6,"elements":[]}');
  });
  await ctx.route(/^https:\/\/routing\.openstreetmap\.de\//, (route) => {
    const u = route.request().url(); log.push(`osrm ${u.split('/')[3]}`);
    if (fail.routing) return route.abort('internetdisconnected');
    return json(route, fx(/routed-foot/.test(u) ? 'osrm-walk-dwarakanagar-rkbeach' : /routed-bike/.test(u) ? 'osrm-bike-dwarakanagar-rkbeach' : 'osrm-drive-dwarakanagar-rkbeach'));
  });
  await ctx.route(/^https:\/\/nominatim\.openstreetmap\.org\//, (route) => {
    const u = route.request().url(); log.push(`nominatim ${u.includes('/reverse') ? 'reverse' : 'search'}`);
    if (fail.nominatim) return route.abort('internetdisconnected');
    return json(route, fx(u.includes('/reverse') ? 'nominatim-reverse-dwarakanagar' : 'nominatim-search-kailasagiri'));
  });
  await ctx.route(/^https:\/\/photon\.komoot\.io\//, (route) => { log.push('photon'); return fail.photon ? route.abort() : json(route, fx('photon-kailasa')); });
  // Anything else that is not our own server (or the server's same-origin tile proxy) is blocked.
  await ctx.route((url) => !/^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|data:|blob:|file:)/.test(url.href) && !/overpass-api|routing\.openstreetmap|nominatim\.openstreetmap|photon\.komoot/.test(url.host), (route) => { log.push(`blocked ${route.request().url().slice(0, 60)}`); return route.abort('blockedbyclient'); });
  if (fail.tiles) await ctx.route(/\/map\/(style\.json|ofm\/)/, (route) => route.abort('internetdisconnected'));
}

/** Records speechSynthesis utterances instead of speaking (headless has no audio). */
export const SPEECH_STUB = `(() => {
  window.__spoken = [];
  const voices = [{ lang: 'en-IN', name: 'stub en-IN', default: true }, { lang: 'hi-IN', name: 'stub hi-IN' }, { lang: 'te-IN', name: 'stub te-IN' }];
  const s = { speak: (u) => window.__spoken.push({ text: u.text, lang: u.lang }), cancel: () => {}, getVoices: () => voices, pause() {}, resume() {}, addEventListener() {}, speaking: false, pending: false };
  Object.defineProperty(window, 'speechSynthesis', { value: s, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();`;
