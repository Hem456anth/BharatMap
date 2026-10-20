# Feature comparison: Apple Maps vs AMap Global vs Bharat Maps (+ CoMaps, the primary blueprint — §10)

Date: 18 Oct 2026.
- Apple and AMap evidence: `REVERSE_ENGINEERING_REPORT.md` (source IDs A1–A16, B1–B10).
- Bharat Maps v0.2 state: `README.md`, `docs/AUDIT.md`, `docs/ARCHITECTURE.md`, `web/app.js`, `web/offline-map.js`, `server/app.js` (repo HEAD `8d57c5b`).
- Integration choices: `STACK_RESEARCH.md`.

**Bharat Maps status legend**

| Mark | Meaning |
|---|---|
| ✅ | Implemented (works end-to-end, tested) |
| 🟡 | Prototype or partial (works with simulated, sample or limited data) |
| 💰 | Needs a paid API or a partnership (do not ship as "live" without one) |
| ⛔ | Not planned (out of scope, legally blocked, or not worth it) |
| — | Absent |

Apple and AMap cells: ● documented, ◐ partial / region-limited, ? unknown.

## 1. Map, interface and gestures
| Feature | Apple | AMap | Bharat v0.2 | Bharat v0.3 target |
|---|---|---|---|---|
| Vector map, pan/zoom/rotate | ● A5 | ● | ✅ MapLibre GL JS | ✅ |
| One-finger zoom (double-tap-drag) | ● A5 | ? | ✅ (MapLibre default) [I] | ✅ |
| Two-finger tilt / 3D toggle | ● A5 | ● | ✅ `#tdBtn` pitch 60° | ✅ + gesture hint |
| Compass, tap to reset north | ● A5 | ● | ✅ MapLibre `NavigationControl` (visualizePitch) | ✅ custom compass FAB (auto-hide when north-up) |
| Long-press to drop a pin → actions | ● A4/A6 | ? | — | ✅ |
| Bottom sheet with detents and grabber | ● A2 | ? | 🟡 2 states (`.grab` toggles `full`) | ✅ 3 detents (peek/half/full) |
| Map styles / layers sheet | ● A7 (modes) | ● | 🟡 online/offline toggle only | ✅ Standard, Transit overlay, Dark; Satellite 💰 (note 1) |
| POI clustering | ● A1 | ● | — (HTML markers, under 200 pins) | ✅ GeoJSON symbol layer + clusters |
| Dark mode | ● A3 | ● | — | ✅ |
| 3D buildings | ● A3 | ● | ✅ OpenFreeMap extrusions (online only) | ✅ + PMTiles building layer |
| Hand-made 3D landmarks / Look Around / Flyover | ● A3 | ◐ | — | ⛔ (street-view capture is Indian-entity only, and costly; DST guidelines) |
| Local-language labels | ● | ● 15 languages B4 | 🟡 OSM `name:<lang>`; 11-language UI | 🟡 + transliteration fallback |

## 2. Search
| Feature | Apple | AMap | Bharat v0.2 | Bharat v0.3 target |
|---|---|---|---|---|
| Typeahead autocomplete | ● | ● B6 | 🟡 debounced suggest over own catalogue; Nominatim fallback (no autocomplete allowed on public Nominatim) | ✅ self-hosted Photon |
| Category chips ("Nearby") | ● A3 | ● | 🟡 commerce chips + mobility chips | ✅ India set: Petrol, EV, ATM, Metro, Bus stop, Railway, Hospital, Pharmacy, Chai/Tiffin, Kirana |
| Filters (open now, price) | ● A3 | ● | 🟡 price/size/in-stock filters for products | ✅ open-now (OSM `opening_hours`) |
| Search updates as the map moves | ● A3 | ? | — | ✅ "Search this area" pill |
| Recents | ● | ● | — | ✅ on-device only |
| Natural-language / multilingual query | ◐ Siri | ● | ✅ deterministic intent engine, 11 languages | ✅ |
| Address intelligence (landmark, pincode, DIGIPIN) | — | — | ✅ | ✅ (differentiator) |

## 3. Place cards and listings
| Feature | Apple | AMap | Bharat v0.2 | Bharat v0.3 target |
|---|---|---|---|---|
| Hours, phone, website, address | ● A3 | ● | ✅ for seeded businesses; — for OSM POIs | ✅ OSM tags shown when present |
| Actions: Directions, Call, Share, Save | ● | ● | 🟡 Directions only, inside orders | ✅ |
| Commerce actions (order, catalogue, price compare) | ● A3/A13 | ● hotels/tickets B1 | ✅ catalogue, cart, order (fictional sellers) | ✅ (real sellers 💰 onboarding/ops) |
| Ratings / reviews UGC | ● A14 | ● | 🟡 seeded rating number | 🟡 own ratings (moderation needed) |
| Owner-managed listing | ● A13 | ● | 🟡 seller dashboard (price/stock) | ✅ + hours and photos |
| Verified-visit ranking signal | — | ● B10 | — | ⛔ v0.3 (needs consent design + scale) |

## 4. Routing
| Feature | Apple | AMap | Bharat v0.2 | Bharat v0.3 target |
|---|---|---|---|---|
| Drive | ● | ● | ✅ OSRM (public demo by default) | ✅ self-hosted OSRM/Valhalla; FOSSGIS for dev only |
| Two-wheeler mode | — (cycling only) | ● motorcycle B1 | 🟡 speed factor | 🟡 Valhalla `motor_scooter`/`motorcycle` costing (self-host) |
| Walk | ● | ● | — (server always calls `/route/v1/driving`, `steps=false`) | ✅ foot profile |
| Bicycle | ● A3 | ● | — | ✅ bike profile |
| Transit (Metro/MMTS/bus) | ● A3 | ● | — (sample metro POIs only) | 🟡 Hyderabad GTFS (HMRL, TGSRTC; MMTS feed status unclear) → OpenTripPlanner/MOTIS self-host |
| Alternative routes | ● A4 | ● B6 | — (single route drawn) | ✅ OSRM `alternatives=true` / Valhalla `alternates` |
| ETA | ● | ● | ✅ duration (no traffic) | ✅ free-flow ETA, labelled "without live traffic" |
| Traffic-aware ETA | ● | ● | — | 💰 TomTom/HERE/Mappls |
| Avoid tolls / highways | ● A4 | ● B6 | — | ✅ (Valhalla `use_tolls`/`use_highways`; OSRM `exclude=toll,motorway` if the profile supports it) |
| Toll cost estimate | — | ● B6 | 🟡 sample toll POIs | 🟡 IHMCL/NHAI-derived plaza list + rate table, labelled "estimate" |
| Multi-stop | ● 15 A9 | ● 16 B6 | ✅ optimiser API (≤25) for delivery | ✅ user-facing "Add stop" (≤10) |
| Leave at / Arrive by | ● A4 | ● | — | ⛔ v0.3 (needs historic traffic, 💰) |
| EV routing with charge stops | ● A3 | ● | — | ⛔ v0.3; EV charger POIs only |
| Truck routing | — | ● B1 | 🟡 speed factor only | 🟡 Valhalla truck costing (self-host) |

## 5. Navigation
| Feature | Apple | AMap | Bharat v0.2 | Bharat v0.3 target |
|---|---|---|---|---|
| Turn-by-turn banner (next maneuver, distance) | ● | ● B7 | — | ✅ from OSRM/Valhalla steps |
| Voice guidance | ● | ● | — | ✅ Android TTS (Capacitor plugin / Web Speech), en + hi + te first |
| Lane guidance | ● A3 | ● B7 | — | 🟡 where OSM `turn:lanes` exists (Valhalla returns lanes) |
| Enlarged junction view | ● A3 (3D) | ● B7 | — | ⛔ (no imagery) → 🟡 schematic arrow diagram |
| Landmark-anchored instructions | — | — | — | 🟡 OSM POI/junction names near the maneuver (original feature) |
| Rerouting on deviation | ● [I] | ● | — | ✅ client off-route detection (>40 m for 3 fixes) → re-request |
| Speed limit + current speed | ● A3 | ● B7 | — | 🟡 speed from GPS ✅; limit only where OSM `maxspeed` exists |
| Speed / red-light cameras | ● A3 | ● B7 | — | ⛔ (data not licensable; legal sensitivity) |
| Traffic-light countdown | — | ● B5 | — | ⛔ |
| Arrival card / parked location | ● A3 | ● | — | ✅ arrival card; 🟡 "where I parked" on-device |
| Background navigation | ● A4 | ● B1 | — | 🟡 Android foreground service (Capacitor) |
| Share live ETA | ● | ● (intercom B1) | ✅ order tracking (SSE) | 🟡 share-trip link |
| Incident reporting (crowd) | ● A7 | ● | — | 🟡 pothole/waterlogging/closure/police check, confidence-gated |

## 6. Traffic, transit, data layers
| Feature | Apple | AMap | Bharat v0.2 | Bharat v0.3 target |
|---|---|---|---|---|
| Live traffic layer | ● | ● | — | 💰 (no free legitimate India source) |
| Live transit arrivals | ● | ● B1 | — | 💰 / partnership (operators publish static GTFS only) |
| Static transit schedules | ● | ● | — | 🟡 HMRL + TGSRTC GTFS (attribution) |
| EV chargers | ● | ● B1 | ✅ via Overpass `live=1` | ✅ Open Charge Map (key) + OSM |
| Petrol / ATM / hospital / pharmacy POIs | ● | ● | 🟡 Overpass | ✅ Overpass self-host / PMTiles POI layer |
| Indoor maps | ● A3 | ● | — | ⛔ |

## 7. Saved, offline, account, privacy
| Feature | Apple | AMap | Bharat v0.2 | Bharat v0.3 target |
|---|---|---|---|---|
| Home / Work shortcuts | ● | ● | — | ✅ |
| Lists / collections | ● A10 | ? | — | ✅ local lists, export/share as link |
| Curated guides | ● A3 | ● | — | ⛔ v0.3 |
| Offline maps | ● A6 | ◐ | ✅ bundled PMTiles for Vizag and Hyderabad (4–9 MB) | ✅ Offline Regions screen: size before download, update, delete |
| Offline routing | ● A6 | ? | 🟡 straight-line estimate fallback | ⛔ v0.3 (needs on-device router) |
| Offline search | ● A6 | ? | — | 🟡 search bundled POIs in PMTiles |
| Use without login | ● A12 | — (CN phone login) | ✅ browsing; login for orders | ✅ navigate/search/save with no account |
| Anonymous telemetry / fuzzing | ● A12 | — | 🟡 no PII in logs | ✅ rotating install ID; coarsen stored locations to H3 r8 after 24 h |
| Survey-of-India-compliant boundaries | n/a | n/a | — (OSM default) | 🟡 must ship before public launch (STACK §8) |

Note 1: there is no free, redistributable high-resolution satellite imagery for app tiles in India. Esri, Maxar, Google and Mappls are all licensed. Satellite stays 💰 / ⛔ for v0.3. [I]

## 8. Strengths, weaknesses, gaps

### Apple Maps
- **Strengths:**
  - restrained, map-first UI with a well-specified sheet model
  - strong privacy architecture
  - polished navigation (lanes, 3D junctions)
  - offline maps with size preview
  - excellent accessibility integration (VoiceOver-aware grabber)
- **Weaknesses for India:**
  - iPhone-only, which is a small share of the Indian market [I]
  - India feature depth largely unverified ([U] transit, detailed city)
  - no two-wheeler mode
  - no toll-cost estimate

### AMap Global
- **Strengths:**
  - deepest navigation stack: lane arrows, junction views, parallel-road detection, signal countdown, interval cameras
  - toll cost per route
  - two-wheeler and e-bike modes
  - typed walking steps
  - super-app commerce
- **Weaknesses:**
  - cluttered home screen
  - Chinese-phone login
  - English drops off in deep screens
  - shares location and device IDs with third parties
  - value concentrated in China

### Bharat Maps (v0.2)
- **Strengths:**
  - India-specific address intelligence (landmarks, pincode, DIGIPIN)
  - 11-language UI
  - commerce loop (search → order → track)
  - working offline basemap for two cities
  - fully open, licence-clean stack
- **Weaknesses:**
  - no navigation (no maneuvers, voice or rerouting)
  - single route, no alternatives
  - no layers or dark mode
  - two-state sheet
  - no saved places
  - routing relies on a public demo server whose policy says "reasonable, non-commercial" use
  - default OSM boundaries
- **Gaps that need money or partners:**
  - live traffic
  - live transit
  - satellite imagery
  - traffic-aware ETA
  - real sellers and inventory
  - official toll API (TIS/RajMargyatra has no documented public API)

### Top gaps to close in v0.3 (no paid dependency)
1. Turn-by-turn navigation with voice and rerouting
2. Alternatives + avoid tolls/highways
3. 3-detent sheet + floating controls + layers + dark mode
4. India category chips + recents + "search this area"
5. Saved places (Home/Work/lists)
6. Offline Regions screen
7. Two-wheeler mode
8. Landmark-anchored instructions
9. Toll estimate (labelled)
10. Hyderabad static transit

## 9. AMap Global APK findings (v17.01.0)

Source: static analysis of the user-supplied APK `com.autonavi.minimap` 17.01.0.2012 (`APK_ANALYSIS.md`, 18 Oct 2026). The APK carries the Chinese app label and only zh + en native resources, so it appears to be the main AMap build with international modes inside. [I]

**Legend.**
- **[O]**: observed in the APK (manifest, resource or file name, file magic)
- **[I]**: inferred
- **[U]**: unknown

Most AMap UI sits in a 92 MB proprietary script bundle that was not opened, so absence of native evidence does **not** mean the feature is absent. This section updates the AMap column above where the APK gives evidence. Rows not listed keep their earlier value.

| Feature (section) | AMap before | AMap from APK | Evidence |
|---|---|---|---|
| Dark mode (§1) | ● | ● map/nav, ◐ native UI | Day/night map and driving-nav styles; only 68 of 1,332 colours have night overrides [O] |
| Map styles / layers (§1) | ● | ● | Standard, public-transport and driving-navigation style families, each day/night [O] |
| Local-language labels / UI (§1) | ● 15 languages B4 | ◐ natively zh + en (zh-CN/HK/TW) | `values-en` has 8,400 strings vs 9,827 default. Other languages, if any, are inside the script bundle [U] |
| Bottom sheet (§1) | ? | ● | `poi_detail_sliding_view_layout` [O] |
| Long-press pin (§1) | ? | ◐ point picking | `fragment_map_select_point`, `map_select_point_mapinteractive_layout` [O]; long-press gesture itself [U] |
| Typeahead, history, did-you-mean (§2) | ● | ● | `search_sugg_*`, `search_history_*`, error / city-suggest header [O] |
| Search filters (§2) | ● | ● | `search_menu_filter_text` [O] |
| Reviews / ratings UGC (§3) | ● | ● | Rating strings, `comment` package, bus-journey review layout [O] |
| Child POIs / entrances (§3) | — | ● | `elipsized_child_poi_layout` [O] |
| Photo contributions (§3) | — | ● | `poi_photo_update_success_fragment`, `DoorAddressUpload` [O] |
| Two-wheeler / e-bike / truck modes (§4) | ● | ● | Vehicle-type chooser; per-mode guidance configs (e-bike, bike, walk, bus); truck/motorbike/EV disclaimers [O] |
| Avoid tolls / route preferences (§4) | ● B6 | ● | `layout_route_preference_widget` [O]; options [I] |
| Lane guidance (§5) | ● B7 | ● | Lane navigation + lane sound configs, lane render profiles [O] |
| Voice guidance (§5) | ● | ● offline TTS + neural voice packs | Embedded TTS engine/data, MNN voice models, voice list + record screens [O] |
| Speed / red-light cameras (§5) | ● B7 | ● | `edog_*` strings, camera/overspeed earcons [O] |
| Traffic-light countdown (§5) | ● B5 | ● | `TrafficLightNewService` (location FGS), front-traffic-light earcon [O] |
| Background navigation (§5) | ● B1 | ● | 11 location-type foreground services, `ACCESS_BACKGROUND_LOCATION`, floating nav overlay service [O] |
| Free-drive / cruise mode (§5) | — | ● | `BackgroundCruiseService`, `amapuricruise` scheme [O] |
| AR walking (§5) | — | ● | `arwalk` JNI/packages, ARCore + Huawei AR + EasyAR [O] |
| Incident reporting (§5) | ● | ● | `traffic_report_*` layouts with photo + POI, event expiry states [O] |
| Live transit / real-time bus (§6) | ● B1 | ● | Real-time bus widget and strings [O] |
| Indoor maps (§6) | ● | ● | Indoor map strings and `indoorMap` deep link [O] |
| EV chargers / petrol / parking (§6) | ● | ● | Charging, gas-station, fuel-discount widgets; parking-slot strings [O] |
| Home / Work, commute (§7) | ● | ● | Commute widget providers and strings [O] |
| Favourites / lists (§7) | ? | ● favourites | Favourites strings and sprites [O]; custom lists [U] |
| Offline maps (§7) | ◐ | ● | City catalogue SQLite + download service + 119 offline strings [O]; coverage outside China [U] |
| Offline routing / search (§7) | ? | ◐ | Offline SDK JNI + offline DB [O]; actual capability [U] |
| Use without login (§7) | — | [U] | Many login SDKs present (Alipay, Taobao, WeChat, QQ, carrier one-tap, Google) [O]; gating unknown |
| Telemetry (§7) | — | — (heavy) | UT analytics, UTDID, ADIU device ID, ad packages, AD_ID, an unidentified SDK, installed-app inventory permission [O] |
| Home-screen widgets / shortcuts (new) | — | ● | 44 components in a widget process; launcher shortcut permissions [O] |
| Car integration (new) | — | ● | HiCar, UCar, Honor Auto, car hand-off [O] |
| Deep links (new) | — | ● | `androidamap://` (24 actions), `geo:`, App Links; also claims Google Maps URLs [O] |

**Engineering profile (new rows).**

| Item | AMap 17.01 | Bharat v0.3 |
|---|---|---|
| APK download size | 194 MB (arm64 only); 344 MB unpacked | ~29 MB (fonts ≈ 11.5 MB + PMTiles 13.4 MB) |
| Code | 8 dex, 72,804 classes; 72 native libs (map engine 29 MB, nav engine 16 MB) | Capacitor WebView + MapLibre GL JS |
| UI tech | Own JS-driven native UI runtime + server-driven templates + mini-program containers | Vanilla JS modules in a WebView |
| min / target SDK | 21 / 35 | 23 / 35 (`android/variables.gradle`) |
| Cleartext traffic | Permitted globally | Disabled (`usesCleartextTraffic=false`) |
| allowBackup | false | false |
| Exported components without permission | 83 | 1 (launcher activity) |
| Background location | Declared | Not requested |
| Third-party analytics / ads | Several | None |

Bottom line: the APK confirms AMap's depth in navigation (lanes, cameras, signals, per-mode guidance, offline TTS) and in surfaces outside the app (widgets, car, deep links). It also shows the cost: size, permissions and tracking. Bharat's open, small and private posture is a real advantage. The ranked follow-ups are in `OPPORTUNITIES.md`.

## 10. CoMaps (primary blueprint from 20 Oct 2026) vs Bharat Map
Source: `COMAPS_TEARDOWN.md` (APK `app.comaps.google` 2026.09.23-2-Google, static only, plus CoMaps' Apache-2.0 public source).
CoMaps marks: ● present [A/S], ◐ partial, — absent, [U] unknown. Bharat column = release 0.7.16 plus this sprint (✅ new = added
from this teardown). The owner made CoMaps the main architecture reference; Apple Maps (web) stays a UI/UX reference only.

| Area | Feature | CoMaps | Bharat Map |
|---|---|---|---|
| Core | Offline-first engine shared by all platforms | ● C++ core (`libs/`) | 🟡 MapLibre + JS modules; routing/search mostly online |
| Core | Renderer | ● own (Drape: OpenGL ES / Vulkan / Metal) | ✅ MapLibre GL JS |
| Offline | Map data model | ● one `.mwm` per region (render + search + routing) | 🟡 PMTiles + POI JSON + one search JSON per app |
| Offline | Region granularity in India | ● state-level (AP 115 MB, Telangana 99 MB; 34 files, 2.19 GB) | ✅ city-level packs (Vizag 4.1 MB, Hyderabad 9.3 MB) |
| Offline | Shipped in the APK | ● world overview + coastlines + borders only | ✅/⚠ 11 cities bundled (81 MB) — slimming awaits approval |
| Offline | Catalogue with size + checksum, download queue, mirrors | ● `countries.txt`, custom map server | 🟡 `regions.json` (size, sha256), no mirror, no hierarchy |
| Offline | Incremental updates | ◐ `mwm_diff` (bsdiff) in source; CDN use [U] | — |
| Offline | Download prompts for view / route | ● | — (planned C4 / D22) |
| Routing | On-device routing | ● car, pedestrian, bicycle, subway/transit | — straight-line fallback; Valhalla graph built for Vizag, no on-device engine (C1) |
| Routing | Two-wheeler (motorcycle/scooter) profile | — no router type | ✅ Valhalla `motor_scooter` (online) |
| Routing | Lanes, speed limits | ● (`lanes/`, `maxspeeds`) | ✅ lanes (OSRM/Valhalla), speed limit when known |
| Search | Offline search | ● in-mwm geocoder + categories | 🟡 bundled index (11 cities, translit, pincode, DIGIPIN); FTS5 on the server |
| Search | Indic category synonyms | ◐ `hi`, `mr` (no `te`, `ta`, `kn`) | ✅ te/hi + 9 more via vocabulary + transliteration |
| Labels | Telugu font | ◐ code2000 fallback | ✅ Telugu glyph stack |
| Voice | Telugu guidance phrases | — (`sound-strings` has hi, mr, ta) | ✅ te/hi (need native review) |
| Saved | Bookmarks / lists | ● categories with settings | ✅ lists + Home/Work + server sync; **✅ new list editor** (rename, reorder, notes, delete) |
| Saved | KML / KMZ / GPX import + export | ● incl. binary KMB, receive via SEND | **✅ new GPX + KML import/export** (KMZ refused with a message; receiving from other apps planned C10) |
| Saved | Track recording | ● foreground service | **✅ new (foreground)**; screen-off planned C9 |
| Community | Edit OSM data | ● built-in editor, OSM login | **✅ new "Suggest an edit"** → structured anonymous OSM note; OSM notes for problems (v0.5) |
| Transit | Subway layer + routing | ● OSM subway layer; GTFS experimental | ✅ rail & metro lines overlay, HMRL GTFS scheduled journeys |
| Car | Android Auto | ● CarAppService (nav category) + native surface renderer | — feasibility only (`docs/ANDROID_AUTO.md`) |
| Places | Offline Wikipedia | ● `descriptions` | — |
| Commerce | Shop, sellers, delivery, payments, service hand-offs | — | ✅/🟡 (Bharat's own scope) |
| Privacy | Background location | — not requested | — not requested |
| Privacy | Analytics / ads | — none | — none |
| Engineering | Release shrinking | ● R8 + resource shrinking | ⏸ off by the owner's choice (awaiting decision) |
| Engineering | Uncompressed, memory-mapped assets | ● `noCompress` for mwm/ttf/png/bin/txt | — (PMTiles read through the WebView) |
| Engineering | APK size | 114.6 MB base (65.7 MB is world overview) + ABI split [U] | 100.2 MB (81 MB city tiles) |

Bottom line: CoMaps shows the shape Bharat should grow into — a small app shell plus downloadable regions that work fully
offline, including routing and search. Bharat already beats it on Indian specifics (city packs, two-wheeler routing, Telugu,
commerce). The gap to close is the on-device engine (C1) and the pack catalogue (C2); the roadmap is in `OPPORTUNITIES.md`.
