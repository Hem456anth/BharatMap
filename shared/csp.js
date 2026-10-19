// Content-Security-Policy shared by the server (HTTP header) and the app shell (<meta> in web/index.html,
// used by the Android app which has no server). connect-src lists ONLY the services the app calls:
//   tiles.openfreemap.org      vector tiles, styles, fonts, sprites (online map)
//   overpass-api.de            real POIs for category search / overlays (OSM)
//   nominatim.openstreetmap.org  search + reverse geocoding (OSM)
//   photon.komoot.io           type-ahead geocoding (OSM)
//   routing.openstreetmap.de   OSRM routing (car / bike / foot) for directions + navigation
//   api.openstreetmap.org     v0.5 "Report a map problem": anonymous OpenStreetMap notes (POST /api/0.6/notes)
//   valhalla1.openstreetmap.de Valhalla routing (motor_scooter two-wheeler, avoid tolls/highways) when no Bharat Map server is set
//   api.razorpay.com, lumberjack.razorpay.com  payments (only when the server enables Razorpay)
//   sdk.cashfree.com, *.cashfree.com, secure(stage).paytmpayments.com   v0.7 payment gateways (only used when the server enables them)
//   *.onrender.com             the documented backend host (render.yaml); other backends are added at build time
// `npm test` checks that web/index.html carries exactly cspString().
export const THIRD_PARTY_HOSTS = ['https://tiles.openfreemap.org', 'https://overpass-api.de', 'https://nominatim.openstreetmap.org', 'https://photon.komoot.io', 'https://routing.openstreetmap.de', 'https://valhalla1.openstreetmap.de', 'https://api.openstreetmap.org'];
export function cspString({ extraConnect = [] } = {}) {
  return [
    "default-src 'self'",
    "script-src 'self' https://checkout.razorpay.com https://sdk.cashfree.com https://secure.paytmpayments.com https://securestage.paytmpayments.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://secure.paytmpayments.com https://securestage.paytmpayments.com",
    `connect-src 'self' ${[...THIRD_PARTY_HOSTS, 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://api.cashfree.com', 'https://sandbox.cashfree.com', 'https://secure.paytmpayments.com', 'https://securestage.paytmpayments.com', 'https://*.onrender.com', ...extraConnect].join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.cashfree.com https://sandbox.cashfree.com https://secure.paytmpayments.com https://securestage.paytmpayments.com",
  ].join('; ');
}
