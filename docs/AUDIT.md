# Audit — Bharat Map sprint 0.5.11 (19 Oct 2026) — device tiers, offline search v2, India road hints, Indic voices

Legend as below (✅ implemented · 🟡 prototype · 🔌 needs external dependency · ⛔ not built). Everything from v0.5 keeps its status.

| Area | Feature | Status | Evidence · dependency |
|---|---|---|---|
| Performance | **Device tiers** low/mid/high from `navigator.deviceMemory`, `hardwareConcurrency`, `connection.effectiveType`/`saveData`; manual override (Settings → Device performance, persisted `bm-tier`). Low: 3D buildings off + max pitch 0, terrain off (none is drawn today), label layers start one zoom later, no route/tile prefetch, low-bandwidth mode forced on (reason `device-tier`, user can still switch it off) | ✅ / 🟡 | `web/lib/device-tier.js`, `web/map/style.js applyTier`, `web/shell.js`; unit (2 GB phone → low, 3 GB + 4 cores → low, 8 GB + 8 cores → high, unknown → mid, override) + E2E desktop/mobile with a faked 2 GB device; `v06-*-01-tier-lite.png`. Not measured on real low-end phones; `deviceMemory` is Chromium/WebView-only (other browsers → mid) |
| Search | **Offline search v2**: prebuilt compact inverted index (Latin, native-script and phonetic tokens, delta-encoded postings) over 86,977 places in all 11 bundled cities; 37,977 with OSM native-script names; 1,079 pincode centroids (median of OSM `addr:postcode`/`postal_code` features); DIGIPIN decode. Loaded lazily in the app (10.6 MB JSON in the APK) | ✅ | `shared/search-index.js`, `web/lib/offline-search.js`, `scripts/build-search-index.mjs`, data `scripts/search-data/osm-extras/*.json` (fetched with `scripts/fetch-osm-search-extras.mjs` from Overpass, ODbL). Unit: 6+ Indic/Latin queries → right top hit (simhachalam→సింహాచలం, సింహాచలం/सिंहाचलम→Simhachalam, గాజువాక→Gajuwaka, చార్మినార్/चारमीनार/charminar→Charminar, ఋషికొండ→Rushikonda, pincode, DIGIPIN). E2E: suggestions + Hindi submit with the network off |
| Search | **Transliteration** Latin ↔ Telugu/Devanagari/Tamil/Kannada/Malayalam/Bengali/Gujarati/Gurmukhi/Odia (one ISCII-offset table), loose phonetic key (aspiration, vowel length, retroflex/dental, v/w, anusvara, doubled letters) | ✅ / 🟡 | `shared/translit.js`; unit. Rule-based and original; no 300-query Indic benchmark yet (roadmap exit criterion not measured) |
| Search | **Server FTS5** `GET /api/v1/places/search` — SQLite FTS5 (`node:sqlite`, unicode61) for candidates, ranking shared with the app; DB built lazily to `data/search.db` | ✅ | `server/lib/search-fts.js`; API test (engine `fts5`, Latin↔Indic, pincode, DIGIPIN) and a unit test that server and device return the same top hit |
| Navigation | **Road hints**: "Take the flyover" (Valhalla `edge.bridge` on motorway–tertiary, ≥ 120 m, or a name with "flyover"), "Stay on the service road" (Valhalla `use`/`road_class`), "Narrow road ahead" (explicit OSM `lanes=1` two-way or `width ≤ 4 m` via Overpass — Valhalla `lane_count` is not used because it defaults to 1 on untagged ways), spoken once ~300 m before, chip under the banner | ✅ / 🟡 | `shared/roadhints.js`, `web/services/roadhints.js`, `/api/v1/road-hints`; unit + API with **real captured** Valhalla `trace_attributes` and Overpass responses for Dwaraka Nagar → Anakapalli (Port Main Road Flyover found at ≈ 2.6 km); E2E desktop/mobile `v06-*-04-hint-flyover.png`. Coverage depends on OSM tagging; not field-tested |
| Navigation | **Time-restriction badge**: `access/motor_vehicle/motorcar/vehicle/hgv/goods/motorcycle/oneway/maxspeed/bus:conditional` parsed; odd-even from notes; "in force now / not now / check signs" evaluated in IST with the opening-hours evaluator | ✅ / 🟡 | unit + E2E with a **SYNTHETIC fixture** (`tests/fixtures/overpass-roadhints-synthetic-rkbeach.json`, labelled) because none of the captured routes carries conditional tags. Real-world coverage of `*:conditional` in Indian OSM data is low |
| Voice | **Indic voice picker**: device voices (Web Speech `getVoices()` / Capacitor TTS `getSupportedVoices()`) filtered to te, hi, ta, kn, ml, mr, bn, gu, pa, or + English-India fallback; sample phrase per language; choice persisted (`bm-guidance-voice`) and used for guidance, also setting the spoken-guidance language | ✅ / 🟡 | `web/nav/voices.js`, `web/nav/voice.js`, `web/native.js`; unit + E2E with a stub voice list (sample spoken with the te-IN voice; guidance utterances te-IN). Real voice availability on Android devices not tested |
| Routing | **Offline routing groundwork**: `scripts/build-graph.sh` (Geofabrik/osmium or Overpass bbox → Valhalla tiles) + `scripts/graph-smoke.py` | 🟡 | Built and routed in the sandbox (aarch64, pyvalhalla 3.9.1): Visakhapatnam 71 tiles / 10.9 MB tar / 3.7 MB gz. Overpass path untested (public endpoints refused the query). **No on-device engine** — `docs/OFFLINE_ROUTING.md` |
| i18n | 32 new keys in en/hi/te (`shared/i18n-v06.js`) | 🟡 | hi/te need native review; other 8 languages fall back to English for these keys |

### Tests (sprint 0.5.11)
- `npm test`: **141 / 141 pass** (120 + 21 new: `tests/v06.test.js` 19, `tests/v06-api.test.js` 2).
- Chromium E2E: see `docs/TEST-REPORT.md`.

### Remaining gaps (sprint 0.5.11)
- On-device offline routing engine (graph build only); bundled-city graphs other than Visakhapatnam not built.
- No Indic search benchmark (300-query set) yet; ranking tuned on a handful of real queries.
- Conditional restrictions and narrow-road tags are sparse in Indian OSM data; time restriction UI verified only on synthetic data.
- Device testing of tiers, voices and hints on real Android phones.
- APK grows by the search index (≈ 10.6 MB raw); no size budget by request.

# Audit — Bharat Map v0.5 (19 Oct 2026) — final functionality audit

Legend: ✅ **Implemented** (working, tested) · 🟡 **Prototype** (works, but partial / simulated / estimate / not device-tested) ·
🔌 **Needs external dependency** (code is in place; the named dependency must be supplied) · ⛔ Not built.
Every feature from v0.1–v0.4 below keeps its status unless a v0.5 row changes it.

### v0.5 features
| Area | Feature | Status | Evidence · dependency |
|---|---|---|---|
| Navigation | **Lane guidance**: lanes parsed from OSRM `intersections[].lanes` (indications + valid) and Valhalla `maneuver.lanes` bitmasks; lane strip under the banner (valid lanes bright, others dimmed; original SVG arrows); shown for the next lane-tagged intersection within 350 m | ✅ | `shared/lanes.js`; unit (real Bengaluru fixture: 2 of 3 lanes valid at the Hosur Road fork) + E2E desktop/mobile; `v05-*-02-lanes.png`. Coverage depends on OSM `turn:lanes` tagging, which is sparse in India |
| Navigation | **Speed-limit sign + overspeed**: GPS speed (or derived from fixes); limit from route annotations (self-hosted OSRM `OSRM_MAXSPEED=1`), else Valhalla `/trace_attributes` `edge.speed_limit`, else Overpass `maxspeed` tags along the corridor; sign only when a numeric limit is known; > 10 % over for 2 s → chime once + red speed badge, re-arms after 10 s at/below the limit | ✅ | `shared/maxspeed.js`, `web/services/speed.js`, `/api/v1/speed-limits`; unit (`"50"`, `"50 mph"`, `"IN:urban"` → unknown, lists, overspeed timing) + E2E (limit 80 shown, overspeed chime, hidden on the untagged stretch); `v05-*-01-speed-junction.png`. FOSSGIS OSRM rejects `annotations=maxspeed` |
| Navigation | `IN:urban` / `IN:rural` implicit limits | ⛔ by design | No single national value (state- and vehicle-specific notifications); never converted into a number |
| Navigation | **Sounds** (WebAudio, generated in code): approaching maneuver, reroute, arrival, overspeed, GPS lost / regained; honour the mute toggle | ✅ / 🟡 | `web/nav/sounds.js`; unit (cues, mute) + E2E (cue log). Audible output not verified on a device (headless has no audio) |
| Navigation | **GPS lost / regained**: no fix for 12 s during GPS navigation → banner + sound; next fix → regained | ✅ / 🟡 | watchdog in `navigation.js`; not device-tested |
| Navigation | **Day/night driving style**: dedicated high-contrast style (wider route with strong casing, amber route at night, POI symbols hidden), switched by NOAA sunrise/sunset at the user's position; override auto/day/night in Settings and the nav bar | ✅ | `shared/sun.js` (pure, unit-tested against published Hyderabad/Delhi times and polar cases) + E2E forced night; `v05-*-03-night-nav.png` |
| Navigation | **Junction view**: enlarged schematic SVG for roundabouts, forks, ramps, merges, sharp/U-turns and 5+-way junctions, drawn heading-up from the route geometry + OSRM intersection bearings (no imagery) | ✅ / 🟡 | `web/nav/junction.js`; unit + E2E. Schematic only: lane-level geometry is not in OSM |
| Navigation | **Arrival summary**: trip time, distance, average speed; "Report a problem on this trip" (OSM note) | ✅ | E2E `v05-desktop-15-arrival-summary.png` |
| Privacy | **Permission explainers** before each OS prompt — location (precise/approximate), background location, notifications, microphone — shown only when the OS would prompt; denial dialog with "Open settings" (Android `ACTION_APPLICATION_DETAILS_SETTINGS` via `BackgroundNav.openAppSettings`) or browser guidance | ✅ / 🟡 | `web/ui/permissions.js`; E2E (rationale, "Not now" asks nothing, denial help); `v05-*-11/12`. Native prompts not device-tested |
| Privacy | **Privacy dashboard** (DPDP Act 2023: notice, access, erasure): groups of on-device data with sizes, caches, permission states, what is sent to which service; export JSON (sign-in token excluded); delete all | ✅ | `web/ui/privacy.js`, `web/lib/privacy-model.js`; unit + E2E (download parsed, delete verified); `v05-desktop-10-privacy.png` |
| Community | **Report a map problem** → anonymous OpenStreetMap note (`POST /api/0.6/notes`), categories wrong road / missing place / closed road / wrong name, confirmation with the note id, device rate limit (1/min, 3/h) | ✅ / 🔌 | `shared/community.js`, `web/ui/report.js`; unit (payload, rate limit) + E2E with the **OSM API mocked** (tests never create real notes). Live use posts to api.openstreetmap.org (public, anonymous) |
| Community | **Incident reports** (pothole, waterlogging, closure, police check), 2-hour expiry, "still there" / "gone" votes → confidence low/medium/high, labelled "Community report, not verified", on the map | ✅ / 🔌 | Server: migration `004_community_live.sql`, `server/community.js`, `/api/v1/incidents` (API tests: expiry, votes, one vote per client, rate limit). Without a server: kept on the device only, labelled so (E2E). Shared reports **need a deployed Bharat Map server** |
| Links | **Deep links**: `geo:` (incl. `geo:0,0?q=lat,lng(label)`), `bharatmap://place|directions|search|list|live|saved|category|offline`, web `?lat=&lon=&name=` / `?list=` / `?live=`; Android intent filters + Capacitor App `getLaunchUrl` / `appUrlOpen` | ✅ / 🟡 | `shared/deeplink.js` (unit), `web/ui/links.js` (E2E). Android intent delivery not device-tested |
| Links | **Share a place** → geo: URI + bharatmap:// link (+ https link when the web app is hosted over https) | ✅ | unit (round-trip) |
| Links | Verified https App Links (`autoVerify`) | 🔌 | **Needs a Bharat Map web domain** with `assetlinks.json` |
| Android | **Launcher shortcuts**: Home, Work, Petrol nearby, Offline maps (static `shortcuts.xml`, original vector icons) | ✅ / 🟡 | links unit-tested; not device-tested |
| Home | **Commute card**: Home/Work drive time from your location via routing, "Typical drive time … No live traffic" | ✅ | E2E `v05-desktop-08-commute.png`; live traffic 🔌 (licensed partner) |
| Routing | **Multi-stop routes** (up to 5 stops; OSRM multi-coordinate, Valhalla multi-location, server `via=`), stop rows with remove, "Add stop" on place cards, waypoint instruction | ✅ | unit + API (`via=`) + E2E (3-point request) |
| Offline | **11 bundled offline cities** (Visakhapatnam, Hyderabad, Vijayawada, Guntur, Tirupati at z15/z14; Bengaluru, Chennai, Mumbai, Delhi NCR, Kolkata, Pune at z14) from the Protomaps 2026-10-17 build via `pmtiles extract`; offline map picks the bundled city covering the map centre | ✅ | `web/offline/regions.json`; ~90 MB of PMTiles in the APK; full Indic glyph PBFs kept |
| Offline | **Offline place index** for every bundled city (68 k real OSM names: POIs + localities, from the bundled tiles by `scripts/build-poi-index.mjs`): type-ahead "On device" suggestions, search fallback when Nominatim is unreachable, landmarks for instructions | ✅ | unit (Kailasagiri, King George Hospital) + E2E offline; `v05-desktop-09-offline-search.png` |
| Search | **Voice search**: Android speech-recognition plugin (`@capacitor-community/speech-recognition`, system recogniser, `RECORD_AUDIO` asked on first tap after the rationale); Web Speech API in browsers; mic hidden when unavailable | ✅ / 🟡 | E2E with a stubbed recogniser (`en-IN`); Android path not device-tested |
| Sharing | **Live location sharing** via the server (`/api/v1/live`: 5–240 min, secret-protected updates every 10 s, public read, delete; viewer marker polls every 10 s) | ✅ / 🔌 | API tests + E2E (server mode). **Needs a deployed server** for real use; Android background updates only while the app runs |
| Sharing | **Favourites list sharing** (list encoded inside the link, ≤ 50 places; import asks first) | ✅ | unit + E2E |
| i18n | v0.5 strings in en (complete) and hi / te (in-house, **need native review**); other 8 languages fall back to English for v0.5 keys | 🟡 | unit |
| Size | APK grew from 29.2 MB (v0.4.8) to 98.4 MB (v0.5.10, 98,439,746 bytes) and 102.8 MB (v0.5.12, 102,777,637 bytes; +4.3 MB for the offline search v2 index) by design: 9 more bundled cities + place indexes; CI prints a size breakdown but never fails on size | ✅ | CI step "APK size report" |

### Tests (v0.5)
- `npm test`: **120 / 120 pass** (95 v0.1–v0.4 + 25 new: `tests/v05.test.js` 20, `tests/v05-api.test.js` 5).
- Chromium E2E (`tests/e2e.mjs`): **91 / 91 pass** — desktop 52, mobile 39 (v0.3 regression 43, v0.4 regression 21, v0.5 new 27), 0 console errors; third-party services from real captured fixtures / mocks. Details: `docs/TEST-REPORT.md`.

### Remaining gaps (v0.5)
- Live traffic, toll fees, live transit arrivals: licensed data partners (unchanged).
- Offline turn-by-turn routing for bundled cities (still a labelled straight-line estimate).
- Device testing: Android permission prompts, intent delivery, launcher shortcuts, TTS/WebAudio output, speech recognition, background navigation.
- Lane and speed-limit coverage is only as good as OSM tagging in India; implicit `IN:*` limits are deliberately not shown.
- Native-speaker review of hi/te v0.5 strings and the other 8 languages.


# Audit — Bharat Map v0.4 (19 Oct 2026)

Legend: ✅ **Implemented** (working, tested) · 🟡 **Prototype** (works, but partial / simulated / estimate / not device-tested) ·
🔌 **Needs external dependency** (code is in place; the named dependency must be supplied) · ⛔ Not built

### v0.4 features
| Area | Feature | Status | Evidence · dependency |
|---|---|---|---|
| Backend | `/api/v1` provider abstraction: route, geocode, reverse, places/nearby, ev, tolls, transit, regions, providers | ✅ | `server/api-v1.js`, `server/providers/`; API tests with fake upstream (`tests/v04-api.test.js`) |
| Backend | Env-configurable upstreams (`VALHALLA_URL`, `OSRM_URL_CAR/BIKE/FOOT`, `PHOTON_URL`, `NOMINATIM_URL`, `OVERPASS_URL`, `OCM_API_KEY`) | ✅ | unit: `providerConfig` |
| Backend | LRU + TTL cache, per-IP token bucket (429 + Retry-After), identifying UA, 1 req/s throttle for public instances, request coalescing, timeouts, circuit breaker, fallback chains | ✅ | unit tests (clock-injected) + API test (429) |
| Backend | gzip of JSON responses | ✅ | API test decodes gzip |
| Backend | Production upstreams (self-hosted Valhalla / Photon / Nominatim) | 🔌 | **Needs a VM** — `docker-compose.yml` + `docs/SELF_HOSTING.md` (sizing). Defaults are the public OSM instances (dev only) |
| Backend | Render deploy | 🔌 | `render.yaml` updated; **needs a Render account** and env values |
| Client | Uses the server when `MAPOS_API_BASE` / Settings URL / `CLIENT_SERVICES=server`, direct public endpoints otherwise, server→direct fallback | ✅ | unit (direct paths), code review; live server path verified by curl against the real FOSSGIS Valhalla |
| Routing | Real two-wheeler mode (Valhalla `motor_scooter`, top speed 60 km/h) with OSRM car-graph fallback (then labelled "Estimate") | ✅ | real captured Valhalla response; unit + E2E (`valhalla motor_scooter` request) |
| Routing | Valhalla for drive/bike/walk with alternates; OSRM fallback; straight-line estimate when both fail | ✅ | unit (fallback order) |
| Routing | Avoid tolls / avoid highways (Valhalla `use_tolls` / `use_highways` = 0); honest note when only OSRM answered | ✅ | unit + E2E (checkbox → Valhalla `auto`) |
| Transit | GTFS loader (zip / folder / .txt.gz; stops, routes, trips, stop_times, calendar, calendar_dates) | ✅ | unit (CSV edge cases, zip reader, fixture feed) |
| Transit | RAPTOR earliest-arrival planner: walk → ride → transfers → walk, Pareto by rides, same-station transfers | ✅ | unit on a labelled test fixture + real HMRL feed (Miyapur → Uppal = Red → Blue at Ameerpet) |
| Transit | Hyderabad Metro (HMRL) GTFS bundled with attribution ("Contains data provided by Hyderabad Metro Rail Ltd.", HMRL terms permit redistribution, 03 Jul 2026 feed via Open Data Telangana / OpenCity) | ✅ | `server/transit/feeds/hmrl/ATTRIBUTION.txt`; E2E itinerary + attribution |
| Transit | Client itineraries (on-device with the packed timetable, or via server), labelled "Scheduled times, not live"; nearest stops otherwise | ✅ | E2E desktop + mobile; screenshot `v04-*-01-transit-itinerary` |
| Transit | TGSRTC buses | 🔌 | **Needs the official TGSRTC GTFS** (form download) dropped into `data/gtfs/` — loader is ready |
| Transit | Live arrivals / delays (GTFS-RT) | 🔌 | **Needs an operator partnership** (none public) |
| Tolls | Toll plazas on route (OSM `barrier=toll_booth`, `highway=toll_gantry`), count + ordered list + map markers, toll-road length from `toll=yes`; "fees not available" | ✅ | real NH16 route + real Overpass response (Agnampudi); unit + E2E; screenshot `v04-*-02-tolls` |
| Tolls | Toll fees (₹) | 🔌 | **Needs a verified fee source** (NHAI fee data / licensed provider); not shown by design |
| EV | Open Charge Map via server proxy (key never shipped), OSM fallback; connectors / power / operator / points / status | ✅ / 🔌 | OSM path ✅ (E2E with real Dwaraka Nagar data); OCM path unit-tested with a mock — **needs `OCM_API_KEY`** for live use |
| Parking | Fee / capacity / type from OSM on the place card | ✅ | E2E (real data has few tags → "Not mapped" shown honestly) |
| Layers | Railway stations + airports chips and overlays | ✅ | E2E (13 chips; rail overlay) |
| Low bandwidth | Auto from `navigator.connection` (Save-Data, slow-2g/2g/3g) + manual toggle; zoom cap 16, no low-zoom prefetch, no 3D, Overpass 3 km / 25 results | ✅ | unit (policy) + E2E (toggle and auto with stubbed `navigator.connection`); screenshot `v04-mobile-04` |
| Low bandwidth | Prefetch route-corridor tiles (z12–14) on unmetered connections when navigation starts | 🟡 | unit (tile maths); runs in the browser/PWA tile cache; in the Android WebView MapLibre does not read that cache |
| Offline | Region catalogue (9 cities), `scripts/make-region.sh` (`pmtiles extract`), server `/regions` with Range | ✅ / 🔌 | Real Vijayawada z≤13 extract made in the sandbox (1.5 MB) and served; **needs a region host** (server disk/CDN) with the generated files for users |
| Offline | Download manager: size, progress, cancel, delete, Cache Storage; offline map prefers a downloaded region | ✅ | unit (real PMTiles bytes, cancel, 404, wrong file) + E2E (mocked host) ; screenshot `v04-*-05-offline-regions` |
| Offline | Offline geocoding of saved places + bundled landmarks | ✅ | unit |
| Offline | Offline routing | 🟡 | straight-line × 1.35 estimate, labelled (unchanged) |
| Android | Background navigation: foreground service (`location`), persistent notification, rationale UI, optional `ACCESS_BACKGROUND_LOCATION` only on request | 🟡 | Gradle build in CI; JS flow E2E-tested with a stub plugin; **not device-tested** |
| Gestures | Two-finger tilt, rotate (+ compass label/snap-to-north tick), double-tap zoom, one-finger zoom (double-tap-drag), tuned inertial pan | ✅ / 🟡 | MapLibre handlers enabled + configured; touch gestures not automated beyond existing drag/long-press tests |
| Motion | Sheet 280 ms `cubic-bezier(0.05,0.7,0.1,1)`, 180 ms content swap, 120 ms control fade during gestures, 100 ms press; all off with reduced motion | ✅ | CSS + `controls.js`; reduced-motion rule |
| a11y | TalkBack labels for new controls (compass with angle, progress bars, toll list, itinerary, dialogs) | 🟡 | ARIA in DOM; not tested with TalkBack on hardware |
| i18n | All v0.4 strings in 11 languages (en/hi/te reviewed; ta, kn, ml, bn, mr, gu, pa, or **need native review**) | 🟡 | unit (every key, no English fallback); v0.3 strings in those 8 languages still fall back to English |
| Performance | Load time, map-ready time, FPS, JS bytes recorded in headless E2E (`docs/perf-v04.json`); Shop demo backend + admin lazy-loaded | ✅ | E2E asserts admin/mock-api are not loaded at boot |
| Live traffic | — | 🔌 | **Needs a licensed traffic partner** (HERE / TomTom / MapmyIndia) |

# Audit — Bharat Map v0.3 (18 Oct 2026)

Legend: ✅ Implemented & tested · 🟡 Prototype / partial / simulated / estimate · 💰 Needs a paid or licensed data/API partner · ⛔ Not built

## v0.3 feature matrix (map-first app)
| Area | Item | Status | Evidence / notes |
|---|---|---|---|
| Shell | Full-screen map, floating search pill, floating controls | ✅ | E2E desktop + mobile, screenshots `v03-*-01-home` |
| Shell | Bottom sheet: peek / half / full, drag + snap + fling, tap-to-cycle, keyboard (↑ ↓ Home End), `aria-label` state | ✅ | unit (`sheet-math`), E2E keyboard + drag + fling on 390×844 |
| Shell | Smooth camera (flyTo/easeTo/fitBounds) honouring `prefers-reduced-motion` | ✅ | `map/camera.js`; reduced motion → `jumpTo`, CSS transitions off |
| Controls | Locate (follow → heading puck), compass (shown when rotated/tilted; resets), layers, 2D/3D | ✅ | E2E (compass visible after 3D, reset to pitch 0) |
| Identity | Original tokens, light/dark (auto + manual), dark basemap online (OpenFreeMap dark) and offline (Protomaps dark) | ✅ | E2E dark toggle + `prefers-color-scheme: dark`; screenshots `*-14-dark`, `*-15-dark-place` |
| Identity | 48 dp targets, WCAG AA text contrast | ✅/🟡 | Token pairs ≥ 4.5:1 (computed); not audited with an external tool or TalkBack on a device |
| Search | Recents (device only), category chips (12), local landmark/locality/pincode/DIGIPIN/seller resolver, Photon type-ahead, Nominatim fallback | ✅ | unit (geocode parsing) + E2E (local, Photon) |
| POIs | Real OSM POIs via Overpass: bbox ≤ 8 km, rounded, 10 min cache, 20 s server / 25 s client timeout, de-dup, ≥ 1 s spacing | ✅ | unit (query builder, parser, cache) + E2E with real captured responses |
| Place card | Name, category, distance, address, opening hours → open/closed (simple OSM syntax; raw otherwise), phone, website, wheelchair, DIGIPIN; Directions / Save / Share / Call; Shop here | ✅ | unit (opening_hours), E2E |
| Place card | Reverse geocode for dropped pins (long-press / right-click) | ✅ | E2E desktop right-click + mobile synthetic long-press |
| Routing | Drive / Cycle / Walk via FOSSGIS OSRM, ≤ 3 alternatives, selected highlighted, ETA, arrival time, steps | ✅ | unit (URL + parser) + E2E (2 alternatives in fixture) |
| Routing | Two-wheeler | 🟡 | Car graph, labelled "Estimate"; a real 2W profile needs Valhalla `motor_scooter` self-hosted |
| Routing | ETA with traffic | 💰 | "ETA without live traffic" shown; traffic needs a licensed partner (e.g. HERE/TomTom/MapmyIndia) |
| Routing | Transit | 🟡/💰 | Nearest metro/rail/bus stops from OSM + honest note; journey planning needs GTFS (HMRL publishes some; no live feed connected) |
| Routing | Offline fallback | ✅ | Straight-line × 1.35, dashed line, "Offline estimate" label (E2E) |
| Navigation | Banner (icon + distance + instruction), next-step preview, ETA/remaining strip, follow camera (bearing + pitch) | ✅ | E2E simulate; screenshots `*-09-navigation` |
| Navigation | Voice: Web Speech (en-IN / hi-IN / te-IN), native Android TTS plugin, mute toggle, English fallback when a voice is missing | ✅/🟡 | E2E verifies utterances + language (stubbed synth); real-device audio not tested here |
| Navigation | Landmark-enhanced instructions (seed landmarks ≤ 150 m) | ✅ | unit en/hi/te; only 9 seed landmarks — needs a curated landmark dataset to scale |
| Navigation | Off-route (> 50 m × 3 fixes, accuracy-aware) → reroute; arrival detection | ✅ | unit + E2E (injected fixes → reroute request) |
| Navigation | GPS via Capacitor `watchPosition` (native) / `navigator.geolocation` | ✅/🟡 | Web path E2E-tested with emulated geolocation; native path compiled in CI, not device-tested here |
| Navigation | "Simulate drive" demo (labelled) | ✅ | E2E to arrival |
| Navigation | Background navigation (screen off), lane guidance, speed limits, speed cameras | ⛔ | Needs a foreground service + richer data |
| Saved | Home, Work, Favourites, custom lists; quick Home/Work directions | ✅ | unit (model/merge) + E2E (persisted) |
| Saved | Server sync when signed in (`/api/me/places`, migration 003) | ✅ | API tests + E2E |
| Layers | Style (Automatic / Standard / Dark), 3D buildings (OSM heights; default 8 m, labelled), rail & metro lines, EV / parking / petrol overlays | ✅ | E2E |
| Layers | Satellite | ⛔ (by design) | No free imagery source licensed for in-app use — omitted |
| Layers | Live traffic | 💰 | Disabled row "Needs a licensed data partner" |
| Offline | Bundled PMTiles (Vizag 4.1 MB, Hyderabad 9.3 MB), Offline maps screen, auto-switch on network failure | ✅ | E2E: tile proxy blocked → PMTiles, zero online tile requests |
| Offline | Downloading new regions in-app | ⛔ | Needs a tile/extract service (planetiler/Protomaps extracts on a CDN) |
| i18n | All v0.3 strings in `shared/i18n.js`; en/hi/te complete; ta, kn, ml, bn, mr, gu, pa, or fall back to English (TODO) | ✅/🟡 | unit coverage test; native-speaker review still required |
| a11y | Combobox search with `aria-activedescendant`, keyboard sheet, focus moved to view headings, `aria-live` nav instructions, reduced motion, forced-colors borders | ✅/🟡 | Not yet tested with TalkBack on hardware |
| Privacy | Location only on user action; CSP restricted to required hosts; clear search history; third-party calls documented (`docs/API.md`) | ✅ | API test (header == meta), E2E |
| Shop | v0.2 commerce (search → seller → order → rider tracking; seller/admin dashboards) moved under Shop | ✅ | E2E desktop + mobile + serverless demo |

### Third-party services and their limits
| Service | Licence / policy | Production plan |
|---|---|---|
| OpenFreeMap tiles | Free, OSM ODbL attribution | Self-host PMTiles on a CDN (already used offline) |
| Overpass API (overpass-api.de) | Fair use; no heavy/automated load | Own Overpass or a POI index (PostGIS) |
| Nominatim (OSMF) | Max 1 req/s, no autocomplete, attribution | Self-host Nominatim |
| Photon (komoot) | Fair use | Self-host Photon |
| FOSSGIS OSRM | Light interactive use only | Self-host OSRM/Valhalla (Valhalla for 2W + truck) |

### v0.3 security notes
- CSP: `script-src 'self'` (+ Razorpay), `connect-src` limited to the five map services, Razorpay and `*.onrender.com`; no inline scripts in the shell (theme bootstrap moved to `boot-theme.js`). `style-src 'unsafe-inline'` remains (MapLibre markers set inline styles).
- External URLs from OSM `website` tags open with `rel="noopener noreferrer"`; only `http(s)` is linked. All OSM text is HTML-escaped.
- `/api/me/places` is per-user, normalised and size-capped; no other user can read it.
- The serverless single-file demo strips the CSP meta (it inlines scripts and loads MapLibre from a CDN); the real web app and the APK keep it.

---

# Earlier audit — Bharat Map v0.1/v0.2 (18 Oct 2026)

Legend: ✅ Implemented & tested · 🟡 Prototype / partial / simulated · 🔌 External dependency · ⛔ Not built

## 1. Feature matrix
| Area | Item | Status | Evidence / notes |
|---|---|---|---|
| Maps | Vector map, zoom/pan/scale, locate me | ✅ | MapLibre GL JS 6.15 (vendored), E2E screenshots |
| Maps | Local-language labels | 🟡 | Uses OSM `name:<lang>` where present; coverage varies by area |
| Maps | 3D tilt + extruded buildings | ✅/🔌 | Pitch toggle; extrusions come from OpenFreeMap "liberty" style |
| Maps | Offline | 🟡 | Service worker caches app shell + viewed tiles; downloadable offline regions (PMTiles) ⛔ |
| Maps | Turn-by-turn voice navigation | ✅ (v0.3) | See v0.3 matrix above |
| Maps | Survey-of-India boundaries | ⛔ | Required before public launch (RESEARCH §2) |
| Marketplace | Business types, verified badge, rating, hours, catalogue, MRP/discount, stock, wholesale tiers | ✅ | 15 **fictional** businesses, 2 cities |
| Marketplace | Seller onboarding/KYC/GSTIN verification | 🟡 | Admin verify endpoint only; no document workflow |
| Killer flow | Search → map pins → product → cart → checkout → rider → live tracking | ✅ | API test "KILLER FLOW", Chromium E2E desktop + mobile |
| Quick commerce | In-stock-first, cheapest sort, size/price filters, locality re-centre, pickup | ✅ | unit tests |
| Payments | COD + "UPI (simulated)" | 🟡 | No PSP integration; no money moves |
| Logistics | Fee rules, bulky handling, vehicle policy, nearest-rider assignment | ✅ | unit tests |
| Logistics | Road routing | ✅/🔌 | OSRM (public demo by default → self-host); offline fallback estimate |
| Logistics | Truck navigation (restrictions) | 🟡 | `profile=truck` = speed factor only; true truck costing needs Valhalla/GraphHopper ⛔ |
| Logistics | Multi-stop route optimisation | ✅ | NN + 2-opt API (≤25 stops); VROOM for production |
| Logistics | Live tracking | 🟡 | SSE + polling work end-to-end; **rider position is simulated along the real route** (no rider GPS app) |
| Logistics | Fleet / warehouses | 🟡 | Admin fleet list; warehouse records; no warehouse inventory transfer |
| AI | NL intents (search, supplier discovery, route, mobility, geocode), multilingual | ✅ | Deterministic engine, tested |
| AI | LLM rewrite | 🟡/🔌 | Optional OpenAI-compatible hook (`LLM_*` env); untested without key |
| Mobility | Metro/rail/bus/airport/EV/parking/toll POIs | 🟡 | 13 **illustrative sample** points |
| Mobility | Live EV/parking/fuel/bus stops | ✅/🔌 | OpenStreetMap via Overpass (`live=1`) |
| Mobility | Live traffic, toll rates, train/bus schedules | ⛔/🔌 | Need licensed feeds / GTFS (RESEARCH §4) |
| Address | Landmark + relation + locality + pincode + DIGIPIN parsing w/ confidence | ✅ | 9 localities/landmarks per city in seed; tested |
| Address | DIGIPIN encode/decode | ✅ | Matches India Post reference `39J-49L-L8T4` |
| Address | Nominatim fallback | ✅/🔌 | Public server for dev only |
| i18n | 11-language UI, native-script query understanding | ✅/🟡 | Machine-assisted strings → native review required |
| Accounts | Customer/seller/rider/admin roles, JWT, RBAC, seller dashboard, admin | ✅ | Rider *app* ⛔ (role & API only) |
| ONDC | Beckn `on_search` catalogue mapping | 🟡 | Unsigned, not registered; select/init/confirm ⛔ |
| Android | PWA installable; Capacitor config | 🟡 | No APK built |
| Deploy | Dockerfile, compose (app+OSRM, PostGIS/Valhalla profile), env, guides | ✅ | Not deployed to a public production host from this environment |

## 2. Test results
- **Unit + API integration**: 32/32 pass (`npm test`, `docs/test-output.txt`) — geo, DIGIPIN, address, i18n, query parsing, ranking, assistant, pricing, rider assignment, tracking monotonicity, route optimisation, auth/lockout/RBAC, IDOR, stock race protection, validation, seller/admin, SQLi, metrics.
- **E2E (real Chromium)**: 17/17 pass against the server (desktop 1366×820 + mobile 390×844), 0 console errors (`docs/e2e-results.txt`, screenshots in `docs/screenshots/`).
- **Serverless demo E2E**: 5/5 pass (`docs/e2e-demo-results.txt`).
- **Load** (1 Node process, sandbox VM, demo catalogue, external calls off): 23,555 requests in 15 s at 50 concurrency → **~1,570 rps, p50 30 ms, p95 48 ms, p99 64 ms, 0 errors** (`docs/load-results.txt`). Rate limiter verified (429 after limit).
- **Dependencies**: `npm audit` → 0 vulnerabilities (MapLibre upgraded 4.7 → 6.15 to clear GHSA-jrc7-96c5-q579).
- Exception: the standalone demo file (`dist/`, published Page) loads MapLibre **5.24 UMD** from unpkg, because the static host rejects ES modules and 6.x is ESM-only. 5.x is in the advisory range (XSS in `DOM.sanitize`, used for HTML popups/attribution); the demo renders no user-supplied HTML popups and holds only fictional data. The real app (server-hosted) uses 6.15.

## 3. Security
Implemented: scrypt password hashing (N=16384), HS256 JWT with alg pinning + expiry + timing-safe compare, required secret in production, RBAC on every mutating route, object-level authorisation on orders (404 for others → no IDOR), login lockout (5 fails / 5 min), per-IP rate limiting, JSON body limit 64 KB, parameterised SQL everywhere, input clamping (coords inside India, qty 1–500, prices), atomic conditional stock decrement in `BEGIN IMMEDIATE` (no overselling), CSP (`script-src 'self'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS in production, CORS allow-list, HTML escaping in all client rendering, request IDs, audit log table, no secrets in logs (paths only, no query strings).

Known gaps / risks:
| Risk | Severity | Fix |
|---|---|---|
| JWT stored in localStorage (XSS → token theft) | Medium | HttpOnly SameSite cookie + CSRF token; refresh-token rotation |
| SSE uses `?token=` (may land in proxy logs) | Low | Short-lived stream ticket endpoint |
| Rate limit / lockout / tile cache are in-memory per process | Medium at scale | Redis |
| `/map/*` tile proxy not rate-limited and could be used as bandwidth relay to the upstream | Low | Limit to tile paths + rate limit, or serve PMTiles from CDN directly |
| `style-src 'unsafe-inline'` (inline style attributes for progress bar) | Low | Move to classes / nonces |
| Seeded demo accounts with shared password | High if deployed as-is | Disable seed / set `DEMO_PASSWORD`, remove demo users |
| No payment integrity (simulated UPI) | N/A until PSP | Server-side PSP verification + webhooks |
| Personal data (drop locations) without DPDP consent/retention policy | Medium | Consent, privacy notice, retention jobs |

## 4. Performance
- Server: search is an in-process scan of the catalogue (fine for ~10k businesses per city, measured ~1.5k rps). Beyond that: PostGIS `ST_DWithin` + GiST and tsvector/trigram (schema provided), Redis cache for hot queries, search index (OpenSearch/Typesense).
- Client: 93 KB single-file demo bundle (excl. MapLibre 1.1 MB, cached by SW); results render as HTML markers (OK for < ~200 pins; switch to a GeoJSON symbol layer with clustering beyond that); typeahead debounced 220 ms.
- Routing: public OSRM adds 100–600 ms and has usage limits → self-host; routes cached 10 min.
- Tracking is computed statelessly per request (no timers per order on the server); SSE interval 1.5 s.

## 5. Accessibility (WCAG 2.1 AA intent — not formally audited)
Done: semantic landmarks, skip link, labelled inputs/selects, `aria-live` for results/chat/toast, `role=tablist/tab/tabpanel` with `aria-selected`, keyboard-focusable cards and buttons with visible focus ring (3 px), `lang` attribute switches with language, progressbar semantics, reduced-motion support, ≥ 4.5:1 text contrast on primary colours (white on #0f6e56 ≈ 6.0:1), touch targets ≥ 38–44 px, map markers are `<button>`s with descriptive labels.
Gaps: tab arrow-key navigation, map canvas has no non-visual equivalent beyond the results list (list mirrors pins), no screen-reader test pass (NVDA/TalkBack), confirm() dialog for cart replacement.

## 6. SEO & mobile
Title/description/OG tags, JSON-LD `WebApplication`, theme colour, manifest + icon (installable PWA), responsive bottom-sheet layout < 820 px, viewport-fit for notches. SPA content (shop pages) is not server-rendered → add SSR/static business pages (`/b/<slug>`) with LocalBusiness JSON-LD for organic discovery.

## 7. Licensing
| Component | Licence | Obligation |
|---|---|---|
| OpenStreetMap data (tiles, Overpass, Nominatim, OSRM graph) | ODbL 1.0 | Attribution shown on map ✅; share-alike for derived *databases* if we publish them |
| OpenFreeMap tiles / OpenMapTiles schema & style | Open (see each project's licence page; verify before launch) | Attribution shown ✅; heavy use of the public instance → self-host |
| MapLibre GL JS | BSD-3-Clause | Licence file shipped in `web/vendor/LICENSE.txt` ✅ |
| OSRM | BSD-2-Clause | – |
| Express | MIT | – |
| DIGIPIN algorithm | Published openly by India Post (see RESEARCH §1.2) | Our implementation is independent, verified against India Post's example output |
| Google Maps / Mappls | Proprietary | **No code, data or API output used or stored** ✅ (clean-room, RESEARCH §2) |
| Public demo servers (OSRM, Nominatim, Overpass, OpenFreeMap) | Usage policies | Dev only; self-host before launch |
| Project code | UNLICENSED (owner's choice) | Choose a licence before publishing |

## 8. Scalability path
1. **City pilot (now)**: 1–2 containers, SQLite WAL, self-hosted OSRM → hundreds of orders/day.
2. **Multi-city**: PostgreSQL+PostGIS (schema ready), Redis, event bus, Valhalla, Photon/Nominatim, PMTiles on CDN; stateless API pods behind LB; rider GPS ingest via WebSocket gateway; VROOM batching.
3. **Nationwide**: partition orders/pings by time & region, H3-sharded supply/demand, search cluster, ONDC as BAP/BPP, multi-region active-passive in India.

## 9. Verdict
A working, tested MVP of the core loop (find → compare → order → dispatch → track) with India-specific address intelligence and 11-language UX, built only on legitimate open data. Not production-launch-ready until: real sellers/inventory, payments, rider app with GPS, self-hosted map stack with Survey-of-India boundaries, cookie-based auth, Redis/PostGIS, DPDP compliance, and native-speaker i18n review.

## v0.2 audit (2026-10-18)
- `npm test`: **44/44 pass** (32 v0.1 + 12 new: migration 002 integrity, Razorpay order/verify/webhook with stubbed HTTP, disabled-payments 503, notifications, admin RBAC/overview/CSV, product deactivation, user disable revokes live JWT, GSTIN validation, Capacitor CORS).
- Chromium E2E against server: **21/21 pass** (desktop + mobile), 0 console errors; new steps: offline map renders bundled PMTiles with zero online tile requests, admin dashboard (verify seller, products, users, audit, CSV download), notifications bell, settings URL validation.
- Migration 002 verified on a v0.1 database with existing orders: rows and order_items preserved, `PRAGMA foreign_key_check` clean, cascades still active.
- Security changes: production refuses to seed without `ADMIN_PASSWORD` (≥12 chars); disabled users lose access immediately; Razorpay signatures checked with constant-time compare; webhook verified over raw bytes; CSV export guards against formula injection; CSP extended only for checkout.razorpay.com; Android `allowBackup=false`, cleartext disabled.
- APK: built in CI (GitHub Actions, x86 runner). The Hark sandbox is aarch64, where Google ships no Android build-tools, so no APK is built locally.
