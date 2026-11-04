# Features and module status (v0.7.20)

Canonical feature inventory. It merges the former `docs/KNOWN_LIMITATIONS.md` (now a pointer) and the per-release
feature tables that used to sit in `README.md`. Evidence per item lives in the audits and test reports linked at the end.

**Status vocabulary — always keep these four apart when reporting:**

| Status | Meaning |
|---|---|
| ✅ **Implemented** | Works with real open data or real logic, covered by unit/API and/or E2E tests. **Nothing has been run on a real phone** unless stated |
| 🟡 **Prototype** | Code path exists and is tested against fixtures or locally computed signatures, but has never met the real counterpart (sandbox, network, device), or the data is labelled demo/estimate/approximate |
| 🔑 **External** | Built, but switched on only by a key, partner agreement or self-hosted service the project does not have yet |
| ❌ **Missing** | Not built (may be designed or documented) |

## Map, search and places

| Feature | Status | Where / note |
|---|---|---|
| Map-first shell: full-screen MapLibre map, floating search pill, three-detent bottom sheet (drag, fling, keyboard), locate/heading, compass, 2D/3D, reduced motion | ✅ | `web/shell.js`, `web/ui/sheet.js`, `web/ui/controls.js`, `web/map/camera.js` |
| Light/dark themes, "Deccan dusk" identity, design tokens (0.7.18 A1), category hues + India chip grid (A7), interaction states (A15) | ✅ | `web/styles.css`, `web/lib/ux.js`. Shop/admin/settings not migrated to the new tokens 🟡 |
| Online basemap (OpenFreeMap liberty/dark) via direct URL or `/map` proxy | ✅ | `web/map/style.js`, `server/app.js` |
| Offline maps: 11 bundled cities (Visakhapatnam, Hyderabad, Vijayawada, Guntur, Tirupati, Bengaluru, Chennai, Mumbai, Delhi NCR, Kolkata, Pune), auto-switch on failure | ✅ | `web/offline/*.pmtiles` (81.4 MB) |
| Offline region download manager (9 catalogue regions, progress/cancel/delete) | ✅ client · 🔑 needs a host for the files | `web/lib/region-manager.js`, `/regions/*.pmtiles`; E2E uses a mocked host |
| Search: recents, 12+ category chips, All categories page, landmarks/localities/pincodes/DIGIPIN, Photon type-ahead, Nominatim fallback | ✅ | `web/ui/search.js`, `web/services/geocode.js` |
| Offline search v2: one index over 86,977 places in 11 cities, native-script names, Latin ↔ Indic transliteration (9 scripts), 1,079 pincodes, DIGIPIN; server FTS5 | ✅ | `shared/search-index.js`, `shared/translit.js`, `web/lib/offline-search.js`, `server/lib/search-fts.js` |
| Locality-aware, typo-tolerant search ("Apollo Hospitals, Jubilee Hills", "apolo hospitl") — G2 | ✅ | `shared/search-locality.js` (device + server) |
| Real POIs from OSM via Overpass, "Search this area" | ✅ | `web/services/overpass.js` |
| Place card: hours parsed to open/closing soon/closed, phone, website, wheelchair, DIGIPIN, share/save/call, dropped pin + reverse geocode, block order + ribbon (A2) | ✅ · ❌ photos/ratings (no data source) | `web/ui/place.js`, `web/lib/opening-hours.js` |
| "Also here" (places inside the same building/station) | ✅ online only | `shared/services/also-here.js` |
| Empty/unavailable states always with an action (A4), map-failure banner (A5) | ✅ · 🟡 no raster fallback without WebGL | `web/ui/states.js`, `web/ui/map-health.js` |
| Landmark-anchor address resolution | ✅ (tests use a synthetic Madhapur fixture) | `shared/address.js`, `/api/v1/address/resolve` |
| Survey-of-India boundaries | ❌ (G4, launch blocker; licence/terms unclear) | plan in `docs/UPGRADE_REPORT_2026-11.md` §8 |
| Satellite imagery, street-level imagery, POI photos/reviews | ❌ | competitor matrix |

## Routing and navigation

| Feature | Status | Where / note |
|---|---|---|
| Drive / cycle / walk routes with up to 3 alternatives (FOSSGIS OSRM) | ✅ online | `web/services/routing.js` |
| Two-wheeler routing (Valhalla `motor_scooter`), avoid tolls / highways | ✅ online (shared FOSSGIS Valhalla, dev-only policy) | `shared/valhalla.js`; OSRM fallback labelled estimate |
| "Prefer main roads" (Valhalla costing; default on for 2W, off for car) — G1 | ✅ · ❌ gate snapping, "never route me here" polygons | `shared/guardrails.js`; OSRM path labelled "not applied" |
| Multi-stop routes (≤ 5 stops), via points on `/api/v1/route` (≤ 8) | ✅ | `web/ui/directions.js` |
| Truck routing (Valhalla truck costing) | ✅ server · 🟡 sparse OSM maxheight/maxweight in India | `/api/v1/route?mode=truck` |
| Turn-by-turn: banner, next step, ETA, follow camera, off-route reroute, arrival, simulate drive | ✅ (simulated GPS in tests) | `web/nav/navigation.js`, `web/nav/tracker.js` |
| Voice guidance en-IN/hi-IN/te-IN with landmark phrases; Indic voice picker (te, hi, ta, kn, ml, mr, bn, gu, pa, or) | ✅ · not device-tested | `web/nav/voice.js`, `web/nav/voices.js`, `web/nav/maneuver.js` |
| Lane guidance, junction view, WebAudio sounds, day/night style (NOAA) | ✅ | `shared/lanes.js`, `web/nav/junction.js`, `web/nav/sounds.js`, `shared/sun.js` |
| Speed limit sign (only when known) + overspeed chime | ✅ | `shared/maxspeed.js`, `web/services/speed.js` |
| India road hints: flyover, service road, narrow road, time-restriction badge | ✅ (restriction/narrow E2E use a labelled synthetic fixture) | `shared/roadhints.js`, `/api/v1/road-hints` |
| No silent reroutes: faster route offered with minutes saved, auto-switch opt-in, voice kept — G10 | ✅ (offers use free-flow times unless a traffic key exists) | `shared/reroute.js` |
| Arrival / get-off alarms — G7 | ✅ foreground only · ❌ background geofence | `shared/alarms.js`, `web/nav/alarms.js` |
| Background navigation (Android foreground service, type location) | ✅ compiled + E2E with a stub plugin · not device-tested | `BackgroundNavPlugin.java`, `NavLocationService.java` |
| Tolls: plazas on route from OSM | ✅ · ❌ fees (no open fee data) | `shared/tolls.js`, `/api/v1/tolls` |
| Commute card (Home/Work drive time) | ✅ ("no live traffic") | `web/ui/saved.js` |
| Live traffic | 🔑 TomTom/HERE key (`TRAFFIC_PROVIDER`); without it "Live traffic unavailable" | `web/ui/traffic.js`, `/api/v1/traffic/*` (tested with a mocked provider) |
| On-device offline routing | ❌ (C1/G5). Vizag Valhalla graph built (71 tiles, 10.9 MB tar), no engine; offline routes are a labelled straight line | `docs/OFFLINE_ROUTING.md` |
| Android Auto | ❌ feasibility doc only | `docs/ANDROID_AUTO.md` |
| Low-bandwidth mode, device tiers (Lite / Balanced / Full), route-corridor tile prefetch | ✅ | `web/lib/bandwidth.js`, `web/lib/device-tier.js`, `web/map/prefetch.js` |

## Transit and mobility

| Feature | Status | Where / note |
|---|---|---|
| Hyderabad Metro scheduled journeys (official HMRL GTFS, RAPTOR on device or server), station departures | ✅ Scheduled, not live | `server/transit/feeds/hmrl/`, `shared/transit/raptor.js`, `web/transit/hmrl.json` |
| Bengaluru Namma Metro (unofficial ODbL GTFS by Vonter; intermediate times approximated) — G3 part | 🟡 labelled approximate | `server/transit/feeds/bmrcl/`, `web/transit/bmrcl.json` |
| Extra GTFS feeds (e.g. TGSRTC) dropped into `TRANSIT_FEEDS_DIR` | ✅ server · 🔑 feed not available | `server/transit/index.js` |
| BMTC buses, Delhi OTD, GTFS-RT live vehicles, trains | ❌ (licence/size pending) | roadmap |
| EV charging (Open Charge Map when keyed, else OSM), parking, rail/airport layers | ✅ · 🔑 OCM key optional | `shared/ev.js` |
| Ride hand-off: Uber universal link with pickup/drop; exact pin + DIGIPIN + landmark in every hand-off; "Copy pickup for driver" — G9 | ✅ · not device-tested | `shared/handoff.js`, `web/lib/clipboard.js` |
| Ola deep link | 🔑 `OLA_XAPP_TOKEN` (partner-pending without it) | catalogue |
| Rapido / Namma Yatri / Bharat Taxi / Yatri Sathi | ✅ link-out + clipboard (no documented pickup parameter) | `shared/services/deeplinks*.js` |
| Ride fares, live ride ETAs | ❌ by design (fares Unavailable, ETA = routing Estimate) | |

## Place-card services and app hand-offs

| Feature | Status | Where / note |
|---|---|---|
| Service panels for 12 panel types, every value labelled Live / Scheduled / Estimate / Link-out / Demo / Unavailable, honesty self-check | ✅ | `shared/services/build.js`, `labels.js`, `panel-types.js`, `web/ui/service-panel.js` |
| Provider catalogue: 93 providers (functional 6, deeplink 1, prototype 6, partner-pending 10, linkout 64, unavailable 5, demo 1 — counted from `shared/services/catalog.js`) | ✅ | generated table `docs/INTEGRATION_MATRIX.md` |
| Link-out interstitial naming the destination host, flags unverified links | ✅ | `web/ui/linkout.js` |
| Verified app hand-offs: Uber documented; App Links only where the site's `assetlinks.json` lists the package (+ APK cert where an APK was supplied); Rapido declared intent (labelled Unverified); Play Store links for confirmed packages; Web-only otherwise; no payment schemes | ✅ · not tried on a phone | `docs/re/DEEPLINKS.md`, `ExternalAppPlugin.java` |
| Admin Listings: place verification + provider links (unverified until an admin verifies) | ✅ | `web/admin.js`, `/api/admin/place-services`, `/api/admin/provider-links` |
| Showtimes, menus, prices, slots, availability from providers | ❌ (no API access; `SHOWTIMES_FEED_URL` is a placeholder) | |
| Courier quotes (Shiprocket, Delhivery) | 🔑 partner-pending stubs (`501`) | `/api/v1/courier/:provider/quote` |

## Shop, orders and payments (the v0.2 commerce flow)

| Feature | Status | Where / note |
|---|---|---|
| Product search ("LED TVs near me"), sellers, price/stock, cart, multilingual intents, assistant | ✅ on **fictional demo sellers** | `shared/search.js`, `shared/seed.js` |
| Orders with atomic stock reservation, rider auto-assignment, SSE tracking | ✅ · rider movement **simulated** along a real route | `server/app.js`, `shared/logistics.js` |
| COD | ✅ | |
| Online order → `pending_payment` → separate payment screen `#/pay/<orderId>`; 30-min expiry, max 5 open | ✅ | `web/ui/payment.js` |
| Razorpay (test mode) | 🔑 keys; flow from v0.2 + fixture tests, no sandbox run in 0.7.x | `server/payments/index.js` |
| Cashfree, PhonePe, Paytm adapters | 🟡 prototype (locally computed signatures only) + 🔑 keys | |
| Refunds | ❌ manual (`refund_required` flag, AUD-38) | |
| Simulated UPI | 🟡 off unless `ALLOW_SIMULATED_UPI=1`; never marks paid | |
| Seller dashboard, admin dashboard (KPIs, users, businesses, products, orders, CSV, audit log) | ✅ | `web/admin.js`, `server/admin.js` |
| ONDC buyer flow | 🟡 prototype behind `ONDC_PROTOTYPE=1` against Bharat's own demo catalogue — **not the ONDC network**, unsigned, no registry | `server/services-api.js`, `web/ui/ondc.js` |
| Notifications: in-app inbox + local notifications while the app runs | ✅ | `server/notify.js`, `@capacitor/local-notifications` |
| Push when the app is closed (FCM) | ❌ (no sender, no Firebase project) | |
| Rider GPS app | ❌ | |

## Saved, sharing, community, privacy

| Feature | Status | Where / note |
|---|---|---|
| Home / Work / Favourites / custom lists on device; sync to `/api/me/places` when signed in | ✅ | `web/ui/saved.js`, `web/lib/saved-model.js` |
| List editor (rename, reorder, notes, delete), GPX 1.1 / KML 2.2 import + export | ✅ web · 🟡 Android share path not device-tested | `shared/geoformats.js`, `web/lib/file-io.js` |
| Track recording (foreground, filters, pause = new segment) | ✅ foreground · ❌ screen-off | `web/lib/track-model.js`, `web/ui/tracks.js` |
| Deep links in: `geo:`, `bharatmap://place\|directions\|search\|list\|live`, web `?lat=&lon=`; launcher shortcuts | ✅ | `shared/deeplink.js`, `AndroidManifest.xml`, `res/xml/shortcuts.xml` |
| Live location sharing (time-limited, secret-protected) and list sharing links | ✅ server · device-only otherwise | `server/community.js`, `web/ui/links.js` |
| Report a map problem / Suggest an edit / Add a missing place → anonymous structured OSM notes | ✅ (tests mock the Notes API; nothing is written to the OSM database) | `shared/osm-edit.js`, `web/ui/report.js` |
| Road incidents (2-hour, votes, confidence, "Community report, not verified"); along-route alerts + "Still there?" — G8 | ✅ (unverified by design; gameable, AUD-28) | `server/community.js`, `shared/route-alerts.js` |
| Voice search (Android speech recognition / Web Speech) | ✅ · not device-tested | `web/ui/voice-search.js` (`RECORD_AUDIO` permission) |
| Permission explainers, Privacy dashboard (what is stored, export JSON, delete all) | ✅ | `web/ui/permissions.js`, `web/ui/privacy.js` |
| Real OSM editing with an OSM account | ❌ (C14) | |

## Platform, languages, quality

| Item | Status | Note |
|---|---|---|
| Android app (Capacitor 7, minSdk 23, target/compile 35, package `com.indiamapos.app`) | ✅ built by CI · **no real-device test** | sandbox is aarch64: no local APK builds |
| Web app served by the API server; one-file serverless demo | ✅ | |
| iOS | ❌ | |
| 11 UI languages (en, hi, te, ta, kn, ml, bn, mr, gu, pa, or) | 🟡 en complete; hi/te written in-house and **need native review**; the other 8 fall back to English for most v0.3+ keys | `shared/i18n*.js` |
| Accessibility: 48 dp targets, WCAG AA text contrast, TalkBack labels, keyboard sheet, `aria-live` navigation | ✅ (automated checks only) | |
| Security hardening (Nov 2026 audit: all High/Medium fixed) | ✅ · 14 Low open | `docs/AUDIT-2026-11.md` |
| APK size ≈ 100 MB, no R8 | as designed; slimming pending owner approval | [DECISIONS.md](DECISIONS.md) ADR-012 |

## Known bugs and limitations

### Not verified outside the test harness
- **No real-device run** of any 0.7.x build: panels, payment screen, alarms, background navigation, voices, App Links
  into installed apps, Uber/WhatsApp hand-off, low-end device tiers. All UI checks are headless Chromium with captured or
  synthetic fixtures.
- **No payment-gateway sandbox run**; Cashfree/PhonePe/Paytm are prototypes; refunds are manual.
- **No ONDC network**: no registry subscription, no request signing (`ONDC_SIGNING_KEY` is not read by any code).
- **No live traffic key**: "Live traffic unavailable"; drive times are free-flow estimates.
- **Hindi/Telugu strings** have no native review; 8 languages fall back to English.

### By design (honesty rules)
- Deep links carry no guessed parameters; only Uber's documented link gets pickup/drop. No links to PhonePe or Google
  Pay; UPI only inside a configured gateway checkout; no `upi://` intents.
- Link-out only for almost every Indian provider: no menus, prices, slots, showtimes, fares or availability.
- Ride ETAs are routing Estimates; fares Unavailable. Metro departures are Scheduled, Hyderabad (official) and Bengaluru
  (unofficial, approximated) only. Toll fees unknown. Demo sellers fictional and always labelled Demo.

### Data and coverage
- "Prefer main roads" is applied only on Valhalla; on OSRM the directions sheet says it is not applied. Turning it on
  for cars moves car routing to the shared FOSSGIS Valhalla (1 req/s policy).
- Alarms are foreground only; incident alerts use unverified 2-hour reports; device-only votes stay on the device.
- Ride hand-off landmark = nearest curated landmark within 300 m (none when far from one).
- Provider URLs were checked on 20 Oct 2026; some could not be reached from the sandbox then (Ahmedabad Metro HTTP 500,
  Kerala RTC and Kolkata Metro no response; Swiggy/DMart 403 to automated requests).
- Offline map labels: MapLibre does not shape complex Indic scripts; Telugu/other Indic labels fall back to the default
  OSM name (`docs/ANDROID.md`).
- Admin Listings verification counts refresh on the next render after toggling a link.

### Known code and doc inconsistencies
- `package.json` `version` and `server/app.js` `VERSION` are `0.7.0`; releases are `0.7.<CI run>`; `/api/health` reports
  `0.7.0`.
- Comments in `.github/workflows/ci.yml` ("AUD-21" for least privilege) and `attach-apk.yml` ("AUD-22" for cert
  pinning) are off by one versus `docs/AUDIT-2026-11.md` (AUD-20 least privilege, AUD-21 cert pinning).
- `docs/test-output.txt` is a stale raw output from 0.7.16 (184 tests); current counts are in `docs/TEST-REPORT.md`.
- Stale GitHub release **v0.5.11** (commit `5d2dd88`, failed E2E, fixed in `a409eda`/v0.5.12) still exists — ask the
  owner before deleting it. Release **v0.7.19** has only the debug APK (no release-signed APK was attached).

## Evidence
[docs/AUDIT.md](docs/AUDIT.md) (per-release implemented / prototype / needs-paid-API tables) ·
[docs/AUDIT-2026-11.md](docs/AUDIT-2026-11.md) (security audit) · [docs/TEST-REPORT.md](docs/TEST-REPORT.md) ·
[docs/UPGRADE_REPORT_2026-11.md](docs/UPGRADE_REPORT_2026-11.md) · [docs/re/COMPETITOR_ANALYSIS_2026-11.md](docs/re/COMPETITOR_ANALYSIS_2026-11.md)
(matrix 31 ✅ / 9 🟡 / 1 💰 / 14 ❌ of 56 rows) · [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) ·
[docs/INTEGRATION_MATRIX.md](docs/INTEGRATION_MATRIX.md) · [docs/re/DEEPLINKS.md](docs/re/DEEPLINKS.md).
