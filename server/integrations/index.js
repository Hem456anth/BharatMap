// Server-side adapter registry. Every provider in shared/services/catalog.js gets an adapter entry
// { id, name, domain, class, ops, auth, status: live | partner-pending | link-out | unavailable, configured, env }.
// Credentials stay server-only (env); /api/v1/integrations exposes status, never keys. Adapters that actually DO
// something here: osm, hmrl-gtfs (transit), ocm (EV, via server/providers), uber (deep link with UBER_CLIENT_ID),
// ola (affiliate token), ondc-* (prototype, ONDC_PROTOTYPE=1), traffic (TomTom/HERE tile proxy), india-post pincode,
// shiprocket/delhivery (partner-pending stubs that refuse to run), payments (server/payments/).
import { PROVIDERS, statusOf } from '../../shared/services/catalog.js';

/** Adapter specifics layered on top of the catalogue (ops, auth, env vars and whether config switches them on). */
const SPEC = {
  uber: { ops: ['deeplink'], auth: 'client_id (public, from server config)', env: ['UBER_CLIENT_ID'] },
  ola: { ops: ['deeplink'], auth: 'Ola affiliate X-APP token', env: ['OLA_XAPP_TOKEN'], upgrade: (env) => (env.OLA_XAPP_TOKEN ? 'deeplink' : null) },
  swiggy: { ops: ['search-link'], auth: 'OAuth 2.1 + PKCE (Builders Club, invite)', env: ['SWIGGY_MCP_CLIENT_ID'] },
  zepto: { ops: ['home-link'], auth: 'OAuth (consumer MCP)', env: [] },
  'ondc-food': { ops: ['search', 'select', 'init', 'confirm', 'status', 'track'], auth: 'ONDC registry subscription + ed25519 signing', env: ['ONDC_PROTOTYPE', 'ONDC_BAP_ID', 'ONDC_SIGNING_KEY'], upgrade: (env) => (env.ONDC_PROTOTYPE === '1' ? 'prototype' : null) },
  'ondc-retail': { ops: ['search', 'select', 'init', 'confirm', 'status', 'track'], auth: 'ONDC registry subscription + ed25519 signing', env: ['ONDC_PROTOTYPE', 'ONDC_BAP_ID', 'ONDC_SIGNING_KEY'], upgrade: (env) => (env.ONDC_PROTOTYPE === '1' ? 'prototype' : null) },
  'ondc-metro': { ops: ['coverage'], auth: 'ONDC registry subscription + signing', env: ['ONDC_PROTOTYPE'], upgrade: (env) => (env.ONDC_PROTOTYPE === '1' ? 'prototype' : null) },
  'ondc-mobility': { ops: ['search', 'confirm', 'track'], auth: 'ONDC registry subscription + signing', env: ['ONDC_BAP_ID'] },
  ocm: { ops: ['nearby', 'status'], auth: 'API key (X-API-Key)', env: ['OCM_API_KEY'] },
  'metro-hyderabad': { ops: ['departures', 'plan', 'lines', 'fares'], auth: 'none (bundled GTFS)', env: ['TRANSIT_FEEDS_DIR'] },
  'india-post': { ops: ['pincode', 'digipin', 'tracking-link'], auth: 'none offline; data.gov.in key for the live directory', env: ['DATAGOVIN_API_KEY', 'DATAGOVIN_PINCODE_RESOURCE'] },
  shiprocket: { ops: ['quote', 'create', 'track'], auth: 'API user email + password → JWT', env: ['SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD'], stub: true },
  delhivery: { ops: ['serviceability', 'create', 'track'], auth: 'static API token', env: ['DELHIVERY_TOKEN'], stub: true },
  razorpay: { ops: ['order', 'verify', 'webhook'], auth: 'key id + secret (server)', env: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] },
  cashfree: { ops: ['order', 'verify', 'webhook'], auth: 'app id + secret (server)', env: ['CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY'] },
  'phonepe-pg': { ops: ['order', 'verify', 'webhook'], auth: 'OAuth client credentials (server)', env: ['PHONEPE_CLIENT_ID', 'PHONEPE_CLIENT_SECRET'] },
  'paytm-pg': { ops: ['order', 'verify', 'webhook'], auth: 'MID + merchant key (server)', env: ['PAYTM_MID', 'PAYTM_MERCHANT_KEY'] },
  nhai: { ops: ['toll-plazas-on-route'], auth: 'none (OSM)', env: [] },
  'demo-shop': { ops: ['catalogue', 'order', 'track'], auth: 'Bharat account', env: [] },
};

/** Live traffic: only when TRAFFIC_PROVIDER + its key are set. */
export function trafficConfig(env = process.env) {
  const p = String(env.TRAFFIC_PROVIDER || '').toLowerCase();
  if (p === 'tomtom' && env.TOMTOM_API_KEY) return { provider: 'tomtom', name: 'TomTom Traffic', tiles: (z, x, y) => `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${z}/${x}/${y}.png?key=${encodeURIComponent(env.TOMTOM_API_KEY)}`, attribution: '© TomTom' };
  if (p === 'here' && env.HERE_API_KEY) return { provider: 'here', name: 'HERE Traffic', tiles: (z, x, y) => `https://traffic.maps.hereapi.com/v3/flow/mc/${z}/${x}/${y}/png?apiKey=${encodeURIComponent(env.HERE_API_KEY)}`, attribution: '© HERE' };
  return null;
}

export function createIntegrations({ env = process.env, payments = null } = {}) {
  const has = (k) => !!env[k];
  const list = PROVIDERS.map((p) => {
    const sp = SPEC[p.id] || {};
    let cls = p.class;
    const up = sp.upgrade?.(env);
    if (up) cls = up;
    if (p.domain === 'payments' && payments) { const g = payments.get(p.id.replace('-pg', '')); if (g && !g.enabled && cls !== 'unavailable' && p.id !== 'upi') cls = 'partner-pending'; }
    const configured = (sp.env || []).length ? (sp.env || []).filter((k) => k !== 'TRANSIT_FEEDS_DIR').some(has) || p.id === 'metro-hyderabad' : null;
    return {
      id: p.id, name: p.name, domain: p.domain, class: cls, status: statusOf({ class: cls }), ops: sp.ops || (p.url ? ['link-out'] : []), auth: sp.auth || (p.url ? 'none (public page)' : 'n/a'),
      env: sp.env || [], configured, stub: !!sp.stub, url: p.url, verified_link: p.verified, evidence: p.evidence, reason: p.reason, ticketing: p.ticketing || null, city: p.city || null,
    };
  });
  const t = trafficConfig(env);
  list.push({ id: 'traffic', name: t ? t.name : 'Live traffic (TomTom / HERE)', domain: 'maps', class: t ? 'functional' : 'unavailable', status: t ? 'live' : 'unavailable', ops: ['tiles'], auth: 'API key (server-side tile proxy)', env: ['TRAFFIC_PROVIDER', 'TOMTOM_API_KEY', 'HERE_API_KEY'], configured: !!t, reason: t ? `Live traffic tiles from ${t.name} via /api/v1/traffic/tiles (key never leaves the server)` : 'No TRAFFIC_PROVIDER key configured: the app shows "Live traffic unavailable"' });
  return {
    list: () => list,
    get: (id) => list.find((x) => x.id === id) || null,
    /** Public client config: no secrets (the Uber client_id is a public identifier by design). */
    clientConfig: () => ({ uberClientId: env.UBER_CLIENT_ID || '', olaXappToken: env.OLA_XAPP_TOKEN || '', ondcPrototype: env.ONDC_PROTOTYPE === '1', ocmLive: !!env.OCM_API_KEY, showtimesFeed: !!env.SHOWTIMES_FEED_URL, traffic: t ? { provider: t.provider, name: t.name, attribution: t.attribution } : null }),
    traffic: t,
  };
}

/** Partner-pending stub: refuses to run and says what is missing (never pretends to quote or ship). */
export function stubAdapter(id, env = process.env) {
  const sp = SPEC[id] || {};
  return { id, run() { const missing = (sp.env || []).filter((k) => !env[k]); const e = new Error(missing.length ? `partner_pending:${id}:missing_${missing.join(',')}` : `partner_pending:${id}:adapter_not_implemented`); e.code = 501; throw e; } };
}
