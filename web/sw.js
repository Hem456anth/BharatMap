// Offline support: app shell is cache-first; map tiles/styles are stale-while-revalidate
// so areas you've viewed keep rendering offline. Full offline regions for the pilot cities ship as PMTiles in web/offline/ (see offline-map.js).
const SHELL = 'mapos-shell-v2', TILES = 'mapos-tiles-v1', MAX_TILES = 3000;
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/mock-api.js', '/config.js', '/native.js', '/admin.js', '/offline-map.js', '/vendor/offline-deps.mjs', '/offline/regions.json', '/manifest.webmanifest', '/icon.svg',
  '/shared/geo.js', '/shared/i18n.js', '/shared/seed.js', '/shared/search.js', '/shared/address.js', '/shared/logistics.js', '/shared/storage.js', '/vendor/maplibre-gl.mjs', '/vendor/maplibre-gl-worker.mjs', '/vendor/maplibre-gl.css'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
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
