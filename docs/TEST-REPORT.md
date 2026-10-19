# Bharat Map 0.5.13 — release APK

Run date: 19 Oct 2026 (IST). First **release** build (previous releases shipped only a debug-signed APK).

| Check | Result |
|---|---|
| CI | [run 13](https://github.com/Hem456anth/BharatMap/actions/runs/39209827250) (`4c89851`): unit + API + audit + secret scan ✅, Browser E2E ✅, Android ✅ — `assembleDebug assembleRelease`; release built without signing secrets (see below) → `bharat-map-0.5.13-release-unsigned.apk` 100,294,263 bytes, `aapt`: `versionCode='13' versionName='0.5.13'`, no `application-debuggable`, `zipalign -c -P 16 4` OK |
| Signing | Signed offline with the Bharat Map release key (`apksigner` 0.9, build-tools 35): **Verifies**, v1 ✅ v2 ✅ v3 ✅, signer `CN=Bharat Map`, RSA 4096, cert SHA-256 `d04d20f9fd727d7ca6d966e771e2ed5760b20fefe9c139d36f0e3e86b7997c6c` |
| Re-verified on GitHub | [attach run](https://github.com/Hem456anth/BharatMap/actions/runs/39210777662): sha256 of the signed APK matches (`bc487abc…9a731eaa4f`), `apksigner verify` ✅, `zipalign` ✅, `aapt` → debuggable=false; attached to the release |
| Release | [v0.5.13](https://github.com/Hem456anth/BharatMap/releases/tag/v0.5.13): `bharat-map-0.5.13.apk` **100,443,822 bytes** (95.8 MiB, release, main asset) + `bharat-map-0.5.13-debug.apk` 102,777,634 bytes |
| Not debuggable | `aapt dump badging` has no `application-debuggable`; the `<application>` element of the binary manifest has no `android:debuggable` attribute (androguard); `buildTypes.release` sets `debuggable false` |
| Unchanged by design | `minifyEnabled false`, `shrinkResources false` (no R8, no resource shrinking); version scheme `0.5.<run number>` / versionCode = run number |
| Install note | Release key ≠ debug key → uninstall a 0.5.12-or-older debug install once, then install `bharat-map-0.5.13.apk` |

# Bharat Map sprint 0.5.11 — Test report

Run date: 19 Oct 2026 (IST), aarch64 sandbox, Chromium 141 headless (SwiftShader). Raw outputs: `docs/test-output.txt` (npm test),
`docs/e2e-results.txt` (Chromium E2E). New screenshots: `docs/screenshots/v06-*.png`.

## Summary
| Suite | Result |
|---|---|
| Unit + API (`npm test`, node:test) | **141 / 141 pass** (120 from v0.1–v0.5 + 21 new) — green on two consecutive runs |
| Browser E2E (`tests/e2e.mjs`, desktop 1366×820 + mobile 390×844) | **102 / 102 pass** — desktop 58, mobile 44 (91 regression + 11 new); 0 console errors. Local full run 1 green; run 2: see CI/notes below |
| Offline routing graph (`scripts/build-graph.sh`) | Visakhapatnam built and routed offline (`scripts/graph-smoke.py`): 71 tiles, 10.9 MB tar, 3.7 MB gz — `docs/OFFLINE_ROUTING.md` |
| CI | [run 12](https://github.com/Hem456anth/BharatMap/actions/runs/39204245141) (`a409eda`): unit + API + audit + secret scan ✅, Browser E2E ✅ (102 / 102 on GitHub's Chromium, 0 FAIL), Android Gradle build ✅ → release [v0.5.12](https://github.com/Hem456anth/BharatMap/releases/tag/v0.5.12), `bharat-map-0.5.12-debug.apk` 102,777,637 bytes (98.0 MiB): `AndroidManifest.xml`, `classes.dex`–`classes4.dex`, 11 offline PMTiles, `offline/search/index.json` (12.5 MB raw), launcher `shortcuts.xml`. [Run 11](https://github.com/Hem456anth/BharatMap/actions/runs/39202827569) (`5d2dd88`) failed only on E2E `low-bandwidth toggle … restored` (desktop) — fixed below; its automatically published v0.5.11 APK predates the fix |

### New unit + API tests (21)
`tests/v06.test.js` (19): device tiers (2 GB phone → low; 3 GB + 4 cores → low; 2G / Save-Data → low; 8 GB + 8 cores → high;
unknown → mid; policy for low; manual override; low tier forces low-bandwidth with reason `device-tier`); transliteration
(Telugu/Devanagari/Tamil/Kannada → Latin; one phonetic key for Simhachalam/సింహాచలం/सिंहाचलम, Visakhapatnam/విశాఖపట్నం, Gajuwaka,
Kailasagiri, Kanchipuram/காஞ்சிபுரம், Bengaluru/ಬೆಂಗಳೂರು, Charminar, Vijayawada; Latin → Telugu); offline search v2 on the **real
bundled index** — **8 query groups with the right top hit offline**: `simhachalam` → the place OSM names సింహాచలం; `సింహాచలం` and
`सिंहाचलम` → Simhachalam; `గాజువాక` → Gajuwaka; `చార్మినార్` / `चारमीनार` / `charminar` → Charminar (Hyderabad); `ఋషికొండ` → Rushikonda;
`rushikonda` → ఋషి కొండ; `vizag steel` → Visakhapatnam Steel Plant; `kailasgiri` → Kailasagiri; pincode `530016`; DIGIPIN; index
shape (11 regions, > 55 k places, > 1 k Telugu and Hindi names, > 100 pincodes, sorted keys); a tiny hand-built index; **server FTS5
agrees with the device index** for 4 queries; road hints (conditional parsing, odd-even notes, width, flags; **real** Valhalla
trace for Dwaraka Nagar → Anakapalli finds the Port Main Road Flyover at ≈ 2.6 km and never derives "narrow" from Valhalla
lane counts; Overpass next to Valhalla adds tag facts only; **synthetic** restriction fixture → badge, narrow + service hints, IST
in-force evaluation); i18n en/hi/te for the new keys; voice picker (filter + order, English-India fallback, persisted choice sets
the guidance language, missing voice → null).
`tests/v06-api.test.js` (2): `GET /api/v1/places/search` (engine `fts5`; Latin ↔ Telugu/Hindi; pincode; DIGIPIN),
`POST /api/v1/road-hints` (real fixtures → flyover events; non-India line → 400).

### New E2E steps (11)
| Step | Desktop | Mobile |
|---|:-:|:-:|
| Device tier: faked 2 GB device → Lite (no 3D, label shift 1, max pitch 0, no prefetch, low-bandwidth `device-tier`); Settings shows "Automatic (Lite…)" + reason; override to Full persists | ✅ | ✅ |
| Offline search v2 suggestions: `simhachalam` → "Simhachalam · సింహాచలం", `గాజువాక` → Gajuwaka, `530016` → Pincode | ✅ | ✅ |
| Offline search v2 with the network off: Hindi `सिंहाचलम` submitted → Simhachalam from the bundled index | ✅ | — |
| Road hint "Take the flyover" ~380 m before the Port Main Road Flyover (real NH16 Valhalla edges), spoken once; Telugu chip | ✅ | ✅ |
| Service-road hint + time-restriction badge "No entry · Mo-Sa 08:00-11:00 · In force now/Not in force now" + narrow event (**synthetic fixture**) | ✅ | ✅ |
| Indic voice picker: te/hi/ta + English-India listed, fr-FR filtered out; Telugu sample spoken with the te-IN voice; guidance then speaks te-IN; back to Automatic | ✅ | ✅ |

### Fix after CI run 11
- **Low-bandwidth / device-tier changes were skipped while tiles were loading** (CI failure on `v04 desktop: low-bandwidth toggle … restored`):
  `ctx.bw.refresh()` applied the policy only when `map.loaded() || map.isStyleLoaded()`, and MapLibre reports both as false while any
  source is still fetching tiles. On CI's slower runner, turning low-bandwidth off mid-load left the zoom cap at 16. The zoom cap and
  prefetch delta are now applied unconditionally (layer visibility changes are guarded and re-applied on `style.load`); `ctx.tier.set()`
  had the same guard and got the same fix (`web/shell.js`, `web/map/style.js`). New E2E regression assertion: the step simulates the
  loading state (`loaded()`/`isStyleLoaded()` → false) before unticking and requires max zoom 20 — it fails on `5d2dd88` (maxZoom 16)
  and passes with the fix. Unit + API re-run: 141 / 141.

### Test-harness change
E2E contexts now pin `navigator.deviceMemory = 8` and `hardwareConcurrency = 8`: the 2-vCPU sandbox would otherwise be detected
as a Lite device (≤ 2 cores) and the v0.3 "3D buildings" step failed on the disabled 3D button in the first full run. The device-tier
step overrides the pin with a 2 GB profile.

### Fixtures caveat (new fixtures)
`valhalla-roadhints-*.json` and `overpass-roadhints-dwarakanagar-anakapalli.json` are **real responses** captured 19 Oct 2026 from
valhalla1.openstreetmap.de `/trace_attributes` and the Overpass API (User-Agent `BharatMap-test-fixture/0.6`).
`overpass-roadhints-synthetic-rkbeach.json` is **synthetic** (marked `"synthetic": true`, way ids negative, names prefixed
"(synthetic)") — no captured route carries `*:conditional` tags, so the restriction badge, narrow-road and service-road UI are
verified on invented tags laid on the real RK Beach route geometry. The search index and pincodes are real OSM data
(`scripts/search-data/osm-extras/`, ODbL).

### Known gaps
- Real Android devices: TTS voice lists (Capacitor `getSupportedVoices`), tier detection in the WebView, hint timing while driving.
- No Indic search benchmark set yet; on-device engine for offline routing not started; Overpass path of `build-graph.sh` untested
  (public endpoints refused the bbox query; Geofabrik path tested).

---

# Bharat Map v0.5 — Test report

Run date: 19 Oct 2026 (IST). Raw outputs: `docs/test-output.txt` (npm test), `docs/e2e-results.txt` (Chromium E2E),
`docs/perf-v04.json` (performance, re-measured). Screenshots: `docs/screenshots/v05-*.png` (new), `v04-*` and `v03-*` (regression).

## Summary
| Suite | Result |
|---|---|
| Unit + API (`npm test`, node:test) | **120 / 120 pass** (95 from v0.3–v0.4 + 25 new) |
| Browser E2E (`tests/e2e.mjs`, Chromium, desktop 1366×820 + mobile 390×844) | **91 / 91 pass** — desktop 52, mobile 39 (v0.3 regression 43, v0.4 regression 21, v0.5 new 27); 0 console errors. Green on two consecutive full local runs after the camera fix below |
| Demo build (`npm run build:demo`) | OK — `dist/india-mapos-demo.html` (585 KB) |
| CI | [run 10](https://github.com/Hem456anth/BharatMap/actions/runs/39164678113) (`f4e1966`): unit + API + audit + secret scan ✅, Browser E2E ✅ (91 / 91 on GitHub's Chromium), Android Gradle build ✅ → release [v0.5.10](https://github.com/Hem456anth/BharatMap/releases/tag/v0.5.10), `bharat-map-0.5.10-debug.apk` 98,439,746 bytes (93.9 MiB): `AndroidManifest.xml`, `classes.dex`–`classes4.dex`, 11 offline PMTiles + 11 offline place indexes, launcher `shortcuts.xml`. Run 9 (`6b4ef2b`) failed only on E2E `layers sheet … pitched` — fixed above |

### Unit + API by file (120)
| File | Tests | File | Tests |
|---|--:|---|--:|
| `tests/unit.test.js` | 20 | `tests/v04.test.js` | 25 |
| `tests/api.test.js` | 12 | `tests/v04-api.test.js` | 6 |
| `tests/phase2.test.js` | 12 | `tests/v05.test.js` | **20** |
| `tests/v03.test.js` | 16 | `tests/v05-api.test.js` | **5** |
| `tests/v03-api.test.js` | 4 | **Total** | **120** |

`tests/v05.test.js` (20): lanes from OSRM intersections (real Bengaluru fork fixture) + Valhalla bitmasks + lane strip HTML;
maxspeed parsing (`"50"`, `"50 mph"`, `IN:urban` → unknown), Valhalla `trace_attributes` (real fixture), OSRM annotation, Overpass
ways matched to the route; overspeed timing (> 10 % for 2 s, re-arm after 10 s); speed from fixes; tracker along-route distance;
NOAA sunrise/sunset vs published times; deep links (geo:, bharatmap://, https, **launcher shortcuts in `shortcuts.xml` all parse**);
share/list links round-trip; OSM note payload + rate limit; incidents expiry/confidence; junction view SVG; sound cues; offline place
index; privacy model (export excludes the token); multi-stop URLs; i18n v0.5 completeness (en/hi/te).
`tests/v05-api.test.js` (5): `/api/v1/incidents` (create → list → votes → expiry; "gone" votes, rate limit), `/api/v1/live`,
`/api/v1/speed-limits`, `/api/v1/route` with `via=` (one OSRM request, lanes in steps).

### E2E journeys per viewport
| Group | Desktop 1366×820 | Mobile 390×844 (touch) |
|---|--:|--:|
| v0.3 regression (map-first shell, search, places, directions, navigation, Shop, admin, …) | 26 | 17 |
| v0.4 regression (performance, transit, tolls, EV/parking, low bandwidth, offline regions, background nav) | 10 | 11 |
| v0.5 new (below) | 16 | 11 |
| **Total** | **52** | **39** |

v0.5 E2E steps: deep link `?lat&lon&name` (D/M); speed limit + overspeed chime + junction view (D/M); lane guidance (D/M); speed
limit never shown where unknown (D/M); forced night driving style (D/M); report a map problem → OSM note, rate limited (D/M);
device-only community incident (D/M); deep links + shared list import (D/M); multi-stop (D); commute card (D); **launcher shortcut
link + arrival trip summary** (arrival banner stays on "You have arrived", no revert to the last turn) (D); offline place index (D);
privacy dashboard export/delete (D); location rationale/denial (D/M); voice search (M); server-mode incidents + live location
sharing (D); console-error checks per group.

### Fixes in this round
- **Camera kept its tilt after navigation (CI failure on `layers sheet … pitched`, run for `6b4ef2b`)**: ending navigation eases the
  map back to flat/north-up over 600 ms; any camera move started before that ease finished (e.g. flying to a dropped pin; on CI's
  software renderer the ease is easily still running) cancelled it and left the map at ~53°, so the next 3D tap toggled to 2D.
  `web/map/camera.js` now keeps a *flatten* intent that is merged into the next fly/ease/fit until the map is flat (cleared by an
  explicit pitch or a user gesture); the 3D button treats a pending flatten as flat. New E2E regression: end navigation and
  immediately fly elsewhere — the map must still settle flat (it stayed at 53° before the fix).
- **Deterministic waits** instead of fixed sleeps around the camera: wait until the map is not moving and flat before the layers
  step, wait for pitch > 40 after 3D, wait for flat after the compass reset (assertions unchanged).
- Arrival screen no longer reverts to the last turn when late speed-limit data arrives; E2E mock returns no speed-limit edges
  outside the captured Bengaluru route, so limits stay unknown elsewhere (as with the real service).

### Fixtures caveat
Every third-party service in the browser E2E (Overpass, OSRM, Valhalla incl. `trace_attributes`, Nominatim, Photon, OSM Notes API,
tile/style hosts) is answered from **real captured responses** in `tests/fixtures/` or a labelled mock; the browser has no internet.
The OSM Notes API is mocked so tests never create real notes. Speed limits are only real for the captured Bengaluru (Silk Board →
Electronic City) trace; elsewhere the mock returns no edges. Results therefore verify our parsing, UI and fallbacks, not the live
availability or coverage of those services.

### Known gaps (not covered automatically)
- On-device Android: permission prompts, intent/deep-link delivery, launcher shortcuts, TTS and WebAudio output, speech
  recognition, background navigation (Gradle build is verified in CI; JS paths run with stub plugins).
- Real touch gestures (two-finger tilt/rotate) and TalkBack on hardware.
- Lane / speed-limit coverage in India depends on sparse OSM tagging; implicit `IN:*` limits are deliberately never shown.
- Native-speaker review of hi/te v0.5 strings; other 8 languages fall back to English for v0.5 keys.
- Single-file demo E2E (`tests/e2e-demo.mjs`) was not re-run for v0.5 (demo build only).
- Performance figures are SwiftShader software rendering, not representative of a phone.

---

# Bharat Map v0.4 — Test report (previous release)

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
