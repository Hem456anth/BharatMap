# Third-party code, data and reference projects

Date started: 20 Oct 2026. Rule (owner's instruction): code from another project is copied or adapted **only** when its licence
allows it; the licence + NOTICE are kept, modified files are marked, and **every reused file is listed here**. Brand assets
(names, logos, icons, sprites, store art) of reference apps are never reused.

## 1. Code copied or adapted from other projects
| Source project | Licence | Files reused in Bharat Map | Modified? |
|---|---|---|---|
| CoMaps (`codeberg.org/comaps/comaps`, Apache-2.0, NOTICE: My.com B.V. 2020, Organic Maps Contributors 2025, CoMaps Contributors 2026) | Apache-2.0 | **None.** The v0.8 GPX/KML, track-recording, list-editor and OSM-note features were written from the open GPX 1.1 / KML 2.2 specifications and our own design; CoMaps was studied for architecture only (`docs/re/COMAPS_TEARDOWN.md`) | — |

If a future phase reuses CoMaps code (see `docs/re/OPPORTUNITIES.md`, "CoMaps adoption roadmap"), add one row per file here,
put a copy of CoMaps' `LICENSE` and `NOTICE` under `third_party/comaps/`, and keep a "Modified by Bharat Map" header in each
changed file (Apache-2.0 §4).

## 2. Libraries (installed from npm / Maven, not vendored)
| Library | Licence | Used for |
|---|---|---|
| MapLibre GL JS (vendored build in `web/vendor/`, licence file alongside) | BSD-3-Clause | map rendering |
| pmtiles | BSD-3-Clause | offline PMTiles |
| Capacitor core/android/app/geolocation/share/local-notifications | MIT | Android shell |
| **@capacitor/filesystem 7 (new in v0.8)** | MIT | writing GPX/KML exports to the app cache before the share sheet |
| @capacitor-community/text-to-speech, speech-recognition | MIT | voice |
| express | MIT | server |
| esbuild, playwright-core, @protomaps/basemaps (dev) | MIT / Apache-2.0 / BSD-3 | build, tests, offline style |

## 3. Data
OpenStreetMap (ODbL 1.0) · Protomaps basemap build of OSM · HMRL GTFS (HMRL open-data terms) · Open Charge Map (CC BY 4.0,
when enabled) · Noto fonts (OFL 1.1). Test fixtures named `*-SYNTHETIC.*` are hand-written and contain no third-party data.

## 4. Reference apps studied (behaviour / public docs only, nothing reused)
CoMaps (primary architecture blueprint, open source), Apple Maps (UI/UX reference), AMap Global, Google Maps, HERE WeGo, and
the APKs listed in `docs/re/DEEPLINKS.md` (manifest-only).
