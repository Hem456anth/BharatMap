# Bharat Map v0.4 — Test report

Run date: 19 Oct 2026 (IST). Raw outputs: `docs/test-output.txt` (npm test), `docs/e2e-results.txt` (Chromium E2E),
`docs/perf-v04.json` (performance). Screenshots: `docs/screenshots/v04-*.png` (new) and `v03-*.png` (regression).

## Summary
| Suite | Result |
|---|---|
| Unit + API (`npm test`, node:test) | **95 / 95 pass** (64 from v0.3 + 31 new) |
| Browser E2E (`tests/e2e.mjs`, Chromium, desktop 1366×820 + mobile 390×844) | **64 / 64 pass** — 43 v0.3 regression journeys (two-wheeler step updated for Valhalla) + 21 new v0.4 steps; 0 console errors |
| Demo build (`npm run build:demo`) | OK — `dist/india-mapos-demo.html` (467 KB) with lazy modules inlined |
| CI | run 7 (`ac669ba`): tests + audit + secret scan ✅, E2E ✅, Android Gradle build incl. the new BackgroundNav plugin ✅ |
| Real-service smoke (sandbox shell, not CI) | `/api/v1/route?mode=two` → live FOSSGIS Valhalla `motor_scooter`, 3 routes, 0.7 s; `make-region.sh vijayawada 13` → real 1.5 MB PMTiles served with HTTP Range (206) |

## New unit + API tests (31)
| File | Tests | Covers |
|---|---|---|
| `tests/v04.test.js` | 25 | LRU+TTL cache; token bucket; upstream UA + 1 req/s spacing + cache + coalescing; timeout + circuit breaker (open → short-circuit → half-open → closed; 404 doesn't trip); `withFallback`; provider config; route chain (two-wheeler Valhalla → OSRM estimate → straight line; drive OSRM-first; avoid tolls → Valhalla with `use_tolls:0`; self-hosted Valhalla first); geocode chain (Photon → Nominatim; autocomplete never Nominatim); EV via OCM (key never in output) and OSM fallback; polyline6 / simplify / projection; Valhalla request + real response parsing; **tolls along a real NH16 route** (2 plazas, Agnampudi, merged booths, toll-road length); EV/parking tag parsing; GTFS CSV edge cases, ZIP reader, loader, timetable, calendar_dates; RAPTOR on a labelled test fixture (walk → ride → transfer → ride → walk) and on the **real HMRL feed** (Miyapur → Uppal = Red → Blue at Ameerpet); pack/unpack lossless; low-bandwidth policy; corridor tiles; region manager (real PMTiles bytes, progress, cancel, 404, wrong file, delete); offline saved-place geocoding; client routing order without a server; on-device transit planning; i18n v0.4 completeness (11 languages) |
| `tests/v04-api.test.js` | 6 | `/api/v1/route` (Valhalla/OSRM, validation, UA on every upstream call), geocode/reverse/places/ev, tolls, transit feeds/plan/stops, regions catalogue + providers + gzip + `/config.js` + version, per-IP 429 with Retry-After |

## New E2E steps (fixtures = real captured responses; the browser has no internet)
| Step | Desktop | Mobile |
|---|:-:|:-:|
| Performance: load, map-ready, FPS, JS bytes; Shop demo backend + admin **not** loaded at boot | ✅ | ✅ |
| Transit: scheduled HMRL itinerary Miyapur → Uppal (Red Line → change at Ameerpet → Blue Line), legs on map, "Scheduled times, not live", attribution | ✅ | ✅ |
| Tolls: Dwaraka Nagar → Anakapalli, 2 OSM plazas (fees not available), markers; avoid tolls → Valhalla `auto` | ✅ | ✅ |
| EV details (operator, points, connectors from OSM) | ✅ | ✅ |
| Parking details (fee, capacity, type) | ✅ | ✅ |
| Airport chip + rail/airport overlays | ✅ | ✅ |
| Low-bandwidth toggle → zoom cap 16, no 3D, 3 km Overpass | ✅ | ✅ |
| Offline region download (mocked host): progress → Cache Storage → used by the offline map → delete | ✅ | ✅ |
| Background-navigation rationale → foreground service start (stub plugin) → fix forwarded → stop on end | ✅ | ✅ |
| Low-bandwidth auto-detected (stubbed `navigator.connection` Save-Data/3G) | – | ✅ |
| Two-wheeler now uses Valhalla `motor_scooter` (no "Estimate" label) | ✅ | ✅ |

## Performance (headless Chromium, SwiftShader software GL, aarch64 sandbox — `docs/perf-v04.json`)
| Metric | Desktop | Mobile 390×844 |
|---|---|---|
| `load` event | 1.27 s | 0.82 s |
| Map style + Bharat Map layers ready | 4.4 s | 3.1 s |
| FPS during a 2 s `easeTo` | 2.4 | 7.1 |
| JS loaded at boot | 51 files, 2.08 MB decoded (MapLibre 1.1 MB + worker 0.5 MB; app code 0.43 MB unminified) | same |
FPS is software-rendered (no GPU in the sandbox/CI) and is **not representative of a phone**; it is recorded to catch
regressions. Load figures are from localhost. App-code size: 428 KB of own JS (unminified, served as ES modules).

## Not covered automatically
- Background navigation on a real Android device (Gradle build is verified in CI; JS flow with a stub plugin).
- Real touch gestures (two-finger tilt/rotate, double-tap-drag zoom) — MapLibre handlers, not synthesised in E2E.
- Open Charge Map with a real key; self-hosted Valhalla/Photon/Nominatim (fake-upstream API tests only).
- TalkBack on hardware; native-speaker review of ta, kn, ml, bn, mr, gu, pa, or.

---

# Bharat Map v0.3 — Test report (previous release)

Run date: 18 Oct 2026 (IST), on the release commit. Raw outputs: `docs/test-output.txt` (npm test),
`docs/e2e-results.txt` (Chromium E2E), `docs/e2e-demo-results.txt` (single-file demo E2E). Screenshots: `docs/screenshots/v03-*.png`.

## Summary
| Suite | Result |
|---|---|
| Unit + API (`npm test`, node:test) | **64 / 64 pass**, 0 fail |
| Browser E2E (`tests/e2e.mjs`, Chromium) | **43 / 43 pass** — desktop 26, mobile 17 |
| Single-file demo E2E (`tests/e2e-demo.mjs`) | **6 / 6 pass** |
| Demo build (`npm run build:demo`) | OK — `dist/india-mapos-demo.html` (333 KB) |
| CI (GitHub Actions) | tests + audit + secret scan, E2E, Android APK build and release — see the run linked from the release |

## Unit + API (64)
| File | Tests | Covers |
|---|---|---|
| `tests/unit.test.js` | 20 | geo (haversine, DIGIPIN vs India Post reference, round-trip), address resolver (landmark/locality/pincode, Telugu), i18n (11 languages), query parsing, search ranking, pricing, rider assignment, tracking, route optimisation |
| `tests/api.test.js` | 12 | health + security headers, search validation, geocode/route/optimize, auth + lockout + RBAC, the full order → rider → tracking → delivered flow, order validation, wholesale, seller dashboard, SQL-injection inertness, metrics |
| `tests/phase2.test.js` | 12 | migrations, config without secrets, CORS (Capacitor origin only), Razorpay order/signature/webhook, notifications, admin (RBAC, CSV, deactivation, user disable, GSTIN) |
| `tests/v03.test.js` | 16 | opening_hours parser, off-route detector (3 fixes > 50 m, accuracy-aware), route tracker, maneuver text en/hi/te, landmark instructions (≤ 150 m), distance rounding, sheet detent maths, Overpass query/parse, OSRM URL/parse/fallback, geocode parsing, saved-places model, i18n completeness for en/hi/te |
| `tests/v03-api.test.js` | 4 | saved places API (auth, round-trip, per-user isolation, size cap), CSP header = app-shell `<meta>`, version 0.3 + migration 003 + style-proxy allow-list, service-worker precache list only names existing files |

## Browser E2E journeys
Viewports: desktop 1366×820, mobile 390×844 (touch). Every journey passed on each viewport it runs on.

| Journey | Desktop | Mobile |
|---|:-:|:-:|
| Map-first home (search pill, 12 category chips, saved, recents) | ✅ | ✅ |
| Sheet detents (keyboard on grabber, drag, fling) | ✅ | ✅ |
| Category "Petrol" → OSM POIs → list + markers | ✅ | ✅ |
| Place card (category, distance, address, actions) | ✅ | ✅ |
| Save to Favourites + set Home → shown on home sheet | ✅ | ✅ |
| Search "RK Beach" → directions with alternatives | ✅ | ✅ |
| Modes: two-wheeler estimate label, walk = foot profile, transit stops (no timetable) | ✅ | ✅ |
| Simulated drive → nav banner, en-IN voice, mute, arrival | ✅ | ✅ |
| GPS off-route (3 fixes > 50 m) → reroute | ✅ | — |
| Landmark + Telugu instructions in step list and voice | ✅ | — |
| Drop pin (right-click / long-press) → reverse geocode → place card | ✅ | ✅ |
| Photon type-ahead | ✅ | — |
| Layers sheet (style, 3D, transit, overlays, traffic disabled) | ✅ | — |
| Offline maps screen (bundled regions + sizes) | ✅ | — |
| Dark mode (settings → dark map + tokens) | ✅ | ✅ |
| Auto dark theme from `prefers-color-scheme` | — | ✅ |
| Offline fallback: network map fails → bundled PMTiles; routing fails → labelled estimate | — | ✅ |
| Shop: "LED TVs near me" → sellers + price markers | ✅ | ✅ |
| Telugu UI + native-script product query | ✅ | ✅ |
| Cart → sign in → order → live tracking | ✅ | ✅ |
| Assistant supplier discovery | ✅ | ✅ |
| Saved places sync to server when signed in | ✅ | — |
| Seller dashboard edit · mobility + address intelligence · admin dashboard · notifications · settings | ✅ | — |
| Console errors = 0 | ✅ | ✅ |

Single-file demo (`file://`, no server): shell boots and Shop search renders, in-browser backend active, order placed,
tracking progresses, category search, page errors 0.

## Fixtures caveat (read this)
The test sandbox has **no outbound internet**. Third-party map services the app calls — Overpass, Nominatim, Photon,
OSRM (routing.openstreetmap.de) and OpenFreeMap tiles/styles — are intercepted by `tests/e2e-net.mjs` and answered from
**real responses captured from those services** (`tests/fixtures/*.json`, Visakhapatnam / Hyderabad areas). The E2E
therefore proves the app parses and renders genuine service payloads, but not live availability, rate limits or
latency of the public endpoints. Web Speech is stubbed to record utterances (language + text) rather than play audio.
On real devices and in CI's live Chromium, these services are reached over the network.

## Accessibility and contrast
- Text tokens are ≥ 4.5:1 on their surfaces in both themes (computed; e.g. white on action green ≈ 6:1).
- E2E asserts ARIA state: sheet handle `aria-label` (collapsed/half/full), route options `aria-checked`, mute `aria-pressed`;
  navigation instructions are in an `aria-live` region; sheet operable by keyboard (↑/↓, Home/End).
- Release fixes from the screenshot review: (1) dark basemap street/place labels were dim grey (~2:1); they are now
  drawn light grey (#B9BDCB) with a dark halo (≈ 9–10:1 on the dark base) in `web/map/style.js`; (2) the map scale bar showed through/under the
  navigation banner — it is now hidden during navigation (`web/styles.css`).
- Not done: an external audit tool (axe) run, or TalkBack testing on a physical device.

## Privacy and security
- Location is requested only on a user action (locate, directions from current location, navigation).
- Recents and saved places stay on the device; they sync to `/api/me/places` only when signed in to a server. Settings has "Clear search history".
- One CSP (`shared/csp.js`) is used for the server header and the app-shell `<meta>` (Android); `connect-src` lists only
  OpenFreeMap, Overpass, Nominatim, Photon, OSRM, Razorpay and the backend host. A unit test enforces header = meta.
- Server also sends `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: geolocation=(self), camera=(), microphone=()`.
- CI fails on high/critical `npm audit` findings and on committed secret patterns.

## Known gaps
- No live traffic and no transit timetables (need licensed feeds); two-wheeler ETA uses the car graph and is labelled an estimate.
- Third-party services covered by fixtures only in the sandbox (see above); public OSM endpoints have fair-use limits and need self-hosting at scale.
- Hindi and Telugu are complete; 8 other languages fall back to English for v0.3 strings.
- Android: background navigation (foreground service) and push while the app is closed (FCM) are not built; the APK is debug-signed unless release secrets are set.
- Native plugin behaviour (Share sheet, back button, native TTS) is compiled by CI but not exercised by automated tests on a device/emulator.
- Shop sellers, products and riders are fictional demo data.
