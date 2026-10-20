# Test fixtures (real responses, not invented)

Captured on 2026-10-18 from the public services the app calls, with `scripts`-style one-off fetches
(User-Agent `BharatMap-dev-fixtures/0.3`), around Dwaraka Nagar, Visakhapatnam (17.7289, 83.3050)
and Ameerpet, Hyderabad (17.4375, 78.4483). Data © OpenStreetMap contributors (ODbL).

| File | Source request |
|---|---|
| `overpass-<cat>-dwarakanagar.json` | `POST https://overpass-api.de/api/interpreter` with `buildOverpassQuery(<cat>, clampBBox(c, null, 4), {limit:40})` |
| `overpass-metro-ameerpet.json` | same, metro category around Ameerpet |
| `osrm-{drive,bike,walk}-dwarakanagar-rkbeach.json` | `buildRouteUrl(mode, Dwaraka Nagar, RK Beach)` on routing.openstreetmap.de |
| `nominatim-reverse-dwarakanagar.json` | `nominatimReverseUrl(17.7262, 83.3075)` |
| `nominatim-search-kailasagiri.json` | `nominatimSearchUrl('Kailasagiri')` |
| `photon-kailasa.json` | `photonUrl('Kailasa', Dwaraka Nagar)` |

Unit tests (`tests/v03.test.js`) parse them; the browser E2E (`tests/e2e.mjs`) serves them through Playwright request
interception because the CI/sandbox browser has no internet. Metro around Dwaraka Nagar is genuinely empty (Vizag has no metro).

## v0.4 fixtures (captured 2026-10-18, User-Agent `BharatMap-dev-fixtures/0.4`)
| File | Source request |
|---|---|
| `valhalla-two-dwarakanagar-rkbeach.json` | `POST https://valhalla1.openstreetmap.de/route` with `buildValhallaRequest('two', Dwaraka Nagar, RK Beach, {alternates:2})` (costing `motor_scooter`) |
| `osrm-drive-dwarakanagar-anakapalli.json` | `buildRouteUrl('drive', Dwaraka Nagar, Anakapalli 17.6913,83.0037)` on routing.openstreetmap.de (NH16) |
| `overpass-tolls-dwarakanagar-anakapalli.json` | `buildTollQuery(<that route>)` on overpass-api.de — 2 real plazas (one named Aganampudi) |

The GTFS unit test for transfers/calendars uses a small **fictional test fixture** defined inline in `tests/v04.test.js`
("Test Line A/B", clearly labelled); everything else uses the real HMRL feed in `server/transit/feeds/hmrl`.
In the E2E region-download step the region host is **mocked**: the bundled Visakhapatnam PMTiles bytes are served for
`/regions/visakhapatnam.pmtiles`.

## v0.5 fixtures (captured 2026-10-19, User-Agent `BharatMap-dev-fixtures/0.5`)
| File | Source request |
|---|---|
| `osrm-drive-silkboard-ecity.json` | `GET https://routing.openstreetmap.de/routed-car/route/v1/driving/77.6228,12.9172;77.6602,12.8452?steps=true&overview=full&geometries=geojson&annotations=true` (Silk Board → Electronic City, Bengaluru; one intersection with `lanes` at the Hosur Road fork: 2 straight lanes valid, right lane not) |
| `valhalla-trace-silkboard-ecity.json` | `POST https://valhalla1.openstreetmap.de/trace_attributes` with that route's geometry, `shape_match: map_snap`, attributes `edge.speed_limit, edge.length, edge.names` (OSM maxspeed: 40/60/80 km/h on NH44 Hosur Road; none on Hewlett Packard Avenue) |

FOSSGIS OSRM rejects `annotations=maxspeed` (InvalidQuery), which is why speed limits come from Valhalla `trace_attributes`
(or Overpass `maxspeed` tags) unless a self-hosted OSRM with `OSRM_MAXSPEED=1` is configured.
In the E2E the **OpenStreetMap Notes API is mocked** (returns note id 4242); tests never create real notes.
The offline place indexes in `web/offline/pois/` are built from the bundled PMTiles by `scripts/build-poi-index.mjs`.

## Sprint 0.5.11 fixtures (captured 2026-10-19, User-Agent `BharatMap-test-fixture/0.6`)
| File | Source request |
|---|---|
| `valhalla-roadhints-{dwarakanagar-anakapalli,dwarakanagar-rkbeach,silkboard-ecity}.json` | `GET https://valhalla1.openstreetmap.de/trace_attributes` for the OSRM fixture route geometry, attributes `edge.length/bridge/road_class/use/lane_count/traversability/names/way_id` (real) |
| `overpass-roadhints-dwarakanagar-anakapalli.json` | `buildRoadHintsQuery(<that route>)` on overpass.private.coffee (real; no `*:conditional` tags on this route) |
| `overpass-roadhints-synthetic-rkbeach.json` | **SYNTHETIC** — not OSM data. Four invented ways (negative ids, names prefixed "(synthetic)") laid on the real RK Beach route geometry: `lanes=1`, `highway=service`, `motor_vehicle:conditional=no @ (Mo-Sa 08:00-11:00)`, an odd-even note. Used only to exercise the restriction badge / narrow / service UI |
| `vizag-beach-walk-SYNTHETIC.gpx` | **SYNTHETIC** — hand-written GPX 1.1 (waypoints incl. a Telugu name and an `&amp;` entity, one invalid latitude, a route point, a 2-segment track with elevation/time) for the v0.8 GPX/KML import tests |
| `hyderabad-places-SYNTHETIC.kml` | **SYNTHETIC** — hand-written KML 2.2 (Folder, Point placemarks, CDATA HTML description, LineString, `gx:Track`) for the v0.8 GPX/KML import tests |
