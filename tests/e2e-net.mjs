// Request-interception layer for browser E2E: the CI/sandbox browser has no internet, so calls to
// Overpass / OSRM / Nominatim / Photon are answered from real captured fixtures (tests/fixtures).
// Every other third-party request is aborted, so a test never silently depends on the network.
import fs from 'node:fs';
import { decodePolyline } from '../shared/polyline.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8');
const CAT_FIXTURE = [
  [/toll_booth/, 'overpass-tolls-dwarakanagar-anakapalli'],
  [/amenity"="fuel/, 'overpass-fuel-dwarakanagar'], [/charging_station/, 'overpass-ev-dwarakanagar'], [/amenity"="parking/, 'overpass-parking-dwarakanagar'],
  [/railway"~"\^\(station\|halt\)/, 'overpass-rail-dwarakanagar'], [/subway/, 'overpass-metro-ameerpet'], [/bus_stop/, 'overpass-bus-dwarakanagar'],
];

export async function installNetworkFixtures(ctx, { log = [], fail = {}, roadHints = false } = {}) {
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body });
  await ctx.route(/^https:\/\/overpass-api\.de\//, async (route) => {
    const body = decodeURIComponent(route.request().postData() || '').replace(/^data=/, '');
    log.push(`overpass ${body.slice(0, 80)}`);
    if (fail.overpass) return route.abort('internetdisconnected');
    // v0.6 road-hint queries (conditional / bridge / service / lanes=1 / width, or the full corridor fallback).
    if (/conditional|highway"~"\^\(motorway/.test(body)) {
      log.push('overpass roadhints');
      if (!roadHints) return json(route, '{"version":0.6,"elements":[]}');
      // NH16 route to Anakapalli: real captured tags; the RK Beach route: the labelled SYNTHETIC restriction fixture.
      return json(route, fx(/,83\.0\d/.test(body) ? 'overpass-roadhints-dwarakanagar-anakapalli' : 'overpass-roadhints-synthetic-rkbeach'));
    }
    const hit = CAT_FIXTURE.find(([re]) => re.test(body));
    // Metro query around Vizag returns the (real) empty result; around Hyderabad the Ameerpet fixture.
    if (hit && hit[1] === 'overpass-metro-ameerpet' && /\(17\.7/.test(body)) return json(route, '{"version":0.6,"elements":[]}');
    return json(route, hit ? fx(hit[1]) : '{"version":0.6,"elements":[]}');
  });
  await ctx.route(/^https:\/\/routing\.openstreetmap\.de\//, (route) => {
    const u = route.request().url(); log.push(`osrm ${u.split('/')[3]}`);
    if (fail.routing) return route.abort('internetdisconnected');
    if (/77\.62/.test(u)) return json(route, fx('osrm-drive-silkboard-ecity'));
    return json(route, fx(/routed-foot/.test(u) ? 'osrm-walk-dwarakanagar-rkbeach' : /routed-bike/.test(u) ? 'osrm-bike-dwarakanagar-rkbeach' : /83\.0037/.test(u) ? 'osrm-drive-dwarakanagar-anakapalli' : 'osrm-drive-dwarakanagar-rkbeach'));
  });
  // FOSSGIS Valhalla (two-wheeler motor_scooter; avoid tolls/highways) — real captured response.
  await ctx.route(/^https:\/\/valhalla1\.openstreetmap\.de\//, (route) => {
    const u = decodeURIComponent(route.request().url()); const costing = (u.match(/"costing":"(\w+)"/) || [])[1];
    if (/trace_attributes/.test(u) && /edge\.bridge/.test(u)) {
      log.push('valhalla trace_attributes roadhints');
      if (fail.valhalla || !roadHints) return json(route, '{"edges":[],"units":"kilometers"}');
      let last = null; try { const pts = decodePolyline(JSON.parse(u.slice(u.indexOf('json=') + 5)).encoded_polyline, 6); last = pts[pts.length - 1]; } catch { /* ignore */ }
      return json(route, last && last[0] < 83.05 ? fx('valhalla-roadhints-dwarakanagar-anakapalli') : '{"edges":[],"units":"kilometers"}');
    }
    if (/trace_attributes/.test(u)) {
      log.push('valhalla trace_attributes');
      if (fail.valhalla) return route.abort('internetdisconnected');
      // Only the captured Bengaluru route has a real trace fixture; elsewhere answer "no edges" (limits stay unknown).
      let first = null; try { first = decodePolyline(JSON.parse(u.slice(u.indexOf('json=') + 5)).encoded_polyline, 6)[0]; } catch { /* ignore */ }
      return json(route, first && first[0] > 77 && first[0] < 78 ? fx('valhalla-trace-silkboard-ecity') : '{"edges":[],"units":"kilometers"}');
    }
    log.push(`valhalla ${costing}`);
    if (fail.routing || fail.valhalla) return route.abort('internetdisconnected');
    return json(route, fx('valhalla-two-dwarakanagar-rkbeach'));
  });
  await ctx.route(/^https:\/\/nominatim\.openstreetmap\.org\//, (route) => {
    const u = route.request().url(); log.push(`nominatim ${u.includes('/reverse') ? 'reverse' : 'search'}`);
    if (fail.nominatim) return route.abort('internetdisconnected');
    return json(route, fx(u.includes('/reverse') ? 'nominatim-reverse-dwarakanagar' : 'nominatim-search-kailasagiri'));
  });
  // v0.5 OpenStreetMap Notes API — MOCKED (never create real notes from tests): echoes a note id like the real API.
  await ctx.route(/^https:\/\/api\.openstreetmap\.org\/api\/0\.6\/notes/, (route) => {
    const body = route.request().postData() || ''; log.push(`osmnote ${decodeURIComponent(body).slice(0, 120)}`);
    if (fail.osm) return route.abort('internetdisconnected');
    return json(route, JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: [83.323, 17.714] }, properties: { id: 4242, status: 'open', mocked: true } }));
  });
  await ctx.route(/^https:\/\/photon\.komoot\.io\//, (route) => { log.push('photon'); return fail.photon ? route.abort() : json(route, fx('photon-kailasa')); });
  // Anything else that is not our own server (or the server's same-origin tile proxy) is blocked.
  await ctx.route((url) => !/^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|data:|blob:|file:)/.test(url.href) && !/overpass-api|routing\.openstreetmap|valhalla1\.openstreetmap|nominatim\.openstreetmap|photon\.komoot|api\.openstreetmap\.org/.test(url.host), (route) => { log.push(`blocked ${route.request().url().slice(0, 60)}`); return route.abort('blockedbyclient'); });
  if (fail.tiles) await ctx.route(/\/map\/(style\.json|ofm\/)/, (route) => route.abort('internetdisconnected'));
}

/** Records speechSynthesis utterances instead of speaking (headless has no audio). */
export const SPEECH_STUB = `(() => {
  window.__spoken = [];
  const voices = [{ lang: 'en-IN', name: 'stub en-IN', voiceURI: 'stub-en-IN', default: true }, { lang: 'hi-IN', name: 'stub hi-IN', voiceURI: 'stub-hi-IN' }, { lang: 'te-IN', name: 'stub te-IN', voiceURI: 'stub-te-IN' }, { lang: 'ta-IN', name: 'stub ta-IN', voiceURI: 'stub-ta-IN' }, { lang: 'fr-FR', name: 'stub fr-FR', voiceURI: 'stub-fr-FR' }];
  const s = { speak: (u) => window.__spoken.push({ text: u.text, lang: u.lang, voice: u.voice ? u.voice.name : null }), cancel: () => {}, getVoices: () => voices, pause() {}, resume() {}, addEventListener() {}, speaking: false, pending: false };
  Object.defineProperty(window, 'speechSynthesis', { value: s, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();`;
