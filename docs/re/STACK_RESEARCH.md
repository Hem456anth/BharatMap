# Bharat Maps: integration stack research (v0.3)

Verified 18 Oct 2026 by fetching each provider's own page, unless marked otherwise.
- Tags: **[O]** read on the fetched page · **[O-x]** search excerpt only · **[I]** inference · **[U]** unknown.
- This builds on `docs/RESEARCH.md` §2–§4 (licensing, OSS evaluation, India data) and does not repeat it.

**Key finding:** the v0.2 code's default router (`router.project-osrm.org` in `server/services/external.js`) is a demo restricted to "reasonable, non-commercial use-cases, ≤ 1 req/s". [O §1.2] Every free public OSM service checked here forbids being the backbone of a consumer app. **v0.3 must self-host routing, geocoding and POIs before any public release.** Public servers are acceptable for development only, behind a server-side proxy with a real User-Agent, caching, and a config switch.

---

## 1. Routing

### 1.1 FOSSGIS routing.openstreetmap.de (OSRM car / bike / foot) and valhalla1.openstreetmap.de
- **Source:**
  - https://routing.openstreetmap.de/about.html [O]
  - https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/ [O]
- **Terms:**
  - **max 1 request/second**
  - valid identifying User-Agent (library defaults are not enough) and Referer
  - max 2 connections (scripts: 1)
  - show OSM attribution **plus a link to https://www.openstreetmap.org/fixthemap**
  - publish an operator e-mail on the app's website and store entries
  - do not hard-code the URLs
  - **commercial use only if the service is not a substantial part of the offering**
  - high-traffic sites may not use it
  - no SLA; can be withdrawn without notice
- **Profiles:**
  - OSRM car, bike and foot worldwide, using FOSSGIS-specific profiles; data refreshed about every 2 days [O]
  - URL pattern `/routed-car/`, `/routed-bike/`, `/routed-foot/` + OSRM v1 API [I: pattern used by its public frontend; confirm before coding]
- **Key:** none.
- **Use in Bharat Maps:** dev and CI smoke tests only, through our `/api/route` proxy with caching. Routing *is* a substantial part of Bharat Maps, so production use breaches the terms.

### 1.2 OSRM demo (router.project-osrm.org)
- **Source:** https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server [O]
- **Terms:** "restricted to reasonable, **non-commercial** use-cases. Do not exceed 1 request per second." No guarantees on uptime, latency or data updates. The same FOSSGIS policy applies.
- **Use:** replace it as the default now. Set `OSRM_URL` to self-hosted OSRM. The repo's `docker-compose.yml` already has an OSRM service.

### 1.3 Self-hosted OSRM / Valhalla (recommended)
| | OSRM | Valhalla |
|---|---|---|
| Licence | BSD-2 (see RESEARCH.md §3) | MIT (see RESEARCH.md §3) |
| Cost | Free; a VM sized for the Southern Zone / India extract | Free; lower RAM, tiled graph |
| Strengths | Very fast; `alternatives=true`, `steps=true`, matrices | Dynamic costing: auto, **motor_scooter / motorcycle** (2-wheeler), pedestrian, bicycle, **truck**; `use_tolls`, `use_highways`, `alternates`; lane info in maneuvers; isochrones [I: from Valhalla docs, not re-fetched this pass] |
| Weakness | Need one preprocessed graph per profile; avoid-toll exclusions need profile classes | Slower than OSRM CH |

- **Decision:**
  - **Valhalla is the primary navigation router** for Drive, 2-Wheeler, Walk and Bike (avoid tolls/highways, alternates, lanes).
  - **OSRM is kept** for delivery matrices and rider assignment (already integrated).
  - Both are built from the Geofabrik India or Southern Zone PBF (RESEARCH.md §4).
- **Dev fallback:** valhalla1.openstreetmap.de under the FOSSGIS rules above (1 rps, dev only). Valhalla's own docs describe it as a public demo under "the usual fair-usage policy". [O-x https://valhalla.github.io/valhalla/start/introduction/]

### 1.4 GraphHopper Directions API (hosted)
- **Source:** https://www.graphhopper.com/pricing/ [O]
- **Free plan:**
  - 500 credits/day, max 5 locations/request, forum support only
  - **"for non-commercial use only"**
  - limited vehicle profiles, no flexible mode
- **Paid plans:**
  - Basic €69/mo (5,000 credits/day, 1 req/s)
  - Standard €199/mo (15,000/day, 2 req/s)
  - Premium €479/mo (50,000/day, 10 req/s)
  - 20% attribution discount
- **Key:** yes.
- **Use:** not chosen. Consider Basic only as a paid hosted fallback if self-hosting slips. The open-source engine (Apache-2.0) remains an option for GTFS and truck (RESEARCH.md §3).

### 1.5 openrouteservice (HeiGIT)
- **Source:** https://openrouteservice.org/plans/ [O]
- **Standard plan (free, everyone),** limits are daily / per minute:
  - Directions 2,000 / 40
  - Matrix 500 / 40
  - Isochrones 500 / 20
  - Geocoding 3,000 / 100
  - POIs 500 / 60
  - Optimization 500 / 40
  - Snap 2,000 / 100
  - Elevation 2,000 / 40
- **Collaborative plan:** free, about 5× higher, for humanitarian, academic, government and non-profit users.
- On-premise is unlimited.
- **Key:** yes (HeiGIT account).
- **Commercial-use terms:** [U] (ToS page not opened).
- **Use:** optional dev fallback for isochrones. Not for production volume.

**Routing verdict:** self-hosted Valhalla (navigation) + self-hosted OSRM (matrices). FOSSGIS / OSRM demo for dev only.

---

## 2. Geocoding and autocomplete

### 2.1 Nominatim (nominatim.openstreetmap.org)
- **Source:** https://operations.osmfoundation.org/policies/nominatim/ [O]
- **Terms:**
  - **absolute max 1 req/s per application** (summed over all users)
  - identifying User-Agent or Referer
  - attribution; ODbL share-alike applies
  - apps must be able to **switch service without a software update**
  - "set up a proxy and enable caching"
  - periodic or bulk requests are discouraged
- **Explicitly forbidden:**
  - **auto-complete search**
  - systematic or grid queries
  - scraping
  - reselling
- **Key:** none.
- **Use:**
  - dev reverse-geocoding fallback only, behind `/api/geocode` with caching
  - **never for typeahead** (v0.2 types ahead over its own catalogue and falls back to Nominatim on submit, which is acceptable; keep it that way)
  - self-host for production (RESEARCH.md §3)

### 2.2 Photon (photon.komoot.io)
- **Source:** https://photon.komoot.io/ [O]
- **Features:** search-as-you-type, typo tolerance, location bias (`lat`/`lon`), `lang`, reverse geocoding, minutely-updated OSM.
- **Terms:** "please be fair – extensive usage will be throttled". Availability is not guaranteed. Apache-2.0 (RESEARCH.md §3).
- **Key:** none.
- **Use:** **self-host Photon for typeahead** (India extract). Use the public endpoint in dev only, at low volume, through the proxy.

**Geocoding verdict:**
- self-hosted Photon for typeahead and forward search
- self-hosted Nominatim for structured and reverse lookup
- our own address parser + DIGIPIN + pincode table first (already built)

---

## 3. POIs (Overpass API)
- **Source:** https://dev.overpass-api.de/overpass-doc/en/preface/commons.html [O]. The FOSSGIS terms also cover overpass-api.de. [O §1.1]
- **Terms:**
  - safety guideline is **about 10,000 requests/day and under 1 GB/day** per user
  - rate-limited by slots (HTTP 429), load-shed (HTTP 504)
  - default timeout 180 s, maxsize 512 MiB
- The documentation names "setting up an app for more than just OSM mappers and relying on the public instances as backend" as **problematic**. The fix is to run your own instance.
- **Key:** none.
- **Use in Bharat Maps:**
  - **do not query Overpass per user search in production**
  - instead, bake the category POIs (fuel, ATM, hospital, pharmacy, bus stop, station, charging, toll booth, cafes and restaurants, convenience shops) into a **POI PMTiles layer** and a PostGIS table during the nightly planetiler build
  - optionally run a private Overpass for ad-hoc queries
  - the v0.2 `live=1` Overpass call becomes dev-only

---

## 4. EV charging (Open Charge Map)
- **Source:**
  - https://openchargemap.org/develop [O]
  - API docs https://www.openchargemap.org/develop/api [O-x: "API Key supplied as query string parameter `key`" or header]
  - Community notice "API Keys are now required" (31 Aug 2020): https://community.openchargemap.org/t/api-keys-are-now-required/161 [O-x]
- **Key:** **yes, free**. Register an app under My Profile → My Apps. Send it as `X-API-Key` or `?key=`.
- **Licence:** user-contributed data is **CC BY 4.0**. Imported data stays under each **Data Provider's** licence. Apps must show the provider attribution and licence visibly to the end user. [O]
- **Rate limit:** none published. [U] A third party reports 20 req/s with a key. [O-x, unverified]
- **Use:**
  - server-side sync every 24 h for India (`countrycode=IN`, `compact=true`), stored in our DB
  - filter to open-licensed providers where possible
  - show "Source: {provider} via Open Charge Map" on the place card
  - merge with OSM `amenity=charging_station`
  - BEE EV Yatra stays reference-only (RESEARCH.md §4)

---

## 5. Transit

| Feed | Status (18 Oct 2026) | Terms | Source |
|---|---|---|---|
| **Hyderabad Metro (HMRL)** | Official static GTFS (schedules, fares, routes, stops), download via Google Form. Transitland's mirror last succeeded about 2 years ago (version dated 2023-02-25, "last fetch failed"). | Free, non-exclusive, **commercial use allowed**, redistribution allowed. Attribution required: "Contains data provided by Hyderabad Metro Rail Ltd." No implied endorsement. HMRL may change or stop the data without notice. | https://hmrl.co.in/open-data [O]; https://www.transit.land/feeds/f-hmrl~hyderabad [O] |
| **TGSRTC (Hyderabad city buses)** | Official static GTFS via Google Form. A Feb 2026 snapshot is mirrored on OpenCity. busmaps lists 1,031 routes and 4,999 stops, valid to Jan 2028. | Same template as HMRL: **commercial use allowed**, attribution "Contains data provided by TGSRTC", no endorsement. | https://www.tgsrtc.telangana.gov.in/open-data [O]; https://busmaps.com/en/india/feedlist [O]; https://data.opencity.in/dataset/hyderabad-bus-stops [O-x] |
| **MMTS (Hyderabad suburban rail)** | Telangana Open Data has a "GTFS for Hyderabad" collection [O-x https://data.telangana.gov.in/]. A third-party repo downloads HMRL, MMTS and TGSRTC from it [O-x]. busmaps marks its MMTS feed **expired (valid to Apr 2020)** [O]. Currency is doubtful. | Portal licence [U] (GODL page not verified, RESEARCH.md §4) | as cited |
| **APSRTC / Vizag city buses** | **No official GTFS found.** busmaps lists a third-party "apsrtc" feed (Transport-Ind), **expired 30 Sep 2026** [O]. | Provenance and licence unclear → do not use | https://busmaps.com/en/india/feedlist [O] |
| **Indian Railways** | No official public API or GTFS (RESEARCH.md §4). busmaps lists a third-party "indianrailways" feed of unclear provenance. [O] | Do not ingest; partnership or licensed aggregator only | — |
| **data.gov.in** | Not found to host these GTFS feeds in this pass. [U] | — | — |
| **Real-time (GTFS-RT)** | None public for these operators. TGSRTC has live tracking in its own "Gamyam" app [O-x tgsrtc.telangana.gov.in]. | Partnership needed | — |

- **Use:**
  - v0.3 ships **Hyderabad static transit** (HMRL + TGSRTC; MMTS only if a current feed is confirmed)
  - planned with a self-hosted GTFS router: OpenTripPlanner 2 or MOTIS, both OSS [I]
  - labels say "Scheduled times" (no live data)
  - Vizag transit: "not available yet"
  - attribution strings shown in About and on transit results

---

## 6. Live traffic: no free, legitimate India source

No free, licensable live-traffic feed for India was found:
- OSM has no traffic data.
- The public OSM services carry none.
- Government open-data portals checked publish none.

Live traffic, traffic-aware ETA and the traffic layer must be marked **💰 paid API required**. Paid options:

| Provider | Free tier (verified) | Notes | Source |
|---|---|---|---|
| **TomTom** | Per-API monthly free requests, no card. **Traffic Incidents** 2.5K/mo; **Traffic Flow & Incidents vector/raster tiles** 200K/mo; **Traffic Flow segment data** 20K/mo; **Routing** (traffic-aware) 20K/mo; Matrix 2.5K/mo. Then pay-as-you-grow. | Must check the ToS for overlaying on a non-TomTom basemap and for caching [U] | https://developer.tomtom.com/pricing [O] |
| **HERE** | "Base Plan": free monthly transaction thresholds per API, pay-as-you-grow, **payment method required**. The pricing page did not render numbers. Third-party figures conflict (30K vs 250K/mo). | Treat free amounts as [U] until read in the HERE console | https://www.here.com/pricing [O-x]; https://www.here.com/learn/blog/august-2025-platform-release-notes [O-x] |
| **Mappls (MapmyIndia)** | "Start for free" signup. Maps SDK "for maps and traffic". Routing APIs "with real-time traffic updates", including India-specific modes. **No public price list found.** | Indian entity (good fit with the DST guidelines). Prior dossier notes restrictive caching ToS (RESEARCH.md §2). | https://about.mappls.com/api/maps-traffic [O]; https://about.mappls.com/api/ (pricing via sales) [O] |

**Recommendation:**
- build the traffic layer and ETA behind a provider interface (`TRAFFIC_PROVIDER=none|tomtom|mappls`)
- default `none` shows "ETA without live traffic"
- if budget allows, pilot TomTom (clear free quota) or Mappls (India data depth, Indian entity), after a ToS review
- crowd incident reports (UI_UX_SPEC §7) are our free complement, clearly labelled "Reported by users"

---

## 7. Tolls

| Source | What | Terms | Use |
|---|---|---|---|
| IHMCL "National Highway (NH) Fee Plazas" PDF (refreshed monthly; Feb 2026 edition seen) | Plaza list: NETC plaza code, name, state, district, highway section, NH number, PIU. **No coordinates or rates** in the excerpt. | Public PDF, no explicit licence | Names and codes to join with locations. https://ihmcl.co.in/wp-content/uploads/2026/02/NH-Fee-Plazas-4.pdf [O-x] |
| NHAI Toll Information System (TIS) / RajMargyatra | Per-plaza rates by vehicle class, plazas between two places, notification PDFs | Web portal; **no documented public API**. An RFP describes its features [O-x https://ihmcl.co.in/wp-content/uploads/2020/03/RFP_TIS-Final.pdf] | Reference for rates. Do not scrape without permission. http://tis.nhai.gov.in/ [O-x] |
| ForceGT/india-toll-plazas (GitHub) | 1,674 plazas, 26 states, coordinates and FASTag-class rates; updated 2026-07-07; derived from RajMargyatra + state sources | Self-described "Government Open Data-style reuse; confirm terms… with counsel". **Not an official NHAI product.** | Candidate seed for estimates after legal review. https://github.com/ForceGT/india-toll-plazas [O] |
| OSM `barrier=toll_booth` | Plaza positions on the road graph | ODbL | Matching plazas to routes (Valhalla also flags toll edges) |

- **Use:** a toll **estimate** = Σ car (or 2-wheeler-exempt) rate for plazas within 50 m of the chosen route.
  - Label it "Toll estimate · rates as of {date}".
  - Exempt two-wheelers per NH fee rules [I: verify the current notification].
- An exact or official toll API is **💰 / partnership** (NHAI/IHMCL).

---

## 8. India boundary and geospatial compliance
- **Source:** DST "Guidelines for acquiring and producing Geospatial Data and Geospatial Data Services including Maps", F.No.SM/25/02/2020 (Part-I), 15 Feb 2021: https://geospatial.dst.gov.in/Guidelines.aspx [O]
- **What applies to Bharat Maps:**
  - **Self-certification**, no prior approval (para 8.ii). The self-certification portal is https://geospatial.dst.gov.in/ [O-x].
  - **Political boundaries must use Survey of India maps or SoI digital boundary data** (para 8.xiii), which "shall be made easily downloadable for free".
  - **Negative list of sensitive attributes:** such attributes must not be marked on any map (para 8.iii). List: https://dst.gov.in/geospatial [O-x].
  - **Accuracy threshold** is 1 m horizontal / 3 m vertical. Data finer than this may be created or owned only by **Indian entities** and must be **stored and processed in India**, on domestic cloud (paras 8.iv, vii, ix).
  - **Street-view and terrestrial mobile-mapping surveys are only for Indian entities** (para 8.vi.b). This is why Look Around-style capture is ⛔ in the comparison.
  - Foreign or foreign-controlled companies may only license finer-than-threshold data via APIs that do not pass through their servers (para 8.viii).
- **Build actions:**
  1. In the planetiler / PMTiles build, drop OSM `admin_level=2` India boundary lines and disputed segments, and inject the SoI national and state outline (RESEARCH.md §2). The current bundled `web/offline/*.pmtiles` (Protomaps) and OpenFreeMap online tiles use OSM's default boundaries [I]. Avoid showing zoomed-out national views until patched.
  2. Exclude negative-list attributes from the POI layer.
  3. Host traces and user locations in an India region.
  4. File the self-certification before public launch.
  5. Record ownership as an Indian entity.
- The **SoI boundary download location** was not confirmed in this pass. [U] Next step: check https://onlinemaps.surveyofindia.gov.in/ [O-x guidelines mirror].

---

## 9. Basemap tiles (for completeness)
- **FOSSGIS tile.openstreetmap.de:** **apps that load tiles themselves need prior consent**. Bulk or offline downloads are forbidden, and caching ≥ 7 days is required. [O §1.1] → not usable.
- **Keep:** OpenFreeMap online (dev and pilot) + Protomaps-schema **PMTiles** (offline, then self-hosted CDN), per RESEARCH.md §3.
- **Offline regions:** generate per-city PMTiles extracts with `pmtiles extract`. Host them on object storage with HTTP Range. Bharat Maps then downloads its own files, so no third-party download policy is involved.

---

## 10. Summary table

| Integration | Choice for v0.3 | Free / paid | Key | Limit (public tier) | Production plan |
|---|---|---|---|---|---|
| Navigation routing | Valhalla (2W, car, foot, bike, truck) | Free OSS | No | Self-host: none. FOSSGIS valhalla1: 1 rps, dev only | Self-host on India VM |
| Matrices / delivery | OSRM | Free OSS | No | Demo: 1 rps, non-commercial | Self-host (already in compose) |
| Hosted routing fallback | GraphHopper | Free plan is non-commercial (500 credits/day); Basic €69/mo | Yes | 1 rps on Basic | Only if self-hosting is delayed |
| Isochrones (optional) | openrouteservice | Free Standard | Yes | 500/day, 20/min | Dev only |
| Typeahead | Photon | Free OSS | No | Public: fair use, throttled | Self-host |
| Reverse / structured geocode | Nominatim + own parser + DIGIPIN | Free OSS | No | Public: 1 rps, no autocomplete, must be switchable | Self-host |
| POIs | Planetiler POI layer (+ private Overpass) | Free OSS | No | Public Overpass: ~10K req/day, 1 GB/day; not for app backends | Nightly build |
| EV chargers | Open Charge Map + OSM | Free (CC BY 4.0 + provider licences) | **Yes (free)** | Not published | 24 h server sync |
| Transit | HMRL + TGSRTC GTFS → OTP/MOTIS | Free, commercial OK, attribution | No (form download) | n/a | Self-host; Vizag none |
| Live traffic | None (label) → TomTom or Mappls pilot | **💰** | Yes | TomTom: 2.5K incidents, 200K flow tiles, 20K traffic routing per month | Provider interface, ToS review |
| Tolls | OSM toll booths + IHMCL list + rate table (estimate) | Free data; official API **💰 / partnership** | No | n/a | Legal review of rate source |
| Boundaries | SoI outline in tile build | Free (per DST para xiii) | No | n/a | Mandatory before launch |
