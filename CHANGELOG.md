# Changelog

Rebuilt from `git log` (32 commits, `a0d17f9` … `ff85cb7`) and the 18 GitHub releases of Hem456anth/BharatMap.
Release tags are created by CI as `v<series>.<CI run number>` on the commit that triggered the run (tag → commit read
with `git ls-remote --tags`); docs-only commits carry `[skip ci]` and produce no release. Dates are IST (release
publish time from the GitHub API; commit dates converted from UTC). APK sizes are the release assets in bytes.

Version series in file names: sprint 0.5.11's code is named `v06` (`tests/v06*.test.js`, `shared/i18n-v06.js`) and the
CoMaps phase-0 code is named `v08` (`tests/v08.test.js`, `shared/i18n-v08.js`) although they shipped as 0.5.11 and
0.7.17. There was never a 0.6 or 0.8 release.

## [0.7.20] — 3 Nov 2026 — competitor gaps
Tag `v0.7.20` → `810a020` (CI run 20); docs `ff85cb7`. Assets: `bharat-map-0.7.20.apk` 100,688,504 (release key, signed
offline, attached via attach run 6), `bharat-map-0.7.20-debug.apk` 103,073,777.
- G1 "Prefer main roads" (Valhalla costing; OSRM fallback labelled "not applied"); G2 locality-aware, typo-tolerant
  search on device + FTS5; G3 (part) Bengaluru Namma Metro unofficial ODbL GTFS; G6 (part) "Add a missing place"
  structured OSM note; G7 get-off/arrival alarms (foreground); G8 on-route incidents + "Still there?"; G9 exact pickup
  hand-off (pin + DIGIPIN + landmark); G10 no silent reroutes, voice kept.
- en/hi/te strings (`shared/i18n-v0720.js`); +19 unit tests (247), +15 E2E steps (152); night-chip contrast and
  missing-place form layout fixes.
- Docs: `docs/UPGRADE_REPORT_2026-11.md`, `docs/re/COMPETITOR_ANALYSIS_2026-11.md` (matrix 26/10/1/14 of 52 → 31/9/1/14 of 56).

## [0.7.19] — 3 Nov 2026 — technical/security audit fixes
Tag `v0.7.19` → `4ae5bed` (CI run 19); docs `1b56d45`. Assets: debug APK only (103,014,892) — no release-signed APK attached.
- `docs/AUDIT-2026-11.md`: 41 findings (0 Critical, 4 High, 11 Medium, 20 Low, 6 Info); all High and Medium fixed plus
  6 Low; 19 regression tests (`tests/audit-2026-11.test.js`, 209 → 228).
- High: production demo accounts no longer use the README password (AUD-01); unpaid online orders expire after 30 min,
  max 5 per customer (AUD-02); style/tile proxy Host cache poisoning fixed, byte-bounded cache (AUD-03); body-parser
  advisory (AUD-17). Medium: roles re-read per request, SSE caps, async scrypt + per-IP auth limit, refund_required
  flag, raw body for form webhooks, legacy circuit breaker, migration 006 indexes, transactions always roll back,
  FileProvider cache-only, CI least privilege + SHA-pinned actions, release certificate pinned by SHA-256.

## [0.7.18] — 20 Oct 2026 — UI/UX pass (A1–A7, A15)
Tag `v0.7.18` → `e89b317` (run 18); docs `9ced124`. Assets: 100,638,568 (release) / 103,014,947 (debug).
- Design tokens, place-card block order + ribbon (Opening/Closing soon), route option cards with totals header + Start,
  empty states that always offer an action, map-failure banner, autocomplete polish, category hue tokens + India chip
  grid + All categories, hover/press/focus states. Dark cards darker than the panel at the owner's request.
- Tests 209 unit/API, 137 E2E.

## [0.7.17] — 20 Oct 2026 — CoMaps as the primary blueprint (phase 0)
Tag `v0.7.17` → `a9e29d9` (run 17); docs `ce23e56`. Assets: 100,613,695 / 102,987,500.
- `docs/re/COMAPS_TEARDOWN.md` (Apache-2.0; architecture; roadmap C1–C17); GPX/KML import-export, list editor, track
  recording, "Suggest an edit" OSM notes, Android Auto feasibility doc, CoMaps in the deep-link inventory.
- Tests 199 unit/API, 120 E2E.

## [0.7.16] — 20 Oct 2026 — hand-offs for every remaining provider
Tag `v0.7.16` → `113fbe2` (run 16); docs `72a6e5a`. Assets: 100,527,145 / 102,870,212.
- App Links from `assetlinks.json` (18), Play Store links for officially confirmed packages (41), Web-only (8) with
  reasons; Ola documented only with its token; Store/Web-only labels; Play intent allow-list. 184 unit/API, 114 E2E.

## [0.7.15] — 20 Oct 2026 — verified app deep links
Tag `v0.7.15` → `5cb9301` (run 15); docs `3f52cd6`. Assets: 100,518,861 / 102,860,835.
- Manifest-only inventory of user-supplied APKs (`scripts/extract-deeplinks.py`); Uber documented; App Links (Swiggy,
  Zomato, District, BookMyShow, Blinkit, Agoda, MakeMyTrip, Park+, Apollo 24|7, Tata 1mg) checked against
  `assetlinks.json`; Rapido declared intent with https fallback; no payment-app links; native `ExternalApp` opener.
  175 unit/API, 112 E2E.

## [0.7.14] — 20 Oct 2026 (commit 19 Oct UTC) — place-card services, payments screen
Tag `v0.7.14` → `340e23b` (run 14); `1ec883f` added `attach-apk.yml`; docs `e03fdf5`. Assets: 100,510,581 / 102,851,530.
- Service panels (12 types) with honesty labels; provider catalogue (92 at the time) + generated
  `docs/INTEGRATION_MATRIX.md`; link-out interstitial; online orders → `pending_payment` → `#/pay/<id>`; Razorpay +
  Cashfree/PhonePe/Paytm prototype adapters (env keys only); no `upi://`; migration 005; `server/services-api.js`
  (panels, integrations, traffic proxy, ONDC prototype, courier stubs, truck routing, landmark addresses); admin
  Listings. Version scheme becomes `0.7.<run>`. 166 unit/API, 112 E2E.

## [0.5.13] — 19 Oct 2026 — first release-signed APK
Tag `v0.5.13` → `4c89851` (run 13); docs `f6f850d`. Assets: 100,443,822 (release) / 102,777,634 (debug).
- Env-driven release `signingConfig` (falls back to unsigned), no R8/shrink, not debuggable; CI `assembleRelease` +
  apksigner/aapt checks; `signing/` gitignored. Signed offline (CI had no secrets). Debug-signed installs (≤ 0.5.12)
  must be uninstalled once.

## [0.5.12] — 19 Oct 2026 — sprint 0.5.11 fix
Tag `v0.5.12` → `a409eda` (run 12); docs `ac2b026`. Asset: debug 102,777,637.
- Low-bandwidth / device-tier changes no longer skipped while tiles load (zoom cap stuck at 16); regression E2E step.

## [0.5.11] — 19 Oct 2026 — sprint 0.5.11 (stale release)
Tag `v0.5.11` → `5d2dd88` (run 11). Asset: debug 102,777,351. **CI E2E failed on this run** (fixed in 0.5.12); the
release still exists on GitHub — delete only with the owner's approval.
- Device tiers (Lite/Balanced/Full); offline search v2 (86,977 places, transliteration, pincodes, DIGIPIN; FTS5
  `/api/v1/places/search`); India road hints (`/api/v1/road-hints`); Indic voice picker; Valhalla graph build for
  Visakhapatnam (`docs/OFFLINE_ROUTING.md`). 141 unit/API, 102 E2E.

## [0.5.10] — 19 Oct 2026 (commit 18 Oct UTC)
Tag `v0.5.10` → `f4e1966` (run 10); docs `fb9bdc3`. Asset: debug 98,439,746.
- Camera tilt after navigation fixed; launcher shortcuts; arrival trip summary + "report a problem on this trip".
  120 unit/API, 91 E2E.

## [0.5.9] — 19 Oct 2026 (commit 18 Oct UTC) — v0.5
Tag `v0.5.9` → `6b4ef2b` (run 9). Asset: debug 98,430,003.
- Lane guidance, speed-limit sign + overspeed chime, WebAudio sounds, day/night style, junction view, permission
  explainers + privacy dashboard, OSM-note problem reports, 2-hour community incidents (migration 004), `geo:` /
  `bharatmap://` deep links + share links, commute card, multi-stop, **11 bundled offline cities** + place index, voice
  search, live location + list sharing.

## [0.4.8] — 19 Oct 2026 (commit 18 Oct UTC) — v0.4 docs
Tag `v0.4.8` → `c3b5fb3` (run 8). Asset: debug 29,228,025.
- README, ARCHITECTURE, API (/api/v1), AUDIT, TEST-REPORT, ANDROID, SELF_HOSTING; transit itineraries leave just in time.

## [0.4.7] — 19 Oct 2026 — v0.4
Tag `v0.4.7` → `ac669ba` (run 7). Asset: debug 29,228,024.
- HMRL GTFS itineraries (device + server), toll plazas on route, avoid tolls/highways, EV/parking details, rail/airport
  layers, low-bandwidth mode, offline region download manager + `make-region.sh`, Android background-navigation
  foreground service, i18n for 11 languages, lazy Shop/admin.

## [0.4.6] — 19 Oct 2026 — v0.4 step A
Tag `v0.4.6` → `836fdb5` (run 6). Asset: debug 29,186,182.
- `/api/v1` map-services backend: Valhalla (incl. `motor_scooter`), OSRM per profile, Photon, Nominatim, Overpass, Open
  Charge Map; LRU+TTL cache, token bucket, 1 req/s public throttle, coalescing, timeouts + circuit breaker; HMRL GTFS +
  RAPTOR; docker-compose + SELF_HOSTING.

## [0.3.5] — 18 Oct 2026 — v0.3 map-first app
Tag `v0.3.5` → `73169c7` (run 5). Asset: debug 29,133,300.
- Map-first shell, OSM places, routing, voice navigation (en/hi/te), saved places (migration 003), layers, dark mode;
  Android Share / App / TTS plugins.

## [0.2.4] — 18 Oct 2026 — rename to Bharat Map
Tag `v0.2.4` → `8d57c5b` (run 4). Asset: `bharat-map-0.2.4-debug.apk` 28,994,575.
- App renamed "India MapOS" → "Bharat Map" (app name, README, UI, docs, CI artifacts). Package id unchanged.

## [0.2.3] — 18 Oct 2026 — first CI release ("India MapOS 0.2.3")
Tag `v0.2.3` → `639742f` (run 3). Asset: `india-mapos-0.2.3-debug.apk` 28,994,591.
- `a0d17f9` initial commit: v0.2 Android app (Capacitor), offline maps, Razorpay, notifications, admin dashboard, CI
  (migrations 001–002); `cd857fc` docs/audit/E2E results; `b781e4d` CI YAML fix; `639742f` versionCode parsing fix.
  (Runs 1–2 produced no release; the reason is not recorded in the repo — unverified.)
