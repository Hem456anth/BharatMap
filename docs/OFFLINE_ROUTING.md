# Offline routing — groundwork (graph build, no on-device engine yet)

Status: **graph build implemented and run in the sandbox (aarch64)**; routing on the built tiles verified with the pyvalhalla
`Actor` (offline, no server). **No on-device engine yet** — the Android app still routes online (FOSSGIS OSRM/Valhalla or the
Bharat Map server). This document records how the Visakhapatnam graph was built, what it weighs, and what an on-device engine needs.

## What was built (19 Oct 2026, IST)
| Item | Value |
|---|---|
| Region | Visakhapatnam — the bundled offline region bbox `83.15,17.62,83.42,17.85` (`web/offline/regions.json`) |
| Source | Geofabrik `asia/india/southern-zone-latest.osm.pbf` (532 MB download, OSM data © OpenStreetMap contributors, ODbL), clipped with `osmium extract -b … --strategy=smart` |
| Clipped extract | `osm/vizag.osm.pbf` **2.9 MB** — 371,748 nodes, 56,132 ways, 314 relations |
| Engine / version | pyvalhalla **3.9.1** (`pip install pyvalhalla`, manylinux aarch64 wheel; ships `valhalla_build_tiles`) |
| Build time | `valhalla_build_tiles` 12 s (2 vCPU sandbox); whole script incl. download ≈ 85 s |
| **Graph tiles** | **71 tiles (levels 0/1/2), 11 MB on disk; `tiles.tar` 10.9 MB (10,946,560 bytes); gzip ≈ 3.7 MB** |
| Not included | admin (country/state) and timezone databases (`--mjolnir-admin ""`, `--mjolnir-timezone ""`) → no border/driving-side rules from admin polygons, no time-dependent routing; no elevation; no traffic |

Smoke test (`python3 scripts/graph-smoke.py osm/graph/vizag/valhalla.json`, run from outside the repo root), all from Dwaraka Nagar:

| To | Costing | Distance | Time | Maneuvers | Query |
|---|---|--:|--:|--:|--:|
| RK Beach | auto | 4.23 km | 6.7 min | 18 | 69 ms (first, loads tiles) |
| RK Beach | motor_scooter (2-wheeler) | 4.07 km | 6.8 min | 18 | 9 ms |
| Simhachalam temple | auto | 17.98 km | 19.9 min | 10 | 18 ms |
| Gajuwaka | pedestrian | 13.79 km | 162.7 min | 30 | 10 ms |

For comparison the online FOSSGIS OSRM route Dwaraka Nagar → RK Beach in `tests/fixtures/osrm-drive-dwarakanagar-rkbeach.json`
is 3.79 km; the offline Valhalla route differs because the profiles and the extract date differ (not a correctness check).

## Exact commands
```bash
sudo apt-get install -y osmium-tool          # 1.18.0 in the sandbox (Debian trixie)
pip install pyvalhalla==3.9.1                 # or ENGINE=docker (ghcr.io/valhalla/valhalla:latest)
SOURCE=geofabrik scripts/build-graph.sh       # download southern zone → clip → build → tiles.tar
python3 scripts/graph-smoke.py "$PWD/osm/graph/vizag/valhalla.json"   # run from /tmp or any dir without ./valhalla
```
Variants: `OSM_PBF=/path/extract.osm.pbf scripts/build-graph.sh` (clip an extract you already have), default `SOURCE=overpass`
(roads + turn restrictions for the bbox from the Overpass API — **this path failed in the sandbox**: every public Overpass
endpoint returned 500/502/504 for the ~56 k-way query, so the Geofabrik path is the tested one), `REGION=… BBOX=…` for other cities.
Outputs go to `osm/` (git-ignored): `osm/<region>.osm.pbf`, `osm/graph/<region>/{valhalla.json,tiles/,tiles.tar}`.

Gotcha: running `python3 -m valhalla …` from the repo root picks up the git-ignored `./valhalla/` self-hosting data folder as a
namespace package and reports "Can't find executable"; the script calls the bundled binaries by absolute path and runs Python from `/tmp`.

## What an on-device engine still needs (not started)
1. **Engine**: Valhalla compiled for Android (arm64-v8a + armeabi-v7a, NDK) behind a Capacitor plugin (`route(json) → json`), reading
   `tiles.tar` from app storage. Expected native library size ≈ 10–15 MB per ABI (to be measured). Alternative: GraphHopper (Java)
   with its own graph format — would mean a second engine to keep in sync; not recommended.
2. **Packaging**: download per region with the existing region manager (`web/lib/region-manager.js`) next to the PMTiles; ~3.7 MB gz
   for Visakhapatnam, so the 11 bundled cities are likely 40–150 MB of graphs (Bengaluru/Delhi much larger than Vizag; to be measured).
3. **Admin + timezone DBs** (`valhalla_build_admins`) for country/state access rules and time-dependent restrictions.
4. **Fallback order** in `web/services/routing.js`: on-device engine when the region graph is present and the network is down or
   slow → server → public services. The route parser (`shared/valhalla.js`) already consumes Valhalla JSON, so on-device output can
   reuse it unchanged (lanes, maneuvers, two-wheeler costing).
5. **Updates**: rebuild monthly from Geofabrik; ship deltas with the region manager v2 (planned).
