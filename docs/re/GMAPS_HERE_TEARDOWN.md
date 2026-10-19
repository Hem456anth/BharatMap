---
title: "Bharat Map: Competitive Teardown of Google Maps and HERE WeGo"
subtitle: "Clean-room static analysis, gap analysis and 90-day roadmap"
date: "19 October 2026"
---

# Scope, method and legend

**Subject.** Bharat Map v0.5.10 (`india-mapos`, HEAD `fb9bdc3`), compared with:

- **Google Maps 26.42.01.997557324** (versionCode 1068832648). The user supplied an APKMirror split bundle, variant "Android 12L+", posted 16 Oct 2026.
- **HERE WeGo** (`com.here.app.maps`). No APK was supplied. Every HERE statement comes from public documentation and is tagged **[PD]**. The HERE column can be upgraded to observed evidence if the user later uploads a HERE WeGo APK.

**Baseline read first:** `docs/AUDIT.md` (v0.5 audit), `docs/re/FEATURE_COMPARISON.md`, `OPPORTUNITIES.md`, `AMAP_DEEP_DIVE.md` and `STACK_RESEARCH.md`. This report does not repeat their content. It cites them where relevant.

**Method (static and read-only).**

- The `.apkm` file is a plain, unencrypted zip of 40 entries: `base.apk`, 4 ABI splits, 6 density splits, 24 language splits and `info.json`. It was unzipped. Nothing was decrypted.
- `apktool 2.12.1 d -s` decoded the manifest and resources. Smali was not produced.
- The class list came from a small header-only DEX parser, which reads the `class_defs` and `type_ids` tables and no method bodies. `jadx 1.5.6` was installed but not needed, and no decompiled code was produced.
- Native libraries were scanned for printable strings. Only proto package names and JNI symbol names were kept.
- The app was not run. No Google or HERE server was contacted. API keys, certificates and similar values seen in `<meta-data>` were skipped and never printed.
- Scratch work is under `.scratch/gmaps/`. The large extractions were deleted afterwards and only `NOTES.md` remains.

**Evidence tags**

| Tag | Meaning |
|------------------|----------------------------------------------------------------------------------|
| **[O]** | Observed in the Google APK: manifest, resource, string key, class or library name |
| **[I]** | Inferred from observed evidence |
| **[PD]** | Public documentation (HERE docs, Play listing, vendor blogs, licence pages) |
| **[U]** | Unknown |
| **[B]** | Bharat Map repository (file named) |

Ratings run from 1 (poor) to 5 (best in class). **Q** is quality, **IR** is India-readiness, **E** is the effort for Bharat to match (1 = days, 5 = needs a partner or years).

# 1. Architecture comparison

| Layer | Google Maps 26.42 | HERE WeGo / HERE SDK | Bharat Map v0.5.10 |
|-------|-----------------------------------------------|----------------------|-----------------------|
| Shell / UI | Native Kotlin/Java. Views, Litho, Yoga, Jetpack Compose (Material 3) and a server-driven template runtime (`libelements.so`, YouTube "Elements"/"Eko") [O] | Native app; Android SDK supports Views and Compose [PD] | Capacitor WebView running vanilla JS modules [B] |
| Code size | 10 dex, 72,261 classes; 68,367 (94.6 %) are R8-repackaged into the default package [O] | [U] | Small JS bundle plus Capacitor plugins [B] |
| Native core | One monolithic `libgoogle3.so` (38.2 MB arm64, 29.4 MB armv7) holding the map, navigation, offline and ML engines [O/I] | C++ SDK core [PD] | None. MapLibre GL JS in the WebView [B] |
| Renderer | `mapcore`/`geoxp` native map controller; GL ES shader states; Vulkan flags present; label engine (`mapcore.labeler`); libtess2 tessellation [O]. 3D: Filament, Draco, meshoptimizer, basis_universal, rocktree tiles [O] | HERE SDK renderer; Style Editor styles [PD] | MapLibre GL JS (WebGL) [B] |
| Vector tile format | Proprietary "paint" protobuf (`maps_paint`, `maps_paint_client.styling`) [O]; not MVT [I] | MVT-style protobuf ("OMV") from the Vector Tile API v2, with geopolitical `kind:xx` views [PD] | MVT in PMTiles (Protomaps basemap) [B] |
| Online tiles | Paint tiles plus separate navigation tiles (`navdata/tiled`, `geonavtiles` host); raster/satellite tile hosts [O] | Vector Tile API v2, Raster Tile API v3 [PD] | OpenFreeMap / Protomaps online; PMTiles offline [B] |
| Tile cache | Native SQLite disk cache (`NativeSqliteDiskCacheImpl`) [O] | SDK cache plus installed regions [PD] | Browser/PWA cache; bundled PMTiles [B] |
| Online routing | Server-side, called over gRPC/protobuf [I] | Routing API v8: REST JSON with flexible polyline [PD] | Valhalla (public FOSSGIS by default), OSRM fallback, straight-line estimate [B] |
| Offline routing | On-device engine `google.maps.ondevice.routing` plus `pathfinder` graph over "Snaptile" road tiles; `OfflineRoutingController` and `OfflineReroutingController` [O] | `OfflineRoutingEngine` (Navigate licence only; no transit or EV offline) [PD] | None. Straight-line estimate only [B] |
| Guidance | Native `navcore` (RouteGuider, ActiveRouteMonitor, turn-card and lane views), lane scoring, lane-aware polyline interpolation [O] | Navigator/VisualNavigator, voice, lanes, warners, Electronic Horizon [PD] | JS: lanes, speed limits, junction schematic, WebAudio cues, TTS voice, reroute [B] |
| Positioning | Native sensor fusion (`LocationIntegrator`, `InertialsMonitor`, `SnappingTracer`), hard-brake detection, raw-GNSS logging DB [O] | HERE Positioning, HD GNSS [PD] | Browser/Capacitor geolocation, accuracy gating [B] |
| Search online | Server-side; Gemini "Ask Maps"/genai search protos [O] | Geocoding & Search v7 [PD] | Photon + Nominatim (public), own catalogue [B] |
| Search offline | Native offline search plus "transcode" [O]; on-device NLP (sentencepiece, NLP-SAFT, TF.Text, TFLite) [O] | Offline search in SDK (Navigate) [PD] | 68k-name JSON index per city, in-memory scan [B] |
| Voice / ASR | Earcons bundled (`da_*.ogg`); no TTS voices in the APK, so voices come from the system or are downloaded [I]; speech recognition through a Google speech host [O] | SDK voice guidance with TTS [PD] | System TTS (native plugin) or Web Speech; system speech recogniser [B] |
| Data delivery | Assets are only 373 KB; styles, models and voice are downloaded at runtime (`mobiledatadownload`) [O/I] | Map catalogs downloaded by region [PD] | Everything in the APK (98.4 MB) [B] |
| Network stack | Cronet, gRPC (OkHttp transport), protobuf lite and Kotlin, Brotli, Zstandard [O] | HTTPS REST [PD] | `fetch()` JSON; server gzip; LRU cache, coalescing, circuit breaker [B] |
| Car / wearables | Android Auto projection (14 projection categories), cluster and auxiliary displays, `androidx.car.app`, Wear, XR/glasses [O] | Android Auto integration documented [PD] | None [B] |
| Addressing | Plus Codes (Open Location Code library, `plus.codes` links), landmark spatial relations [O]; no DIGIPIN [O, absence] | what3words hosted API [PD] | DIGIPIN, pincode and landmark parsing [B] |
| UI languages | 68 language splits, 11 of them Indic (bn, gu, hi, kn, ml, mr, ne, pa, ta, te, ur); **no Odia or Assamese** [O] | [U] for Indic | 11 languages including **Odia**; v0.5 strings only in en/hi/te [B] |
| Privacy posture | 56 permissions (background location, contacts, AD_ID, ad-services attribution); 52 exported components without permission; cleartext allowed; backup allowed [O] | Play data-safety label: "no data shared with third parties" [PD] | No ad/analytics SDKs; cleartext off; `allowBackup=false` [B] |
| Min / target SDK | 32 / 37 for this variant [O] | [U] | 23 / 35 [B] |

**Key architectural takeaways**

1. **Google moved almost everything into one native library.** Rendering, guidance, positioning fusion, on-device routing and offline search all appear as JNI classes or proto packages backed by `libgoogle3.so` [O]. The Java/Kotlin layer is mostly UI and plumbing. Bharat cannot copy this, and should not. The open equivalent is MapLibre Native (C++) plus Valhalla mobile (C++).
2. **Google ships two tile families.** Display uses "paint" tiles. Routing and guidance use navigation tiles ("Snaptiles" and nav tiles) [O]. Offline routing works because the road graph is tiled and downloaded with the region [I]. Bharat should do the same: PMTiles for display plus Valhalla graph tiles per region.
3. **The APK is thin and the data is fat.** Google bundles 373 KB of assets and fetches styles, ML models and voice at runtime [O/I]. Bharat bundles 93 MB of PMTiles in the APK [B], which is the opposite trade-off.
4. **Device tiering is explicit.** There are GPU allow/block lists for levels 0 to 3 [O], a "lite navigation" multitasking mode [O], a Wi-Fi-only mode [O], and a separate Maps Go app that the main app queries for [O].
5. **The India-first features are real and visible in the APK** [O]:
   - two-wheeler mode (restricted roads, tolls, shortcuts, memorise-route cards) and two-wheeler "Navatars"
   - odd-even licence-plate avoidance
   - narrow-road and flyover decorations
   - rickshaw fares
   - metro ticket booking
   - India-localised search hints
   - landmark-relative addresses

   Each matches Google's public announcements [PD].

# 2. Feature matrix with ratings

Each cell gives Q/IR. E is Bharat's effort to reach parity on India-relevant quality.

| Feature | Google Q/IR | HERE Q/IR | Bharat Q/IR | E | Evidence (short) |
|----------|--------------|------------|--------------|-----|---------------------------------------------|
| Turn-by-turn navigation | 5/5 | 4/3 | 3/4 | 3 | G: navcore, lane scoring [O]. H: Navigator, lanes [PD]. B: lanes, junction view, cues; not device-tested [B] |
| Offline maps | 4/4 | 5/3 | 3/4 | 2 | G: OfflineInstance, Wi-Fi-only, SD card, expiry [O]. H: region/country install, Navigate licence [PD]. B: 11 bundled cities, no delta updates [B] |
| Offline routing | 4/4 | 4/3 | 1/1 | 3 | G: `ondevice.routing`, Snaptile [O]. H: OfflineRoutingEngine [PD]. B: straight line [B] |
| Offline search | 4/4 | 4/3 | 2/3 | 2 | G: `maps_gmm_offline.search` [O]. B: JSON scan, names only [B] |
| Voice guidance | 5/4 | 4/2 | 2/3 | 2 | G: flyover voice in 9 Indian languages [PD]. H: Indic voices [U]. B: system TTS; hi/te only for v0.5 keys [B] |
| Live traffic | 5/5 | 4/3 | 1/1 | 5 | G: traffic widget/hub [O]. H: Traffic API v7 [PD]; India coverage [U]. B: none, needs a partner [B] |
| Search / geocoding | 5/5 | 4/3 | 3/3 | 3 | G: Ask Maps/genai protos [O]. B: public Photon/Nominatim [B] |
| Transit | 4/4 | 3/2 | 2/3 | 3 | G: metro ticket booking strings [O], ONDC [PD]. H: 1,900+ cities [PD], India [U]. B: Hyderabad Metro GTFS + RAPTOR [B] |
| POI depth / freshness | 5/5 | 3/2 | 2/2 | 5 | G: UGC, merchant mode [O]. B: OSM + Overpass [B] |
| Two-wheeler | 4/5 | 3/3 | 3/4 | 2 | G: 27 `TWO_WHEELER_*` strings, Navatars [O]. H: `scooter` mode, 60 km/h cap [PD]. B: Valhalla `motor_scooter` [B] |
| Addressing | 4/3 | 2/2 | 4/5 | 1 | G: Plus Codes, landmark relations, no DIGIPIN [O]. H: what3words [PD]. B: DIGIPIN + pincode + landmarks [B] |
| Indic languages | 4/4 | 2/2 | 3/4 | 2 | G: 11 Indic splits, no Odia/Assamese [O]. B: 11 languages incl. Odia; partial v0.5 [B] |
| Low-end / Lite | 4/4 | 3/2 | 3/3 | 2 | G: GPU tiers, lite nav, Maps Go [O]. B: low-bandwidth mode; 98 MB APK; WebView [B] |
| Safety / incidents | 5/4 | 4/3 | 3/3 | 3 | G: police, speed trap, flood, lane closure reports [O]. B: 2-hour incidents, OSM Notes [B] |
| Privacy | 2/2 | 4/3 | 5/5 | 1 | G: 56 permissions, AD_ID [O]. H: data-safety label [PD]. B: zero trackers [B] |
| Car (Android Auto) | 5/4 | 4/3 | 1/1 | 4 | G: projection services [O]. B: none [B] |

HERE India-readiness ratings are judgements built on public docs plus unknown India coverage. Treat them as provisional until a HERE APK or a field test is available.

# 3. Ranked gap list

Ranked by user impact in India against the effort to close the gap.

| # | Gap (Bharat behind) | Why it matters | Open, legitimate route |
|-----|-------------------------|-------------------------------|---------------------------------------|
| 1 | **No offline routing** | Rural and low-signal trips are the India use case; Google and HERE both route offline | Valhalla mobile (MIT) plus per-city graph tiles shipped next to the PMTiles |
| 2 | **Production backends are public FOSSGIS/OSM instances** | Their usage policies forbid substantial commercial use (STACK_RESEARCH §1), which makes this a launch blocker | Self-host Valhalla, Photon and Overpass (compose file already exists) |
| 3 | **Survey of India boundary compliance** | The 2021 Guidelines §xiii make SoI boundaries the standard for political maps; AUDIT lists this as (not built) | Overlay SoI boundary data on the basemap; hide OSM `admin_level=2` disputed lines |
| 4 | **APK of 98 MB with no delta updates** | Low storage and expensive data on entry phones | On-demand region download, tile-diff patches, Brotli/zstd |
| 5 | **Offline search is name-only JSON** | No transliteration ranking, addresses or fuzzy match | SQLite FTS5 (trigram) with Indic transliteration keys |
| 6 | **Indic voice and string completeness** | v0.5 strings exist only in en/hi/te; the other 8 fall back to English | Native-speaker review; per-language TTS voice picker |
| 7 | **No live traffic** | ETA trust | Licensed partner (MapmyIndia/TomTom/HERE) or opt-in anonymised probe speeds with k-anonymity |
| 8 | **POI and rural coverage** | OSM is thin outside metros | Overture Places (CDLA-Permissive/Apache/CC0 sources), Open Buildings (CC BY 4.0) as a mapping aid, community edits through OSM |
| 9 | **Transit beyond the Hyderabad Metro** | Bus is the majority mode | Ingest more official GTFS feeds as they are published (TGSRTC form download); flexible loader exists |
| 10 | **No device testing or Android Auto** | Many v0.5 features are prototype until tested on hardware | Device lab (Redmi/Realme/Samsung A); `androidx.car.app` later |

**Where Bharat is ahead**

- **DIGIPIN.** No DIGIPIN string or code was observed in Google's APK [O]. DIGIPIN is the Department of Posts' national grid. It is open source under Apache-2.0 and designed for offline use [PD].
- **Odia** is in Bharat's 11 UI languages. It is absent from Google's 68 language splits and locale config [O].
- **Privacy.** Bharat has zero ad and analytics SDKs and requests no background location by default. Google requests 56 permissions [O].
- **Licence-clean open stack.** OSM is ODbL, and Bharat ships offline maps for 11 cities on first launch.

**India open-data sources: licences checked 19 Oct 2026**

| Source | Licence / terms (current page) | Use in Bharat |
|-------------|--------------------------------------------------------------|-------------------------|
| OpenStreetMap | ODbL 1.0; credit "© OpenStreetMap contributors"; share-alike for derived databases [PD] | Basemap, routing, POIs (already) |
| ISRO Bhuvan | Bhuvan ToS forbids derivative works, redistribution, bulk download and **use for real-time navigation or route guidance** without written permission [PD] | **Do not ingest.** Link out only |
| Survey of India / 2021 Guidelines / NGP 2022 | Guidelines §xiii: SoI boundaries are the standard for political maps and are freely downloadable. §vii–ix: data finer than 1 m horizontal accuracy is for Indian Entities only and must be stored in India. Street-view surveys are for Indian Entities only. NGP 2022 published in the Gazette of 28 Dec 2022 [PD] | Use the SoI boundary layer; keep the hosting entity Indian; self-certify on the DST portal |
| India Post DIGIPIN | Code under Apache-2.0; ~4 m × 4 m grid; offline encode/decode; India bounding box 2.5–38.5° N, 63.5–99.5° E [PD] | Already implemented; add the official symbol and 3-4-3 display grouping |
| data.gov.in (GODL-India) | Worldwide, royalty-free, commercial and derivative use allowed; attribution required (provider, source, licence, URL) [PD] | Pincode directory, census towns, facility lists |
| GTFS (HMRL) | HMRL terms permit redistribution with attribution (AUDIT v0.4) [B] | In use; add others as published |
| Overture Maps | Base, Buildings, Divisions, Transportation: ODbL. Places: CDLA-Permissive 2.0 / Apache-2.0 / CC0 by source. No Indian address source listed [PD] | Places enrichment (keep source attribution) |
| Microsoft Global ML Building Footprints | **CDLA-Permissive 2.0** (repo page; Overture's page still says ODbL, so the repo is authoritative). India received about 110 M edits in March 2024 [PD] | Building layer for low zoom / rural |
| Google Open Buildings v3 | Choice of CC BY 4.0 **or** ODbL; India (IND) covered; includes a Plus Code per building [PD] | Rural settlement layer; ODbL option is OSM-compatible |

# 4. Roadmap

## 4.1 Top 10 features: impact vs effort

| # | Feature | Impact | Effort | Builds on |
|------|--------------------------------------------------------|---------|---------|---------------------|
| 1 | **On-device routing**: Valhalla mobile plus per-city graph tiles (`motor_scooter`, `auto`, `pedestrian`) | Very high | M–L | `shared/valhalla.js` request shape is reused unchanged |
| 2 | **Self-hosted backend cut-over** (Valhalla, Photon, Overpass, tiles) on an Indian VM | Very high (legal) | M | `docker-compose.yml`, `SELF_HOSTING.md` |
| 3 | **SoI-compliant boundary layer** plus disputed-line suppression | High (legal) | S | Style JSON + one GeoJSON overlay |
| 4 | **Region manager v2**: download on demand, size first, Wi-Fi-only, expiry/auto-update, delta patches | High | M | `regions.json`, `make-region.sh` |
| 5 | **Offline search on SQLite FTS5** with transliteration keys, DIGIPIN and pincode | High | S–M | `build-poi-index.mjs` |
| 6 | **Device-tier profile**: low/mid/high style, label density, 3D off, cache size | Med–High | S | Low-bandwidth policy module |
| 7 | **Indic voice pack UX**: language/voice picker, Indian-language numerals, flyover and service-road prompts | High | S–M | `web/nav/voice.js` |
| 8 | **Flyover / service-road and narrow-road hints** from OSM `bridge=yes`+`layer`, `highway=service`, `width`/`lanes` | High | M | Lane and junction modules |
| 9 | **Odd-even / time-restricted roads** from OSM `conditional` restrictions (Valhalla honours `date_time`) | Med | S | Valhalla costing options |
| 10 | **Community traffic v0**: opt-in, anonymised segment speeds aggregated per 15 minutes with k ≥ 5 and shown only above a confidence threshold | Med–High | L | Incident server tables |

**Status after sprint 0.5.11 (19 Oct 2026):**

| # | Feature | Status |
|---|---|---|
| 1 | On-device routing | 🟡 Groundwork: Visakhapatnam Valhalla graph built and routed offline in the sandbox (71 tiles, 10.9 MB tar, 3.7 MB gz; `docs/OFFLINE_ROUTING.md`); no on-device engine yet |
| 2 | Self-hosted backend cut-over | ⛔ Not started (needs a VM) |
| 3 | SoI boundary layer | ⛔ Not started |
| 4 | Region manager v2 | ⛔ Not started |
| 5 | Offline search FTS5 + transliteration + DIGIPIN/pincode | ✅ Done: token index in the app (86,977 places, 11 cities), SQLite FTS5 on the server, Latin↔Indic transliteration for 9 scripts, 1,079 pincodes, DIGIPIN. Benchmark set not built |
| 6 | Device-tier profile | ✅ Done (Lite/Balanced/Full + override); cache size per tier not yet tiered |
| 7 | Indic voice pack UX | ✅ Voice picker + sample + persisted guidance voice/language; Indian-language numerals not done |
| 8 | Flyover / service-road / narrow-road hints | ✅ Done (Valhalla edges + Overpass tags); field test pending |
| 9 | Odd-even / time-restricted roads | 🟡 Badge from `*:conditional` + odd-even notes with in-force-now evaluation; routing does not yet pass `date_time` to avoid them |
| 10 | Community traffic v0 | ⛔ Not started |

Deliberately out: satellite imagery (no free redistributable source), speed cameras (data plus legal), street view (Indian-entity survey rules plus cost), and Bhuvan data (ToS).

## 4.2 Architecture choices

| Decision | Choice | Reason |
|---------|-----------------------------|--------------------------------------------------------------|
| Renderer | **MapLibre GL JS now; MapLibre Native Android for the navigation screen in v0.7** | GL JS keeps one codebase. Native gives Vulkan/GL ES performance on low-end GPUs and reads PMTiles directly (`pmtiles://`, since Android 11.7.0). Note that PMTiles sources do not support offline packs or ambient caching, so Bharat manages files itself [PD] |
| Router (server) | **Valhalla primary; OSRM for matrices** | Dynamic costing (`motor_scooter`, `use_tolls`, `use_highways`, time-dependent), lanes and speed limits in one engine; OSRM CH is faster for many-to-many delivery matrices. GraphHopper (Apache-2.0) is viable self-hosted, but its hosted free plan is non-commercial (STACK_RESEARCH §1.4) and no maintained Android offline build was found [U] |
| Router (device) | **Valhalla mobile (`io.github.rallista:valhalla-mobile`, MIT)** | Runs `route`, `trace_route`, `trace_attributes` and `sources_to_targets` on downloaded tiles. Answers in Valhalla or OSRM JSON, so the existing parser keeps working [PD] |
| Geocoder | **Photon for type-ahead, Nominatim for structured/reverse; Pelias deferred** | Photon is light and multilingual (OSM `name:xx`). Nominatim gives address hierarchy. Pelias brings Elasticsearch ops weight for little India gain until there is an address source [I] |
| Tiles | **Planetiler → PMTiles (Protomaps schema)**; tilemaker only for small custom layers | Planetiler builds India in minutes on one VM. PMTiles serves from object storage with Range requests and no tile server |
| Offline search | **SQLite FTS5** with `trigram` tokenizer plus a `translit` column | Fuzzy and substring matches across scripts; about 5–8 MB per metro [I] |
| Formats on the wire | MVT (protobuf) tiles; gzip for JSON today, Brotli at the CDN; Valhalla PBF later | Google uses protobuf and Brotli/zstd end to end [O]. Bharat already uses MVT |

## 4.3 Offline-first and low-bandwidth strategy

- **Delta tile updates.** Build each region as PMTiles. On update, compare tile hashes by z/x/y, ship a diff archive holding only the changed tiles plus a manifest, and apply it into a new file with an atomic rename. Expect 5–15 % of the size per monthly OSM refresh [I].
- **Two-family offline region:**
  - `city.pmtiles` for display
  - `city.valhalla.tar` for routing
  - `city.fts.sqlite` for search
  - one manifest with sizes, version and expiry, mirroring Google's offline instance, tile fetcher and search split [O]
- **Compression.** Brotli for JSON and manifests; tiles stay gzip-compressed inside PMTiles; zstd for graph tars.
- **Request coalescing.** Keep the server coalescer and add client-side de-duplication of identical in-flight tile and route requests, then batch Overpass and POI lookups per viewport.
- **2G mode.** No raster or 3D, zoom cap 15, no prefetch, text-only route list, voice still on, route geometry simplified (precision-5 polyline), tile requests capped at 4 in flight.

## 4.4 90-day roadmap (starts Tue 20 Oct 2026)

| Window | Milestone | Exit criteria |
|-------------|-------------------------------------------------------|-------------------------------|
| Days 1–15 (to 3 Nov) | **M1 Legal-ready backend.** Indian VM; self-hosted Valhalla, Photon and Overpass; SoI boundary overlay; DST self-certification | No public FOSSGIS/OSM endpoints in production config; boundary review signed off |
| Days 16–30 (to 18 Nov) | **M2 Offline search v2.** *(core done early in sprint 0.5.11; benchmark pending)* FTS5 index builder; transliteration keys for 11 languages; DIGIPIN/pincode lookup offline | Top-5 hit rate ≥ 85 % on a 300-query Indic test set, offline |
| Days 31–50 (to 8 Dec) | **M3 Offline routing.** Valhalla mobile plugin (Capacitor); Hyderabad and Visakhapatnam graph tiles; online-to-offline fallback | Airplane-mode turn-by-turn in 2 cities on 3 devices |
| Days 51–65 (to 23 Dec) | **M4 Region manager v2.** Remove bundled cities above 2; on-demand download with size, Wi-Fi-only, expiry and delta patches | APK ≤ 35 MB; monthly delta ≤ 15 % of the full region |
| Days 66–80 (to 7 Jan 2027) | **M5 India guidance.** *(hints, restriction badge and voice picker done early in sprint 0.5.11; field test + string review pending)* Flyover/service-road and narrow-road hints; odd-even restrictions; Indic voice picker; native-speaker string review for all 11 languages | Field-tested on 50 km of Hyderabad/Vizag routes; no English fallback strings |
| Days 81–90 (to 17 Jan 2027) | **M6 Low-end and community.** *(device tiers done early in sprint 0.5.11)* Device-tier profile; 2G mode hardening; opt-in probe-speed pilot behind a flag | Cold start ≤ 3 s on a 3 GB-RAM phone; pilot privacy review done |

**First 90 minutes:** run `docker compose up valhalla photon`, point `VALHALLA_URL` and `PHOTON_URL` at them, build Hyderabad graph tiles with the commands in §5, and confirm a `motor_scooter` route answers locally with no public endpoint in the request log.

# 5. Tool commands and snippets

**Static APK inventory (as used here; read-only)**
```bash
unzip -l app.apkm                                   # is it a plain zip?
unzip -q app.apkm -x 'split_config.x86*' -d apkm    # extract
java -jar apktool.jar d -s -f apkm/base.apk -o base_dec   # manifest+res, no smali
unzip -lv apkm/split_config.arm64_v8a.apk | grep '\.so'   # native libs + sizes
jadx --no-res --no-src -d out apkm/base.apk         # optional: structure only
```

**Valhalla graph tiles for one city (server and device)**
```bash
wget https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf
osmium extract -b 78.2,17.2,78.7,17.6 southern-zone-latest.osm.pbf -o hyd.osm.pbf
valhalla_build_config --mjolnir-tile-dir tiles --mjolnir-tile-extract hyd.valhalla.tar \
  > valhalla.json
valhalla_build_tiles -c valhalla.json hyd.osm.pbf
valhalla_build_extract -c valhalla.json -v          # -> hyd.valhalla.tar for the app
```

**Region display tiles**
```bash
pmtiles extract https://build.protomaps.com/20261017.pmtiles hyd.pmtiles \
  --bbox=78.2,17.2,78.7,17.6 --maxzoom=15
```

**Offline search schema (SQLite FTS5)**
```sql
CREATE TABLE place(id INTEGER PRIMARY KEY, name TEXT, name_local TEXT,
  kind TEXT, lat REAL, lng REAL, pincode TEXT, digipin TEXT, rank REAL);
CREATE VIRTUAL TABLE place_fts USING fts5(
  name, name_local, translit, kind,
  content='place', content_rowid='id', tokenize='trigram');
-- translit = Latin key built at index time, e.g. "charminar" for చార్మినార్
SELECT p.* FROM place_fts f JOIN place p ON p.id = f.rowid
WHERE place_fts MATCH ?1 ORDER BY bm25(place_fts) - p.rank LIMIT 10;
```

**Device routing call (Kotlin, Capacitor plugin side; illustrative, so check the valhalla-mobile Dokka for exact builder names)**
```kotlin
val cfg = ValhallaConfigBuilder().withTileExtract(File(filesDir, "hyd.valhalla.tar").path).build()
val valhalla = Valhalla(context, cfg)
val json = valhalla.route(routeRequestJson)   // same body as web/services → shared/valhalla.js
```

**MapLibre Native offline region from a downloaded PMTiles file**
```kotlin
style.addSource(VectorSource("base", "pmtiles://file://${filesDir}/hyd.pmtiles"))
```

**SoI-first boundary handling (style filter)**
```json
{ "id": "boundary-country", "type": "line", "source": "base",
  "source-layer": "boundaries",
  "filter": ["all", ["==", ["get", "kind"], "country"], ["!=", ["get", "disputed"], true]] }
```
Draw the official SoI boundary GeoJSON on top as its own layer.

**Delta patch builder (idea)**
```bash
pmtiles show old.pmtiles --metadata; pmtiles show new.pmtiles --metadata
# script: iterate tile IDs, hash(tile_old) != hash(tile_new) -> write to diff.pmtiles + manifest.json
```

# 6. Legal and ToS risks

| Risk | Detail | Mitigation |
|-------------|----------------------------------------------------------|-----------------------------|
| **Google ToS: reverse engineering** | Google's Terms of Service (effective 30 Jul 2026) prohibit "reverse engineering our services or underlying technology … to extract trade secrets or other proprietary information, except as allowed by applicable law". The software licence bars copying and modification. The Maps Additional Terms bar creating a substitute service from Maps content and "mass download", and bar use with other products for real-time navigation | Teardown limited to static, read-only inventory for interoperability and competitive research. No code, assets, text or data copied. No Google content used to build Bharat data |
| **Google Maps Platform Terms** | §3.2.1 forbids reverse engineering and decompiling | Bharat uses no Google Maps Platform APIs |
| **HERE terms** | HERE End User Terms bind users to an Acceptable Use Policy. The AUP was not fetched in full, so its reverse-engineering clause is [U] | Public docs only; no HERE APK was analysed |
| **Data contamination** | OSM forbids adding data from Google Maps or other copyrighted maps. Bhuvan forbids derivative and navigation use | Never trace from Google, HERE or Bhuvan; keep data provenance per layer |
| **Geospatial regulation** | 2021 Guidelines: SoI boundaries are the standard for political maps; data finer than the threshold is for Indian Entities only and stored in India; street-view and mobile-mapping surveys are for Indian Entities only | Indian hosting entity; SoI layer; no street-view capture |
| **DPDP Act 2023** | Live sharing, incident and probe data are personal data | Existing privacy dashboard; opt-in; aggregation and k-anonymity |
| **Secrets** | The APK contains API keys and backup keys in `<meta-data>` | Skipped; not recorded anywhere |
| **Public infrastructure terms** | FOSSGIS/OSM services are not for substantial commercial use | Roadmap M1 |

This report is not legal advice. Have Indian counsel review the reverse-engineering exception before any further work on Google artefacts.

# 7. Evidence appendix

**Google Maps APK: observed [O] unless tagged otherwise**

| Claim | Evidence (file / path / class) |
|------------------|----------------------------------------------------------------------------------|
| Plain zip; variant, min API | `.apkm` central directory; `info.json` (`min_api` 32, arches, 24 languages) |
| min 32 / target 37 | `base_dec/apktool.yml` `sdkInfo` |
| 56 permissions incl. background location, AD_ID, ad-services attribution, contacts | `AndroidManifest.xml` `<uses-permission>` |
| 13 location/dataSync foreground services | Manifest `foregroundServiceType`: `navcore.service.base.NavigationService`, `directions.livetrips.service.LiveTripsService`, `offline.update.OfflineManualDownloadService`, `car.GmmCarProjectionService` and others |
| 52 exported components without permission; cleartext allowed; `allowBackup=true` | Manifest `<application>` attributes and component scan |
| Deep links: `geo`, `google.navigation`, `google.maps`, `google.streetview`, `plus.codes`, about 550 Google ccTLD hosts | `MapsActivity` and `GmmCarProjectionService` intent filters |
| Widgets: search, traffic | `widget.SearchWidgetProvider` (`@xml/search_widget_new_logo`), `widget.traffic.TrafficWidgetProvider` |
| Android Auto / cluster / glasses / Wear | `com.google.android.gms.car.application` → `@xml/automotive_description`; categories `CATEGORY_PROJECTION_NAVIGATION` (14), `CATEGORY_CLUSTER_DISPLAY`, `CATEGORY_GLASSES`; `wearable.GmmWearableListenerService` |
| No dynamic feature modules; 68 language splits; Indic set; no `or`/`as` | `res/xml/splits0.xml` (single module ""), `res/xml/locales_config_release.xml` (80 locales) |
| Native libs | `split_config.arm64_v8a.apk`: `libgoogle3.so` 38,190,512 B, `libelements.so` 3,642,800 B, `libarcore_sdk_*`, `libframesequence.so`; armv7 `libgoogle3.so` 29,353,268 B |
| Server-driven UI runtime | `libelements.so` JNI `...elements.templates.UnifiedTemplateResolver`, proto pkgs `youtube.elements`, `youtube.eko` |
| Assets tiny; GPU device tiers | `assets/` 373 KB; `assets/lists/level_{0..3}_gpu_{allow,block}list` |
| Third-party stack | `res/raw/third_party_license_metadata` (350 names): Cronet, gRPC Java/Kotlin, Protobuf, Dagger, Kotlin coroutines, Compose/Material3, Litho, Yoga, TensorFlow, TFLite Support, TF.Text, Filament, Draco, meshoptimizer, basis_universal, libtess2, Brotli, Zstandard, Riegeli, open_location_code, or-tools, mobiledatadownload, Lottie, ExoPlayer, Spotify SDK |
| Class count and obfuscation | 10 dex, 72,261 class defs; 68,367 without a package (header parse) |
| Renderer | `libraries/geo/mapcore/geoxp/jni/NativeMapController`, `.../internal/store/diskcache/NativeSqliteDiskCacheImpl`, `.../renderer/LabelRenderer`, `.../internal/model/NativeTess2`, GL `*ShaderState` classes |
| Paint tile format [O names, I meaning] | `libgoogle3.so` strings: `maps_paint.PaintRequestTemplate`, `maps_paint_client.styling.*` |
| Navigation tiles | `apps/gmm/navdata/tiled/{cache,fetcher,provider}/Native*`; host category `geonavtiles` |
| Offline subsystem | `apps/gmm/offline/{instance,tilefetcher,routing,search,paint,roadview,update,appindex}/*` |
| On-device routing | proto pkgs `google.maps.ondevice.routing`, `pathfinder.Snaptile*`; classes `offline/routing/OfflineRoutingControllerImpl`, `OfflineReroutingControllerImpl`, `roadgraph/SnaptileStore` |
| Guidance | `libraries/geo/navcore/{guider/jni/RouteGuiderJni, service/guider/jni/ActiveRouteMonitorJni, turncard/views/TurnCardLaneGuidanceListView}`; `directions/laneaware/NativeLaneAwarePolylineInterpolator`; pkg `maps_gmm_nav.lane_scoring` |
| Positioning fusion | `apps/gmm/location/navigation/{LocationIntegratorJni, InertialsMonitorJniCpp, SnappingTracerJni}`, `location/hardbrake/SensorSignalProcessingJni`, `location/rawgnssmeasurements/storage/RawGnssLoggingDatabase` |
| On-device ML / NLP | `systems/odml/jni/{OdmlJni, text/TextClassifierJni}`; pkgs `sentencepiece`, `nlp_saft.mobile`, `maps_gmm_odml.proto`; ML Kit text/face |
| Gemini search | pkg `maps_tactile.shared.genaisearch`; 68 `ASK_MAPS*` and 32 `GEMINI*` string keys; `res/raw/ask_maps_spinner_aurora` |
| 3D / immersive | `com/google/geo/imagery/viewer/*`, `geo/ar/arlo/*`; pkgs `geo_globetrotter_proto_rocktree`, `three_d_serving.tiles` |
| Two-wheeler | String keys `TWO_WHEELER_CARD_BODY_RESTRICTED_ROADS`, `..._TOLLS`, `..._SHORTCUTS`, `..._MEMORIZE`, `NAVATARS_SETTINGS_ENTRY_POINT_TITLE_TWO_WHEELER_MODE`; raw `two_wheeler_card_*`; class pkg `customchevron/navatars`; native enum `TWO_WHEELER` |
| India-specific | `AVOID_ODD_EVEN_ROADS`, `ODD_EVEN_LICENSE_PLATE_*`, raw `img_odd_even_license_plate`; `DRIVING_DECORATIONS_NARROW_ROAD`, `DRIVING_DECORATIONS_FLYOVER`; `METRO_TICKET_BOOKING_*`; `DIRECTIONS_TRANSIT_OPTIONS_CONNECTING_MODES_RICKSHAW`; `GHOST_TEXT_*_LOCALIZED_FOR_INDIA`; raw `user_delight_durga_puja`; `<queries>` for `com.olacabs.customer`, `com.winit.merucab`, `com.whereismytrain.android`, `com.google.android.apps.nbu.paisa.user` |
| Addressing | `PLUS_CODE_*` (32 keys), `OPEN_LOCATION_CODE_TUTORIAL_PLUS_CODE_LABEL`, `LANDMARK_SPATIAL_RELATIONSHIP_{NEAR,BESIDE,BEHIND,ACROSS_THE_ROAD,WITHIN}`; native `gmm.TactilePlaceProto.OpenLocationCode`; no `DIGIPIN` in strings or native strings |
| Offline UX | `OFFLINE_MAPS_SETTINGS_DOWNLOAD_PREFERENCE_WIFI_ONLY`, `OFFLINE_MAPS_SETTINGS_STORAGE_SETTINGS_SD_*`, `OFFLINE_MAP_DISUSE_EXPIRATION_*`, `OFFLINE_TO_ONLINE_NAVIGATION_*` (227 OFFLINE keys) |
| Lite / low-end | `LITE_NAVIGATION_*` (13 keys), `WIFI_ONLY_MODE_*`, `features/minmode/MinModeActivity`, `<queries>` `com.google.android.apps.mapslite`; meta-data `PROPERTY_SATELLITE_DATA_OPTIMIZED` |
| Incidents | `REPORT_INCIDENT_PROMPT_{POLICE,SPEED_TRAP,LANE_CLOSURE,...}`, `FLOOD_*`, `ROAD_CLOSURE_*` |
| Voice | raw `da_*` earcons (`da_laneguidance_tick`, `da_navigation_chimes_*`); `<queries>` `com.google.android.tts`; speech host category `speechs3proto2` [O]; voice data downloaded at runtime [I] |
| Network | Licences (Cronet, gRPC, protobuf); `META-INF/services/io.grpc.*`; host categories (production only): `mobilemaps-pa` (main app API), `geonavtiles-pa` (nav tiles), `mt*`/`mts*`/`kh` (raster and satellite tiles), `streetviewpixels-pa`, `mapsphotoupload`, `footprints-pa`, `infinitedata-pa`, `notifications-pa`. Protobuf/gRPC over these is [I] |

**HERE [PD]**

| Claim | Source |
|----------------------------------------------------|------------------------------------------------|
| Routing v8 is REST JSON with flexible polyline, transport modes, traffic, tolls, EV, guidance | https://www.here.com/docs/bundle/routing-api-developer-guide-v8/page/README.html |
| `scooter` mode covers two-wheelers up to motorcycles; motorcycle-open roads; 60 km/h cap; avoids highways by default | https://docs.here.com/routing/docs/routing-v8-scooter-routing.md |
| Scooter coverage equals navigable countries | https://docs.here.com/routing/docs/routing-v8-scooter-routing-coverage.md |
| Vector tiles are protobuf, MVT-style ("OMV") | https://docs.here.com/map-rendering/docs/encoding-specification.md |
| Geopolitical views (`kind:xx`), India/Kashmir example | https://docs.here.com/map-rendering/docs/geopolitical-views-vector-tile-api.md |
| SDK components: offline maps, OfflineRoutingEngine (Navigate licence; no transit/EV offline), voice, lanes, Android Auto | https://docs.here.com/here-sdk/docs/here-sdk-for-android-developer-guide/llms.txt ; https://docs.here.com/here-sdk/docs/android-offline-maps-routing.md |
| Product catalogue: Traffic v7, Transit v8, Safety Cameras, what3words | https://docs.here.com/llms.txt |
| WeGo: 1 crore+ downloads, 3.2★, transit in 1,900+ cities, offline region/country maps, data-safety label, updated 21 Sep 2026 | https://play.google.com/store/apps/details?id=com.here.app.maps |
| End User Terms and AUP | https://legal.here.com/en-gb/terms/here-end-user-terms |
| Indic voice/UI languages in WeGo; India traffic/transit depth; app internals | [U]: upload the HERE WeGo APK to upgrade |

**Legal, licence and India sources [PD]**

| Item | URL |
|-----------------------------------|-----------------------------------------------------------------|
| Google Terms of Service (reverse-engineering clause) | https://policies.google.com/terms |
| Google Maps Additional Terms | https://www.google.com/help/terms_maps/ |
| Google Maps Platform Terms §3.2.1 | https://cloud.google.com/maps-platform/terms |
| Google Maps India features (Navatars, flyover voice in 9 languages, ONDC metro tickets) | https://blog.google/intl/en-in/products/explore-communicate/google-maps-in-india-enhancing-every-way-you-travel-with-india-first-features |
| OSM licence | https://www.openstreetmap.org/copyright |
| Bhuvan Terms of Service | https://bhuvan.nrsc.gov.in/home/index.php (Terms dialog) |
| 2021 Geospatial Guidelines (full text) | https://geospatial.dst.gov.in/Guidelines.aspx |
| National Geospatial Policy 2022 | https://dst.gov.in/national-geospatial-policy (gazette PDF linked there) |
| DIGIPIN | https://www.indiapost.gov.in/digipin ; https://github.com/INDIAPOST-gov/digipin |
| GODL-India | https://www.data.gov.in/sites/default/files/Government_Open_Data_Use_Licence_India.pdf |
| Overture licences | https://docs.overturemaps.org/attribution/ |
| Microsoft building footprints | https://github.com/microsoft/GlobalMLBuildingFootprints |
| Google Open Buildings | https://sites.research.google/gr/open-buildings/ |
| MapLibre Android PMTiles | https://www.maplibre.org/maplibre-native/android/examples/data/PMTiles |
| Valhalla mobile | https://github.com/Rallista/valhalla-mobile |

**Bharat Map [B]**

| Claim | File |
|----------------------------------------------------|------------------------------------------------|
| v0.5 feature state, remaining gaps, SoI (not built) | `docs/AUDIT.md` |
| APK 98.4 MB; 11 cities; 68k index | `docs/AUDIT.md` v0.5 table; `web/offline/*.pmtiles`, `web/offline/pois/*.json` |
| Offline index is normalised JSON scan | `web/lib/offline-index.js` |
| Voice through Web Speech or native TTS | `web/nav/voice.js` |
| 11 UI languages incl. Odia | `shared/i18n.js` `LANGS` |
| min/target SDK 23/35 | `android/variables.gradle` |
| Public-endpoint policy constraints | `docs/re/STACK_RESEARCH.md` §1–2 |

**Unknowns**

- Exact Google tile and route wire schemas: proto names only, no schema read.
- Whether Google's offline routing covers two-wheeler and walking.
- The quality of Google's Odia support in map labels (as opposed to the UI).
- Everything internal to HERE WeGo.
- HERE's India traffic, transit and voice coverage.
- The full HERE AUP clause text.
- Measured on-device size of a Valhalla tile tar for Indian metros (estimate: tens of MB per metro).

