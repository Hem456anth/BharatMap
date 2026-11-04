# CLAUDE.md — start here

Entry point for Claude Code (and any new contributor) on **Bharat Map**. Read this file first, then the root doc for
the area you touch. State: **v0.7.20** (code `810a020`, docs `ff85cb7`, 3 Nov 2026); repo
https://github.com/Hem456anth/BharatMap, branch `main`.

## What this is (one paragraph)

India-first map app (Android via Capacitor + web) with its own open-data map-services backend (Node/Express +
SQLite). Real OSM places, routing (Valhalla/OSRM), voice navigation (en/hi/te), offline maps and search for 11 cities,
scheduled metro for Hyderabad (official) and Bengaluru (unofficial), place-card service panels with honesty labels,
and a Shop/order/tracking flow on **fictional** demo sellers. It is a **working prototype**: tested in headless
Chromium and CI, **never on a real phone**. Context: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Repository map

```
india-mapos/                      repo root (folder name kept after the rename; see ADR-009)
├── server/                       Express API — index.js (listen), app.js (createApp: ops, auth, Shop, orders, SSE,
│   │                             payments, notifications, /map tile proxy), api-v1.js (/api/v1), community.js,
│   │                             services-api.js (v0.7 panels/traffic/ONDC), admin.js, auth.js, db.js, notify.js
│   ├── providers/ lib/           upstream fallback chains; upstream.js, lru.js, ratelimit.js, search-fts.js
│   ├── payments/ services/       gateway adapters; legacy external.js, ondc.js, payments.js (Razorpay)
│   ├── integrations/             adapter registry (status only)
│   └── transit/                  gtfs.js, index.js, feeds/hmrl (official), feeds/bmrcl (unofficial ODbL)
├── shared/                       isomorphic pure logic (search, address/DIGIPIN, logistics, i18n*, csp, valhalla,
│                                 guardrails, reroute, alarms, handoff, route-alerts, transit/raptor, services/*)
├── web/                          client: index.html, app.js, shell.js, ui/ nav/ services/ map/ lib/, sw.js,
│   │                             styles.css, mock-api.js (on-device Shop), native.js; web/shared → ../shared (symlink)
│   ├── offline/                  11 *.pmtiles, catalog.json, regions.json, pois/, search/index.json, fonts/, sprites/
│   ├── transit/                  hmrl.json, bmrcl.json, index.json (packed timetables)
│   └── vendor/                   MapLibre GL JS 6.15 + offline-deps.mjs (vendored, no runtime CDN)
├── android/                      Capacitor 7 project, package com.indiamapos.app; app/src/main/java/com/indiamapos/app/
│                                 {MainActivity, BackgroundNavPlugin, NavLocationService, ExternalAppPlugin}.java
├── db/migrations/ 001–006.sql    SQLite schema (auto-applied)   db/postgis/  target schema (not wired)
├── scripts/                      dev-restart.sh, migrate.mjs, build-www.mjs, build-demo.mjs, build-*-index.mjs,
│                                 build-transit.mjs, make-region.sh, build-graph.sh, gen-integration-matrix.mjs, …
├── tests/                        19 node:test files (npm test), e2e.mjs + e2e-net.mjs, e2e-demo.mjs, load.mjs, fixtures/
├── data/deeplinks/               only tracked part of data/ (deep-link evidence); data/*.db is gitignored
├── .github/workflows/            ci.yml (test → e2e + android → release), attach-apk.yml (manual)
├── docs/                         deep references, audits, test reports, docs/re/ teardowns, screenshots
└── Dockerfile, docker-compose.yml, render.yaml, .env.example, capacitor.config.json, package.json
```
Details per file: [ARCHITECTURE.md](ARCHITECTURE.md#b-repository-map-verified-paths).

## Commands

| Task | Command | Notes |
|---|---|---|
| Install | `npm ci` | Node ≥ 22.13 |
| Run | `npm run migrate && npm start` | http://localhost:8080; `npm run dev` watches |
| Background server | `scripts/dev-restart.sh` | :8080, log `data/server.log`, pid `data/server.pid` |
| Unit + API tests | `npm test` | **247 / 247** expected. New test files must be added to the `test` script in `package.json` |
| Browser E2E | `scripts/dev-restart.sh && node tests/e2e.mjs` | Needs the server on :8080, Chromium (`/usr/bin/chromium` or `$CHROME`) and `fonts-noto-core`. **152 PASS** in CI. Use `ONLY='<regex>'` to chunk; the sandbox may kill a full run (memory) — CI is authoritative |
| One-file demo | `npm run build:demo` | rewrites the tracked `dist/india-mapos-demo.html` — do not stage it |
| Android web bundle | `MAPOS_API_BASE=https://… node scripts/build-www.mjs && npx cap sync android` | APK builds only in CI (sandbox is aarch64) |
| Integration matrix | `node scripts/gen-integration-matrix.mjs` | after editing `shared/services/catalog.js` (a test compares) |

Debugging: JSON request logs on stdout, `X-Request-Id` on every response, `/api/health`, `/metrics` (dev),
`/api/v1/providers` (breaker state, `tried[]`), `/api/config` and `/api/v1/integrations` (what is switched on).
Headless Chromium has **no internet**: use `tests/fixtures/` (served by `tests/e2e-net.mjs`) and the `/map` tile proxy.
More: [SETUP.md](SETUP.md#debug).

## Release (how it works today)

1. Every push to `main` runs CI and **publishes release `v0.7.<run>`** with the debug APK. Docs-only commits:
   put **`[skip ci]`** in the message.
2. CI has **no signing secrets** (the owner must add `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), so it uploads an unsigned release artifact.
3. Sign offline from that artifact in `/tmp` (apksigner segfaults on some filesystems): `zipalign -P 16 4`, then
   `apksigner sign` with the release key (alias `bharatmap`, cert SHA-256 `d04d20f9…b7997c6c`), verify.
4. Attach with the manual workflow `.github/workflows/attach-apk.yml` (inputs `url`, `sha256`, `tag`, `name`) via the
   REST `POST /repos/Hem456anth/BharatMap/actions/workflows/attach-apk.yml/dispatches` endpoint (JSON body with
   `inputs`). It re-verifies hash, signature, pinned cert, alignment, not-debuggable.

The keystore lives **outside the repo** in the project-root `signing/` folder (gitignored). **Never print, copy or
commit its contents or passwords.** R8/minify is off by decision. Full procedure: [SETUP.md](SETUP.md#android-release-and-signing).

## Rules (must follow)

**Project rules**
- **Clean-room only**: OSM + open data; no Google/Mappls code or data; reverse-engineering references are
  behaviour-only (`docs/re/`). **CoMaps (Apache-2.0) is the main architectural blueprint**; Apple Maps web is a UI/UX
  reference only; AMap/Google/HERE come from earlier teardowns. **Apple screenshots are never committed**; no
  third-party assets at all.
- **Honesty**: label every value (Live / Scheduled / Estimate / Link-out / Demo / Unavailable); never fabricate
  prices, fares, showtimes or ETAs; demo sellers/riders are fictional and labelled so; **always report implemented /
  prototype / external / missing separately**.
- **Conventions**: prices are **INR integers, GST-inclusive**; coordinates must be **inside the India bbox**
  (`shared/geo.js#inIndia`); times in IST.
- **Payments**: only server-verified gateway payments confirm orders; **no `upi://` intents**; keys only server-side.
- **Deep links**: documented formats and verified App Links only; no guessed parameters; no payment schemes (ADR-014).
- **Owner approval required** before: APK slimming (bundle only Vizag + Hyderabad, downloadable cities, font trim,
  R8 — proposed, **not approved**; history in ADR-012), deleting the stale **v0.5.11** release, spending money,
  store publishing, signing changes.

**Repo rules**
- Commit as `Hem456anth <183790673+Hem456anth@users.noreply.github.com>`.
- **Never stage** `dist/india-mapos-demo.html`, `docs/perf-v04.json`, or regenerated v03–v06 / v0718 screenshots;
  stage paths explicitly.
- New schema → new `db/migrations/00N_*.sql` (+ PostGIS mirror). New route → validate inputs, `{error}` codes, update
  [API.md](API.md). New env var → [SETUP.md](SETUP.md#configuration) by name and purpose only.
- Keep the package id `com.indiamapos.app` and the folder name (ADR-009).
- Never put secrets in code, docs or logs; CI scans for key patterns.

Conventions in full: [CONTRIBUTING.md](CONTRIBUTING.md). Architecture rules: [ARCHITECTURE.md](ARCHITECTURE.md#d-architecture-rules-enforced-by-code-or-tests).

## Module completion status (summary)

| Area | Implemented ✅ | Prototype 🟡 | External 🔑 (key/partner/host) | Missing ❌ |
|---|---|---|---|---|
| Map & offline | Map shell, themes, 11 offline cities, offline search v2 + locality/typo search, region manager client | Raster fallback without WebGL | Region file host | Survey-of-India boundaries, satellite/street imagery |
| Routing & nav | Drive/2W/cycle/walk/truck, alternatives, multi-stop, main roads, turn-by-turn, voice, lanes, speed limits, road hints, alarms (foreground), no silent reroute, background nav (stub-tested) | — | Live traffic (TomTom/HERE), self-hosted Valhalla/OSRM | On-device offline routing (C1), Android Auto, background geofence |
| Transit | Hyderabad metro (official GTFS, scheduled) | Bengaluru metro (unofficial, approximated) | Extra GTFS feeds | BMTC, Delhi, live vehicles, trains |
| Places & hand-offs | Service panels (12 types), 93-provider catalogue, link-out interstitial, verified App Links, Uber pickup/drop, admin Listings | — | Ola token, courier partners | Showtimes/menus/prices, photos/reviews |
| Shop & payments | Search, cart, orders, stock reservation, SSE tracking (simulated rider), COD, payment screen, admin/seller dashboards | Cashfree/PhonePe/Paytm adapters, ONDC buyer flow (demo catalogue), simulated UPI | Razorpay keys, gateway sandboxes | Refunds (manual), FCM push, rider GPS app |
| Community & saved | Lists + sync, GPX/KML, tracks (foreground), OSM notes, incidents + along-route alerts, live location | — | — | Real OSM editing, screen-off tracks |
| Platform | Android (CI-built), web, 11-language scaffolding | hi/te need native review; 8 languages fall back to English | Backend deploy (Render), CI signing secrets | iOS, Play Store, PostGIS + Redis |

Full table: [FEATURES.md](FEATURES.md).

## Known bugs and limitations (top)

- No real-device testing; no payment-gateway sandbox run; no ONDC network; no traffic key.
- Hindi/Telugu strings not natively reviewed; the other 8 languages fall back to English.
- Offline routing is a labelled straight line; Survey-of-India boundaries are not rendered.
- 14 open Low audit findings (AUD-22…38, `docs/AUDIT-2026-11.md`).
- Version strings: `package.json`/`server/app.js` say `0.7.0` while releases are `0.7.<run>`; workflow comments cite
  AUD ids off by one; `docs/test-output.txt` is stale (184 tests). Stale release v0.5.11 still exists; v0.7.19 has no
  release-signed APK.
- APK ≈ 100 MB (11 bundled cities ≈ 81 MB of PMTiles); slimming pending owner approval.
More: [FEATURES.md](FEATURES.md#known-bugs-and-limitations).

## Next actionable tasks

From `docs/UPGRADE_REPORT_2026-11.md` §8, `docs/AUDIT-2026-11.md`, `docs/re/OPPORTUNITIES.md` — details and done
criteria in [TASKS.md](TASKS.md):
1. **C1 on-device offline routing** (valhalla-mobile + per-city search DB; Vizag graph exists) — T-1/T-2.
2. **G4 Survey-of-India boundaries** — licence unclear; research first — T-3.
3. **BMTC / Delhi feeds** — pending licence and size — T-6.
4. **Gateway refunds** (manual now; needs sandbox keys) — T-OWN-5.
5. **14 open Low audit items** — T-4 (no owner input) / owner-gated ones.
6. **Express 5 / Capacitor 8** — T-5.
7. **Render deploy** (owner's account + `ADMIN_PASSWORD`, then the `MAPOS_API_BASE` repo variable) — T-OWN-2.
8. **FCM push**, **rider GPS app**, **PostGIS + Redis**, **ONDC signing**, **Play Store release** — T-9…T-13.
9. **UI items A8–A14, A16–A18** (specs outside the repo; ask the owner) — T-8.

## Documentation map (and the docs/ approach)

**Approach (ADR-018): root docs are canonical; `docs/` holds deep references.** Where a `docs/` file covered the same
topic as a root file, its content was merged into the root file and the `docs/` file was replaced by a one-line pointer:
`docs/ARCHITECTURE.md` → [ARCHITECTURE.md](ARCHITECTURE.md), `docs/API.md` → [API.md](API.md),
`docs/CONFIGURATION.md` + `docs/DEPLOYMENT.md` → [SETUP.md](SETUP.md), `docs/KNOWN_LIMITATIONS.md` →
[FEATURES.md](FEATURES.md). Everything else in `docs/` stays as a deep reference and is linked, never copied.

| Root (canonical) | Deep references in `docs/` |
|---|---|
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | [PRD](docs/PRD.md), [RESEARCH](docs/RESEARCH.md) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | [SELF_HOSTING](docs/SELF_HOSTING.md), [OFFLINE_ROUTING](docs/OFFLINE_ROUTING.md), [ANDROID](docs/ANDROID.md), [ANDROID_AUTO](docs/ANDROID_AUTO.md), [re/COMAPS_TEARDOWN](docs/re/COMAPS_TEARDOWN.md) |
| [FEATURES.md](FEATURES.md) | [AUDIT](docs/AUDIT.md), [INTEGRATIONS](docs/INTEGRATIONS.md), [INTEGRATION_MATRIX](docs/INTEGRATION_MATRIX.md) (generated), [re/DEEPLINKS](docs/re/DEEPLINKS.md), [re/COMPETITOR_ANALYSIS_2026-11](docs/re/COMPETITOR_ANALYSIS_2026-11.md) |
| [API.md](API.md) · [DATABASE.md](DATABASE.md) · [SETUP.md](SETUP.md) | [SELF_HOSTING](docs/SELF_HOSTING.md), [ANDROID](docs/ANDROID.md), [tests/fixtures/README](tests/fixtures/README.md) |
| [ROADMAP.md](ROADMAP.md) · [TASKS.md](TASKS.md) | [UPGRADE_REPORT_2026-11](docs/UPGRADE_REPORT_2026-11.md), [AUDIT-2026-11](docs/AUDIT-2026-11.md), [re/OPPORTUNITIES](docs/re/OPPORTUNITIES.md), [re/UI_UX_V0718](docs/re/UI_UX_V0718.md) |
| [CHANGELOG.md](CHANGELOG.md) | [TEST-REPORT](docs/TEST-REPORT.md), raw outputs `docs/e2e-results.txt`, `docs/test-output.txt` (stale), `docs/load-results.txt` |
| [DECISIONS.md](DECISIONS.md) | [THIRD_PARTY](docs/THIRD_PARTY.md), [re/STACK_RESEARCH](docs/re/STACK_RESEARCH.md) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | — |

Reverse-engineering teardowns (behaviour-only) stay in [docs/re/](docs/re/): `REVERSE_ENGINEERING_REPORT`,
`FEATURE_COMPARISON`, `UI_UX_SPEC`, `UI_UX_SPEC_V2`, `UI_UX_V0718`, `STACK_RESEARCH`, `APK_ANALYSIS`, `AMAP_DEEP_DIVE`,
`GMAPS_HERE_TEARDOWN`, `COMAPS_TEARDOWN`, `APPLE_MAPS_V2_TEARDOWN`, `APPLE_MAPS_APK_CHECK`, `DEEPLINKS`,
`OPPORTUNITIES`, `COMPETITOR_ANALYSIS_2026-11`.

## Environment facts for agents

- Sandbox is **aarch64** → no local APK builds (CI only). JDK/Android SDK are not needed locally.
- Headless Chromium has **no internet** → fixtures + `/map` proxy.
- GitHub access for automation: `apicall github …` / git with the GitHub credential; cannot write Actions secrets;
  the `workflow_dispatch` wrapper drops `inputs`, so dispatch `attach-apk.yml` through the REST endpoint.
- Source archive for handoff: `../india-mapos-source.zip` from `git archive --format=zip --prefix=india-mapos/ HEAD`.
