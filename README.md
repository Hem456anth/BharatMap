# Bharat Map — v0.7.20

An India-first map app with its own open-data map-services backend, for Android and the web: a calm full-screen map
with a floating search pill and a three-height bottom sheet, real places from OpenStreetMap, routes for drive /
two-wheeler / cycle / walk / truck and scheduled metro, turn-by-turn voice navigation with **landmark-led instructions
in English, Hindi and Telugu**, lane guidance, speed-limit warnings, a night driving style, **offline maps and search for
11 Indian cities**, and a **Shop** area for the original commerce flow (product search → seller → order → rider
tracking, seller and admin dashboards).

> **Status: working prototype.** Map, search, places, routing and navigation use real open data (OpenStreetMap via
> Overpass, Nominatim, Photon, OSRM, Valhalla). Sellers, products and riders in Shop are **fictional demo data**. Live
> traffic needs a TomTom/HERE key; live transit arrivals are not included (metro journeys use **scheduled** GTFS times).
> Nothing has been tested on a real phone yet. Status of every feature: [FEATURES.md](FEATURES.md).

**New in v0.7.20 (3 Nov 2026):** Prefer main roads · locality-aware, typo-tolerant search · get-off and arrival alarms ·
incident alerts along the route with "Still there?" · no silent reroutes · exact pickup hand-off (pin + DIGIPIN +
landmark) · Add a missing place · Bengaluru Namma Metro schedules. History: [CHANGELOG.md](CHANGELOG.md).

## Quick start

Requires Node.js ≥ 22.13 (built-in `node:sqlite`, no native builds).

```bash
npm ci
npm run migrate          # data/mapos.db + fictional demo data
npm start                # http://localhost:8080
npm test                 # 247 unit + API tests
scripts/dev-restart.sh && node tests/e2e.mjs   # Chromium E2E (needs Chromium + fonts-noto-core; server on :8080)
```

Development demo logins (password `demo1234`, override with `DEMO_PASSWORD`): `customer@mapos.demo`,
`seller+b2@mapos.demo`, `admin@mapos.demo`. Production has no known password (`ADMIN_PASSWORD` required). Full guide:
[SETUP.md](SETUP.md).

## Android app

Capacitor 7, package `com.indiamapos.app` (kept from the original "India MapOS" name so updates install over old
builds). CI builds on every push to `main` and publishes GitHub release `v0.7.<run>`; the release-key-signed
`bharat-map-0.7.<run>.apk` (≈ 100 MB with 11 offline cities, not debuggable, no R8) is attached after offline signing,
`-debug.apk` is for troubleshooting. Coming from 0.5.12 or older (debug-signed): uninstall once. Install and native
details: [docs/ANDROID.md](docs/ANDROID.md); signing: [SETUP.md](SETUP.md#android-release-and-signing).

## Documentation

| Document | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Entry point for Claude Code / new contributors: repo map, commands, rules, status, next tasks |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | What the project is, owner, timeline, references, non-negotiable rules |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, repository map, module layers, diagrams |
| [FEATURES.md](FEATURES.md) | Every feature with implemented / prototype / external / missing status; known limitations |
| [API.md](API.md) | Every HTTP route |
| [DATABASE.md](DATABASE.md) | SQLite schema, migrations, PostGIS target |
| [SETUP.md](SETUP.md) | Run, test, debug, configure (all env vars), deploy, release and sign |
| [ROADMAP.md](ROADMAP.md) · [TASKS.md](TASKS.md) | What comes next; actionable tasks with done criteria |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commit identity, `[skip ci]`, conventions, tests, docs rules |
| [CHANGELOG.md](CHANGELOG.md) · [DECISIONS.md](DECISIONS.md) | Release history v0.2 → v0.7.20; architecture decision records |
| `docs/` | Deep references: audits ([AUDIT](docs/AUDIT.md), [AUDIT-2026-11](docs/AUDIT-2026-11.md)), [TEST-REPORT](docs/TEST-REPORT.md), [UPGRADE_REPORT_2026-11](docs/UPGRADE_REPORT_2026-11.md), [ANDROID](docs/ANDROID.md), [SELF_HOSTING](docs/SELF_HOSTING.md), [OFFLINE_ROUTING](docs/OFFLINE_ROUTING.md), [INTEGRATIONS](docs/INTEGRATIONS.md), [INTEGRATION_MATRIX](docs/INTEGRATION_MATRIX.md), [PRD](docs/PRD.md), [RESEARCH](docs/RESEARCH.md), [THIRD_PARTY](docs/THIRD_PARTY.md), research in [docs/re/](docs/re/) |

## Attribution & licences

Map data © OpenStreetMap contributors (ODbL). Online tiles: OpenFreeMap / OpenMapTiles. Offline tiles: Protomaps basemap
(OSM). Map problems are reported as public OpenStreetMap notes. Routing: OSRM and Valhalla on FOSSGIS servers
(routing.openstreetmap.de, valhalla1.openstreetmap.de) or self-hosted. Transit: *Contains data provided by Hyderabad
Metro Rail Ltd.* (HMRL GTFS, HMRL open-data terms); Bengaluru Namma Metro: unofficial GTFS by Vonter (ODbL 1.0,
github.com/Vonter/bmrcl-gtfs). EV: Open Charge Map (CC BY 4.0) when enabled. Geocoding: Nominatim, Photon (komoot).
Rendering: MapLibre GL JS (BSD-3). Fonts: Noto (OFL). Icons, colours and UI are original to this project (clean-room;
no third-party brand assets). Reused code and reference projects: [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) (CoMaps,
Apache-2.0, studied as the architecture blueprint; no CoMaps code or assets copied). Package licence: `UNLICENSED`
(`package.json`).
