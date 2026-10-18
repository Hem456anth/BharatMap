# Feature comparison: Apple Maps vs AMap Global vs Bharat Maps

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
