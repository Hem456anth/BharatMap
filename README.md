# Bharat Map — v0.3 (map-first app + Shop, Android + web)

An India-first map app with an original identity: a calm, full-screen map with a floating search pill and a
three-height bottom sheet, real places from OpenStreetMap, route options for drive / two-wheeler / cycle / walk,
turn-by-turn voice navigation with **landmark-led instructions in English, Hindi and Telugu**, offline maps for
Visakhapatnam and Hyderabad, and a **Shop** area for the v0.2 commerce flow (product search → seller → order → rider
tracking, seller and admin dashboards).

> Status: **working prototype**. Map, search, places, routing and navigation use real open data (OpenStreetMap via
> Overpass, Nominatim, Photon, OSRM). Sellers, products and riders in Shop are **fictional demo data**. Live traffic and
> transit timetables are **not** included (they need licensed feeds). See `docs/AUDIT.md` for implemented vs prototype vs
> needs-paid-API.

## Features (v0.3)
| Area | What you get |
|---|---|
| Map-first shell | Full-screen MapLibre map · floating search pill · draggable bottom sheet (peek ~120 px / half / full) with touch drag, snap, fling, tap-to-cycle and keyboard (↑/↓, Home/End) · floating locate (follow → heading), compass (appears when rotated/tilted, resets north), layers, 2D/3D · smooth `flyTo/easeTo` that honours `prefers-reduced-motion` |
| Identity | Original "Deccan dusk" tokens (indigo brand/route, green actions, saffron location puck), light + dark themes (auto from the device, or manual in Settings), dark basemap online (OpenFreeMap dark) and offline (Protomaps dark), 48 dp targets, WCAG AA text contrast |
| Search | Autocomplete: recents (on device), 12 category chips, local landmarks / localities / pincodes / DIGIPIN / demo sellers, Photon type-ahead, Nominatim fallback, “search products in Shop” |
| Categories | Petrol, EV charging, ATM, Metro, Bus stop, Railway, Hospital, Pharmacy, Restaurant, Kirana & supermarket, Parking, Toilets — real POIs from Overpass around the map centre (bbox ≤ 8 km, cached, timeouts), list + accessible markers, “Search this area” |
| Place card | Name, category, distance, address, opening hours parsed to open/closed (raw string otherwise), phone, website, wheelchair, DIGIPIN · Directions · Save · Share (Android share sheet / Web Share / copy) · Call · “Shop here” for demo sellers · long-press / right-click drops a pin with reverse geocoding |
| Routing | FOSSGIS OSRM (`routed-car`, `routed-bike`, `routed-foot`) with up to 3 alternatives drawn (selected highlighted, tap to switch), distance / ETA / arrival time, step list. Two-wheeler uses the car graph and is labelled an estimate. Transit shows nearest metro/rail/bus stops from OSM and says live timetables are not available. Offline → straight-line estimate, labelled |
| Navigation | Full-screen mode: maneuver banner (icon, distance, instruction), next-step preview, ETA / remaining strip, follow camera with bearing + pitch, voice (Web Speech; native Android TTS) in en-IN / hi-IN / te-IN with mute, landmark instructions (“Turn left near RK Beach”) within 150 m, off-route (> 50 m for 3 fixes) → reroute, arrival detection, GPS via Capacitor `watchPosition`, and a clearly-labelled **Simulate drive** |
| Saved | Home, Work, Favourites and custom lists (on device; synced to `/api/me/places` when signed in to a server), quick Home/Work directions |
| Layers | Map style (Automatic / Standard / Dark), 3D buildings (OSM heights where tagged, labelled default otherwise), rail & metro lines, EV / parking / petrol overlays (Overpass), live traffic row disabled (“needs a licensed data partner”) |
| Offline | Bundled PMTiles for Visakhapatnam (4.1 MB, z≤15) and Hyderabad (9.3 MB, z≤14), Offline maps screen, auto-switch when the network map fails |
| i18n / a11y | All new strings in `shared/i18n.js` (en/hi/te complete; 8 other languages fall back to English for v0.3 keys, marked TODO); combobox search, sheet operable by keyboard, `aria-live` navigation instructions for TalkBack |
| Privacy | Location only on user action (locate, directions from you, navigation); CSP allows only the required hosts; “Clear search history” in Settings |
| Shop (v0.2) | “LED TVs near me” → verified sellers, price/stock, cart, COD / simulated UPI / Razorpay, rider auto-assignment, live tracking, assistant, mobility, seller & admin dashboards |

## Quick start (local)
Requirements: Node.js ≥ 22.13 (uses built-in `node:sqlite`, no native builds).

```bash
npm install
npm run migrate         # creates data/mapos.db and seeds demo data
npm start               # http://localhost:8080
npm test                # 64 unit + API integration tests
node tests/e2e.mjs      # Chromium E2E (needs the server running and Chromium at /usr/bin/chromium or $CHROME)
npm run build:demo      # dist/india-mapos-demo.html — one-file serverless demo
```

Demo logins (password `demo1234`, change via `DEMO_PASSWORD`): customer@mapos.demo · seller+b2@mapos.demo · admin@mapos.demo

## Layout
```
web/                 client (MapLibre GL, vendored; no runtime CDN)
  shell.js           wires the map-first UI          app.js   map + Shop (commerce) + auth
  ui/                sheet.js (+ sheet-math.js), search.js, place.js, directions.js, saved.js, panels.js (layers/offline/settings), controls.js, icons.js
  nav/               navigation.js (UI), tracker.js (progress/off-route), maneuver.js (text + landmarks), voice.js
  services/          overpass.js, routing.js, geocode.js, net.js (timeouts, cache, rate spacing)
  map/               style.js (online/offline, light/dark, overlays, auto-offline), camera.js (reduced motion)
  lib/               opening-hours.js, saved-model.js (pure, unit-tested)
  offline/           PMTiles regions, fonts, light/dark sprites
server/              Express API (auth, search, orders, SSE tracking, seller/admin, saved places, tile proxy)
shared/              isomorphic core (search, address/DIGIPIN, logistics, i18n, CSP)
tests/               unit + API (node:test), Chromium E2E with fixture-backed network (tests/fixtures = real captured responses)
android/             Capacitor 7 project (com.indiamapos.app); CI builds the APK
docs/                ARCHITECTURE, API, AUDIT, TEST-REPORT, ANDROID, DEPLOYMENT, screenshots
```

## Android app
Capacitor 7, package `com.indiamapos.app`, built by GitHub Actions on every push to `main` and published as a Release
(`Bharat Map 0.3.N`, asset `bharat-map-0.3.N-debug.apk`). Native plugins: Geolocation (watchPosition for navigation),
Share, App (hardware back), Local Notifications, Text-to-Speech (community plugin) for voice guidance. With no backend
configured the app runs fully on-device (Shop uses fictional demo data). Details: [docs/ANDROID.md](docs/ANDROID.md).

## Docs
`docs/ARCHITECTURE.md` · `docs/API.md` · `docs/AUDIT.md` (implemented / prototype / needs paid API) · `docs/TEST-REPORT.md` ·
`docs/ANDROID.md` · `docs/DEPLOYMENT.md` · `docs/PRD.md` · `docs/RESEARCH.md` · research for v0.3 in `docs/re/`.

## Attribution & licences
Map data © OpenStreetMap contributors (ODbL). Online tiles: OpenFreeMap / OpenMapTiles. Offline tiles: Protomaps basemap
(OSM). Routing: OSRM on FOSSGIS servers (routing.openstreetmap.de). Geocoding: Nominatim, Photon (komoot). Rendering:
MapLibre GL JS (BSD-3). Fonts: Noto (OFL). Icons, colours and UI are original to this project (clean-room; no third-party
brand assets).
