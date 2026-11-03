# Bharat Map — competitor analysis, November 2026 (condensed)

Condensed from the research pass of 3 Nov 2026 (`re-staging/competitor-2026-11/`: COMPETITORS.md, USER_FEEDBACK.md,
MATRIX.md, GAPS_RANKED.md). **No third-party screenshots are reproduced here**; every claim carries a source ID that
resolves to a URL in §7, or an issue URL in §6. Method: web_search + web_fetch of public pages only (Play / App Store
listings rendered without JS, vendor blogs and release notes, press, public issue trackers); no logins, no app
decompilation in this pass (earlier teardowns in `docs/re/` cover APK internals). Store numbers as rendered on
3 Nov 2026. `[PR]` vendor claim not independently verified · `[U]` could not verify.

What this pass changed in the product: see `docs/UPGRADE_REPORT_2026-11.md` (gaps G1–G10, implemented in 0.7.20) — the
matrix below is the **before** state (Bharat Map 0.7.18, HEAD `9ced124`), with the 0.7.20 deltas listed in §5.

## 1. Positioning (who uses what in India)

| App | Who it is for in India | Business model | Play rating / reviews / installs |
|---|---|---|---|
| Google Maps | Default for nearly everyone | Free, ads (promoted pins, map search/suggest ads) [S1][S7] | 3.3 / 1.96 Cr / 1,000 Cr+ [S1] |
| Mappls (MapmyIndia) | Drivers who want India-specific guidance; "Swadeshi" users | Free; B2C ads planned past 35–50 M users [S12]; paid NaviMaps offline app [S17] | 3.8 / 74.8 K / 1 Cr+ [S10] |
| Apple Maps | iPhone users (default) | Free, bundled | n/a (iOS) |
| CoMaps | Privacy / offline / FOSS users | Free, donations, no ads, not-for-profit [S24][S26] | 4.1 / 1.69 K / 1 L+ [S24] |
| Organic Maps | Offline / privacy users | Free, donations [S29] | 3.9 / 24 K / 50 L+ [S29] |
| OsmAnd | Power users, hikers, riders | Freemium: 7 free map downloads; Maps+ $14.99/yr or $69.99 once; Pro $5.99/mo or $39.99/yr [S33][S34] | 4.5 / 2.54 L / 1 Cr+ [S34] |
| HERE WeGo | Offline drivers, travellers | Free; HERE does not monetise the app [S38] | 3.2 / 5.01 L / 1 Cr+ [S36] |
| Waze | Car drivers in metros | Free; Waze ads not offered in India as of Sep 2026 [S44] | (not fetched) |
| Ola Maps | Developers; Ola/Ola Electric riders | API: 100 K free calls/API/month, then tiered prepaid (from 1 Sep 2026) [S47][S48] | no standalone consumer app found [U] |
| Namma Yatri | Auto/cab riders + metro commuters in 7 cities | Zero-commission ride app, driver subscriptions [S52] | 4.8 / 5.14 L / 1 Cr+ [S52] |
| Chalo | City-bus riders (~17 cities on Play listing) | Free app with ads; ticket/pass/card business [S58] | 4.0 / 2.56 L / 1 Cr+ [S58] |
| Where is my Train | Indian Railways passengers | Free, "No Ads"; owned by Google since Dec 2018 [S62][S64] | 4.4 / 51.9 L / 50 Cr+ [S62] |


## 2. What each competitor shipped or is known for (Nov 2025 – Nov 2026)

- **Google Maps** — India package (Nov 2025): flyover voice guidance in 9 Indian languages, two-wheeler "Navatars",
  metro tickets via ONDC/Namma Yatri in Delhi, Bengaluru, Kochi, Chennai [S3][S5]; accident-prone-area alerts from
  authority data in 4 cities and official speed limits in 9 [S4]; Ask Maps (Gemini) in India from Mar 2026, Hindi from
  Aug 2026 [S8][S9]; narrow-road and flyover callouts since Jul 2024 in 8 cities [S14]. Free with ads (promoted pins,
  search/suggest ads) [S1][S7]. Weak spots in user feedback: narrow lanes / footpaths, unrequested reroutes, the new
  default voice (Oct 2026) [S18][S19].
- **Mappls (MapmyIndia)** — 3D junction view, door-level navigation, live signal timers (Bengaluru pilot, 125+ signals),
  Mappls Pin + DIGIPIN, NHAI toll savings, multimodal transit in 18 cities, 10 Indian languages [S21][S22][S23][S25][S27].
  Offline only in the separate paid NaviMaps app [S17][S35]; ads planned past 35–50 M users [S12].
- **Apple Maps** — transit in India appeared quietly in Aug 2026 [S49][S50]; offline maps with navigation [S51];
  India data from MapmyIndia [S37][S39]; iPhone-only, no two-wheeler mode.
- **CoMaps** (primary FOSS blueprint) — weekly map updates decoupled from app releases (May 2026) [S63]; Mangrove
  reviews and an "add review" link [S66]; avoid paved/unpaved/stairs [S67]; no traffic (#5531) [S68]; open issue that
  OSM boundaries may be illegal to distribute in India (#2964) [S69].
- **Organic Maps** — public-transport routing, alternatives and user-supplied satellite tiles (Jun 2026) [S71];
  Wikipedia in hi/bn/ta/te/mr (Aug 2026) [S72][S73]; stop-order optimisation (Sep 2026) [S74]; open India issues:
  SoI boundaries #12213, locality-aware search #10566, Marathi turn text #8607 [S76].
- **OsmAnd** — freemium (7 free downloads; Maps+ / Pro subscriptions; Android Auto paid) [S33][S34]; India address
  issue #16127 (`addr:place` without `addr:street`) [S81].
- **HERE WeGo** — free, offline downloads, transit in 1,900+ cities, incident report + "confirm it is still active"
  [S36][S82][S83]; DIGIPIN in HERE processes [S84].
- **Waze** — Gemini search, Motorcycle Mode in 7 markets with **India excluded** [S85][S86]; no ads sold in India [S44].
- **Ola Maps** — developer platform (MapLibre SDKs, OSRM, Pelias, MCP server) [S90][S91][S92]; free tier cut to 100 K
  calls/API/month from Sep 2026 [S47][S48]; no standalone consumer app found [U].
- **Namma Yatri** — zero-commission rides in 7 cities, metro booking, SOS; Play complaints include pickup pins shown
  wrongly to drivers [S52]; Namma Transit uses BMTC/BMRCL GTFS [S98][S99].
- **Chalo** — live bus tracking + passes in ~17 cities, ads, shares data with third parties; complaints: routes never
  live, refunds [S58]. TGSRTC Gamyam (Hyderabad) criticised for stale data [S105].
- **Where is my Train** (Google) — offline timetable, cell-tower live status without internet, destination alarm,
  platform numbers [S62].

## 3. What users say (themes ranked by observed frequency)

| # | Theme | n | Apps hit | Direction |
|---|---|---|---|---|
| A | Search/POI/address coverage weak (esp. OSM apps in India) | 12 | Organic, OsmAnd, CoMaps, Mappls, Namma Yatri | complaint |
| B | Bad routes: narrow lanes, footpaths, dead ends, outdated one-ways, ignoring the chosen route | 10 | Google (9), Mappls (1) | complaint |
| E | Public-transport info missing or unreliable (live bus, platforms, transfers) | 10 | Chalo, Gamyam, WIMT, Google, Mappls, Organic | complaint + request |
| G | OSM-app navigation clunky / complex / unreliable UX | 7 | CoMaps, OsmAnd, HERE | complaint |
| K | India-specific guidance (junction/flyover views, door numbers, signal timers) is the reason to switch | 7 | Mappls (praise), Google (complaint) | praise |
| C | Traffic/ETA wrong or missing | 6 | Google, Mappls, CoMaps, Organic | complaint + request |
| D | Offline maps wanted / offline friction (limits, sizes, separate app) | 6 | Mappls, OsmAnd, OSM apps, Google | request + complaint |
| F | Unwanted AI/voice changes in navigation | 6 | Google, Waze | complaint |
| H | Two-wheeler / moped routing demand | 6 | Waze, CoMaps, Organic, Google/AA | request |
| J | Privacy / no-tracking / no-ads praised | 6 | Organic, CoMaps | praise |
| I | Payments, refunds, support failures in transit/ride apps | 5 | Chalo (3), Namma Yatri (2) | complaint |
| L | Indic language quality (TTS grammar, glyph shaping, localized turn text) | 5 | OsmAnd, Organic, CoMaps | complaint |
| M | Battery / heat / jumpy marker | 3 | Mappls, OsmAnd | complaint |
| N | Paywalls on basics (download limit, Android Auto) | 2 | OsmAnd | complaint |
| O | Map legality: Survey-of-India boundaries | 2 | CoMaps, Organic | request |
| P | Small requests: Home/Work one-tap, via points, incident reporting, overnight trains, photo management | 7 (mixed) | CoMaps, Mappls, WIMT | request |

"n" = distinct items actually read (reviews, posts, issues, articles), not a share of users. Evidence items with
quotes and URLs: `re-staging/competitor-2026-11/USER_FEEDBACK.md` (kept outside the repo because it quotes reviews).

## 4. Feature matrix (52 rows, before = Bharat Map 0.7.18)

Competitor cells: ● present · ◐ partial / limited cities / paid / beta · — absent · n/a out of scope · ? not verified.
Bharat Map (BM) cells: ✅ implemented with unit/E2E tests (no real-device run yet) · 🟡 prototype / partial / labelled
estimate · 💰 needs a paid key or partner · ❌ missing. Columns: G Google Maps · M Mappls · A Apple Maps · CM CoMaps ·
OM Organic Maps · OA OsmAnd · H HERE WeGo · W Waze · OL Ola Maps · NY Namma Yatri · CH Chalo · WT Where is my Train.
`T:…` = earlier teardown in `docs/re/` (GMAPS_HERE_TEARDOWN.md, COMAPS_TEARDOWN.md, APPLE_MAPS_V2_TEARDOWN.md).

### 4.1 Map, data, offline

| # | Feature | G | M | A | CM | OM | OA | H | W | OL | NY | CH | WT | BM | Bharat evidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Offline basemap download | ● | ◐ (NaviMaps, paid) | ● | ● | ● | ◐ (7 free) | ● | ? | n/a | — | ◐ (timetables) | ● (timetable) | ✅ 11 bundled cities + download manager | `web/offline/*.pmtiles`, `web/lib/region-manager.js` | S1 S10 S17 S51 S24 S29 S33 S82 S58 S62 |
| 2 | Offline routing (on device) | ● | ◐ (NaviMaps) | ● | ● | ● | ● | ● | ? | n/a | — | — | n/a | ❌ straight-line fallback; Vizag Valhalla graph built, no engine | `docs/OFFLINE_ROUTING.md` | T:GMAPS_HERE, S35 S51 S29 S34 S82 |
| 3 | Offline search | ● | ◐ (NaviMaps) | ● | ● | ● | ● | ● | ? | n/a | — | — | ● (fuzzy train search) | ✅ 86,977-place token index, translit, pincode, DIGIPIN | `web/offline/search/index.json`, `shared/translit.js` | T:GMAPS_HERE, S35 S62 |
| 4 | Region granularity suited to India | ◐ draw-a-box | ◐ country | ? | ◐ state (AP 115 MB) | ◐ state | ◐ state | ◐ region | ? | n/a | n/a | n/a | n/a | ✅ city packs (4–9 MB) | `web/offline/regions.json` | T:CM, S23 |
| 5 | Frequent map-data updates without app update | ● | ? | ● | ● weekly | ● biweekly | ◐ hourly (Pro) | ? | ● | ? | n/a | n/a | n/a | ❌ packs rebuilt with releases; no delta | `scripts/make-region.sh` | S63 S29 S33 |
| 6 | Satellite imagery | ● | ● (sat-view nav, iOS notes) | ● | — | ◐ BYO tile URL | ◐ online layers | ? | — | ? | — | — | — | ❌ (copy explains no licensed free source) | `shared/i18n.js` `satellite_note` | S1 S22 S71 S34 |
| 7 | Street-level imagery | ● Street View | ● RealView | ◐ Look Around surveying | — | — | ◐ Mapillary | — | — | — (planned per 2024 claim) | — | — | — | ❌ (⛔ by policy) | `docs/re/FEATURE_COMPARISON.md` | S15 S22 S53 S34 |
| 8 | 3D buildings | ● | ● 3D landmarks | ● | ● | ? | ● (5.3) | ? | — | ? | — | — | — | ✅ OSM heights | `web/map/style.js` | S1 S21 S78 T:CM |
| 9 | Survey-of-India compliant boundaries | ● (India view) [I] | ● | ? | — (#2964) | — (#12213) | ? | ? | ? | ? | n/a | n/a | n/a | ❌ OSM default | no boundary code in `web/`, `shared/` | S69 S76; GMAPS_HERE §3 #3 |
| 10 | Low-end / data-saver mode | ● (Maps Go) | ? | n/a | ◐ | ◐ | ◐ | ? | ? | n/a | ? | ? | ● (small, offline) | ✅ device tiers Lite/Balanced/Full + low-bandwidth | `web/lib/device-tier.js`, `web/lib/bandwidth.js` | S1(similar apps) S62 |

### 4.2 Search, places, address

| # | Feature | G | M | A | CM | OM | OA | H | W | OL | NY | CH | WT | BM | Bharat evidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 | Dense business POIs + hours/phone | ● 250 M | ◐ (weaker than G) | ◐ | ◐ OSM | ◐ OSM | ◐ OSM | ◐ | ◐ | ● (API) | n/a | n/a | n/a | 🟡 OSM via Overpass; seeded demo sellers | `web/services/overpass.js`, `shared/seed.js` | S1 S42 A1–A12 in USER_FEEDBACK |
| 12 | User reviews / ratings | ● | ● | ● | ◐ Mangrove (Android) | — (#2758) | — | ? | — | n/a | ● driver rating | n/a | n/a | 🟡 seeded rating number only | `web/app.js` (`business.rating`) | S1 S10 S66 S76 |
| 13 | User photo contributions | ● | ● | ? | — | — | ◐ Mapillary | ? | — | n/a | — | — | — | ❌ | — | S1 S10 |
| 14 | Typeahead autocomplete | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ✅ Photon + offline index | `web/ui/search.js` | S1 S90 |
| 15 | Indic-script search + transliteration | ● | ● (10 langs) | ? | ◐ hi/mr | ◐ | ◐ | ? | ? | ● 11+ langs [PR] | ◐ 5 UI langs | ● 9 langs | ● 8 langs | ✅ 9 Brahmic scripts both ways | `shared/translit.js` | S22 S58 S64 T:CM |
| 16 | Conversational / LLM search | ● Ask Maps (en, hi) | ◐ voice search | ◐ Siri | — | — | — | — | ● beta | ● MCP | — | — | — | 🟡 deterministic intent engine; optional LLM rewrite only if `LLM_API_KEY` | `shared/search.js`, `server/services/external.js` `llmRewrite` | S8 S9 S22 S85 S90 |
| 17 | DIGIPIN / short address codes | — (Plus Codes) | ● Mappls Pin + DIGIPIN | ? | — | — | — | ● (DIGIPIN in HERE processes) | — | ? | — | — | — | ✅ DIGIPIN + pincode + landmark | `shared/address.js` | T:GMAPS_HERE, S22 S84 |
| 18 | House-number / door-level navigation | ● | ● | ● | ◐ OSM | ◐ OSM | ◐ OSM (`addr:place` issue) | ? | ? | ? | n/a | n/a | n/a | 🟡 OSM + landmark resolver | `shared/address.js` | S21 S81 |
| 19 | Suggest an edit / map-problem report | ● | ● (Post on Map) | ● | ● OSM editor | ● editor | ● OSM edit | ? | ● editors | n/a | n/a | n/a | n/a | ✅ anonymous OSM notes | `shared/osm-edit.js`, `web/ui/report.js` | S10 S29 S34 S87 |

### 4.3 Routing and navigation

| # | Feature | G | M | A | CM | OM | OA | H | W | OL | NY | CH | WT | BM | Bharat evidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 | Two-wheeler routing | ● since 2017 | ● bike routes | — | — (#4040) | — (#9273) | ● profiles | ◐ scooter | — in India | ● (API) | n/a | n/a | n/a | ✅ Valhalla `motor_scooter` (online only) | `shared/valhalla.js` | S13 S22 S34 S86 |
| 21 | Alternatives + avoid tolls/highways | ● | ● (resets bug) | ● | ● | ● (Jun 2026) | ● | ● | ● | ● | n/a | n/a | n/a | ✅ | `web/services/routing.js` | S1 S10 S71 |
| 22 | Multi-stop / stop-order optimisation | ● | ◐ (no "via") | ● | ● | ● optimise (Sep 2026) | ● | ● | ◐ | ● optimise | n/a | n/a | n/a | ✅ up to 5 stops (optimiser API ≤25 for delivery) | README v0.5 | S36 S74 S90 S22 |
| 23 | Turn-by-turn voice in Indian languages | ● flyover voice 9 langs | ● 10 langs | ◐ | ◐ hi/mr/ta | ◐ | ◐ (Hindi TTS issue) | ◐ Bengali (India) | ? | ● SDK | n/a | n/a | n/a | ✅ en/hi/te (native review pending); device voices for 10 langs | `web/nav/voice.js`, `web/nav/voices.js` | S3 S22 S76 T:CM |
| 24 | Landmark-based instructions | ● (Gemini) | ? | ? | — | — | — | — | — | ? | n/a | n/a | n/a | ✅ en/hi/te | `web/nav/maneuver.js`, README | S2 |
| 25 | Flyover / service-road / narrow-road hints | ● flyover + narrow-road | ● 3D junction | — | — | — | — | — | — | ? | n/a | n/a | n/a | ✅ "Take the flyover", service road, narrow road (OSM tags) | `shared/roadhints.js` | S3 S14 S21 |
| 26 | Lane guidance | ● | ● | ● | ● (iOS Jul 2026) | ◐ (#1404) | ● | ● | ● | ? | n/a | n/a | n/a | ✅ where OSM `turn:lanes` | `shared/lanes.js` | S65 S76 T:GMAPS_HERE |
| 27 | Junction view | ◐ | ● photo-realistic 3D | ● 3D | — | — | — | ? | — | ? | n/a | n/a | n/a | 🟡 schematic SVG | `web/nav/junction.js` | S21 T:AP |
| 28 | Speed limit + overspeed | ● official limits 9 cities | ● | ● | ● | ◐ (#952) | ● | ● | ● | ? | n/a | n/a | n/a | ✅ OSM `maxspeed` only (sparse) | `shared/maxspeed.js`, `web/services/speed.js` | S4 S22 S60 S76 |
| 29 | Rerouting on deviation | ● | ● | ● | ● | ● | ● | ● | ● | ● SDK | n/a | n/a | n/a | ✅ 3-fix rule | `web/nav/tracker.js` | — |
| 30 | Background / screen-off navigation | ● | ● | ● | ● | ● | ● | ● | ● | ● | n/a | n/a | ● (cell-tower) | ✅ location FGS + notification | `android/.../NavLocationService.java` | S62 T:CM |
| 31 | Android Auto / CarPlay | ● | ● both | ● CarPlay | ● AA + CarPlay dash | ● | ◐ paid | ● CarPlay | ● | n/a | n/a | n/a | n/a | ❌ feasibility doc only | `docs/ANDROID_AUTO.md` | S31 S66 S73 S34 S36 |

### 4.4 Traffic, safety, community

| # | Feature | G | M | A | CM | OM | OA | H | W | OL | NY | CH | WT | BM | Bharat evidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 32 | Live traffic + traffic-aware ETA | ● | ● | ● | — (#5531) | — (#1160) | — | ● | ● | ● (fleet probes) | n/a | n/a | n/a | 💰 TomTom/HERE key only; otherwise "free-flow" label | `web/ui/traffic.js`, KNOWN_LIMITATIONS | S1 S21 S68 S76 S84 |
| 33 | Proactive disruption alerts (no active nav) | ● Delhi/Mumbai/BLR | ? | ● commute alerts | — | — | — | ? | ● | ? | n/a | n/a | n/a | ❌ (commute card is free-flow only) | `web/ui/saved.js` commute | S4 S46 |
| 34 | Crowd incident reports (pothole, waterlogging, closure) | ● | ● smart-city issues | ● | — | — | — | ● (Galaxy notes) | ● | ? | n/a | n/a | n/a | 🟡 2-hour, voted, "not verified"; shared only via own server | `server/community.js`, `web/services/community.js` | S1 S10 S83 S89 |
| 35 | Authority safety data (accident-prone / black spots) | ● 4 cities | ● (Delhi TP) | ? | — | — | — | ? | ◐ speed cams | ? | n/a | n/a | n/a | ❌ | — | S4 S11 |
| 36 | Live traffic-signal countdown | — | ● Bengaluru 125 signals | — | — | — | — | — | — | — | n/a | n/a | n/a | ❌ (⛔ in OPPORTUNITIES) | — | S23 S25 |
| 37 | Toll plazas / toll cost | ● | ● NHAI pass savings, trip cost | ● avoid | ◐ | ◐ | ◐ | ● | ● | ● (API) | n/a | n/a | n/a | 🟡 plazas on route, fees "not available" | `shared/tolls.js` | S22 S25 S90 |

### 4.5 Transit, mobility, commerce

| # | Feature | G | M | A | CM | OM | OA | H | W | OL | NY | CH | WT | BM | Bharat evidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 38 | Metro journey planning | ● | ● 18 cities | ◐ new (Aug 2026) | ● subway layer | ● (Jun 2026) | ◐ | ● 1,900 cities (India ?) | — | n/a | ● (BLR + others) | ● trip planner | ● metro | 🟡 Hyderabad HMRL GTFS only (scheduled) | `server/transit/`, `web/transit/hmrl.json` | S1 S27 S49 S71 S36 S52 S58 S62 |
| 39 | City bus routing / schedules | ● | ● | ◐ | — | ● (Jun 2026) | ◐ | ? | — | n/a | ◐ (Namma Transit BLR) | ● 17 cities | ● Mumbai buses (Sep 2026) | ❌ (GTFS loader ready; no bus feed bundled) | `server/transit/gtfs.js` | S1 S27 S71 S98 S58 S62 |
| 40 | Live vehicle positions / arrivals | ● (real-time in Ask Maps) | ? | ◐ some regions | — | — ("in development") | — | ◐ | — | n/a | ● metro + auto | ● GPS buses | ● trains w/o internet | ❌ "live arrivals Unavailable everywhere" | KNOWN_LIMITATIONS | S9 S29 S52 S58 S62 |
| 41 | Train running status / PNR | ◐ (transit) | ◐ rail routes | ? | — | — | — | ? | — | n/a | — | ◐ | ● offline, cell-tower | ❌ (station panels only) | `shared/services/panel-types.js` | S27 S62 |
| 42 | Metro / bus ticket purchase | ● ONDC (4 cities) | — | ◐ transit cards (some regions) | — | — | — | — | — | n/a | ● | ● tickets/passes | — | 🟡 link-out + ONDC prototype (demo network) | `web/ui/ondc.js`, KNOWN_LIMITATIONS | S5 S52 S58 |
| 43 | Ride-hailing hand-off / booking | ● (ride-share) | ? | ● (rideshare option) | — | — | — | ? | — | ● Ola | ● own | ◐ (autos/taxis in planner) | — | ✅ Uber deep link; Ola/Rapido link-out, ETAs labelled Estimate | `shared/services/catalog.js` | S1 S52 S58 |
| 44 | Commerce / services catalogue on place card | ● (order, reserve, hotels) | ◐ EV booking via partners | ◐ | — | — | — | — | — | n/a | n/a | n/a | n/a | ✅/🟡 92-provider catalogue, demo sellers, payments only with gateway keys | `shared/services/catalog.js` (93 `P(` entries incl. helper), `server/payments/` | S1 S22 |
| 45 | EV charger POIs | ● | ● + booking | ● | ● (Type 1 combo, Mar 2026) | ◐ (#7043) | ● | ? | ? | ? | n/a | n/a | n/a | ✅ OSM / Open Charge Map (key) | `shared/ev.js` | S22 S65 S76 |

### 4.6 Personal, sharing, privacy, platform

| # | Feature | G | M | A | CM | OM | OA | H | W | OL | NY | CH | WT | BM | Bharat evidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 46 | Saved places, Home/Work, lists | ● | ● (Home/Work ETA Sep 2026) | ● | ● (Home/Work issue #5137) | ● | ● | ● collections | ● | n/a | ● saved rides | ? | ● | ✅ lists + editor + server sync | `web/lib/saved-model.js` | S1 S22 S36 S76 |
| 47 | GPX/KML import-export, track recording | ◐ | ? | — | ● | ● | ● | ? | — | n/a | n/a | n/a | n/a | ✅ GPX/KML (no KMZ), foreground tracks | `shared/geoformats.js`, `web/lib/track-model.js` | S29 S34 T:CM |
| 48 | Live location sharing / SOS | ● | ● | ● | — | — | ◐ (tracker app) | ? | ● ETA share | n/a | ● SOS + share | — | ● share train | ✅ time-limited share link; no SOS | `server/community.js`, `web/ui/links.js` | S10 S52 S62 |
| 49 | Deep links (`geo:`, own scheme), launcher shortcuts | ● | ● (Arattai hand-off) | ● | ● | ● | ● | ? | ● | n/a | ? | ? | ? | ✅ `geo:`, `bharatmap://`, App Links, 4 shortcuts | `android/app/src/main/AndroidManifest.xml`, `res/xml/shortcuts.xml` | S30 T:CM |
| 50 | Home-screen widget | ? | ? | ● | — | — | ? | ? | ? | n/a | ? | ? | ? | ❌ (no AppWidgetProvider) | grep: none | S46 |
| 51 | No ads / no third-party tracking | — ads [S1] | ◐ no ads yet, ads planned | ● | ● no data collected | ● no data collected | ◐ | ◐ | — ads (not in IN) | n/a | ◐ shares data w/ 3rd parties | — ads + shares data | ● no ads | ✅ no ad/analytics SDKs; privacy dashboard, export/delete | `web/ui/privacy.js` | S1 S12 S24 S29 S52 S58 S62 |
| 52 | Platforms | Android, iOS, web | Android, iOS, web | iOS, web | Android, iOS, Linux | Android, iOS | Android, iOS, web | Android, iOS, web | Android, iOS | SDKs | Android, iOS | Android, iOS, web | Android, iOS | Android (Capacitor) + web/PWA; ❌ iOS | `capacitor.config.json` | S56 S29 S36 S58 |

### 4.7 Scorecard before (0.7.18, 52 rows)
- ✅ implemented: 26 rows (1, 3, 4, 8, 10, 14, 15, 17, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 43, 45, 46, 47, 48, 49, 51), plus 44 partly.
- 🟡 prototype/partial: 10 rows (11, 12, 16, 18, 27, 34, 37, 38, 42, 44); row 52 is ✅ Android/web.
- 💰 needs paid key: 1 row (32).
- ❌ missing: 14 rows (2, 5, 6, 7, 9, 13, 31, 33, 35, 36, 39, 40, 41, 50); row 52 lacks iOS.
Caveat that applies to every ✅: the repo's own `docs/KNOWN_LIMITATIONS.md` says no real-device run has been done for
v0.7; all checks are headless Chromium E2E.

### 4.8 Rows added in this pass (53–56; BM column = 0.7.20)

| # | Feature | G | M | A | CM | OM | OA | H | W | OL | NY | CH | WT | BM 0.7.20 | Bharat evidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 53 | Locality-aware, typo-tolerant search ("name, locality") | ? | ? | ? | ? | — (#10566) | ◐ (#16127) | ? | ? | ? | ? | ? | ● (fuzzy train search) | ✅ device index + server FTS5 | `shared/search-locality.js`, `shared/search-index.js`, `server/lib/search-fts.js` | S62 S76 S81 |
| 54 | Arrival / get-off alarm | ? | ? | ? | ? | ? | ? | ? | ? | n/a | ? | ? | ● destination alarm | ✅ foreground only (no background geofence) | `shared/alarms.js`, `web/nav/alarms.js` | S62 |
| 55 | No silent reroute (offer with time saved; auto-switch opt-in) | ◐ (theme F complaints) | ? | ? | ? | ? | ? | ? | ? | n/a | n/a | n/a | n/a | ✅ | `shared/reroute.js`, `web/nav/navigation.js` | S18 S19, USER_FEEDBACK F |
| 56 | Add a missing place (structured) | ● (row 19) | ● Post on Map | ? | ● OSM editor | ● editor | ● OSM edit | ? | ● editors | n/a | n/a | n/a | n/a | ✅ structured anonymous OSM note | `shared/osm-edit.js`, `web/ui/report.js` | S10 S29 S34 S87 |

Competitor cells in rows 53–56 are filled only where a source in §7 says so, `?` everywhere else.

## 5. Bharat Map 0.7.20 deltas (after)

| # | Feature | Before (0.7.18) | After (0.7.20) | Gap |
|---|---|---|---|---|
| 25 | Flyover / service-road / narrow-road hints | ✅ hints after routing | ✅ + "Prefer main roads" costing (Valhalla); on OSRM it is labelled "not applied" | G1 |
| 34 | Crowd incident reports | 🟡 map only, 2 h, voted | ✅ + on-route alerts (voice cue once) and "Still there?" votes; still labelled unverified, own server or this device | G8 |
| 38 | Metro journey planning | 🟡 HMRL only | 🟡 HMRL + Bengaluru Namma Metro (unofficial ODbL GTFS, approximated stop times) | G3 (part) |
| 43 | Ride-hailing hand-off | ✅ Uber deep link | ✅ + exact pin, DIGIPIN and landmark in every hand-off (in the link where documented, else clipboard) | G9 |
| 53 | Locality-aware, typo-tolerant search | ❌ (new row) | ✅ device index + server FTS5 | G2 |
| 54 | Arrival / get-off alarm | ❌ (new row) | ✅ foreground only (no background geofence) | G7 |
| 55 | No silent reroute | 🟡 off-route reroute only (new row) | ✅ faster route offered with minutes saved; auto-switch opt-in and announced; voice choice kept | G10 |
| 56 | Add a missing place (structured) | 🟡 free-text OSM note (new row) | ✅ structured anonymous OSM note | G6 (part) |

**Scorecard after (0.7.20, 56 rows).** ✅ 31 (the 26 before + row 34 + new rows 53, 54, 55, 56) · 🟡 9 (rows 11, 12, 16, 18, 27, 37, 38, 42, 44) · 💰 1 (row 32) · ❌ 14 (rows 2, 5, 6, 7, 9, 13, 31, 33, 35, 36, 39, 40, 41, 50); row 52 (platforms) is counted outside the four buckets as before (✅ Android/web, ❌ iOS). Rows 55 and 56 were 🟡 in the before state but did not exist in the 52-row matrix, so the before count is unchanged.
Not closed in 0.7.20: G4 Survey-of-India boundaries (row 9), G5 on-device routing (row 2), bus feeds (row 39), Overture POI merge (row 11). The ✅ caveat applies: no real-device run yet.

## 6. Issue trackers used as demand signals (queried 3 Nov 2026)

### Organic Maps (GitHub)
- #5331 Implement public transport routing — open, 121 reactions, 82 comments — https://github.com/organicmaps/organicmaps/issues/5331
- #1360 Track Follow / Navigation support — open, 82 reactions — https://github.com/organicmaps/organicmaps/issues/1360
- #952 Show speed limit sign on all platforms — open, 74 reactions — https://github.com/organicmaps/organicmaps/issues/952
- #1160 Integrate Traffic Data — open, 56 reactions — https://github.com/organicmaps/organicmaps/issues/1160
- #2758 User reviews (Mangrove) — open, 43 reactions — https://github.com/organicmaps/organicmaps/issues/2758
- #1183 Alternative routes — open, 39 reactions — https://github.com/organicmaps/organicmaps/issues/1183
- #1404 Lane assist — open, 19 reactions — https://github.com/organicmaps/organicmaps/issues/1404
- #391 Preferred map language option — open, 19 reactions — https://github.com/organicmaps/organicmaps/issues/391
- #9273 Add motorcycle routing profile — open, 2 reactions — https://github.com/organicmaps/organicmaps/issues/9273
- #12213 India: Survey-of-India-compliant boundary overrides — open (2026-02-20) — https://github.com/organicmaps/organicmaps/issues/12213
- #8607 Turn notification text/TTS not localized (Marathi name:mr ignored) — open — https://github.com/organicmaps/organicmaps/issues/8607
- #10566 Search doesn't rank "Al-Shifa Hospital, Perinthalmanna, Kerala" (no locality parsing) — open — https://github.com/organicmaps/organicmaps/issues/10566
- #2311 maps.google.co.in links lose destination — https://github.com/organicmaps/organicmaps/issues/2311
- #1263 Integrate openaddresses.io for search — https://github.com/organicmaps/organicmaps/issues/1263
### OsmAnd (GitHub)
- #16127 Search by addr:block / addr:place (India addresses without addr:street) — closed — https://github.com/osmandapp/OsmAnd/issues/16127
- #19780 Telugu label cropped — closed 2024 — https://github.com/osmandapp/OsmAnd/issues/19780
- #10062 Devanagari rendered incorrectly — open since 2020 — https://github.com/osmandapp/OsmAnd/issues/10062
- #6642 Hindi TTS nonsensical sentences — closed 2019 — https://github.com/osmandapp/OsmAnd/issues/6642
- #16718 Voice prompts in Urdu — open — https://github.com/osmandapp/OsmAnd/issues/16718
### CoMaps (Codeberg)
- #2964 Disputed boundaries / "Make CoMaps legal in India" — open, 17 comments — https://codeberg.org/comaps/comaps/issues/2964
- #5531 Roadworks and congestions ("biggest problem ... missing of congestions") — closed 2026-10-25 — https://codeberg.org/comaps/comaps/issues/5531
- #4927 Render (auto)rickshaw stands (traveller in India) — open — https://codeberg.org/comaps/comaps/issues/4927
- #4040 Routing options for mopeds — open, 12 comments — https://codeberg.org/comaps/comaps/issues/4040
- #5418 Bicycle & two-wheeler routing profiles on CarPlay — open — https://codeberg.org/comaps/comaps/issues/5418
- #5137 Navigating to Home and Work missing — closed — https://codeberg.org/comaps/comaps/issues/5137
- #5108 India National Highway shields rendered twice — closed — https://codeberg.org/comaps/comaps/issues/5108
- #5437 Split Puducherry into its own map — open — https://codeberg.org/comaps/comaps/issues/5437
- #3555 India node in Hindi with native language — closed — https://codeberg.org/comaps/comaps/issues/3555
- #5326 Car routing does not respect time-restricted roads — open — https://codeberg.org/comaps/comaps/issues/5326
- #3016 Save and load route — open, 11 comments — https://codeberg.org/comaps/comaps/issues/3016

## 7. Sources (all fetched or returned by search on 3 Nov 2026)

[S1] https://play.google.com/store/apps/details?id=com.google.android.apps.maps&hl=en_IN
[S2] https://blog.google/products-and-platforms/products/maps/gemini-navigation-features-landmark-lens
[S3] https://blog.google/intl/en-in/products/explore-communicate/google-maps-in-india-enhancing-every-way-you-travel-with-india-first-features/
[S4] https://blog.google/intl/en-in/products/explore-communicate/google-maps-in-india-keeping-you-informed-with-new-safety-disruption-alerts/
[S5] https://support.google.com/maps/answer/15179212?hl=en&co=GENIE.Platform%3DAndroid
[S6] https://timesofindia.indiatimes.com/technology/tech-news/google-maps-is-getting-india-first-ai-powered-features-list-of-10-updates-coming-to-app/articleshow/125127352.cms
[S7] https://support.google.com/google-ads/answer/16388390?hl=en
[S8] https://blog.google/intl/en-in/products/explore-communicate/ask-anything-about-any-place-on-maps-with-gemini
[S9] https://blog.google/intl/en-in/products/ask-maps-gets-more-helpful-in-india
[S10] https://play.google.com/store/apps/details?id=com.mmi.maps&hl=en_IN
[S11] https://www.newsbytesapp.com/news/science/delhi-traffic-police-partners-with-google-mapmyindia-for-road-safety/story
[S12] https://www.thehindubusinessline.com/companies/mapmyindia-eyes-50-million-mappls-downloads-by-year-end/article70189580.ece
[S13] https://www.businesstoday.in/technology/news/story/google-launches-two-wheeler-mode-in-google-maps-for-india-google-assistant-88558-2017-12-05
[S14] https://blog.google/intl/en-in/products/explore-communicate/six-ways-were-enabling-more-efficient-and-sustainable-journeys-on-google-maps-in-india-powered-by-ai-and-local-partners/
[S15] https://blog.google/intl/en-in/products/explore-communicate/google-announces-local-partnerships-to-build-a-more-helpful-maps-experience-in-india/
[S16] https://www.medianama.com/2025/07/223-mapmyindias-mapplspin-india-posts-digipin
[S17] https://www.mapmyindia.com/navimaps/pricing
[S18] https://www.cbc.ca/news/world/google-maps-voice-change-9.7393031
[S19] https://www.androidauthority.com/gemini-hands-free-google-maps-conversation-3696358
[S20] https://business.google.com/us/accelerate/announcements/google-maps-in-demand-gen/
[S21] https://about.mappls.com/app/
[S22] https://apps.apple.com/in/app/mappls-mapmyindia-maps/id723492531
[S23] https://www.business-standard.com/markets/capital-market-news/mapmyindia-s-flagship-mappls-app-now-offers-ai-powered-live-traffic-signal-timer-in-bengaluru-125092500271_1.html
[S24] https://play.google.com/store/apps/details?id=app.comaps.google&hl=en_IN
[S25] https://www.cnbctv18.com/business/mappls-launches-indias-first-real-time-traffic-signal-timers-and-nhai-toll-saving-features-19713766.htm
[S26] https://www.comaps.app/support/how-do-the-features-differ-from-those-of-organic-maps/
[S27] https://about.mappls.com/blog/mapmyindia-expands-capabilities-of-mappls-app-with-multimodal-public-transport-metro-rail-bus-route
[S28] https://indianexpress.com/article/technology/tech-news-technology/mapmyindia-new-public-transport-feature-metro-rail-bus-routes-10446482/
[S29] https://play.google.com/store/apps/details?id=app.organicmaps&hl=en_IN
[S30] https://www.indiatoday.in/technology/news/story/zohos-arattai-teams-up-with-mapmyindias-mappls-for-easy-location-sharing-3030462-2026-11-02
[S31] https://www.moneycontrol.com/technology/mappls-app-explained-what-features-this-homegrown-google-maps-rival-offers-key-features-and-more-article-13613192.html
[S32] https://cdn-public.mappls.com/about-mappls/assets/investor_doc/2025-26/q2/MMI_Q2__H1FY26_Results_Press_Release.pdf
[S33] https://www.osmand.net/pricing
[S34] https://play.google.com/store/apps/details?id=net.osmand&hl=en_IN
[S35] https://play.google.com/store/apps/details?id=com.mmi.navimaps&hl=en
[S36] https://play.google.com/store/apps/details?id=com.here.app.maps&hl=en_IN
[S37] https://www.hindustantimes.com/business/indian-navigation-app-mappis-tops-google-maps-in-downloads-with-5-million-downloads-101691486219136.html
[S38] https://ackodrive.com/news/the-future-of-maps-how-here-technologies-a-global-mapping-specialist-is-helping-automakers-develop-and-customise-navigation-tools/
[S39] https://www.livemint.com/technology/tech-news/mapmyindia-charts-the-consumer-route-11663175270991.html
[S40] https://mapplsapi.com/
[S41] https://maps.guru/compare/mappls-alternative
[S42] https://www.medianama.com/2022/12/223-views-google-maps-mapmyindias-mappls-2/
[S43] https://www.reddit.com/r/degoogle/comments/1pb6fkw/indias_biggest_roadblock_to_degoogling_google
[S44] https://ppc.land/waze-ads-gain-41-countries-including-all-27-eu-member-states
[S45] https://www.apple.com/in/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26
[S46] https://www.apple.com/in/newsroom/2025/06/apple-services-deliver-powerful-features-and-intelligent-updates-to-users-this-fall/
[S47] https://maps.olakrutrim.com/pricing
[S48] https://maps.olakrutrim.com/pricing/update-2026
[S49] https://www.gadgets360.com/mobiles/news/apple-maps-gets-transit-support-in-india-11971770
[S50] https://gadgets.beebom.com/news/apple-maps-quietly-gets-transit-support-in-india
[S51] https://support.apple.com/en-in/105084
[S52] https://play.google.com/store/apps/details?id=in.juspay.nammayatri&hl=en_IN
[S53] https://www.medianama.com/2025/01/223-apple-look-around-feature-india-partner-techmahindra-data
[S54] https://en.wikipedia.org/wiki/Apple_Maps
[S55] https://www.reddit.com/r/IndiaTech/comments/1od7txp/apple_maps_or_google_maps_in_india
[S56] https://wiki.openstreetmap.org/wiki/CoMaps
[S57] https://technology.inquirer.net/147812/comaps-and-the-right-to-fork
[S58] https://play.google.com/store/apps/details?id=app.zophop&hl=en_IN
[S59] https://www.comaps.app/news/2026-01-24/Release-2026.01.24-release-notes/
[S60] https://www.comaps.app/news/2026-02-09/Release-2026.02.09-release-notes/
[S61] https://www.comaps.app/news/2026-04-23/Release-2026.04.23-release-notes/
[S62] https://play.google.com/store/apps/details?id=com.whereismytrain.android&hl=en_IN
[S63] https://www.comaps.app/news/2026-05-06/Release-2026.05.06-release-notes/
[S64] https://entrackr.com/2018/12/google-acquire-where-is-my-train/
[S65] https://www.comaps.app/category/release/
[S66] https://www.comaps.app/news/2026-10-05/Release-2026.10.05-release-notes/
[S67] https://www.comaps.app/support/how-do-the-features-differ-from-those-of-organic-maps/
[S68] https://codeberg.org/comaps/comaps/issues/5531
[S69] https://codeberg.org/comaps/comaps/issues/2964
[S70] https://forum.fossunited.org/t/problem-statements-and-ideas-fosshack-2026/7186
[S71] https://organicmaps.app/news/2026-06-29/satellite-imagery-public-transport-routes-alternate-routes-new-search-and-route-planning-interface-for-android-large-accessibility-fonts/
[S72] https://github.com/organicmaps/organicmaps/releases
[S73] https://organicmaps.app/news/2026-08-31/multi-selection-bookmarks-tracks-carplay-dashboard-hiding-tracks-share-links-august-2026
[S74] https://organicmaps.app/news/2026-09-29/route-optimization-improved-alternative-routes-hide-individual-tracks-visibility-intermittent-water-areas-in-september-2026-update
[S75] https://www.xda-developers.com/android-autos-navigation-switched-to-offline-maps/
[S76] GitHub / Codeberg issues — URLs listed in §6 below
[S77] https://www.osmand.net/blog/osmand-android-5-2-released/
[S78] https://www.apkmirror.com/apk/osmand/maps-navigation-osmand/osmand-maps-gps-offline-5-3-10-release/
[S79] https://en.wikipedia.org/wiki/OsmAnd
[S80] https://docs.osmand.net/docs/user/purchases/ios
[S81] https://github.com/osmandapp/OsmAnd/issues/16127
[S82] https://help.here.com/faq/offline_maps
[S83] https://galaxystore.samsung.com/detail/com.here.app.maps
[S84] https://www.financialexpress.com/auto/car-news/here-to-stay-how-here-technologies-is-powering-indias-mobility-revolution/4135847/
[S85] https://blog.google/waze/waze-updates-gemini-motorcycle-mode/
[S86] https://nerdyinfo.com/waze-motorcycle-mode/
[S87] https://www.waze.com/discuss/t/self-organized-local-meetups/380066
[S88] https://www.localguidesconnect.com/t/sign-up-to-be-part-of-a-cross-community-pilot-to-help-map-traffic-disruptions-across-india/507862
[S89] https://apps.apple.com/in/app/waze-navigation-live-traffic/id323229106
[S90] https://maps.olakrutrim.com/products
[S91] https://makewithmaplibre.com/products/ola-maps
[S92] https://wiki.openstreetmap.org/wiki/Ola_-_Organised_Editing
[S93] https://swadeshiapps.com/blog/indian-alternatives-to-google-maps
[S94] https://inc42.com/buzz/krutrim-cuts-nearly-half-of-remaining-workforce-in-fresh-layoffs/
[S95] https://www.indiatoday.in/technology/news/story/krutrim-layoffs-bhavish-aggarwal-ai-startup-cloud-focus-ola-revenue-2957916-2026-07-28
[S96] https://tech.olakrutrim.com/navigating-india-the-journey-of-ola-maps/
[S97] https://www.linkedin.com/posts/karthik-puvvula-16309664_reactnative-mapsapi-startuptech-activity-7476287472822448130-vOun
[S98] https://indianexpress.com/article/cities/bangalore/bengaluru-gtfs-data-format-seamless-multimodal-transit-10153394/
[S99] https://www.thehindu.com/news/national/karnataka/bmrcl-bmtc-open-transport-data-allow-namma-yatri-tummoc-users-to-coordinate-first-last-mile-connectivity/article69797299.ece
[S100] https://www.moneycontrol.com/news/business/startup/from-bharat-taxi-to-state-run-mobility-apps-namma-yatri-piggybacks-on-govt-platforms-13716383.html
[S101] https://www.nammayatri.in/about/
[S102] https://prdlive.kerala.gov.in/news/376934
[S103] https://keralakaumudi.com/en/kerala/general/track-priyadarshini-buses-using-chalo-app-1778287
[S104] https://inc42.com/buzz/exclusive-chalo-funding-mobility-startup-raises-inr-53-cr-from-cofounders-others/
[S105] https://www.thehindu.com/news/national/telangana/rtc-should-do-more-with-gamyam-bus-live-tracking-app/article71640425.ece

Notes on verification: [S6], [S28], [S86] are secondary press re-stating primary announcements; [S41], [S93] are
third-party comparison blogs (used only for "pricing not published" and "5 M free tier earlier / lawsuit reported").
[S55] content came from a search excerpt of the Reddit thread, not a full fetch.

