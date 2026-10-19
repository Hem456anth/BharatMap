# Apple Maps v2 teardown: public behaviour, public API and the gap to Bharat Map v0.5.13

Date: 20 Oct 2026 (IST). Docs-only research; no code in this repo was changed.
Baseline read first: `README.md` (v0.5 + sprint 0.5.11, release v0.5.13), `docs/AUDIT.md`, `docs/re/FEATURE_COMPARISON.md`, `docs/re/OPPORTUNITIES.md`, `docs/re/APPLE_MAPS_APK_CHECK.md`, `docs/re/UI_UX_SPEC.md` §5.
Companion spec: `docs/re/UI_UX_SPEC_V2.md` (place-card service panels).

## 0. Clean-room rules for this document
- Everything below describes **behaviour and public API surface in our own words**. No Apple code, assets, icons, sounds, styles or verbatim product copy were copied. Short UI labels (for example "Directions", "Avoid Tolls") are quoted only to identify a control.
- No private API, no traffic interception, no binary analysis. Sources are Apple's public developer documentation, Apple's public feature and support pages, and what the public web app at maps.apple.com shows to an unsigned visitor.
- **No Apple Maps data may flow into Bharat Map.** Apple's terms forbid scraping, caching or bulk extraction of the service, and the developer agreement forbids using Apple map data to create or improve another map (see §3). This teardown informs UX and product decisions only. It is not a data source.

## 1. Evidence legend
| Tag | Meaning |
|---|---|
| **[OW]** | Observed on the public web app maps.apple.com on 20 Oct 2026 (browser in the Hark sandbox, not signed in, nothing submitted). Raw notes: `/workspace/web/notes/e39fedb7-f5dc-4f3e-bd5a-78f4294c9bdf/apple-maps-web-tu_u6l4zgfqbyl5665wxyaq46zoal/findings.md` (outside the repo). |
| **[PD]** | Public documentation: developer.apple.com docs (fetched as the docs JSON), apple.com/maps, apple.com/ios/feature-availability, support.apple.com guides, Apple legal pages. Source IDs in §2. |
| **[I]** | Inferred from [OW] or [PD]; reasoning given. |
| **[U]** | Unknown: could not be established from public sources. |
| **[B]** | Bharat Map repository (file named). |

Observation caveat [OW]: the map canvas in the sandbox browser never drew tiles (blank surface with markers only), so map styling, traffic colours, 3D and Look Around imagery on the web could not be verified visually. Search, place cards, autocomplete and the directions planner worked normally. The web app also served distances in **miles** for Indian routes (locale inferred from the browser) and has no units control.

## 2. Sources
| ID | Source |
|---|---|
| P1 | https://developer.apple.com/maps/ (overview: MapKit, MapKit JS, Maps Server API) |
| P2 | https://developer.apple.com/documentation/applemapsserverapi (endpoints, 25,000 calls/day, HTTP 429) and its child pages `-v1-token`, `-v1-geocode`, `-v1-reversegeocode`, `-v1-search`, `-v1-searchautocomplete`, `-v1-place-:id`, `-v1-place`, `-v1-place-alternateids`, `-v1-directions`, `-v1-etas`, `DirectionsAvoid`, `PoiCategory`, `Place`, `DirectionsResponse`, `EtaResponse`, `TokenResponse` |
| P3 | https://developer.apple.com/documentation/applemapsserverapi/creating-and-using-tokens-with-maps-server-api and https://developer.apple.com/documentation/mapkitjs/creating-a-maps-token |
| P4 | https://developer.apple.com/documentation/mapkitjs (namespace `mapkit`, `Map`, `Search`, `Directions`, `PlaceDetail`, `PlaceSelectionAccessory`, `PlaceSelectionAccessoryStyle`, `LookAround`, `LookAroundPreview`, `PointOfInterestFilter`, `MapFeatureType`, `Map.selectableMapFeatures`, `Map.colorScheme`, `Map.mapType`, `Annotation.clusteringIdentifier`, MapKit JS 6 release notes, Maps Embed API article) |
| P5 | https://developer.apple.com/documentation/mapkit (`MKLookAroundScene`, `MKMapItem`, `MKMapItemRequest`, `MKMapItemDetailViewController`, `MKMapView.selectableMapFeatures`, `MKMapFeatureAnnotation`, `MKStandardMapConfiguration` + `EmphasisStyle`, `MKDirections`, `MKLocalSearchCompleter`) |
| P6 | https://developer.apple.com/maps/web (MapKit JS: 250,000 map views + 25,000 service calls per day per membership; dashboard; Snapshots) |
| P7 | https://www.apple.com/maps/ (feature page) |
| P8 | https://www.apple.com/ios/feature-availability/ (Maps rows, checked for India) |
| P9 | support.apple.com iPhone User Guide, Maps chapter: offline maps (`iphcfb5f5bc6`, KB 105084), Share ETA (`iph65c86df8c`), traffic + incidents (`iphb8a99022c`, KB 105024), EV routing (`iphc5e3a4b4b`), Look Around (`iph65703a702`), guides (`iph4c213d62d`), transit (`ipha44f57caa`), walking, use Maps, Book rides (table of contents only) |
| P10 | Apple Developer Program License Agreement (developer.apple.com/support/terms) and Xcode and Apple SDKs Agreement (apple.com/legal/sla/docs/xcode.pdf): reverse-engineering clause and Apple Maps Service definitions; Apple Maps Terms of Use (apple.com/legal/internet-services/maps/terms-en.html): no scraping, no unauthorised caching, no reverse engineering |
| P11 | https://github.com/morluto/rea README and `docs/mcp-contracts.md` (REA) |
| P12 | Apple Developer Forums threads 807656, 818109 (quota behaviour; DTS reply that exceeding returns `TooManyRequests`) |

## 3. REA ("Reverse Engineer Anything") and why it does not apply here

**What REA is [PD P11].** An MIT-licensed MCP server plus CLI (`npx rea-agents setup`) that gives a coding agent local reverse-engineering tools and returns findings as "Evidence" records with stated limitations. It drives existing engines (Hopper, Ghidra, IDA, JADX, Apktool, objdump/Rizin, tshark, binwalk, adb) rather than shipping its own decompiler.

**Supported targets [PD P11]:** native binaries (pseudocode, assembly, symbols, xrefs via Hopper/Ghidra/IDA), offline ELF layout, Go and Rust build metadata, WASM, EVM bytecode, SQLite files, recorded Linux crashes, JavaScript/Electron apps (modules, source maps, IPC), websites (page structure, scripts, network observations, screenshots in a Chrome-family browser), saved HAR/SAZ network captures, .NET assemblies, **Android APKs (manifest, classes, decompiled methods via JADX)**, Android devices over adb, Android resources (Apktool), Flutter snapshots, firmware, packet captures, logic-signal recordings, packages and Apple bundle anatomy (plists, resources), and process behaviour capture.

**MCP tools seen in its contract doc [PD P11]** (names only): session and catalog (`binary_session`, `open_binary`, `close_binary`), native analysis (`analyze_function`, `compare_functions`, `trace_call_path`, `get_call_graph`, `inspect_binary_layout`, `inspect_macho`, `decode_interface_builder`), artifacts (`inspect_artifact`, `compare_artifacts`, `inspect_wasm_artifact`), JS apps (`analyze_javascript_application`, `trace_javascript_semantics`, `trace_application_feature`, `compare_application_versions`), runtime capture (`capture_browser_scenario`, `capture_process_scenario`, `compare_web_captures`), and evidence handling (`get_evidence_bundle`, `export_evidence_bundle`, `inspect_analysis_view`, `record_unknown`). Its own disclaimer limits use to lawful research, interoperability and "software you own or are authorized to examine".

**Why it is not used for Apple Maps:**
1. **No Apple Android binary exists.** Apple publishes no Apple Maps app for Android. The APK supplied as "Apple Maps" was an AppsGeyser WebView wrapper (`com.wAppleMaps_16160807`) that loads a DuckDuckGo maps search page and bundles ad SDKs; its dex files contain no MapKit or maps.apple.com code (`docs/re/APPLE_MAPS_APK_CHECK.md`). Running REA's APK tools on it would only describe AppsGeyser and ad SDKs.
2. **Apple's terms prohibit it.** The developer agreement and the Xcode/SDK agreement forbid decompiling, reverse engineering, disassembling or deriving source of Apple Software or Services, and define the Apple Maps Service to include MapKit, MapKit JS and the Maps Server API [PD P10]. The Apple Maps Terms of Use add bans on scraping, bulk extraction, unauthorised caching and reverse engineering of the service [PD P10]. A copy of the agreement also restricts using Apple map data to compare against or improve another map [PD P10, secondary copy; confirm against the current DPLA before relying on the exact wording]. REA's website-observation or network-capture tools pointed at maps.apple.com's internal traffic would fall into this territory.
3. **The legitimate sources are enough.** The public developer docs, Apple's feature and support pages, and what any visitor can see in the web app give a full picture of behaviour. That is the method used here.

Where REA *would* be legitimate for this project: inspecting Bharat Map's own APK and web bundle (for example size audits, or checking the release build for debug code), or an open-source app whose licence allows it.

## 4. India availability snapshot
From Apple's feature-availability page [PD P8], India is listed for: **Satellite, Turn-by-Turn Navigation, Traffic, Report an Incident, Preferred Route**. India is **not** listed for: Detailed City Experience, Lane Guidance, Speed Limits, Speed Cameras, Congestion Zones, Transit (directions), Transit and Payment Cards, Cycling, Look Around, AR walking directions, Flyover, Hikes/Topographic, Indoor Maps (airports, malls), Visited Places, Custom Route Creation.

What the web app shows for India [OW]:
- Restaurant, cinema and hotel place cards carry partner data (Tripadvisor or Foursquare photos and ratings, hours, phone, website), and the hotel card localises price level to ₹ symbols.
- **Secunderabad station shows a departures board** with operator pills "Indian Railways" and "MMTS", train number and name, destination, departure clock time, service exceptions, and an attribution line to Indian Railways / South Central Railway. This is a station-card feature even though India is not listed for Transit directions [I: the availability page lists routable transit, not station departures]. Whether these times are live or scheduled is [U]: the board shows absolute times and no delay tag, while the San Francisco board shows countdowns and a "Delays" tag.
- The Charminar landmark card is nearly empty (name, Directions, address).
- No Guides surfaced for Indian results; no Look Around.

**Takeaway [I]:** Apple's India depth is a partner overlay (Tripadvisor, Foursquare, Booking.com, Indian Railways) on a thinner base. Bharat Map's India-specific strengths (DIGIPIN, 11 languages, Indic search, two-wheeler routing, km units, scheduled metro journeys, offline cities) are not matched in Apple's India experience.

## 5. Screen-by-screen UI/UX inventory

### 5.1 Map canvas and floating controls
- **Web [OW]:** collapsible left rail with three entries: Search, Guides, Directions; a "Manage Your Business" link (Business Connect) at the bottom; a BETA badge next to the wordmark. Right-side stack: map type, current location, compass (shows heading, rotatable), then zoom in/out. The map-type popover offers **Standard, Hybrid, Satellite** only. No traffic toggle, no 2D/3D button, no settings, no language or units control, and no "open in app" prompt. Footer: Privacy, Terms, Legal, Imagery.
- **iOS [PD P7, P9]:** map modes Explore/Driving/Transit/Satellite on iOS (FEATURE_COMPARISON A7); a 3D control; Look Around binoculars in select cities; the profile button beside the search field opens Places, Guides, Offline Maps, Reports, preferences [PD P7 "Settings"; P9 offline + incidents steps]. A home screen of frequent places (home, work, gym, school) appears when Maps opens [PD P7].
- **Developer surface [PD P4, P5]:** map type `standard | mutedStandard | hybrid | satellite` and `colorScheme light | dark` (JS). Native has `MKStandardMapConfiguration` with elevation style and an **emphasis style `default | muted`** (muted lets app overlays stand out), a POI filter and a `showsTraffic` flag.

### 5.2 Search sheet and "Find Nearby"
- **Web [OW]:** Search opens a sheet with one combobox. Empty state is a "Find Nearby" grid of text chips: Fast Food, Gas Stations, Restaurants, Hotels, Coffee, Convenience, Groceries. There are no recents in the empty state; recents appear later as a rail in the sidebar once a place has been opened. Deep links of the form `/search?q=` hit an unsupported-browser gate in the sandbox; typing in-app works.
- **iOS [PD P7]:** filters such as cuisine, price, takeout and **open now**; results **update as the map moves**; Nearby categories; results shown as coloured badges on the map.

### 5.3 Autocomplete
- **Web [OW]:** two-line rows (title; locality, region, country) with a type icon: place pin, "Search Nearby" query row (magnifier), category icon for businesses, and a highlighted top-hit row. No distance on landmark rows; distance and street address appear for distance-rankable businesses. In San Francisco, rows can carry a "Featured in N Guides" pill; none in India. The query "Charminar Hyderabad" also returned an unrelated US restaurant, which shows the ranking is global, not India-biased [OW, I].
- **API [PD P2, P4, P5]:** `/v1/searchAutocomplete`, `mapkit.Search.autocomplete`, `MKLocalSearchCompleter`. Filters: include/exclude POI categories, address categories, `resultTypeFilter` (POI, address, physical feature, query), `limitToCountries`, `searchLocation`/`searchRegion` hints with `searchRegionPriority`, `userLocation`, `lang`.

### 5.4 Place card
Generic anatomy, assembled from what is shown [OW] and documented [PD P7]:
1. **Header:** name; category; a **contained-place chip** linking to the parent (mall, neighbourhood, city).
2. **Live-state ribbon:** hours state (Open/Closed), cost (price level, ₹ in India), accepted payments.
3. **Action row:** Directions (primary) plus, when known, Call, Website, **Book** (hotels) and a More menu (for example "Claim This Place", or "Shows" linking to Apple's events service for venues in the US).
4. **Photos:** carousel; every tile labelled with its provider and sometimes a subject (Exterior, Interior, Atmosphere).
5. **Departures** (stations only): operator pills, then rows; attribution footer.
6. **Ratings & Reviews:** aggregate score + count with provider link-out; review snippets. In the US, Apple's own percentage rating can appear next to Yelp, Foursquare and Tripadvisor scores.
7. **About:** short description with a link-out to Wikipedia.
8. **Good to Know:** amenity list (wheelchair access, parking types, Wi-Fi, payment types, AC, pool and so on), collapsible.
9. **Featured in Guides** (US): curated guide tiles.
10. **Also at This Location:** co-located businesses or facilities (for example tenants, or toilets at a station).
11. **Details:** hours table, website, phone, address (address links to directions), "More on <provider>".
12. iOS-only additions [PD P7]: Look Around/Flyover launch, rent a bike, pay for parking, order food, and chat with the business; editing business info from the card.

Per type, observed [OW]:
| Card | Sections and actions seen | Missing |
|---|---|---|
| Charminar (landmark, IN) | name, Directions, address | category, photos, hours, rating, About, Share, Report |
| Paradise (restaurant, IN) | category; Closed ribbon; Directions/Call/Website/More (Claim This Place); Tripadvisor photos and 4.1 rating with snippets; hours, website, phone, address | menu, order, reserve, delivery, price level |
| PVR (cinema, IN) | category + mall chip; Directions/Call/Website; Tripadvisor + Foursquare photos; Foursquare 3.8 rating; Good to Know (contactless, wheelchair, parking, AC, cash) | showtimes, tickets, hours |
| Secunderabad (station, IN) | category; Directions only; **Departures** (Indian Railways / MMTS pills, train no., name, destination, time, exceptions, attribution); Foursquare photos; About + Wikipedia | tickets, platform, live delay |
| Taj Krishna (hotel, IN) | category; ₹₹₹₹ cost; Directions/Call/Website/**Book**/More; Book opens a **provider picker that links out** to Booking.com and Tripadvisor (no prices shown); Tripadvisor photos and 4.7 rating; amenities | rates, availability, in-app booking |
| Ferry Building (landmark, US) | category + city chip; Open ribbon; Accepts row; Directions/Call/Website/More (Shows); About; Good to Know; Featured in Guides; Also at This Location with mixed rating providers; full details | Share on card |
| Powell St (subway, US) | Directions only; Departures with Muni Metro/BART pills, per-line rows with two countdowns, a "Delays" tag; Also at This Location (public toilets); Good to Know | tickets |
| Dropped pin | reverse-geocoded address as title, "Marked Location", single **Add Stop** action, "At This Address" businesses, Remove; pin added to recents | Share, Save, Report |

**Developer surface [PD P2, P4, P5]:** a stable opaque **Place ID** with `alternateIds` (`/v1/place/{id}`, `/v1/place?ids=`, `/v1/place/alternateIds`); MapKit JS `PlaceLookup`/`getPlace`, `PlaceDetail` (an embeddable interactive place card with `colorScheme` and `displaysMap`), `PlaceSelectionAccessory` (styles: automatic, callout, compact callout, full callout, open-in-Maps), the no-code **Maps Embed API** (an iframe snippet built from a Place ID and token); native `MKMapItemRequest` (from a tapped map feature or an identifier) and `MKMapItemDetailViewController`, which is presented modally, cannot be subclassed and has a private view hierarchy. **The structured Place object in the Server API carries name, coordinate, display region, formatted and structured address, country and IDs only** [PD P2]: hours, photos, ratings and amenities are rendered by Apple's own card views and are not exposed as raw fields [I].

### 5.5 Directions planner
- **Web [OW]:** modes **Drive, Walk, Cycle** only (no Transit, in India or San Francisco). From/To comboboxes with drag handles, Add Stop, a time pill (Leave at / Arrive by, a date picker with past days disabled, time field), an Avoid pill (**Avoid Highways, Avoid Tolls**). Up to 3 alternatives, each with duration, clock ETA, distance and a label ("Fastest", "Fewer turns"). A Route Details drill-in lists steps (distance + instruction, roundabout exit numbers, keep left/right). There is no "Start" on the web. Cycling in San Francisco adds per-route climb and a lane-quality subtitle, per-step tags (bike path, protected lane, bike lane, shared road) and a total-elevation profile; none of this appeared for India. Indian routes were in miles.
- **iOS [PD P7, P9]:** driving, walking, transit, cycling and rideshare travel modes; ETAs for future departures "based on expected traffic"; up to 15 stops (FEATURE_COMPARISON A9); EV routing with charge-aware stops for compatible vehicles; send a list of directions to yourself before losing signal.
- **API [PD P2]:** `/v1/directions` takes `transportType` **Automobile | Walking | Cycling** (default Automobile), `avoid` with a single documented value **Tolls**, `departureDate` *or* `arrivalDate`, `requestsAlternateRoutes`, `lang`, location hints. The response returns routes that index into shared `steps` and `stepPaths` arrays and flags `hasTolls` per route. `/v1/etas` accepts **Automobile | Transit | Walking | Cycling** and several destinations separated by `|`. JS `DirectionsRequest`: origin, destination, arrival/departure date, alternates, transport type, `avoidTolls`, `AbortSignal`.

### 5.6 Turn-by-turn navigation (iOS only)
[PD P7, P9] Spoken turn-by-turn; real-time traffic; speed limits and speed cameras where available; a 3D road-level view at complex junctions; lane guidance; incident reporting by button or voice ("there's an accident up ahead"); Share ETA from the route card; find stops along the route; route overview and list of turns; walking guidance mentions stairs; AR walking guidance on supported iPhones; haptics on Apple Watch; CarPlay. **None of this exists on the web app or in MapKit JS** [OW, I]; MapKit JS returns route steps and Apple's doc says "your app can supply step-by-step navigation" [PD P4], meaning the developer must build guidance, voice and rerouting.

### 5.7 Transit
[PD P7, P9] Transit directions with departure times, connections and fares; nearby departures; pinned lines; alerts when approaching your stop; transit cards in Wallet in some regions. [OW] On the web, transit appears only as station-card departures; there is no transit routing. For India, Apple lists no Transit directions [PD P8].

### 5.8 Guides and collections
[PD P7, P9] Editorial Guides from partner publishers (nearly 1,000, auto-updating), user-created custom guides that can be shared, "Featured in Guides" on place cards. [OW] Guides entry in the web rail; no Indian guides surfaced in results.

### 5.9 Sharing
[PD P9] Share ETA with contacts during driving, walking or cycling navigation; automatic ETA sharing to a pinned place; recipients get a Maps notification and can follow progress; sharing stops on arrival or manually. Share places from the card (iOS). [OW] The web app showed **no Share control** on any card or for dropped pins; sharing on the web is the page URL [I].

### 5.10 Settings / profile
[PD P7, P9] Profile button opens Places (pinned, recents), Guides, Offline Maps, Reports, preferences (default travel mode, units, spoken-direction settings, avoid options), clear location history and delete recent directions. [OW] The web app has no settings at all.

### 5.11 Offline maps (iOS 17+)
[PD P9] Download an area (long-press → Download, from a place card, or Profile → Offline Maps); adjustable area with **size shown before download**; place cards keep hours and ratings offline; turn-by-turn for driving, walking, cycling and transit with ETAs offline; automatic updates on by default; Wi-Fi-only downloads; "optimize storage" deletes unused maps; an "only use offline maps" switch; maps do not sync across devices; not available in all regions.

### 5.12 Report an issue / incident
[PD P7, P9] Incidents: crash, speed check (roadwork instead in mainland China), traffic, roadwork, hazard, road closure; reported by button, CarPlay or voice; Apple shows them to others only when confidence is high, and users can report an incident as cleared. Place issues are edited directly from the card. [OW] Not on the web app (only "Claim This Place").

### 5.13 Look Around, 3D, Flyover, Detailed City
[PD P7, P9] 360° street-level panoramas in select cities (pan, tap to move, pinch, full screen, hide labels); Flyover photo-realistic 3D; detailed city experience with elevation, trees, crosswalks and turn lanes (cities listed are outside India); interactive globe; 3D satellite. **Developer:** `MKLookAroundScene` (fetched for a coordinate or map item) feeds a Look Around view; MapKit JS `LookAround` and `LookAroundPreview` must be loaded as a separate library, and they emit `load`, `error` (unsupported browser or no imagery), `readystatechange`, `open-dialog`, `leave-dialog`, `close` [PD P4, P5]. None in India [PD P8].

### 5.14 Accessibility
[PD P9] Walking guidance mentions stairs; Watch haptics for turns; VoiceOver exploration of the map with a rotor for zoom and points of interest and audio "follow the road" (described in Apple's VoiceOver guide; we read it in a third-party copy, so treat the detail as [PD, secondary]). [OW] The web app exposes ARIA roles for its comboboxes, options and radio groups; no audit was done.

## 6. Gestures, camera and 3D
| Behaviour | Apple | Evidence | Bharat v0.5.13 |
|---|---|---|---|
| Pan, pinch zoom, rotate, two-finger tilt, one-finger zoom | yes | [PD] earlier report A5 | ✅ MapLibre handlers tuned (AUDIT v0.4) |
| Long-press / hold to drop a pin → reverse-geocoded card | yes; web uses a ~1.5 s mouse hold | [OW] | ✅ long-press/right-click pin with DIGIPIN |
| Compass shows heading; tap resets north | yes | [OW] | ✅ |
| 3D buildings / pitched view | yes, plus 3D landmarks in select cities | [PD P7] | ✅ OSM heights, default height labelled |
| Junction 3D road-level view | yes, select regions | [PD P7] | 🟡 schematic SVG junction view |
| Look Around / Flyover | select cities, not India | [PD P8] | ⛔ (no imagery; SoI street-view rules) |
| Camera follows route with bearing and pitch | yes (iOS) | [PD P9] | ✅ |
| Web map: wheel zoom without Shift (MapKit JS 6) | yes | [PD P4] | ✅ MapLibre default |
| Reduced motion | system setting | [PD] | ✅ `prefers-reduced-motion` honoured |

## 7. Feature dependencies and limitations
| Capability | Depends on | Limitation |
|---|---|---|
| **MapKit JS** | Apple Developer Program membership; a token (static domain-restricted token from the dashboard, or a dynamically signed JWT with scope `mapkit_js` and an `origin`) | **No turn-by-turn guidance, voice or rerouting**: it returns routes and steps only. Directions transport types exclude transit for routing. Look Around needs a separate library load and fails on unsupported browsers or where there is no imagery. MapKit JS 6 needs CORS-clean images [PD P3, P4]. |
| **Maps Server API** | ES256 JWT signed with a Maps private key: header `alg`, `kid`, `typ`; claims `iss` (Team ID), `iat`, `exp`, `scope` (`server_api`), optional `origin`; exchanged at `/v1/token` for an access token with `expiresInSeconds` | Directions: Automobile/Walking/Cycling only; the only documented avoid value is Tolls. ETAs add Transit. Responses hold IDs, addresses and geometry; no hours, ratings or photos [PD P2, P3]. |
| **Quotas and price** | Per developer membership | **250,000 map views and 25,000 service calls per day**, shared between MapKit JS and the Server API. Over quota → HTTP 429 / `TooManyRequests`; more capacity by request form; no public paid tier [PD P2, P6, P12]. Native MapKit has no per-call fee but has per-device rate limits [PD P12, forum]. |
| **Licence** | DPLA / Xcode SDK agreement, Maps Terms | Apple map data is for use in your app with Apple's map; no scraping, bulk download, unauthorised caching or reverse engineering; no use to build or improve another map [PD P10]. **For Bharat Map this rules out Apple as a data source and as a backend for an open, offline, India-hosted product** [I]. |
| **Place cards** | Apple's partners (Tripadvisor, Foursquare, Yelp, Booking.com, Wikipedia, operators) | Coverage varies sharply by country and place; Indian landmarks can be bare [OW]. |
| **Booking / ordering** | Partner deep links and, on iOS, app extensions | Web "Book" for hotels is a provider picker that leaves Apple Maps; no prices or availability in the card [OW]. |
| **Transit** | Operator feeds | Not routable in India [PD P8]; station boards exist [OW]. |
| **Offline** | iOS 17+, supported regions | Not available in all countries [PD P9]; India availability [U]. |
| **EV routing** | Compatible vehicle via CarPlay or maker app | Select vehicles and areas; real-time charger availability only for some providers and countries [PD P9]. |
| **Privacy** | On-device personalisation, rotating identifiers | Maps has no sign-in; history is not tied to the Apple Account [PD P7]. |

## 8. Public API inventory
| Surface | Item | What it does | Notes |
|---|---|---|---|
| Server API | `GET /v1/token` | Exchange a signed JWT for a Maps access token | `accessToken`, `expiresInSeconds` |
| Server API | `GET /v1/geocode` | Address → coordinates | lang, country limits, location hints |
| Server API | `GET /v1/reverseGeocode` | Coordinates → addresses | |
| Server API | `GET /v1/search` | Place search | `q`, include/exclude `PoiCategory`, address categories, `resultTypeFilter`, `limitToCountries`, region hints, pagination (`enablePagination`, `pageToken`) |
| Server API | `GET /v1/searchAutocomplete` | Type-ahead | same filters as search |
| Server API | `GET /v1/place/{id}`, `GET /v1/place?ids=` | Place by ID / batch | `PlacesResponse` with lookup errors |
| Server API | `GET /v1/place/alternateIds` | Alternate IDs for IDs | supports ID migration |
| Server API | `GET /v1/directions` | Routes and steps | Automobile/Walking/Cycling; `avoid=Tolls`; arrival or departure date; alternates; `hasTolls` per route |
| Server API | `GET /v1/etas` | ETA + distance to many destinations | adds Transit; `departureDate`/`arrivalDate`; maximum destinations [U] |
| Server API | `PoiCategory` | 77 category strings | includes ATM, EVCharger, GasStation, Hospital, Hotel, MovieTheater, Parking, Pharmacy, PublicTransport, Restaurant, Restroom, Store… (no "temple" or "kirana": `ReligiousSite`, `FoodMarket`) |
| MapKit JS | `mapkit.load` / `init` | Load libraries; token callback | v6: promises, standard `EventTarget`, `AbortSignal`, TypeScript defs |
| MapKit JS | `Map` | Map view | `mapType`, `colorScheme`, `pointOfInterestFilter`, `selectableMapFeatures` (`PointOfInterest`, `PhysicalFeature`, `Territory`), padding, camera zoom range |
| MapKit JS | Annotations | `MarkerAnnotation`, `ImageAnnotation`, `PlaceAnnotation`, `MapFeatureAnnotation` | `clusteringIdentifier` clusters colliding annotations; collision mode; display priority |
| MapKit JS | Overlays | circle, polyline, polygon, `TileOverlay` (`imageForTile`), `LineGradient`, `importGeoJSON` | indoor-map example from GeoJSON |
| MapKit JS | `Search` | search + autocomplete | `PointOfInterestFilter`, `AddressFilter`, region priority |
| MapKit JS | `PointsOfInterestSearch` | POIs in a region | |
| MapKit JS | `Geocoder` | lookup / reverse lookup | |
| MapKit JS | `Directions` | `route`, `eta` | `DirectionsRequest` with `avoidTolls`, `requestsAlternateRoutes` |
| MapKit JS | `PlaceLookup`, `getPlace`, `PlaceDetail`, `PlaceSelectionAccessory` | Place ID lookup, embeddable place card, annotation callouts | accessory styles: automatic, callout, compact callout, full callout, open in Maps |
| MapKit JS | `LookAround`, `LookAroundPreview`, `LookAroundScene` | street-level views | separate library; navigation/zoom/scroll toggles; POI and road labels; badge position; dialog mode |
| Embed | Maps Embed API | iframe place card + map from a Place ID | token type "Embed API" |
| Web Snapshots | static map images | token type "Web Snapshots" | |
| MapKit (native) | `MKMapView` + `selectableMapFeatures`, `MKMapFeatureAnnotation` | tap Apple POIs, territories, physical features | |
| MapKit (native) | `MKStandardMapConfiguration` | elevation style, **emphasis default/muted**, POI filter, traffic | |
| MapKit (native) | `MKMapItem`, `MKMapItemRequest`, `MKMapItemDetailViewController` | identifier + alternate identifiers, phone, URL, time zone, category; open in Maps with launch options; modal detail card | detail view is not subclassable |
| MapKit (native) | `MKLocalSearch`, `MKLocalSearchCompleter` | search, completions | result types, filters, region priority |
| MapKit (native) | `MKDirections` | driving/walking directions, ETA | |
| MapKit (native) | `MKLookAroundScene` (+ scene request) | Look Around data for a coordinate or item | |
| Auth | Maps ID + private key; static tokens | per-scope tokens: `mapkit_js`, `server_api`, `embed_api`, `web_snapshots` | domain restriction, expiry options, revoke |

## 9. Feature comparison with Bharat Map v0.5.13
Bharat marks: ✅ implemented, 🟡 partial/prototype, 🔌 needs a partner/server/key, ⛔ not planned, — absent [B README, AUDIT].

| Area | Apple (best surface) | Apple in India | Bharat v0.5.13 | Verdict |
|---|---|---|---|---|
| Map styles | Standard/Hybrid/Satellite; muted emphasis; dark | Satellite listed [PD] | Automatic/Standard/Dark; night nav style; no satellite (licence) | Apple ahead on imagery |
| Search & autocomplete | global, filters, map-follow results | global ranking, unrelated US hits [OW] | Photon + offline index of 86,977 places, Latin↔Indic transliteration, pincode, DIGIPIN | **Bharat ahead for India** |
| Category entry | Find Nearby (7 chips web) | same | 12–13 India chips | Bharat ahead (India set) |
| Place identity | opaque Place ID + alternate IDs, embed | yes | OSM element in links; no stable ID scheme or ID migration | **Gap** |
| Place card: core details | hours, phone, website, address, amenities | partner-dependent | OSM hours → open/closed, phone, website, wheelchair, DIGIPIN, EV and parking details | parity on fields, Bharat lacks structure |
| Place card: photos/About | partner photos, Wikipedia | yes for businesses | — | **Gap** |
| Ratings & reviews | partners + own % ratings | Tripadvisor/Foursquare | seeded demo rating only (Shop) | **Gap** |
| Contained place / also here | parent chip, "Also at This Location", "At This Address" | yes (PVR → mall) | — (D7/#24 planned) | **Gap** |
| Station departures | operator pills, live/scheduled board | Indian Railways + MMTS board [OW] | metro itineraries (scheduled HMRL GTFS); no per-station board | **Gap** (data already in repo) |
| Book / order | Book picker (hotels), Shows, order food / pay parking (iOS) | hotel Book link-outs | Shop demo: seller → cart → order → rider tracking (fictional) | Bharat has the flow, not real partners |
| Ride hailing | rideshare mode + app extensions (iOS) | [U] | — (D12 planned) | **Gap** |
| Directions modes | drive/walk/cycle/transit/rideshare (iOS); web D/W/C | drive/walk; cycling not listed | drive, **two-wheeler**, cycle, walk, metro (scheduled) | Bharat ahead for India |
| Time-based routing | leave at / arrive by with expected traffic | yes (traffic listed) | — for road; transit planner takes a time | **Gap** (needs traffic history 🔌) |
| Avoid options | tolls, highways | yes | tolls, highways (Valhalla) | parity |
| Alternatives & labels | 3 routes, "Fastest", "Fewer turns" | yes | up to 3, selectable | close; add route labels |
| Cycling detail | elevation profile, climb, lane quality | not in India | — | Gap (needs DEM + OSM cycleway) |
| Turn-by-turn | full, CarPlay | yes | ✅ voice en/hi/te + Indic voice picker, lanes, speed limit, junction view, road hints, reroute | Bharat strong; no live traffic |
| Traffic | real-time | yes | — 🔌 | Apple ahead |
| Incidents | report + confidence + cleared | yes | ✅ 4 types, 2-hour expiry, votes | parity in model |
| Share ETA | contacts, auto to pinned places | [U] | live location link (server) 🔌; no ETA payload | **Gap** (small) |
| Guides | editorial + custom, shareable | none seen | lists shared as links | Gap on curated content |
| Offline | areas with size, auto-update, offline routing + place cards | [U] | 11 cities bundled + region manager; offline search; **routing offline is straight-line** | Gap on offline routing |
| Look Around / 3D city | select cities | no | ⛔ | Not pursued |
| Accessibility | VoiceOver map exploration, haptics | — | ARIA, TalkBack labels (not device-tested) | Gap: device audit |
| Privacy | no sign-in, rotating IDs | — | no ads/analytics SDKs, DPDP dashboard | parity / Bharat ahead on openness |
| Units / language | system-driven; web showed miles in India | — | km, 11 UI languages | Bharat ahead |

## 10. Prioritised gap roadmap: place card → services → book/order → track
Ranking: user impact in India first, then lower effort; effort S ≤ 2 days, M ≤ 2 weeks, L longer. Every item uses open data, official feeds, open protocols or link-outs; nothing uses Apple data.

| # | Gap | Stage | Impact / effort | What to build (open route) |
|---|---|---|---|---|
| 1 | **Service-panel framework on the place card** with honesty labels (Live, Scheduled, Estimate, Link-out, Unavailable) and states (loading, no integration, offline) | place card | H / M | `UI_UX_SPEC_V2.md`. One panel slot between the action row and Details, chosen by OSM tags; one provenance footer per panel |
| 2 | **Stable place identity**: `osm:<type>/<id>` as the primary key, plus Wikidata QID and an optional Overture GERS ID as alternates; redirect table when OSM objects are merged or split | place card | H / S–M | Mirrors the Place ID + alternate-ID idea. Needed for saved places, shares, reviews and orders to survive OSM edits |
| 3 | **Station/stop panel with scheduled departures** (HMRL first; TGSRTC/MMTS as feeds arrive), line pills, "Scheduled" label, service exceptions, attribution | services | H / S | Reuse `server/transit` GTFS + `shared/transit/raptor.js`; on device from the packed timetable. GTFS-RT ingest behind a flag (D10) |
| 4 | **Header ribbon + Good to know** from OSM: open state, `payment:upi`, `payment:cash`, `wheelchair`, `air_conditioning`, `delivery`, `takeaway`, `parking`, `toilets`, `internet_access` | place card | H / S | Extend `web/ui/place.js`; only show tags that exist; "Not mapped" otherwise |
| 5 | **Contained place and "Also here"**: parent chip (mall, campus, station) and children (shops, gates, toilets, platforms) | place card | M / M | Overpass `is_in` / area containment and child `entrance=*`, `amenity=toilets` (merges D7 and #24) |
| 6 | **Photos and About with attribution**: Wikidata image, Wikimedia Commons, Wikipedia extract in the user's language when present, Panoramax later | place card | M / S–M | Licence and author shown on every image; hidden when none |
| 7 | **Reviews and ratings** via Mangrove (open, CC-BY data keyed by geo URI) with report/blocklist | place card | M / M | D15; label the source; never mix demo ratings with real ones |
| 8 | **Book / reserve link-out picker** (hotel, cinema, restaurant, venue, train): only official or partner URLs that OSM `website`/`reservation:url` or the operator publishes; IRCTC for trains | book/order | H / S | Matches Apple's Book-picker pattern honestly: "Opens <site>", no prices unless a partner API supplies them |
| 9 | **Order from a place, then track**: connect the Shop flow to the place card ("Order from here" for demo sellers today), then a real path through ONDC (retail, food, grocery) as a buyer app; tracking card reuses SSE rider tracking | book/order → track | H / L | Demo stays labelled "Demo"; ONDC requires registration and a network participant agreement 🔌 |
| 10 | **Ride panel** (auto, cab, bike taxi): ETA and route preview from Bharat routing (Estimate), then hand-off to ONDC mobility (Namma Yatri is open source) or installed apps by documented intents; trip tracking via the shared live-location link | services → track | H / M–L | D12; never show fares without a partner quote |
| 11 | Share ETA (add ETA and arrival auto-stop to the existing live-location link) | track | M / S | `server/community.js` live endpoint + nav ETA |
| 12 | Leave-at / arrive-by for road routes, labelled "typical, no live traffic" | services | M / M | Valhalla `date_time`; only real once historic speeds exist 🔌 |
| 13 | Route labels ("Fastest", "Fewest turns", "Avoids tolls") and cycling elevation profile | services | M / S–M | Valhalla `elevation_interval` with an open DEM (SRTM/Copernicus GLO-30, check licence) |
| 14 | Offline routing (D21) so offline cards can still route | services | H / L | Valhalla graph build exists; on-device engine missing |

**Top 10 for the next sprint planning:** #1, #2, #3, #4, #8, #5, #6, #10, #9, #7 (ordered so each step makes the next one possible: panels and identity first, then content, then link-outs, then transactions and tracking).

## 11. Things not to copy
- Apple Maps data in any form (tiles, place details, ratings, departures, geometry), including "for comparison" [PD P10].
- Apple brand assets, SF Symbols, the Apple Maps colour palette, its place-card layout pixel for pixel, its sound cues or wording.
- Partner-licensed content Apple shows (Tripadvisor, Foursquare, Yelp, Booking.com): Bharat may link out to public pages, but must not ingest that content without its own licence.
- Look Around-style street imagery collection in India without an Indian entity and the DST guidelines check (`GMAPS_HERE_TEARDOWN.md` §6).

## 12. Unknowns
- Whether Indian Railways/MMTS departures on Apple's station card are live or scheduled [U].
- Offline-maps availability in India on iOS [U].
- `/v1/etas` maximum number of destinations per request [U].
- iOS-only place-card actions in India (order food, pay parking, rideshare) [U]: not observable without an iPhone.
- Map rendering details on the web (tiles failed to draw in the sandbox) [U].
