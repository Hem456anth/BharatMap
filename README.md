# Bharat Map — v0.2 (Android app + backend)

India-first map super-app: **Map → Business → Product → Delivery** on one intelligent map.
Search “LED TVs near me” (in 11 Indian languages), compare verified nearby sellers by price and stock,
order with delivery or pickup, get a rider auto-assigned, and track the delivery live on real roads.

> Status: **functional MVP / pilot-ready prototype** for two cities (Visakhapatnam, Hyderabad) with
> **fictional demo sellers**. See `docs/AUDIT.md` for exactly what is implemented vs prototyped vs external.

## Quick start (local)

Requirements: Node.js ≥ 22.13 (uses built-in `node:sqlite`, no native builds).

```bash
npm install
npm run vendor          # copies MapLibre GL into web/vendor (already committed)
npm run migrate         # creates data/mapos.db and seeds demo data
npm start               # http://localhost:8080
npm test                # 32 unit + API integration tests
```

Demo logins (password `demo1234`, change via `DEMO_PASSWORD`):

| Role | Email |
|---|---|
| Customer | customer@mapos.demo |
| Seller (Vizag Digital World) | seller+b2@mapos.demo (any `seller+b1..b15@mapos.demo`) |
| Admin | admin@mapos.demo |

Serverless demo: `npm run build:demo` → `dist/india-mapos-demo.html`, one file that runs the whole flow
in the browser (same shared logic, localStorage state).

## What's inside

```
server/            Express API (auth, search, geo, routing, orders, SSE tracking, seller, admin, ONDC adapter, tile proxy)
  services/        external adapters (OSRM, Nominatim, Overpass, optional LLM) + ONDC mapper
shared/            isomorphic core used by server AND browser: search/AI intents, address intelligence,
                   DIGIPIN, logistics (pricing, rider assignment, tracking, route optimisation), i18n (11 languages)
web/               MapLibre web client (PWA, responsive/mobile bottom-sheet, a11y), in-browser demo backend
db/migrations/     SQLite schema (MVP)     db/postgis/  production PostGIS schema
tests/             unit + API integration (node:test), Chromium E2E, load test
docs/              PRD, research dossier, architecture, API, deployment, audit, test results, screenshots
android/           Capacitor wrapper config (not built)
```

## Android app
Native Capacitor app in `android/`, built by GitHub Actions into an installable APK on every push (see Releases).
Details: [docs/ANDROID.md](docs/ANDROID.md). Backend one-click deploy: `render.yaml` → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Docs
- `docs/PRD.md` – product requirements
- `docs/RESEARCH.md` – reverse-engineering teardown (Google Maps, Mappls, Amap, ONDC), licensing, stack evaluation, data sources
- `docs/ARCHITECTURE.md` – diagrams, data model, key flows
- `docs/API.md` – REST API reference
- `docs/DEPLOYMENT.md` – production deployment guide
- `docs/AUDIT.md` – final audit (functionality, security, performance, accessibility, licensing, scalability)

## Attribution
Map data © OpenStreetMap contributors (ODbL). Tiles: OpenFreeMap / OpenMapTiles. Routing: OSRM. Rendering: MapLibre GL JS (BSD-3).
