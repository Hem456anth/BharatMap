# Bharat Maps: behaviour-level teardown of Apple Maps and AMap Global

Research date: 18 Oct 2026. Method: REA "observe → understand → recreate → verify" (https://github.com/morluto/rea), applied **only at the behaviour and UI level**.

## 0. Scope, boundary and evidence rules

**Boundary.** Apple Maps and AMap Global (高德地图 international build) are proprietary, closed apps. For this report:
- No binaries, APKs or IPAs were downloaded, decompiled or inspected.
- No code, icons, assets, map tiles, brand names or UI copy were copied.
- Every observation comes from public documentation, official product pages, store listings and press.

The "recreate" step (UI_UX_SPEC.md) is an **original** design that learns from these behaviours and imitates neither app's look.

**Evidence tags**
| Tag | Meaning |
|---|---|
| **[O]** | Observed: stated in a page that was fetched and read for this report |
| **[O-x]** | Observed in a search-result excerpt only. The full page was not opened, so treat it as weaker. |
| **[I]** | Inference: our reading of the behaviour, not stated by the vendor |
| **[U]** | Unknown: no public source found |

### 0.1 Source index
**Apple**
| # | Source |
|---|---|
| A1 | HIG – Maps: https://developer.apple.com/design/human-interface-guidelines/maps |
| A2 | HIG – Sheets (detents, grabber): https://developer.apple.com/design/human-interface-guidelines/sheets |
| A3 | apple.com/maps product page: https://www.apple.com/maps/ |
| A4 | Support – Get driving directions: https://support.apple.com/guide/iphone/get-driving-directions-ipha84a94043/ios |
| A5 | Support – Explore maps with immersive views (gestures, 3D): https://support.apple.com/guide/iphone/explore-maps-with-immersive-views-ipha937272d1/ios ; older version https://support.apple.com/en-in/guide/iphone/iph10d7bdf26/17.0/ios/17.0 |
| A6 | Support – Offline maps: https://support.apple.com/en-us/105084 and https://support.apple.com/guide/iphone/download-offline-maps-iphcfb5f5bc6/ios |
| A7 | Support – Report an incident: https://support.apple.com/en-us/105024 ; traffic: https://support.apple.com/guide/iphone/check-traffic-conditions-report-incidents-iphb8a99022c/ios |
| A8 | Newsroom, iOS 15 Maps (3D cities, AR walking): https://www.apple.com/newsroom/2021/09/apple-maps-introduces-new-ways-to-explore-major-cities-in-3d |
| A9 | Newsroom, iOS 16 (multistop, transit fares): https://www.apple.com/newsroom/2022/09/ios-16-is-available-today/ |
| A10 | Newsroom, iOS 18 Maps (hikes, custom walking routes, Places Library): https://www.apple.com/newsroom/2024/09/apple-maps-introduces-new-ways-to-explore-the-world |
| A11 | Newsroom, iOS 26 services (Preferred Routes, Visited Places): https://www.apple.com/newsroom/2025/06/apple-services-deliver-powerful-features-and-intelligent-updates-to-users-this-fall |
| A12 | Apple Privacy – Features (random identifiers, fuzzing): https://apple.com/privacy/features |
| A13 | Apple Business Connect: https://business.apple.com/docs/onboarding-guide/place-card ; https://www.apple.com/au/newsroom/2023/01/introducing-apple-business-connect/ |
| A14 | App Store listing "Maps": https://apps.apple.com/ca/app/maps/id915056765 |
| A15 | Mac Maps keyboard shortcuts and gestures: https://support.apple.com/guide/maps/keyboard-shortcuts-and-gestures-mps36380d1ed/mac |
| A16 | 9to5Mac on Visited Places (E2E encryption): https://9to5mac.com/2026/03/19/ios-26s-new-apple-maps-feature-has-quickly-become-a-favorite |

**AMap**
| # | Source |
|---|---|
| B1 | Google Play – AMap Global (fetched 18 Oct 2026, updated 11 Oct 2026): https://play.google.com/store/apps/details?id=com.autonavi.minimap&hl=en_US |
| B2 | App Store India – AMap Global: https://apps.apple.com/in/app/amap-global/id461703208 |
| B3 | China Daily, English version launch (Jan 2025): https://www.chinadaily.com.cn/a/202501/23/WS679200b3a310a2ab06ea8f0c.html |
| B4 | People's Daily, multilingual version (Jul 2025): https://en.people.cn/n3/2025/0714/c90000-20339734.html |
| B5 | China Daily, traffic-light countdown going abroad (May 2026): https://www.chinadaily.com.cn/a/202605/20/WS6a0d9aaaa310d6866eb49c3a.html ; Pandaily: https://pandaily.com/alibaba-amap-traffic-light-countdown-global-expansion-8530 |
| B6 | AMap open platform – Route planning 2.0 web API: https://lbs.amap.com/api/webservice/guide/api/newroute |
| B7 | AMap Navigation SDK for iOS – Navigation Events: https://lbs.amap.com/api/navigation-sdk-for-ios/guide/navigation-map/navi-info |
| B8 | Global Times on Chinese map-app features (Mar 2026): https://www.globaltimes.cn/page/202603/1356359.shtml |
| B9 | Shanghai gov, multilingual services (Jul 2026): https://english.shanghai.gov.cn/en-EasyShanghai/20260713/379bcea6e1bd4defaa7db2451d68d3dd.html |
| B10 | Alibaba "Street Stars" (via existing dossier `docs/RESEARCH.md` §1.4): https://www.alibabagroup.com/en-US/document-1902406454384525312 |

---

## Part A — Apple Maps

### A.1 Interface structure
- **Map-first layout.** The map is full-bleed. HIG asks apps to "make your map interactive" and not cover it with non-interactive elements. [O A1]
- **Card / sheet over the map.** HIG's legal-link guidance refers to "a custom card from the bottom of the screen", with a "lowest resting position". [O A1]
  - Sheets rest at **detents**: the system defines *large* (full) and *medium* (about half), and custom detents are allowed. [O A2]
  - A **grabber** shows the sheet is resizable. Tapping the grabber **cycles through detents**, and it works with VoiceOver. [O A2]
  - Swiping vertically dismisses the sheet. [O A2]
  - The Maps app's home card has a third, collapsed "search bar only" resting height. [I] This is a common observation and is not stated in A1/A2.
- **Selection.** Selected elements get distinct styling (outline plus colour). Overlapping POIs **cluster** and expand as you zoom. [O A1]
- **Place cards** come in callout, compact, caption or sheet style. On iOS the full place card is presented **as a sheet**. Keep the selected location visible while the card is open. [O A1]
- **Map modes.** A "Map Modes" button switches Explore / Driving / Transit / Satellite. [O-x A7 support excerpt]
- **Emphasis styles.** There is a *default* (saturated) style and a *muted* (desaturated) style for data-heavy overlays. [O A1]
- **Account entry.** Your picture or initials sit next to the search field. This opens Offline Maps, Reports and other settings. [O A6, A7]

### A.2 Gestures
| Gesture | Behaviour | Source |
|---|---|---|
| Drag | Pan | [O A5] |
| Pinch | Zoom | [O A5] |
| Double-tap, hold, then drag up or down | One-finger zoom in/out | [O A5] |
| Two-finger rotate | Rotate. Compass button restores north-up. | [O A5] |
| Two-finger drag up | 2D → 3D tilt. Drag up/down adjusts the angle. | [O A5] |
| Zoom fully out | Map becomes an interactive 3D globe | [O A3, A5] |
| Touch and hold the map | Drops a pin, offering Directions / Download | [O A4, A6] |
| Mac: Option + double-click | Zoom out; Shift-Cmd-D drops a pin at the centre | [O A15] |
| Two-finger tap to zoom out | [U] on iPhone; not in fetched sources | — |

### A.3 Search and autocomplete
- Search uses **filters**: cuisine, price range, takeout, "open now". **Results update automatically when the map is moved.** [O A3]
- **Nearby** offers one-tap categories: Restaurants, Gas Stations, Coffee, Hotels, Bars, Fast Food, Groceries, Shopping Centers. Results show on the map as coloured badges. [O A3]
- HIG recommends combining search with category filters. [O A1]
- Autocomplete ranking signals: [U]. On-device personalisation is described only in general terms. [O A12]

### A.4 Place cards
- **Basics:** address, hours, website, phone. [O A3]
- **Details:** price range, photo galleries, associated Guides, accepted payments, even whether pets are allowed. [O A3]
- **Launchers:** Flyover / Look Around. [O A3]
- **Transactions:** rent a bike, pay for parking, order food. [O A3] Reservations and menus are also available. [O-x A14]
- **Business-managed content** through Business Connect: photos, logo, cover image, action buttons such as ordering food or reserving, "Showcases" offers, events, and Good-to-Know attributes. [O A13]
- **Ratings and photos:** users can rate places and add photos. [O-x A14] Ratings appear as an overall % with per-aspect breakdowns. [O-x maps.apple.com place-page excerpt]
- **Edits:** users can edit and submit business info from the card. [O A3]

### A.5 Routing
- **Modes:** driving, walking, transit, cycling, rideshare. [O-x A4 support index]
- **Driving routes** are listed with time and distance, a **Go** button, and **traffic colour-coding per route** (alternatives shown side by side). [O A4]
- **Options sheet:** "Leave at / Arrive by" with predicted-traffic ETA, and **Avoid tolls / Avoid highways**. [O A4]
- **Multistop:** up to 15 stops (iOS 16). [O A9]
- **Preferred routes:** routes learned on-device between frequent places (iOS 26), with delay alerts before you leave. Can be switched off in Settings. [O A4, A11]
- **EV routing:** factors in charge level and elevation, adds charging stops, and shows live availability for some providers. [O A3, A4 index]
- **Cycling:** elevation profile, steep-incline and stairs warnings, avoids busy roads. [O A3]
- **Walking:** custom walking routes and US national-park hikes, filterable and downloadable (iOS 18). [O A10]

### A.6 Turn-by-turn guidance
- **Lane guidance** for turns and exits. [O A3]
- At complex intersections the view switches to a **3D road-level perspective**. [O A3]
- **Speed limits and speed cameras.** Compass and speed-limit display can be toggled. [O A3, A4]
- **Spoken directions** have their own settings page. [O-x A4 index] They keep speaking with the phone locked or another app open. A **banner** returns you to Maps. [O A4]
- **Share ETA.** [O-x A4 index]
- **Incident reporting** while navigating: Crash, Speed Check, Traffic, Roadwork, Hazard, Road Closure. Users can confirm "Cleared / Still Here". Apple shows reports only when confidence is high. [O A7]
- **Rerouting** behaviour, thresholds and copy: [U]. Automatic rerouting on deviation is assumed. [I]
- **Arrival:** parked-car location and directions to the parked car. [O A3, A4 index] Arrival UI details: [U]

### A.7 2D/3D rendering and landmarks
- **Detailed city experience** (select cities): elevation, buildings, trees, crosswalks, turn lanes, and **custom-designed 3D landmarks** in day and dark (moonlit) modes. [O A3, A8]
- **Flyover:** photo-realistic 3D. **Look Around:** 360° street-level imagery. [O A3]
- No Indian cities are named among the detailed cities on the pages we read. [I]

### A.8 Traffic
- Real-time traffic shows yellow for slowdowns and red for stop-and-go. Incident markers include closures, crashes and roadwork. [O-x A7 support excerpt; O A3]
- Crowd-sourced reports are confidence-gated. [O A7]

### A.9 Transit
- Real-time arrivals, departures and outages, live vehicle positions, alerts when your stop is near, and pinned favourite lines. [O A3]
- Fares and Wallet transit cards, in select cities. [O A9]
- Indoor maps for airports and malls. [O A3]
- Transit availability in India: [U]. The feature-availability page was not opened.

### A.10 Saved places, collections and guides
- **Favorites:** one-tap navigation. [O A8]
- **Guides:** about 1,000 curated Guides that auto-update, plus user-made Guides that can be shared. [O A3]
- **Places Library** (iOS 18): saved places, Guides, pins and routes in one place, with personal notes. [O A10]
- **Visited Places** (iOS 26): opt-in automatic logging, searchable, end-to-end encrypted, removable with a swipe. [O A11, A16]

### A.11 Business listings and reviews
- Owners claim and manage the place card through Apple Business Connect. [O A13]
- Ratings and photos are user-contributed. [O-x A14] Review text versus rating-only on Apple's own platform: [U]

### A.12 Offline maps
- Introduced in iOS 17. Includes hours and ratings, turn-by-turn and ETA offline. [O A6]
- Three entry points: long-press then Download, a place card, or Profile → Offline Maps → Add. [O A6]
- You choose the area by resizing a rectangle. **The size is shown before download.** [O A6]
- Maps update automatically unless settings say otherwise. You can rename, resize or delete them. [O A6]
- Offline maps are **not synced across devices.** [O A6]

### A.13 Privacy
- **No sign-in.** Search, routing and traffic data are tied to rotating **random identifiers**, not the Apple Account. [O A12, A3]
- **Location fuzzing:** the precise origin of a search is coarsened within 24 h. There is no search or location history server-side. [O A12]
- **On-device personalisation:** parked car, Visited Places, preferred routes. [O A3, A11]
- **Location permission:** Maps asks for "while using" access before first use. [O-x Apple Maps Image Collection privacy PDF] Precise Location must be on for directions. [O-x support excerpt]

---

## Part B — AMap Global (高德地图, international build)

**Context.**
- The English build launched in Jan 2025. [O-x B3] A multilingual build (14 more languages) followed in Jul 2025. [O-x B4]
- The store listing claims coverage of "230+ countries and regions". [O B1]
- Its depth (lanes, signals, live transit) is concentrated in mainland China, Hong Kong and Macau. [O B1]

### B.1 Interface structure
- A dense, services-heavy home screen. One reviewer calls it "like a rocket launch control room… 10,000 plus function[s]". [O B1, user review]
- The home screen bundles ride-hailing, hotels, tickets and charging into one surface. [O B1]
- Inference: AMap is the opposite philosophy to Apple's restraint. It is powerful, but discoverability suffers. [I]
- Sheet and detent model: [U]. No public UI documentation was found.
- Login needs a Chinese phone number for many functions. English coverage drops off in deeper screens. [O B1, user reviews]

### B.2 Gestures
- [U] for the consumer app. The SDKs expose standard pan, zoom, rotate and tilt. [I] SDK gesture pages were not opened.

### B.3 Search and autocomplete
- The open platform exposes **input tips** (autocomplete), **POI search 2.0**, and geocoding and reverse geocoding. [O B6 page navigation]
- The consumer app search finds restaurants, pharmacies and hotels. Searching "Charging Map" or "Gas Stations" surfaces chargers and pumps. [O B1]

### B.4 Place cards and listings
- Listings carry reviews ("search nearby, read reviews"). [O-x soft112 mirror of the HK listing text] There is hotel price comparison across the network and scenic-spot ticket booking with refunds. [O B1]
- **Street Stars** ranks businesses using **navigation-behaviour signals** plus reviews. [O B10]

### B.5 Routing
The public API mirrors the app's options. [O B6]
- **Driving strategies:**
  - recommended (default, same as the app)
  - avoid congestion
  - prefer highways / avoid highways
  - fewer tolls / toll-free
  - prefer main roads
  - fastest
  - plus combinations of these
- **Driving options:**
  - up to 16 waypoints
  - avoid-polygons (up to 32 areas)
  - **licence-plate-based restriction avoidance**
  - vehicle type (petrol / BEV / PHEV)
  - ferry on/off
- **Per-route driving fields:**
  - toll cost (¥) and toll distance
  - main toll road
  - **number of traffic lights**
  - per-segment traffic status (unknown / free / slow / congested / severe)
  - navigation action codes
- **Walking:**
  - up to 3 alternatives
  - indoor routing
  - each step typed (crosswalk, underpass, footbridge, metro passage, stairs, escalator, elevator, ramp, ferry…)
- **Cycling and e-bike:** e-bike routing respects restrictions.
- **Transit:**
  - strategies: recommended, cheapest, fewest transfers, least walking, most comfortable (air-con), no-metro, metro-first, fastest
  - 1–10 alternatives
  - night buses
  - taxi-cost comparison
- **Consumer app extras:** trucks, **motorcycles** and NEV routing in HK and Macau [O B1]; congestion-avoidance plans [O B1]; "shade routing" and a **"green wave"** suggested speed. [O-x B8, press about Chinese apps generally]

### B.6 Turn-by-turn guidance
From the Navigation SDK, which mirrors the app. [O B7]
- **NaviInfo** drives the top guidance panel: current road, remaining distance and time.
- **Junction view:** an enlarged 3D illustration of complex intersections and exits (25:16 image).
- **Lane info:** per-lane arrow codes (straight, left, right, U-turn combinations, bus lane, variable lane), with "recommended lane" highlighting.
- **Turn icon** including the road shape.
- **Traffic bar:** a strip showing congestion along the remaining route.
- **Congestion ahead:** distance and delay.
- **Cameras:** type, speed limit, distance. Includes **interval (average-speed) cameras**.
- **Service areas and toll stations ahead.**
- The SDK index also lists: real-time and simulated navigation, **free-drive / cruise mode** (guidance without a destination), alternative routes during navigation, **parallel-road detection** (e.g. flyover versus service road), TTS voice, motorcycle and e-bike planning. [O B7 navigation]
- **Traffic-light countdown:** AI-predicted, not read from signal hardware. It covers about 500,000 intersections in CN/HK/MO/TW and also works while cycling, walking and in cruise mode. It tells you how many red cycles to expect, and is being rolled out abroad (May 2026). [O-x B5]
- Voice continues in the background. [O B1] Voice-pack choice: [U] in sources read.
- Location sharing and **intercom** within a group while navigating. [O B1]

### B.7 2D/3D rendering and landmarks
- "3D lane-level views". [O-x B2] A 3D city map, plus "3D map" and "3D terrain" products on the open platform. [O B6 navigation; O-x soft112]

### B.8 Traffic
- Real-time traffic and ETAs. Traffic-situation and traffic-incident web APIs. [O B1, B6 navigation]

### B.9 Transit
- Real-time bus and metro positions and arrivals, plus **arrival alerts**. [O B1]
- A subway-map product. [O B6 navigation]

### B.10 Saved places
- [U] in fetched sources.
- AMap now offers **pre-trip info** (entry rules, arrival cards) and **hotel-aware arrival routing** for foreigners. [O-x B9]

### B.11 Offline maps
- Offline maps exist. One reviewer says offline use fails on the Play build in China. [O B1 review] Mechanics: [U]

### B.12 Privacy
- Play data-safety label:
  - **shares location and device IDs with third parties**
  - collects location, personal info "and 10 others"
  - encrypts data in transit
  - offers deletion on request
  
  [O B1]
- HealthKit is used only for step-count display. [O B1]
- Inference: a commercial, account-centric model, the opposite of Apple's anonymous-by-default stance. [I]

---

## Part C — What Bharat Maps should take (understand → recreate)

| # | Lesson | From | Why it matters in India [I] |
|---|---|---|---|
| 1 | One resizable sheet with 3 resting heights and a tappable, accessible grabber | Apple A1/A2 | One-handed use on budget Android phones. The map stays visible. |
| 2 | Category-first search with "open now" and **search-as-you-move-the-map** | Apple A3 | Indian queries are categorical ("ATM near me", "petrol bunk") |
| 3 | Route list with traffic-coloured alternatives, Avoid tolls/highways, Leave at/Arrive by | Apple A4 + AMap B6 | Tolls and highway choice matter on NH corridors |
| 4 | **Toll cost and traffic-light count per route** | AMap B6 | Price-sensitive users weigh cost against time |
| 5 | **Two-wheeler mode** as first-class, not just "bike" | AMap B1/B6 (motorcycle, e-bike) | Two-wheelers dominate Indian roads |
| 6 | **Lane arrows plus enlarged junction view** at flyovers and service-road splits; parallel-road detection | Apple A3, AMap B7 | Flyover versus service-road confusion is a top Indian navigation failure |
| 7 | Walking steps typed (footbridge, subway, stairs) | AMap B6 | Metro stations and FOBs in Hyderabad and Vizag |
| 8 | Size-before-download offline regions with resize, auto-update and delete | Apple A6 | Data cost and patchy coverage |
| 9 | Anonymous by default: no login to navigate, rotating IDs, coarsened history, on-device "frequent places" | Apple A12 | DPDP Act; also a trust differentiator against AMap |
| 10 | Confidence-gated crowd incident reports (pothole, waterlogging, police check, road closure) | Apple A7 | No licensed live-incident feed is available for free |
| 11 | Place card with actions plus a verified-visit signal for ranking | Apple A3/A13, AMap B10 | Fits Bharat Maps' commerce loop (sellers, catalogue) |
| 12 | **Landmark-anchored instructions** ("after Jagadamba Junction") | Neither app documents this. India-specific. [I] | Indian wayfinding is landmark-led, not street-name-led |
| 13 | Avoid AMap's clutter: services go behind clearly labelled entry points | AMap B1 reviews | Keep the home screen calm |

## Part D — Unknowns to resolve (not blocking v0.3)
- Apple: rerouting and arrival UX copy, which features are available in India, and two-finger-tap zoom on iPhone.
- AMap: home-sheet behaviour, saved places and collections, voice packs, offline-download flow, gesture set.
- These cannot be resolved without hands-on screenshots, which we did not take. If the user supplies their own screenshots, extend this report with them as [O] evidence.
