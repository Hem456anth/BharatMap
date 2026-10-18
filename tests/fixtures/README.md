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
