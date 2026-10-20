# CoMaps teardown — the primary architecture blueprint for Bharat Map

Date: 20 Oct 2026 (IST). Status of this document: **CoMaps is Bharat Map's main reference from now on** (decided by the
project owner on 20 Oct 2026). Apple Maps (web) remains a UI/UX reference only, handled separately. Earlier teardowns
(AMap, Google Maps, HERE) stay as evidence for individual features; where they disagree with this document on
*architecture*, this document wins.

Evidence used, and nothing else:
- **[A]** the user-supplied APK `files/uploads/base-436de92e2415.apk` — static analysis only: AndroidManifest, permissions,
  components, intent filters, signing block, ZIP inventory and sizes, and three plain data files read as data
  (`assets/countries.txt` for region sizes, `assets/fonts/*.txt` + font `cmap` tables for script coverage). **No dex was
  decompiled, no native code disassembled, nothing secret extracted.** Raw dump: `work/comaps/comaps-static.json` (project
  scratch, not committed).
- **[S]** CoMaps' public source at `https://codeberg.org/comaps/comaps`, commit `2ed70d0d28` (19 Oct 2026), read with a
  blob-less sparse checkout (`docs/`, `LICENSE`, `NOTICE`, `android/app/build.gradle.kts`, directory listings, a few headers).
- **[I]** = inferred from [A]/[S]; **[U]** = unknown.

## 0. Licence (checked first)
| Item | Finding |
|---|---|
| Code licence | **Apache License 2.0** — `LICENSE` at `https://codeberg.org/comaps/comaps/raw/branch/main/LICENSE`; README "Licensed under the Apache License 2.0" |
| NOTICE | `Copyright 2020 My.com B.V. (Mail.Ru Group) · 2025 Organic Maps Contributors · 2026 CoMaps Contributors`; `3party/` and `tools/` carry their own licences; "Some icons files may be copyrighted by (C) 2020 My.com B.V."; full list in `data/copyright.html` |
| Lineage | Maps.ME → Organic Maps (Apache-2.0) → CoMaps (fork of Organic Maps sources as of 02.04.2025) |
| Trademarks | Apache-2.0 §6 grants no trademark rights → **no CoMaps / Organic Maps names, logos, icons, symbol sprites or store art in Bharat Map** |
| Map data | `.mwm` files are derived from OpenStreetMap → **ODbL 1.0**, attribution "© OpenStreetMap contributors" (same as Bharat Map today) |
| Hosting | Codeberg's Terms (shown on the repo page, Oct 2026) restrict LLM-generated content *on Codeberg*. This affects contributing upstream, not reading or reusing the Apache-2.0 code |
| What it allows us | Reuse/adapt code with the licence + NOTICE kept, modified files marked, and listed in `docs/THIRD_PARTY.md`. **This sprint copied no CoMaps code** (§9) |

## 1. What it is
CoMaps (`app.comaps.google`, versionName `2026.09.23-2-Google`, versionCode 26092302, minSdk 21, targetSdk 36) [A] is a
community-run, not-for-profit, offline-first OSM maps app for Android, iOS, macOS and Linux [S README]. Its core is one
C++ engine (rendering, routing, search, storage) shared by thin native UIs (Java on Android, Swift/Obj-C++ on iOS, Qt on
desktop). Languages in the repo: C++ 68 %, C 9 %, Java 8 %, Swift 5 % [S].

## 2. Key findings (the 10 that matter for Bharat Map)
1. **The engine is the product, the UI is thin.** One C++ core (`libs/`: `drape`, `indexer`, `routing`, `search`, `storage`,
   `kml`, `editor`, `transit`, `map`) drives every platform [S `docs/STRUCTURE.md`]. Bharat Map's equivalent "core" is
   scattered across MapLibre, server services and web modules; the blueprint says: consolidate offline capability into one
   on-device engine layer with a stable JSON/JNI boundary.
2. **One file per region does everything offline.** A `.mwm` holds features with type ids, scale-indexed geometry, the
   search index and the routing graph sections [S `docs/MAPS.md`, `libs/routing/*index_graph*`, `cross_mwm_*`]. Routing
   across regions uses cross-mwm "leaps" [S `leaps_graph`, `cross_mwm_graph`]. Bharat Map ships three parallel artefacts per
   city (PMTiles + POI JSON + one global search JSON) and routes only online.
3. **The APK ships a world overview, not cities.** 65.7 MB of the 114.6 MB base APK is `World.mwm` (53.5 MB) +
   `WorldCoasts.mwm` (8.5 MB) + `packed_polygons.bin` (3.7 MB, region borders for "which map covers this point") [A]. Every
   detailed region is downloaded on demand from the `countries.txt` catalogue [A, S `libs/storage`].
4. **Indian region granularity is state-level and heavy:** Andhra Pradesh **115.1 MB**, Telangana **99.3 MB**, all India
   **2.19 GB in 34 files** (map series 2026.06.28) [A `countries.txt`]. That is ≈ 28× Bharat's Vizag PMTiles (4.1 MB) because an
   mwm carries the whole state with routing and search. **Bharat should keep city-level packs** (rendering + graph + index per
   metro), which suit Indian phones and data plans better than state files.
5. **Native code is not in the base APK.** The Play build is a split install (`com.android.vending.splits.required=true`);
   `lib/` is empty in the base, so the engine `.so` lives in an ABI config split that was not supplied [A]. Native size is
   therefore [U] from this upload.
6. **Lean by construction:** R8 minify + resource shrinking on release and beta [S `build.gradle.kts` L242–262]; map data,
   `.ttf`, `.png`, `.bin`, `.txt` stored *uncompressed* (`noCompress`) so the engine can memory-map them straight from the APK
   [S L269–273, A compress_type 0]; dex is only 6.3 MB [A]; language splits disabled on purpose (users complained about
   re-downloads after a language change) [S L78–83].
7. **Offline-first permissions.** 15 permissions: fine/coarse location, two foreground-service types (location for
   navigation + track recording, dataSync for downloads), notifications, wake lock, boot, network state, legacy storage read,
   and two Android Auto permissions — **no background location, no contacts, no camera, no ad id** [A]. WebView Safe Browsing
   disabled and metrics opted out [A app meta-data].
8. **Open formats in and out.** The launcher activity claims `geo:`, `ge0:`, `cm:`, `comaps:`, legacy `mapsme:`, `ge0.me` and
   `comaps.at` (App Link, autoVerify via a flavour `@bool`), `openstreetmap.org/` + `/search`, and opens / receives (SEND,
   SEND_MULTIPLE) **KML, KMZ, GPX and its binary KMB** files [A]. Bookmarks and tracks round-trip through KML/KMZ/GPX
   [S `libs/kml/serdes*.hpp`, `serdes_gpx.*`].
9. **Android Auto is a real nav app, rendered natively.** `CarAppService` (category NAVIGATION, minCarApiLevel 5) with
   `androidx.car.app.ACCESS_SURFACE` + `NAVIGATION_TEMPLATES`, its own screens (map, free drive, navigation, search, bookmarks,
   downloads, permissions) and a `SurfaceRenderer` drawing the engine's map into the car surface [A, S
   `android/app/src/main/java/app/organicmaps/car/**`]. A WebView app cannot do this without a native map renderer (§7).
10. **Indic coverage gap we can beat.** Bundled fonts: Noto for Devanagari, Bengali, Malayalam; **Telugu, Tamil, Kannada,
    Gujarati, Gurmukhi and Odia fall back to `code2000.ttf`** (3.2 MB pan-Unicode font; 80 Telugu code points) [A cmap]. The
    text shaper is HarfBuzz (`3party/harfbuzz`) [S]. Quality of Telugu conjuncts on device is [U] — Search category synonyms ship for `hi` and `mr`
    but not `te`/`ta`/`kn` (`categories.txt` languages), and voice-guidance phrase files exist for `hi`, `mr`, `ta` but not `te`
    (`sound-strings/`) [A]. Bharat already ships proper Telugu/Devanagari glyph stacks, Telugu guidance and native-script search.

Other observations: the Google build's signing certificate SHA-256 is `8c3dde72…faac19` (Play App Signing), which differs
from the fingerprint CoMaps publishes for its own builds (`4894e8e6…3b4c`) [A vs S README] — the Play listing is re-signed by
Google, so verify F-Droid/Codeberg builds against the published key, not this one. `NavigationContentProvider` is exported
(navigation state for other apps) [A]. WorkManager, Room and AndroidX Startup are used for background work and storage [A].

## 3. APK size anatomy (base APK, 114.6 MB = 114,642,554 bytes, 1,603 entries; MB = 10⁶ bytes as stored) [A]
| Group | Stored in APK | Notes |
|---|--:|---|
| `assets/World.mwm` | 53.53 MB | world overview map (low zoom), memory-mapped, stored uncompressed |
| `assets/WorldCoasts.mwm` | 8.49 MB | coastlines for zoomed-out views |
| `assets/symbols/` (53 files) | 11.94 MB | icon atlases per DPI (mdpi…xxxhdpi + "6plus") × light/dark |
| `assets/fonts/` (16 files) | 10.59 MB | DroidSans fallback 3.45, code2000 3.16, Jomolhari 1.82, DejaVu 0.76, Noto (Deva/Beng/Mlym/Arab/Hebr/Thai), Roboto, Padauk, KhmerOS |
| `dex` (2 files) | 6.27 MB | classes.dex 5.70 + classes2.dex 0.57 (R8-shrunk) |
| `resources.arsc` | 6.02 MB | Android strings/resources, uncompressed |
| `assets/countries-strings/` (48) | 5.57 MB | localised region names |
| `assets/packed_polygons.bin` | 3.68 MB | region borders for the downloader |
| `assets/drules_proto_*.bin` (10) | 4.66 MB | compiled MapCSS styles: default, outdoors, public-transport, public-transport-outdoor, vehicle × light/dark (0.29–0.52 MB each) |
| `assets/icudt75l.dat` | 0.43 MB (1.31 MB raw) | ICU data (transliteration/normalisation) [I] |
| `assets/vulkan_shaders/` | 0.36 MB | precompiled SPIR-V shader pack |
| `categories.txt`, `countries.txt`, `classificator.txt`, `types.txt`, `editor.config`, `mapcss-mapping.csv`… | ≈ 1.7 MB (with `copyright.html`, `faq.html`) | search categories, region catalogue, type system, editor schema |
| `res/` (drawable, layout, color, …) | ≈ 0.73 MB | |
| `lib/` | **0** | native engine in a separate ABI split (not supplied) |

**Shipped vs downloaded.** Shipped: world overview, coastlines, borders, styles, icons, fonts, catalogues, UI. Downloaded per
region from `countries.txt` (with size + checksum per file, served from CoMaps' CDN or a user-chosen mirror
[S `docs/DEPLOY_OWN_MAP_SERVER.md`]): every detailed `.mwm` (render + search + routing + transit sections). Updates: a full
re-download per map series; `libs/mwm_diff` + `3party/bsdiff-courgette` implement binary diffs between mwm versions [S] (whether
the current CDN serves diffs is [U]).

**Region sizes relevant to us** (bytes from `countries.txt`, map series `2026.06.28`) [A]:

| Region file | Size |
|---|--:|
| `India_Andhra Pradesh` (contains Visakhapatnam) | 115,087,782 B (≈ 115.1 MB) |
| `India_Telangana` (contains Hyderabad) | 99,287,122 B (≈ 99.3 MB) |
| `India_Karnataka_South` / `_North` | 74.3 MB / 65.4 MB |
| `India_Maharashtra` | 165.4 MB |
| `India_Delhi` | 24.8 MB |
| All 34 India files | ≈ 2,187 MB |

## 4. Architecture (from the public source) — and the Bharat Map equivalent
| CoMaps module [S] | What it does | Bharat Map today | Blueprint decision |
|---|---|---|---|
| `drape`, `drape_frontend`, `shaders` | Own GPU renderer (OpenGL ES / Vulkan / Metal), tile-less vector rendering from mwm | MapLibre GL JS in the WebView, PMTiles | **Keep MapLibre** (proven, styleable, our sprites/fonts). Re-implementing Drape is out of scope |
| `indexer` + `.mwm` format, `generator/` | OSM → typed features, geometry per scale, sections | Planetiler/Protomaps PMTiles + separate POI/search JSON | **Adopt the idea, not the format:** one *region pack* per city = `{pmtiles, valhalla tiles.tar, search.sqlite}` + manifest |
| `storage` (`countries.txt`, downloader, pinger, queue) | Region catalogue, mirrors, queued downloads, checksums | `web/lib/region-manager.js` + `regions.json` (size, sha256) | **Re-implement** CoMaps' catalogue semantics: hierarchy, per-file size + checksum, mirror ping, resumable queue, "download maps along this route" |
| `mwm_diff` (bsdiff) | Incremental region updates | Full re-download | Later: bsdiff deltas per pack (Phase 3) |
| `routing`, `routing_common` | On-device A* (car, pedestrian, bicycle, transit, ruler) on mwm graphs, cross-mwm leaps, maxspeeds, lanes | Online OSRM/Valhalla; Valhalla graph for Vizag built offline but unused on device | **On-device Valhalla** (C1). CoMaps has **no motorcycle/scooter router type** (`RouterType`: Vehicle, Pedestrian, Bicycle, Transit, Ruler [S `libs/routing/router.hpp`]) — India needs two-wheeler costing, which Valhalla has (`motor_scooter`) |
| `search` | Offline geocoder + ranking over mwm indexes, categories, bookmarks | Bundled JSON index + translit (client), FTS5 on the server | **On-device SQLite FTS5 per region pack** (C2) |
| `kml` | Bookmarks/tracks, KML/KMZ/GPX, binary KMB | Saved lists (localStorage + server sync) | **Done this sprint:** GPX/KML import-export, list editor (§9) |
| `tracking` + `TrackRecordingService` | Track recording (location FGS) | none | **Done this sprint (foreground);** screen-off via our existing location FGS next |
| `editor` + OSM OAuth2 | Edit POIs and upload changesets | OSM Notes (anonymous) | **Done this sprint:** structured "Suggest an edit" note; real changesets later behind OSM login (C9) |
| `transit` | OSM subway layer + experimental GTFS | HMRL GTFS journeys; rail & metro lines overlay | Keep; add per-pack GTFS (C10) |
| `descriptions` | Offline Wikipedia extracts | none | Optional (C12) |
| `android/.../car/**` | Android Auto screens + native surface renderer | none | Feasibility doc only (`docs/ANDROID_AUTO.md`, C8) |
| `platform` | Files, HTTP, location abstraction | Capacitor plugins | Keep Capacitor; add native modules only where the engine needs them |

**Strategic options for "CoMaps as the blueprint".**
- **(A) Fork CoMaps and add Bharat features.** Fastest path to full offline nav, but abandons the WebView stack (commerce,
  service panels, ONDC, payments, 11-language UI are all web code), inherits state-level mwms and no two-wheeler routing, and
  means rebuilding the UI in Java/Kotlin. Not recommended now.
- **(B) Keep the Bharat stack, rebuild CoMaps' architecture with open parts** (MapLibre + PMTiles, Valhalla mobile, SQLite FTS5,
  a CoMaps-style catalogue). Keeps everything already built; each piece is independently testable. **Recommended.**
- **(C) Hybrid: embed the CoMaps C++ core as a native module** for routing/search only. The core is monolithic (routing needs
  `indexer`, `coding`, `geometry`, `platform`, `storage`), needs mwm files built with its generator, and would duplicate
  rendering data. Keep as a fallback research option (see C1).

## 5. UX patterns worth adopting (behaviour only; our own UI and copy)
1. **Download prompt where the map is missing** — when the viewport or a route crosses an area without a pack, offer the pack
   with its size (CoMaps' "download maps for route/view" screens [S car/screens/download]).
2. **Region manager as a tree with sizes and "update all"**, plus a custom mirror URL in Advanced settings [S docs].
3. **Bookmarks = lists you own and can move between apps** (KML/GPX in and out; receive files from other apps).
4. **Track recording with a persistent notification and a stats sheet** (distance, time, speed, elevation).
5. **Style families per activity** (default / vehicle / outdoors / public-transport, each light/dark) instead of one style with
   toggles [A drules files]. Bharat already has a driving style; a public-transport style would suit Hyderabad metro users.
6. **Editor that asks for *facts* (hours, phone, website, name in local language)** — we send them as a note today.
7. **Privacy by default**: no account required, no analytics, no background location [A].
8. **Car screen with only templates the platform allows** (free drive, navigation, search, saved places).

## 6. How this answers the open "smoother and lighter app" goal (30–40 MB) — plan only, awaiting approval
Measured on our current release `bharat-map-0.7.16.apk` (100.2 MB):

| Part | Now | CoMaps-style plan |
|---|--:|--:|
| PMTiles, 11 cities | 81.4 MB | **Vizag 4.1 + Hyderabad 9.3 = 13.4 MB** bundled; 9 cities (68 MB) become downloadable packs |
| Glyph PBF fonts (`offline/fonts`) | 9.7 MB | ~3–5 MB after trimming to Latin + the Indic ranges we render (estimate; Noto, OFL) |
| Offline search index (one JSON, all cities) | 3.6 MB | ~1 MB (split per city; Vizag + Hyderabad bundled) [I] |
| POI JSON | 1.0 MB | ~0.3 MB (two cities) [I] |
| dex | 2.9 MB | ~1.2 MB with R8 (CoMaps does this) [I] |
| Web code, res, other | ~1.7 MB | ~1.7 MB |
| **Total** | **100.2 MB** | **≈ 32 MB with only the city move; ≈ 21–24 MB with fonts + R8** [I] |

So the 30–40 MB target is reached by **moving 9 cities to downloads alone**; font trimming and R8 are extra margin. Not
done in this sprint, by instruction: no R8, no city removal, no font subsetting until the owner approves. The earlier
standing direction "do not slim, bigger is fine" (19 Oct) and the new "lighter" goal conflict — the owner must choose.
Smoothness levers that do not change size (can ship any time): keep fixes on-device (C1/C2 remove network waits), cap
MapLibre `maxTileCacheSize` per device tier (already tiered), and pre-warm the bundled pack on first launch.

## 7. Android Auto: what CoMaps needs and what it would take us
CoMaps renders its own map onto the car `Surface` with the native engine. Bharat's map is MapLibre GL **JS** inside a WebView,
which cannot draw into a car surface. A Bharat Android Auto app needs MapLibre **Native** Android rendering into the
`SurfaceCallback`, route/turn data passed from the web layer via a Capacitor plugin, and Google's navigation-app review. Full
analysis: `docs/ANDROID_AUTO.md`. Nothing ships until it is tested in the Desktop Head Unit and a car.

## 8. Deep links found [A] (recorded in `data/deeplinks/apk-manifest-links.json`, marked "Reference teardown, not a hand-off")
`geo:` · `ge0:` · `cm:` · `comaps:` · `mapsme:` · `http(s)://ge0.me` · `https://comaps.at` (autoVerify) ·
`http(s)://www.openstreetmap.org/` and `/search` · KML/KMZ/GPX/KMB by MIME type and file extension (VIEW from
`content:`, `file:`, `data:`, `http(s):`), plus SEND/SEND_MULTIPLE · `CarAppService` NAVIGATE `geo:`. Bharat already emits
`geo:` links when sharing a place, so "Open in CoMaps / Organic Maps / any maps app" works today without a CoMaps-specific link.

## 9. What Bharat Map implemented from this teardown (this sprint, clean-room)
| Item | Status | Where |
|---|---|---|
| GPX 1.1 / KML 2.2 import (waypoints, route points, tracks, `gx:Track`) and export (lists, tracks) | ✅ implemented (web + Android share sheet via Capacitor Filesystem/Share; KMZ refused with a message) | `shared/geoformats.js`, `web/lib/file-io.js` |
| Track recording (accuracy/jump/min-distance filters, pause = new segment, stats, map line, local storage) | ✅ foreground; 🟡 screen-off recording not yet (needs the location FGS hook) | `web/lib/track-model.js`, `web/ui/tracks.js` |
| List editor (rename, reorder, edit name + personal note, delete list) | ✅ | `web/lib/saved-model.js`, `web/ui/saved.js` |
| "Suggest an edit" → structured anonymous OSM note (name, Telugu/Hindi name, hours, phone, website, wheelchair) | ✅ (no direct OSM editing) | `shared/osm-edit.js`, `web/ui/osm-edit.js` |
| Android Auto | 📄 feasibility doc only | `docs/ANDROID_AUTO.md` |
No CoMaps code, assets, styles, icons or strings were copied; GPX/KML are open standards implemented from their specs.
`docs/THIRD_PARTY.md` lists what is reused (nothing from CoMaps) and the new MIT dependency.

## 10. Limitations and unknowns
- Native library sizes, renderer internals and on-device performance are [U]: the ABI split was not supplied and nothing was
  run on a device. The routing algorithm description comes from file names/headers only.
- Region sizes are from the catalogue bundled in this APK (series 2026.06.28); the live CDN may be newer.
- Telugu label rendering quality in CoMaps was not observed on a device.
- Whether CoMaps' CDN serves mwm diffs today is [U].
