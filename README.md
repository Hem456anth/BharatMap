# Bharat Map — v0.5 + sprint 0.5.11 (map-first app + own map-services backend, Android + web)

An India-first map app with an original identity: a calm, full-screen map with a floating search pill and a
three-height bottom sheet, real places from OpenStreetMap, route options for drive / two-wheeler / cycle / walk,
turn-by-turn voice navigation with **landmark-led instructions in English, Hindi and Telugu**, lane guidance, speed-limit
warnings and a night driving style, offline maps for **11 Indian cities** with an on-device place index, and a **Shop** area for the v0.2 commerce flow (product search → seller → order → rider
tracking, seller and admin dashboards).

> Status: **working prototype**. Map, search, places, routing and navigation use real open data (OpenStreetMap via
> Overpass, Nominatim, Photon, OSRM). Sellers, products and riders in Shop are **fictional demo data**. Live traffic and live
> transit arrivals are **not** included (they need licensed feeds); metro journeys use **scheduled** HMRL GTFS times. See `docs/AUDIT.md` for implemented vs prototype vs
> needs-paid-API.

## New in sprint 0.5.11 (19 Oct 2026)
| Area | What you get | Status |
|---|---|---|
| Device tiers | `web/lib/device-tier.js` picks **Lite / Balanced / Full** from `navigator.deviceMemory`, CPU threads and `connection.effectiveType`/`saveData` (a 2 GB phone → Lite). Lite: no 3D buildings or terrain, labels appear one zoom later, no tile/route prefetch, low-bandwidth mode on. Manual override in Settings → Device performance | Implemented (unit + E2E) |
| Offline search v2 | One prebuilt token index over **86,977 places in all 11 bundled cities** (56 k from the bundled tiles + 30.7 k OSM features with native-script names), **37,977 places with Telugu/Hindi/Tamil/Kannada/… names from OSM**, **1,079 pincode centroids**, DIGIPIN decoding — `web/offline/search/index.json` (10.6 MB, works offline in the APK). **Latin ↔ Indic transliteration** (`shared/translit.js`, all 9 Brahmic scripts): "simhachalam" finds సింహాచలం, "చార్మినార్"/"चारमीनार" find Charminar. Server: the same data in **SQLite FTS5** (`node:sqlite`) at `GET /api/v1/places/search` | Implemented (unit + API + E2E) |
| India road hints | From OSM tags along the route: **"Take the flyover"** (bridge on a main road, Valhalla `trace_attributes` edges), **"Stay on the service road"**, **"Narrow road ahead"** (explicit `lanes=1` / `width ≤ 4 m`), and a **time-restriction badge** (`*:conditional`, odd-even notes) that says whether it is in force now (IST). Spoken once ~300 m before. `POST /api/v1/road-hints` on the server | Implemented; restriction/narrow/service E2E use a **labelled synthetic fixture** (no conditional tags on the captured routes) |
| Indic voice picker | Settings → Guidance voice lists the device's TTS voices for te, hi, ta, kn, ml, mr, bn, gu, pa, or (+ English-India fallback) with **Play sample**; the choice is saved and also sets the spoken-guidance language | Implemented (unit + E2E with a stub voice list); not device-tested |
| Offline routing groundwork | `scripts/build-graph.sh` builds a Valhalla graph for Visakhapatnam (Geofabrik + osmium + pyvalhalla 3.9.1 on aarch64): **71 tiles, 10.9 MB tar, 3.7 MB gzipped**; routes verified offline with `scripts/graph-smoke.py`. **No on-device engine yet** — see `docs/OFFLINE_ROUTING.md` | Graph build tested; engine not started |

## New in v0.5
| Area | What you get |
|---|---|
| Lane guidance | Lane strip under the maneuver banner from OSRM `intersections[].lanes` / Valhalla lanes (valid lanes highlighted, original SVG arrows) |
| Speed limit + overspeed | Speed from GPS; limit from OSM `maxspeed` via Valhalla `trace_attributes` (or a self-hosted OSRM's `annotations=maxspeed`, or Overpass along the corridor). Sign only when a number is known; > 10 % over for 2 s → gentle chime + red badge |
| Navigation sounds | Approaching maneuver, reroute, arrival, overspeed, GPS lost/regained — synthesised with WebAudio, muted with voice |
| Day / night driving | High-contrast navigation style; switches at sunrise/sunset (NOAA algorithm, unit-tested) with Auto / Day / Night override |
| Junction view | Enlarged schematic diagram (original SVG from route geometry + junction bearings) before roundabouts, forks, ramps and sharp turns |
| Permissions & privacy | Rationale before each OS prompt (location, background, notifications, microphone), denial help with “Open settings”, **Privacy dashboard** (what is stored, export JSON, delete all — DPDP Act 2023) |
| Community | **Report a map problem** → anonymous OpenStreetMap note (4 categories, rate-limited). **Road incidents** (pothole, waterlogging, closure, police check) that expire after 2 h, with votes and confidence, labelled “Community report, not verified” (shared through the server, device-only otherwise) |
| Deep links | `geo:` URIs, `bharatmap://place|directions|search|list|live`, web `?lat=&lon=`; Android intent filters + App plugin; share links (geo + app + https); launcher shortcuts (Home, Work, Petrol nearby, Offline maps) |
| Home & routing | Commute card (Home/Work drive time, “no live traffic”), **multi-stop routes** (up to 5 stops), arrival summary with “report a problem on this trip” |
| Offline, bigger | **11 bundled cities** (Visakhapatnam, Hyderabad, Vijayawada, Guntur, Tirupati, Bengaluru, Chennai, Mumbai, Delhi NCR, Kolkata, Pune) + an **offline place index** of 68 k real OSM names built from the bundled tiles (`scripts/build-poi-index.mjs`); full Indic glyphs kept. APK ≈ 98 MB |
| Voice, live, lists | Voice search (Android speech recognition / Web Speech), **live location sharing** via the server (time-limited, secret-protected), favourites lists shared as links |

## New in v0.4
| Area | What you get |
|---|---|
| Own backend for map services | `/api/v1` route · geocode · reverse · places/nearby · ev · tolls · transit · regions, with env-configurable upstreams (Valhalla, OSRM per profile, Photon, Nominatim, Overpass, Open Charge Map), LRU+TTL cache, per-IP rate limit, identifying User-Agent, 1 req/s throttle for public instances, request coalescing, timeouts and a circuit breaker with fallbacks. The app uses it when a backend is configured and the public OSM services directly otherwise. `docker-compose.yml` + [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for self-hosted Valhalla, Photon, Nominatim on the India extract |
| Real two-wheeler routing | Valhalla `motor_scooter` (FOSSGIS public instance or your own), alternates, **avoid tolls / avoid highways**; OSRM fallback is labelled an estimate |
| Metro journeys | Hyderabad Metro **scheduled** itineraries from the official HMRL GTFS (bundled with attribution): walk → Red/Green/Blue line → change → walk, planned on the phone (RAPTOR) or on the server. Labelled "Scheduled times, not live". Drop TGSRTC's GTFS into `data/gtfs/` on the server for buses |
| Tolls | "Toll plazas on route (fees not available)": OSM toll booths/gantries along the selected route, ordered, on the map; km on toll roads |
| EV & parking | Charging connectors, power, operator, points (Open Charge Map through the server when keyed, else OSM); parking fee/capacity/type; railway-station and airport chips and layers |
| Low-bandwidth mode | Auto on Save-Data / 2G / 3G or by toggle: fewer tiles (zoom cap, no low-zoom prefetch), no 3D, smaller search area; gzip on the server; route-corridor tile prefetch on Wi-Fi |
| Offline regions | Download manager (size, progress, cancel, delete) for 9 city regions served as PMTiles; `scripts/make-region.sh` cuts them from the Protomaps daily build; saved places and landmarks searchable offline |
| Background navigation | Android foreground service (type `location`) with a persistent notification and an in-app rationale; "Allow all the time" only on request |
| Polish | Gesture tuning (tilt, rotate + compass, double-tap/one-finger zoom, inertial pan), motion per the UI spec, reduced motion, TalkBack labels, v0.4 strings in all 11 languages (8 marked for native review), Shop/admin lazy-loaded, performance recorded |

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
npm test                # 120 unit + API integration tests
node tests/e2e.mjs      # Chromium E2E (needs the server running and Chromium at /usr/bin/chromium or $CHROME)
npm run build:demo      # dist/india-mapos-demo.html — one-file serverless demo
```

Demo logins (password `demo1234`, change via `DEMO_PASSWORD`): customer@mapos.demo · seller+b2@mapos.demo · admin@mapos.demo

## Layout
```
web/                 client (MapLibre GL, vendored; no runtime CDN)
  shell.js           wires the map-first UI          app.js   map + Shop (commerce) + auth
  ui/                sheet.js (+ sheet-math.js), search.js, place.js, directions.js, saved.js, panels.js (layers/offline/settings), controls.js, icons.js
  nav/               navigation.js (UI), tracker.js (progress/off-route), maneuver.js (text + landmarks), voice.js, junction.js, sounds.js
  ui/ (v0.5)         permissions.js, privacy.js, report.js, links.js (deep links, list + live sharing), voice-search.js
  services/          overpass.js, routing.js, geocode.js, net.js (timeouts, cache, rate spacing)
  map/               style.js (online/offline, light/dark, overlays, auto-offline), camera.js (reduced motion)
  lib/               opening-hours.js, saved-model.js, offline-index.js, privacy-model.js (pure, unit-tested)
  offline/           PMTiles for 11 cities, pois/ place indexes, fonts (full Indic glyphs), light/dark sprites
server/              Express API (auth, search, orders, SSE tracking, seller/admin, saved places, tile proxy)
  api-v1.js          /api/v1 map services        providers/  upstream chains     lib/  cache, rate limit, upstream
  transit/           GTFS loader + bundled HMRL feed      community.js  incidents + live location (v0.5)
shared/              isomorphic core (search, address/DIGIPIN, logistics, i18n, CSP, lanes, maxspeed, sun, deeplink, community)
tests/               unit + API (node:test), Chromium E2E with fixture-backed network (tests/fixtures = real captured responses)
android/             Capacitor 7 project (com.indiamapos.app); CI builds the APK
docs/                ARCHITECTURE, API, AUDIT, TEST-REPORT, ANDROID, DEPLOYMENT, screenshots
```

## Android app
Capacitor 7, package `com.indiamapos.app`, built by GitHub Actions on every push to `main` and published as a Release
(`Bharat Map 0.5.N`, asset `bharat-map-0.5.N-debug.apk`, ≈ 98 MB with 11 offline cities). Native plugins: Geolocation (watchPosition for navigation),
Share, App (hardware back + deep links), Local Notifications, Text-to-Speech and Speech Recognition (community plugins), and the
own `BackgroundNav` plugin (foreground service for navigation with the screen off; opens app settings after a permission denial).
Intent filters for `geo:` and `bharatmap://`, and four launcher shortcuts. With no backend
configured the app runs fully on-device (Shop uses fictional demo data). Details: [docs/ANDROID.md](docs/ANDROID.md).

## Docs
`docs/ARCHITECTURE.md` · `docs/API.md` · `docs/AUDIT.md` (implemented / prototype / needs paid API) · `docs/TEST-REPORT.md` ·
`docs/ANDROID.md` · `docs/SELF_HOSTING.md` · `docs/OFFLINE_ROUTING.md` (graph build) · `docs/DEPLOYMENT.md` · `docs/PRD.md` · `docs/RESEARCH.md` · research for v0.3 in `docs/re/`.

## Attribution & licences
Map data © OpenStreetMap contributors (ODbL). Online tiles: OpenFreeMap / OpenMapTiles. Offline tiles: Protomaps basemap
(OSM). Map problems are reported as public OpenStreetMap notes. Routing: OSRM and Valhalla on FOSSGIS servers (routing.openstreetmap.de, valhalla1.openstreetmap.de) or self-hosted.
Transit: *Contains data provided by Hyderabad Metro Rail Ltd.* (HMRL GTFS, HMRL open-data terms). EV: Open Charge Map (CC BY 4.0) when enabled. Geocoding: Nominatim, Photon (komoot). Rendering:
MapLibre GL JS (BSD-3). Fonts: Noto (OFL). Icons, colours and UI are original to this project (clean-room; no third-party
brand assets).
