# Bharat Map: Research Dossier

**Date:** October 2026
**Scope:** India-first map + commerce + logistics + mobility super-app. The MVP is built clean-room on open data.

**How to read this document**
- **[D] Documented:** stated on the cited page. Every page was fetched while this document was being written.
- **[I] Inferred:** our analysis or estimate. Not a claim made by the source.
- Prices are as published on the access date and will drift.

---

## 0. Executive summary

1. **[I] Do not build on Google or Mappls content.** Both forbid the caching and derivation that an MVP would need. Build on OSM (ODbL) plus government open data. Keep a commercial API only as a pass-through fallback, and never mix its output into our database.
2. **[I] Core stack:** MapLibre + planetiler/PMTiles + Valhalla + Photon/Nominatim + PostGIS + H3 + VROOM.
   - Every core engine is permissively licensed except two: PostGIS is GPL-2.0 and Nominatim is GPL-3.0.
   - Both run as separate network services, so their copyleft does not reach our code. [I]
3. **[I] Self-hosting all-India tiles and routing is cheap.** The India OSM extract is 1.6 GB. Tiles plus routing fit on 2–3 mid-size servers, roughly ₹40k–₹1.2 lakh/month. Usage-priced APIs cost far more at scale.
4. **[I] Commerce should start as an ONDC buyer app (BAP),** not a proprietary marketplace. ONDC gives us sellers, logistics and mobility supply without building it ourselves.
5. **Legal must-haves:**
   - Depict India's boundary per Survey of India. [D]
   - Keep sensitive or high-accuracy data and processing in India. [D]
   - Never label negative-list attributes. [D]

---

## 1. Competitive teardown

### 1.1 Google Maps Platform

**Public features [D]**
- Products: Maps, Routes, Places, Geocoding, Address Validation, Distance Matrix.
- India-specific pricing: prices are up to 70% lower for eligible India-billed customers from 2024-08-01, billed in INR. A usage discount applies at 5M+ monthly events. (https://developers.google.com/maps/billing-and-pricing/india)
- Free usage: from 2025-03-01, per-SKU free caps replaced the $200 monthly credit. Example: Dynamic Maps (India) has a 70,000 free cap, then $2.10 per 1,000, falling to $0.53 per 1,000 above 5M.
- Subscriptions: India-priced accounts cannot buy subscriptions. Global subscriptions run $100, $275 or $1,200 per month. (https://developers.google.com/maps/billing-and-pricing/india ; https://developers.google.com/maps/billing-and-pricing/overview)
- ONDC builders were reported to get up to 90% off select APIs. That report came shortly after Ola dropped Google Maps. (https://analyticsindiamag.com/ai-news-updates/google-maps-api-to-cost-70-less-now)

**Inferred architecture [I]**
- A global vector tile CDN, a proprietary road graph with live traffic from Android telemetry, and a Places index merged from crawl, user contributions and Business Profile.
- Moat: data freshness and reviews, not rendering.

**Terms that constrain us [D]** (https://cloud.google.com/maps-platform/terms §3.2.3)
- No scraping: no pre-fetching, indexing, storing or rehosting content, and no bulk download.
- No caching, except where the Service Specific Terms allow it.
- No creating content from Google content. Examples given: no tracing imagery, and no point-in-polygon analysis on Places lat/lng.
- No use with or near a non-Google map.
- No use in embedded vehicle systems.
- No re-creating Google products or features.

**Service Specific Terms [D]** (https://cloud.google.com/maps-platform/terms/maps-service-terms)
- place_id may be cached.
- Geocode and Directions lat/lng may be cached for at most 30 days.
- Geocoding, Directions and Distance Matrix must not be used with a non-Google map.

**Reproduce vs avoid**
- **Reproduce:** place-detail UX, the ETA chip and the "Directions / Call / Order" action row. [I]
- **Avoid:**
  - Any Google API behind a MapLibre map. This is prohibited. [D]
  - Seeding our POI database from Places. This is prohibited. [D]

### 1.2 MapmyIndia / Mappls (incl. eLoc / Mappls Pin, DIGIPIN)

**Public features [D]** (https://about.mappls.com/api/)
- Maps and traffic SDKs.
- Search and geocoding, with 300+ POI categories. Autosuggest can filter by pincode, by bounds or by eLoc.
- Routing for car, two-wheeler, heavy vehicle and pedestrian.
- Distance matrix with predictive ETA.
- Route optimisation, snap-to-road, Address Standardisation, POI-along-route.
- Tracking SDKs and NaviMaps for embedded systems. (https://about.mappls.com/api/search-and-geocoding)

**Mappls Pin (eLoc) [D]**
- A "6-character pin code for every doorstep's precise location".
- It is assigned to and stored for registered places. You "add it to our maps" to create one.
- So it is a proprietary lookup ID, not an algorithmic code. (https://about.mappls.com/mappls-pin/)

**Terms [D]** (https://about.mappls.com/api/terms-&-conditions)
- No cache copies made to avoid fees.
- Anything not specifically permitted is prohibited.
- Users grant Mappls a perpetual, royalty-free license to User Content placed on its servers.
- Users give a broad indemnity.
- Claims must be brought within 1 year.

**DIGIPIN, the public alternative [D]** (https://github.com/INDIAPOST-gov/digipin ; older repo https://github.com/CEPT-VZG/digipin relocated)
- Developed by India Post with IIT Hyderabad and NRSC/ISRO.
- Each 10-character alphanumeric code covers a cell of about 4 m × 4 m.
- The code is derived purely from lat/lng, so no lookup service is needed.
- Licensed Apache-2.0. A Node.js reference encode/decode API is provided.

**Reproduce vs avoid**
- **Reproduce:** two-wheeler and heavy-vehicle profiles, and pincode-scoped autosuggest. [I]
- **Adopt DIGIPIN as our native address token.** It is free, offline-computable and government-backed. [I]
- **Avoid:**
  - Building on eLoc. It is a vendor lock-in ID. [I]
  - Uploading user content to Mappls, given the perpetual-licence clause. [D]

### 1.3 Ola Maps (brief)

- **Origin [D]:** launched as #ExitGoogleMaps. Ola claimed 10,000+ developer sign-ups.
- **2024 pricing [D]:** a 5M calls per API per month free tier, then 50% of Google's reduced rates, and 3 years free for ONDC startups and SMBs. (https://tech.olakrutrim.com/ola-maps-made-for-india-priced-for-india)
- **New pricing from 1 Sept 2026 [D]:** the free tier is now **100,000 calls per API per month**, and billing is by prepaid credits. (https://maps.olakrutrim.com/pricing/details)

| API | Tier 2 rate (100k–5M) | Tier 3 rate (5M+) |
|---|---|---|
| Autocomplete | ₹0.056 | ₹0.013 |
| Directions | ₹0.199 | ₹0.049 |
| Distance Matrix (per pair) | ₹0.199 | ₹0.049 |
| Dynamic Maps (per load) | ₹0.141 | ₹0.036 |

- The 2026 pricing page also shows Street View, MCP and "Data stays in India" claims. [D]
- **Lesson [I]:** a 50× cut to the free tier in two years shows that vendor promotional pricing is not a foundation. This supports self-hosting the core.

### 1.4 Amap / Gaode and its local-services integration

**Street Stars [D]** (https://www.alibabagroup.com/en-US/document-1902406454384525312), launched 2025-09-10:
- An AI ranking built from **navigation behaviour** and reviews, with user-consented credit-score trust signals.
- 300+ cities and 1.6M businesses at launch.
- Amap's scale: 170M DAU, 120M+ daily service searches and 13M+ daily navigations to businesses.
- Alibaba committed RMB 1B+ in subsidies.
- Positioned as the "gateway for lifestyle services" against Meituan.

**Inferred architecture [I]**
- The map is the intent funnel: search, then navigate, then arrive.
- The "arrival" event becomes a verified-visit signal. That signal powers rankings that review sites cannot fake. Transactions (coupons, booking, ride-hail) are added on top.

**Reproduce [I]**
- A verified-visit signal derived from our own navigation sessions, with consent.
- A "best near me" ranking built on it.
- Commerce actions on the place card.

**Avoid [I]**
- A subsidy war. The equivalent of RMB 1B is not available to us.

### 1.5 ONDC / Beckn

**Roles [D]** (https://github.com/beckn/protocol-specifications)
- **BAP:** the buyer app.
- **BPP:** the seller or provider platform.
- **BG:** the gateway.
- The BAP calls the BG only when no BPP is named in `context`.
- The BG runs a registry `lookup` and broadcasts to matching BPPs.
- BPPs ACK synchronously, then send `on_search` asynchronously.
- The BG routes on `context` only. No PII goes through it.
- Core 1.0.0 was released 2022-12-31.

**Transaction flow [D]**
- The core transaction API defines paired endpoints: `/search /select /init /confirm /status /track /cancel /update /rating /support`, each with an `on_*` callback. (from https://raw.githubusercontent.com/beckn/protocol-specifications/master/api/transaction/build/transaction.yaml)
- ONDC publishes sequence diagrams for search → select → init → confirm, plus a buyer reference app (biap-client-node-js / buyer-app.ondc.org). (https://raw.githubusercontent.com/ONDC-Official/developer-docs/main/Tech_Quickstart_Guide.md)

**Registry onboarding [D]** (https://raw.githubusercontent.com/ONDC-Official/developer-docs/main/registry/Onboarding%20of%20Participants.md)
- **Prerequisites:**
  1. An FQDN as `subscriber_id`.
  2. A valid SSL certificate, checked by OCSP.
  3. Whitelisting through portal.ondc.org under "environment access request". Approval takes 6–48 h.
- **Keys:** an Ed25519 signing key pair and an X25519 encryption key pair.
- **Domain proof:** host `ondc-site-verification.html` containing the signed `request_id`.
- **Challenge:** expose `/on_subscribe` to decrypt an AES challenge using the ONDC public key.
- **Registration:** POST `/subscribe` with `ops_no` 1 (buyer), 2 (seller) or 4 (both). ops_no 3 and 5 are deprecated.
- **Environments:** staging is **decommissioned**. Pre-prod (`preprod.registry.ondc.org/ondc/subscribe`) and prod remain.
- **Lookup:** `/v2.0/lookup` (signed) is recommended.
- **Rate limits:** `/subscribe` 10 RPM, `/lookup` 7600 RPM.

**Reproduce [I]**
- Register as a BAP first.
- The map is where `search` intent comes from: "groceries near me" and "auto to station" become Beckn `search` calls with a GPS/area code in `context`.

**Avoid [I]**
- Becoming a BPP, which means seller onboarding and settlement liability, before product-market fit.

### 1.6 Quick commerce: Blinkit, Swiggy Instamart, Zepto (brief)

**[D]** At the end of FY26 (Mar 2026):

| | Zepto | Instamart | Blinkit |
|---|---|---|---|
| Dark stores | 1,139 | 1,143 | 2,243 |
| Q4 orders | 210M (about 77% of Blinkit's) | n/a | 273.9M |

(https://www.business-standard.com/companies/start-ups/zepto-closes-gap-with-blinkit-on-orders-despite-rising-losses-126060900572_1.html)

**Pattern [I]**
- A dense dark-store grid with a radius of a few km.
- Serviceability is computed per H3-like cell.
- Each cart is assigned to the nearest stocked store.
- ETA comes from a store-to-door isochrone plus picker queue time.
- A two-wheeler rider fleet handles delivery.

**For Bharat Map [I]**
- Do not run dark stores.
- Build the primitives: serviceability polygons, two-wheeler isochrones, and ETA promise.
- Expose these to ONDC sellers and logistics BPPs.

---

## 2. Licensing and ToS constraints

| Regime | What it means for us | Source |
|---|---|---|
| **Google ToS** | No scraping, no bulk download, no caching beyond place_id or 30-day lat/lng. No use with a non-Google map. No derived databases. | [D] https://cloud.google.com/maps-platform/terms ; https://cloud.google.com/maps-platform/terms/maps-service-terms |
| **Mappls ToS** | No cache to avoid fees. Whatever is not permitted is prohibited. Perpetual licence over uploaded user content. | [D] https://about.mappls.com/api/terms-&-conditions |
| **OSM ODbL** | Credit "© OpenStreetMap contributors". Share-alike on derived databases, which must be published under ODbL on request. Rendered tiles and images are "Produced Works" and can carry any licence, unless they are meant to extract the data. OSMF gives no free tile, API or Nominatim capacity to third-party apps. | [D] https://www.openstreetmap.org/copyright ; https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline |
| **DST Geospatial Guidelines (2021-02-15)** | No prior approval; compliance by self-certification. Negative list of attributes only, with no list of prohibited areas. Data finer than 1 m horizontal / 3 m vertical may be owned only by Indian entities and must be stored and processed in India. Foreign entities may only license it via APIs, without the data passing through their servers. Street-view and terrestrial mobile mapping are for Indian entities only. | [D] https://geospatial.dst.gov.in/Guidelines.aspx (the dst.gov.in PDF URL returned 404) |
| **Negative attributes** | Facilities on the negative list must not be labelled. | [D] https://dst.gov.in/sites/default/files/List%20of%20Negative%20Attributes.pdf |
| **Boundary depiction** | Political maps must follow Survey of India boundaries. | [D] DST guidelines (above) |
| **OSM default boundary** | OSM maps "on the ground" (e.g. the Line of Control), which is not the SoI depiction. The OSM India community documents tile servers that use SoI boundaries "to comply with Indian law". | [D] https://wiki.openstreetmap.org/wiki/India/Rendering_server ; https://wiki.openstreetmap.org/wiki/Disputed_territories |

**Implications [I]**

1. **ODbL scope.** Our POI and address database, if built from OSM, is a Derivative Database.
   - Proprietary layers (merchant catalogues, ratings, trip logs) must be kept as a **separate, non-derived** database.
   - That means joined at query time, not merged into OSM tables. This keeps them out of share-alike.
   - Get counsel to review this before launch.
2. **Boundaries.**
   - Strip OSM `admin_level=2` lines for J&K and Ladakh, plus the disputed segments, at tile build time.
   - Inject an SoI-sourced India outline.
   - Never render `claimed_by`-style alternatives to Indian users.
3. **Data residency.** Location traces and street imagery at under 1 m accuracy belong in India-region infrastructure, owned by an Indian entity. This is cleanest anyway for DPDP Act compliance (not researched here).
4. **Bhuvan.** Its ToS forbids derivative works, redistribution, bulk lat/lng extraction and **real-time navigation** use. View-only and reference use is OK. Do not ingest. [D] (https://bhuvan.nrsc.gov.in/terms.php)

---

## 3. Open-source stack evaluation

Licences were verified from the GitHub API or the LICENSE files on 2026-10-18.

| Component | License | India coverage | Cost | Scalability | Ops burden | Recommendation |
|---|---|---|---|---|---|---|
| **MapLibre GL JS** | BSD-3 [D] (LICENSE.txt) | n/a (renderer) | Free | Client-side | Low | **Adopt** (web) |
| **MapLibre Native** | BSD-2 [D] | n/a | Free | Client-side | Low–med (mobile builds) | **Adopt** (Android/iOS) |
| **OpenFreeMap** | MIT code. OSM/OpenMapTiles data needs attribution. [D] | Planet incl. India, weekly | Public instance free, no keys, commercial use OK. Offline downloads capped at 3,000 tiles / 50 MB. No SLA. [D] (https://openfreemap.org/) | nginx + Btrfs static files | None (hosted) / med (self) | **Dev and prototype only.** No SLA, and the default boundary is OSM's. |
| **Protomaps / PMTiles** | BSD-3 code, CC0 spec. Basemap is an ODbL Produced Work. [D] | Planet build about 120 GB (z0–15). Extract India with `pmtiles extract`. [D] (https://docs.protomaps.com/basemaps/downloads) | Object storage + CDN | Static files, effectively unlimited | **Very low** | **Adopt** as the tile format and serving model |
| **planetiler** | Apache-2.0 [D] | Reads the Geofabrik India PBF directly | Free | Planet in 19 min–3.5 h depending on machine. Needs 0.5× PBF in RAM and 5–10× PBF in disk. [D] (https://github.com/onthegomap/planetiler) | Low (batch job) | **Adopt.** Custom profile to fix boundaries and add Indic labels. |
| **PostGIS** | GPL-2.0 [D] | n/a | Free | Vertical, plus read replicas | Medium | **Adopt** (POIs, geofences, orders) |
| **OSRM** | BSD-2 [D] | Good on OSM roads | Free | Very fast CH. Car profile has high RAM needs [I]. | Medium. Full re-preprocess per update. | Use for **matrix-heavy** batch jobs only |
| **Valhalla** | MIT [D] (COPYING) | Good. Has motorcycle/scooter and truck costing. [I] | Free | Tiled graph, low RAM, dynamic costing | Medium | **Adopt** as the primary router (2W, auto, truck, isochrones, map-matching) |
| **GraphHopper** | Apache-2.0, including a pre-built **truck** profile, custom models, map-matching and GTFS. [D] (https://github.com/graphhopper/graphhopper) | Good | Free (OSS). Paid Directions API separate. | CH/hybrid modes | Medium (JVM) | **Alternative** to Valhalla. Use for GTFS transit routing. |
| **Nominatim** | GPL-3.0 [D] | OSM addresses in India are sparse [I] | Free | Planet needs 128 GB RAM and 1 TB NVMe and takes about 2.5 days. India is far smaller. [D] (https://nominatim.org/release-docs/latest/admin/Installation/) | High | Use for **reverse geocoding** and structured lookup |
| **Photon** | Apache-2.0 [D] | Same data as Nominatim | Free | Search-engine backed | Medium | **Adopt** for typeahead |
| **Pelias** | MIT [D] | Can blend OSM, OpenAddresses and custom CSV (DIGIPIN, pincode) [I] | Free | Elasticsearch cluster | **High** (many services) | Defer. Revisit at multi-city scale. |
| **VROOM** | BSD-2 [D] | n/a (uses OSRM/Valhalla matrices) | Free | ms–s for 100s of stops [I] | Low | **Adopt** for delivery batching and rider routing |
| **OR-Tools** | Apache-2.0 [D] | n/a | Free | Heavy CP-SAT/VRP | Low (library) | Use for complex constraints such as shifts and capacity tiers |
| **H3** | Apache-2.0 [D] | Global | Free | Library | None | **Adopt** for serviceability, surge, demand heatmaps and ETA aggregation |

**GraphHopper truck licensing**
- The README lists truck among the pre-built profiles in the Apache-2.0 open-source engine. [D]
- An older belief that truck routing is commercial-only does not apply to the current OSS engine.
- The commercial GraphHopper Directions API and its Route Optimization (jsprit-based) are separate paid products. [D]

---

## 4. India data sources and access terms

| Source | What | Access / terms | Use |
|---|---|---|---|
| **Geofabrik India OSM** | `india-latest.osm.pbf`, 1.6 GB, updated daily. Daily `.osc.gz` diffs. Six zone extracts (e.g. Southern Zone 532 MB). | ODbL. Free download. User and changeset metadata stripped. [D] (https://download.geofabrik.de/asia/india.html) | Base roads, POIs, buildings |
| **DIGIPIN** | Algorithmic 10-character code for a cell of about 4 m × 4 m | Apache-2.0 [D] (https://github.com/INDIAPOST-gov/digipin) | Native address token, offline encode |
| **India Post pincode directory** | All-India pincode directory (circle, region, division, office, pincode, district, state), updated monthly. A separate API variant includes lat/long. | data.gov.in, under the Government Open Data License – India. API key required. [D] (https://data.gov.in/resource/all-india-pincode-directory-till-last-month ; https://data.gov.in/apis/04cbe4b1-2f2b-4c39-a1d5-1c2e28bc0e32). The GODL text page returned 404 on fetch, so the attribution terms are **not verified here**. | Pincode autosuggest, coarse geocode |
| **Delhi OTD (DTC/cluster buses)** | Static GTFS: 3,464 stops, 543 routes, last updated 2024-06-20. Realtime VehiclePositions for authorised keys. | Purpose form (commercial or non-commercial). OTD T&Cs apply. [D] (https://otd.delhi.gov.in/data/static/) | Delhi bus routing |
| **DMRC** | Metro GTFS: 262 stations, 36 routes, last updated **2023-08-10** (stale) | Same portal [D] (https://otd.delhi.gov.in/data/staticDMRC/) | Delhi metro. Validate against the current network. |
| **Hyderabad Metro (HMRL)** | GTFS. The Telangana open data page shows an update on 03 Jul 2026. | Free, non-exclusive, commercial use allowed. Attribution required: "Contains data provided by Hyderabad Metro Rail Ltd." Download via Google Form. [D] (https://hmrl.co.in/open-data) | Hyderabad metro |
| **Hyderabad TGSRTC** | Bus GTFS | Open data page with form-gated download [D] (https://www.tgsrtc.telangana.gov.in/open-data, via search; terms not opened) | Hyderabad buses |
| **Kochi Metro (KMRL)** | GTFS-static | Free, commercial use allowed. Attribution required: "Contains data provided by Kochi Metro Rail Limited". No implied endorsement. [D] (https://kochimetro.org/open-data/) | Kochi metro |
| **BMRCL / BMTC (Bengaluru)** | BMRCL shares GTFS under an open-data framework. BMTC is *preparing* to share real-time data, initially with Namma Yatri, BIAL and Tummoc (Oct 2026). | Partner-based, not a public download [D] (https://www.thehindu.com/news/cities/bangalore/bmtc-to-share-real-time-bus-data-with-mobility-platforms-in-bengaluru/article71568994.ece) | Bengaluru: apply as a partner. Community GTFS exists but is unofficial. |
| **Indian Railways** | Official: NTES (live running) and the RailOne app. **No public developer API found.** [I] Unofficial: RailRadar REST API (schedules, live status, GeoJSON routes), free sandbox 100 requests/month. | NTES is web only (https://enquiry.indianrail.gov.in/mntes). RailRadar is a third party with an unclear upstream licence. [D] (https://railradar.in/docs) | Display only via a licensed aggregator. Legal review needed. |
| **Open Charge Map** | Global EV charger registry, including India | User-contributed data is CC BY 4.0. Imported third-party data keeps its provider licence. Filter `opendata=true`. Provider attribution must be visible. [D] (https://openchargemap.io/develop) | EV layer (open subset) |
| **BEE EV Yatra** | Government public charging-station locator, showing 26,247 stations | Web map. No open bulk licence found. [D] (https://evyatra.beeindia.gov.in/public-charging-stations) | Reference and partnership target. Do not scrape. |
| **NHAI / IHMCL toll** | National Highway Fee Plazas list (PDF with NETC plaza code, name, state, NH). TIS portal for fee rules. | Public PDF, no explicit licence [D] (https://ihmcl.co.in/nh-toll-plaza ; http://tis.nhai.gov.in/) | Toll POIs and cost estimates. Geocode the plazas ourselves. |
| **Bhuvan (ISRO)** | Imagery, LULC, village geocoding, routing APIs | ToS bans derivatives, redistribution, bulk lat/lng and navigation use [D] (https://bhuvan.nrsc.gov.in/terms.php) | **Do not ingest** |
| **Bharatmaps (NIC)** | NICMAPS base map using 1:50k SoI/ISRO/FSI/RGI data, 23 layers | Service access requires an *official (government) email* login [D] (https://mapservice.gov.in/) | Not available to a private company. Use only for G2C projects. |
| **Parking** | No open occupancy feed found. Delhi (Oct 2026): MCD has 463 sites (94,831 ECS). Integrating MCD and NDMC on Park+, with data shared to Google and MapmyIndia, was *discussed*. DMRC has park-and-ride at 127 stations. | Not open [D] (https://timesofindia.indiatimes.com/city/delhi/call-for-unified-plan-to-end-parking-mess-in-city/articleshow/134799958.cms) | Use OSM `amenity=parking` plus merchant-contributed data. Pursue civic data-sharing MoUs. |

**Not established in this pass:** the official BMTC/BMRCL GTFS download URL and terms, and the GODL clause text.

---

## 5. Architecture decisions and phased rollout

### 5.1 Key decisions

**D1. Clean-room data plane.** [I]
- Sources: OSM, DIGIPIN, government open data, and first-party contributions (merchants, riders, users).
- No Google or Mappls output is ever persisted.
- If a commercial API is used at all, it is as a live pass-through on its own vendor map, per that vendor's terms.

**D2. Tiles.** [I]
- Planetiler with a custom OpenMapTiles-compatible profile builds `india.pmtiles` nightly from the Geofabrik PBF.
- The build pipeline does three things:
  - Replaces boundaries with SoI geometry.
  - Drops negative-list labels.
  - Adds Indic `name:*` labels.
- Served from India-region object storage plus a CDN. Rendered by MapLibre on web and mobile.

**D3. Routing.** [I]
- Valhalla is primary, with profiles for auto, motor_scooter (2W), pedestrian, truck and bicycle, plus isochrones and map-matching.
- OSRM runs as a sidecar for large distance matrices that feed VROOM.
- GraphHopper GTFS handles transit in cities with feeds.

**D4. Search.** [I]
- Photon handles typeahead.
- Nominatim handles reverse geocoding.
- A custom PostGIS index holds the pincode directory, DIGIPIN, and merchant POIs.
- Ranking blends text relevance, distance, and (later) a verified-visit signal on the Amap pattern.

**D5. Commerce.** [I]
- An ONDC BAP, starting from the reference buyer app with our own map UX.
- Domains in order: retail (RET10 grocery) → mobility → logistics.
- No proprietary marketplace in the MVP.

**D6. Logistics primitives.** [I]
- H3 cells (res 8–9) for serviceability and demand.
- VROOM for batching.
- Valhalla 2W isochrones for ETA promises.

**D7. Residency and compliance.** [I]
- India-region hosting, Indian-entity ownership, and self-certification under the DST guidelines.
- An ODbL attribution UI, plus a published derivative-database policy.

### 5.2 Phased rollout

| Phase | Scope | Data | Infra (inferred) |
|---|---|---|---|
| **P0: MVP city (0–4 mo)** | Hyderabad (HMRL and TGSRTC GTFS available, home-state proximity) **or** Delhi (richest OTD feeds). Map, search, 2W/car directions, transit, one ONDC domain (grocery) as a BAP on pre-prod, then prod. | Southern Zone PBF (532 MB) or a city clip, plus GTFS, pincode, DIGIPIN | 1 server for tiles, router and geocoder, plus managed Postgres |
| **P1: Multi-city (4–12 mo)** | 5–8 metros (add Bengaluru, Kochi, Mumbai, Chennai). Mobility via ONDC (Namma Yatri-style). Delivery ETA and serviceability APIs for ONDC sellers. Crowdsourced POI edits. | Full India PBF, multiple GTFS feeds, OCM EV, toll plazas | 2–3 servers plus CDN |
| **P2: Nationwide (12–24 mo)** | All-India routing and search, logistics (truck profile, tolls), verified-visit ranking, offline maps, and a B2B API (priced to undercut the new Ola and Google tiers) | Plus partner data (parking, realtime transit) | HA pairs per service, plus a second region |

### 5.3 Rough self-hosting cost for all-India (inferred estimate, not vendor-quoted)

**Inputs [D]**
- India PBF: 1.6 GB.
- Planetiler needs about 0.5× PBF in JVM heap and 5–10× PBF in disk. The whole planet builds in 3.5 h on 8 CPU / 16 GB. India is about 2% of the planet's 92 GB.
- Nominatim needs 128 GB RAM and 1 TB for the full planet.

**Derived [I]**
- India tiles at z0–15: about 2–5 GB of PMTiles.
- A nightly build takes minutes on an 8 vCPU / 16 GB box.

| Component | Sizing (India) [I] | Monthly cost (India region) [I] |
|---|---|---|
| Tile build (nightly batch) | 8 vCPU / 16 GB, ephemeral | ₹2k–5k |
| Tile serving | 5 GB PMTiles on object storage plus CDN egress. About ₹1–3 per GB of egress at 1–5 TB/month. | ₹5k–20k |
| Valhalla (all profiles, India) | 8 vCPU / 32 GB, ×2 for HA | ₹25k–50k |
| OSRM matrix sidecar (car + 2W) | 8 vCPU / 32–64 GB | ₹15k–30k |
| Nominatim + Photon (India) | 8 vCPU / 32 GB, 300 GB NVMe | ₹15k–30k |
| PostGIS (managed) | 4 vCPU / 16 GB | ₹10k–25k |
| **Total** | | **≈ ₹70k–1.6 lakh/month** (about $850–1,900) |

**Comparison [D, applied I]**
- At the Ola Tier 2 Directions rate of ₹0.199/request, 5M directions requests cost about ₹10 lakh/month.
- So self-hosting breaks even at roughly **0.5–1M routed requests/month**. [I]

**Caveats [I]**
- Traffic-aware ETA needs our own probe data from rider and driver apps. Open data does not provide it.
- OSM address coverage in India is thin. Pincode, DIGIPIN and merchant-entered addresses close the gap.

---

## 6. Open questions and next steps

1. Get the GODL clause text and the OTD Delhi T&C text. Both pages were not retrievable in this pass.
2. Find the BMRCL GTFS official download URL and terms.
3. Get legal review of the ODbL boundary between OSM-derived and proprietary databases, and of whether Indian Railways data can be used through aggregators.
4. Pick the MVP city. Hyderabad is recommended for open GTFS licence clarity; Delhi offers realtime feeds.
5. Prototype: run planetiler against the Southern Zone PBF with an SoI boundary overlay, stand up Valhalla, and complete the ONDC pre-prod `/subscribe` handshake.
