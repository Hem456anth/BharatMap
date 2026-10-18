# Self-hosting Bharat Map's map services (v0.4)

Bharat Map's server (`server/`) fronts every map service the app uses through **`/api/v1`** (see `docs/API.md`):

| Endpoint | Provider chain (first that works wins) | Env |
|---|---|---|
| `/api/v1/route` | Valhalla ⇄ OSRM (per profile) → labelled straight-line estimate | `VALHALLA_URL`, `OSRM_URL_CAR`, `OSRM_URL_BIKE`, `OSRM_URL_FOOT` (`OSRM_URL` = car, legacy) |
| `/api/v1/geocode` | Photon → Nominatim (type-ahead uses Photon only) | `PHOTON_URL`, `NOMINATIM_URL` |
| `/api/v1/reverse` | Nominatim | `NOMINATIM_URL` |
| `/api/v1/places/nearby`, `/api/v1/tolls` | Overpass | `OVERPASS_URL` |
| `/api/v1/ev` | Open Charge Map (if keyed) → Overpass (OSM `amenity=charging_station`) | `OCM_API_KEY`, `OCM_URL` |
| `/api/v1/transit/*` | Bundled HMRL GTFS + any feed in `TRANSIT_FEEDS_DIR` | `TRANSIT_FEEDS_DIR` (default `data/gtfs`) |
| `/api/v1/regions`, `/regions/*.pmtiles` | Offline region files (HTTP Range) | `REGIONS_DIR` (default `data/regions`) |

Unset upstreams default to the public OSM-community instances (FOSSGIS Valhalla/OSRM, komoot Photon, OSMF Nominatim,
overpass-api.de). Those are **for development only**: the server throttles each to **1 request/second**, sends an
identifying `User-Agent` (`HTTP_USER_AGENT`), caches responses (LRU + TTL) and opens a circuit breaker after 3
consecutive failures (30 s cool-down) so the app falls back immediately. Production needs the services below.

Other server knobs: `V1_RATE_BURST` (default 60) and `V1_RATE_PER_SEC` (default 2) — per-IP token bucket on
`/api/v1`; `CLIENT_SERVICES=server` makes the server-hosted web app use `/api/v1` (the Android app does so whenever it
is built with `MAPOS_API_BASE`).

## One-command stack
```bash
cp .env.example .env              # optional: OCM_API_KEY, HTTP_USER_AGENT, NOMINATIM_PASSWORD
docker compose --profile routing --profile geocoding up -d
docker compose logs -f valhalla   # first run downloads the India extract and builds tiles
```
`docker-compose.yml` wires the app to `valhalla:8002`, `photon:2322` and `nominatim:8080`, mounts `./data/regions`
(offline PMTiles) and `./data/gtfs` (extra GTFS feeds, e.g. TGSRTC).

## Data: the India OSM extract
`https://download.geofabrik.de/asia/india-latest.osm.pbf` (Geofabrik, updated daily, ODbL; ≈ 1.5–1.8 GB in 2026 —
check the Geofabrik page for today's size). Valhalla and Nominatim download it themselves (`tile_urls`, `PBF_URL`);
OSRM needs `scripts/prepare-osrm.sh`. Nominatim can stay current with the Geofabrik India diffs (`REPLICATION_URL`).

## Sizing (India extract; estimates — measure on your hardware)
| Service | Build / import | Serving | Disk | First run |
|---|---|---|---|---|
| Valhalla (all costings) | 8–16 GB RAM | 2–4 GB RAM | ~5–8 GB tiles + PBF | 1–3 h on 4 vCPU |
| Photon (prebuilt India index, `REGION=india`) | none (download) | 2–4 GB heap (`-Xmx4g`) | ~5–10 GB | 15–60 min download/extract |
| Nominatim (`IMPORT_STYLE=address`) | 16–32 GB RAM, fast SSD | 4–8 GB RAM | 60–120 GB | 6–24 h |
| OSRM car (MLD, optional) | 12–16 GB RAM | 4–6 GB RAM | ~10 GB | 1–2 h |
| Overpass (optional, India only) | 8 GB RAM | 2–4 GB RAM | 50–80 GB | many hours; keep using a public instance sparingly or replace with a PostGIS POI index |
| Bharat Map app | — | 256–512 MB | < 1 GB (+ regions) | seconds |

A practical small production setup: one 8 vCPU / 32 GB RAM / 250 GB NVMe VM in an Indian region for Valhalla +
Photon + Nominatim, and the app on a small instance or Render. Valhalla alone (routing for all modes, incl. a real
two-wheeler `motor_scooter` profile) fits on 4 vCPU / 16 GB.

## Transit feeds
- **HMRL (Hyderabad Metro)** ships with the server (`server/transit/feeds/hmrl`, GTFS of 03 Jul 2026, *Contains data
  provided by Hyderabad Metro Rail Ltd.*; HMRL terms allow commercial use and redistribution with attribution).
- **TGSRTC / others**: download the official GTFS zip (TGSRTC publishes it via a form at
  https://www.tgsrtc.telangana.gov.in/open-data), drop it in `data/gtfs/tgsrtc.zip` and put the attribution line in
  `data/gtfs/tgsrtc.ATTRIBUTION.txt` ("Contains data provided by TGSRTC"). Restart; `GET /api/v1/transit/feeds` lists it.
- `node scripts/build-transit.mjs` re-compiles bundled feeds into `web/transit/*.json` for on-device planning.
All transit times are **scheduled** (GTFS), never live; the app labels them so.

## Offline regions
`scripts/make-region.sh <id>` cuts a city extract from the Protomaps daily build with `pmtiles extract` into
`data/regions/<id>.pmtiles`; the catalogue is `web/offline/catalog.json`. Serve `data/regions` from the app
(`/regions/…`, Range-enabled) or any CDN/object store with HTTP Range and set `REGIONS_BASE`.

## Render
`render.yaml` deploys the app only (free plan, Singapore). Point `VALHALLA_URL` / `PHOTON_URL` / `NOMINATIM_URL` at
your VM, and set `OCM_API_KEY` in the dashboard. Without them the deployment uses the public instances (dev only).
