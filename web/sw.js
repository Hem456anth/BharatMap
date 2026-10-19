// Offline support: app shell is cache-first; map tiles/styles are stale-while-revalidate
// so areas you've viewed keep rendering offline. Full offline regions for the pilot cities ship as PMTiles in web/offline/ (see offline-map.js).
const SHELL = 'bharatmap-shell-v0.7', TILES = 'mapos-tiles-v1', MAX_TILES = 3000;
const ASSETS = ["/", "/index.html", "/styles.css", "/app.js", "/shell.js", "/boot-theme.js", "/mock-api.js", "/config.js", "/native.js", "/admin.js", "/offline-map.js", "/vendor/offline-deps.mjs", "/offline/regions.json", "/manifest.webmanifest", "/icon.svg", "/ui/controls.js", "/ui/directions.js", "/ui/icons.js", "/ui/panels.js", "/ui/place.js", "/ui/saved.js", "/ui/search.js", "/ui/sheet-math.js", "/ui/sheet.js", "/nav/maneuver.js", "/nav/navigation.js", "/nav/tracker.js", "/nav/voice.js", "/map/camera.js", "/map/style.js", "/services/geocode.js", "/services/net.js", "/services/overpass.js", "/services/routing.js", "/lib/opening-hours.js", "/lib/saved-model.js", "/shared/geo.js", "/shared/i18n.js", "/shared/seed.js", "/shared/search.js", "/shared/address.js", "/shared/logistics.js", "/shared/storage.js", "/shared/csp.js", "/vendor/maplibre-gl.mjs", "/vendor/maplibre-gl-worker.mjs", "/vendor/maplibre-gl.css", "/nav/background.js", "/services/server.js", "/services/tolls.js", "/services/transit.js", "/map/prefetch.js", "/lib/bandwidth.js", "/lib/region-manager.js", "/shared/ev.js", "/shared/i18n-v04.js", "/shared/polyline.js", "/shared/tolls.js", "/shared/valhalla.js", "/shared/transit/pack.js", "/shared/transit/raptor.js", "/offline/catalog.json", "/transit/index.json", "/transit/hmrl.json", "/lib/device-tier.js", "/lib/offline-search.js", "/shared/translit.js", "/shared/search-index.js", "/shared/roadhints.js", "/services/roadhints.js", "/shared/i18n-v06.js", "/nav/voices.js", "/shared/i18n-v07.js", "/ui/service-panel.js", "/ui/linkout.js", "/ui/payment.js", "/ui/ondc.js", "/ui/traffic.js", "/services/providers/index.js", "/services/also-here.js", "/shared/services/build.js", "/shared/services/catalog.js", "/shared/services/labels.js", "/shared/services/linkouts.js", "/shared/services/panel-types.js", "/shared/services/departures.js", "/shared/services/also-here.js"];
self.addEventListener('install', (e) => e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('mapos-shell') || (k.startsWith('bharatmap-shell') && k !== SHELL)).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if (u.hostname.endsWith('openfreemap.org') || u.hostname === 'unpkg.com') {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(async (r) => { if (r.ok) { c.put(e.request, r.clone()); const keys = await c.keys(); if (keys.length > MAX_TILES) c.delete(keys[0]); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (u.origin === location.origin) e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
