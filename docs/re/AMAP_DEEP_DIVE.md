# AMap 17.01.0.2012 — deep dive into the script bundle and proprietary packs

Date: 19 Oct 2026 · Method: REA-style observe → understand (https://github.com/morluto/rea), static and read-only.
Follows `APK_ANALYSIS.md` (first pass: manifest, resources, native libs), which skipped the 92 MB UI bundle and the other packs. Ranked actions are in `OPPORTUNITIES.md` → "Deep-dive additions".

## 0. Scope, boundary, legend

**Artifact.** `files/uploads/amap-global-17-01-0-2012-8ba7bfdec515.apk`. The package is `com.autonavi.minimap` 17.01.0.2012, the main Chinese AMap build.

**What was done.**
- Unzipped `assets/` and the 8 `classes*.dex` into a scratch folder (since deleted).
- Read file magic and container headers with Python. Parsed index tables for structure only: counts, sizes and entropy.
- Read the dex **string pools** with a small parser. Identifiers only; no decompilation, no smali, no jadx.
- Read plaintext JSON assets for **key names and structure**: cloud config, voice-pack manifests, voice-command catalogue, language list, offline city catalogue.
- Pulled readable property names from the guidance-config binaries.

**What was not done.**
- The script bundle is **encrypted and signed** (see §1.1). It was not decrypted, and no key was looked for.
- The compressed `AMAP` packs were not decompressed.
- The app was not run, and no network call went to AMap.
- No API keys, tokens, certificates, public keys, hashes, URLs beyond the domain, or personal data were recorded.
- No AMap code, assets, images, sounds or text was copied. Identifiers appear only as evidence. Chinese strings are translated or paraphrased.

**Legend.**

| Tag | Meaning |
|---|---|
| **[O]** | Observed: the identifier, file or structure is in the APK |
| **[I]** | Inferred from names or structure, not proven at runtime |
| **[U]** | Unknown: there is a name but its purpose is unclear, or it is hidden in an encrypted pack |

**Key correction to the first pass.** The UI page inventory is *not* locked inside the encrypted bundle. The Java host code references script pages by path, so the **dex string pool carries a plaintext page registry**: 252 distinct script pages across 73 bundle roots, plus 120 internal `amapuri://` routes. This document is built mainly on that registry. [O]

---

## 1. Format findings, pack by pack

### 1.1 `assets/ajx.bundle/bundles.oajx` (92.3 MB): the script UI bundle

| Layer | Finding | Tag |
|---|---|---|
| Outer container | Magic `ion\n002`. The header gives table offset 0x30, **50 entries** and a name-table offset. Each entry is 20 bytes: 5 × u32 (an id/hash, name offset, name length 14–34 bytes, data offset, data length). | [O] |
| Module names | All 50 names are **encrypted**. Every name ciphertext starts with the same 12 bytes, which looks like a common path prefix under a fixed keystream. Not decoded, by policy. | [O] structure / [U] names |
| Inner modules | Each of the 50 payloads is its own container with magic `spx\n003`, a version word, an **embedded signature/public-key block** (value not recorded), then a file table of 36-byte rows (name hash, offsets, compressed and uncompressed sizes). | [O] |
| File counts | 50 modules hold **83,848 files**. The largest modules hold 10,554, 7,645, 7,041 and 6,178 files. 13 modules are ≥ 6 MB; one is a 2 KB stub with 1 file. | [O] |
| Payload | Byte entropy is 7.9–8.0 bits/byte, so payloads are compressed and/or encrypted. File names inside modules are not readable. | [O] |
| `baseline2.bin` (760 KB), `baseline_diff.bin` (346 KB) | Entropy ≈ 8.0, no magic. Probably a base snapshot plus a binary diff for bundle updates. | [I] |
| Runtime | AJX3: a JS engine (`workerjs_v8`), Yoga layout and a native view bridge (`com.autonavi.minimap.ajx3`, 1,398 classes). Pages are `*.page.js` (some are `.tsx.js`/`.jsx.js` builds, so TypeScript/JSX sources) plus XML/CSS "splash" skeletons, e.g. `MinePageSplash.xml` and `detail_splash_view.xml`, rendered before the JS loads. | [O] names / [I] mechanism |
| Cloud bundles | `amap_bundle_cloud_*` names (taxi, AR-nav skin, audio denoise, face recognizer, mini-game resources, device-ML location resources) and `CloudBundleLoader.page` show that some bundles are **downloaded after install**, not shipped in `bundles.oajx`. | [O] names / [I] delivery |

**Verdict:** a proprietary, signed and encrypted container. Recorded as protected and not opened further.

### 1.2 Other packs

| Pack | Format | Structure-level finding | Tag |
|---|---|---|---|
| `horusAssets/horusAssets.pack` (552 KB), `C1TemplateAssets/horuscloudres.pack` (2.6 MB) | Magic `AMAP` + version 1. LZ-style compressed stream with a `.amap_pack_CRC32_TABLE`. File names partly readable through literal runs. | Horus resource names: camera scene config, hybrid bus guide, car-layer animation, fine arrows, HD "smart" layers, traffic-light Lottie, travel plan, an RTK entry animation, HD cloud extension, cruise, overspeed pulse, metronome sound files, "no barrier", **green wave**, light **countdown**, red/yellow/green light images, halo/beam effects, an English i18n file. So Horus is the **immersive / HD-lane navigation render layer**: lights, countdowns, green-wave advisories and lane-level effects. `C1TemplateAssets` holds hashed XML/SVG/PNG/JSON templates (dark variants too), probably server-driven card templates. | [O] names / [I] role |
| `navi/*.bin`, `navi/zh-Hans/*.bin` (20 files) | Magic `74 9e 33 01`, a checksum word, version 3, then a **readable serialized key/value tree**. Not encrypted. | See §1.3 for what the property names show | [O] |
| `navi/GSafeConfig.dat` | Magic `e5 f0 33 01`, plain English templates | Safety-alert phrase templates: speed cameras (single, paired, with the limit, with current speed and an overspeed warning), surveillance, red-light, road-rule, bus-lane, emergency-lane and non-motorised cameras; road hazards (railway crossing, village, sharp/winding/Z-shaped road, narrowing left/right, merge left/right, slippery road, falling rocks, crosswind, accident black spot); "you were speeding through the section" | [O] |
| `voicesqure/default_voice_ip/*.json` (80) + one bundled neural voice | JSON manifests. The neural voice is MNN encoder/decoder + DDSP-GAN f0/control models + `config.json` (speed and volume scale) | Each manifest has: id, display name, numeric language code, 3D-resource flag, music flag, "pilot" flag, offline flag, share flag, and a `download` object (version, md5, real size ≈ 30 MB, model type, SDK version, gray-release %, device-score gate) pointing at `mapdownload.autonavi.com`. **80 language packs**, including Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, Nepali and Sinhala. | [O] |
| `language_config.json` | JSON | **81 language codes**, grouped by region. The South Asia group lists hi, bn, pa, gu, mr, ta, te, kn, ml, si, ne, ur. | [O] |
| `vui_card_setting.json` | JSON | Voice-command help cards by page (home/search/plan, car+truck result, motorbike result, car navigation, truck navigation, pre-trip point picking), with per-city example queries. See §6.3. | [O] |
| `intelligent_intent_config.json` | JSON | An OEM "intelligent intent" declaration: notify traffic-light status during cruise, executed by opening the cruise page. | [O] |
| `config/default_config.json` (1,637 keys), `config/custom_config.json` (79 keys) | JSON key/value | Mostly **Alipay mPaaS / mini-program container** switches (`h5_*`, `ta_*`, `nebulax_*`, `xNN_*` vision models, `ariver_*`), plus an `amap_ta_*` group for AMap's mini-program host. Also permission-guide paths per OEM (auto-start, keep-alive on Huawei/OPPO/vivo/Xiaomi/Meizu). Not AMap map features. | [O] |
| `all_city_compile_v2.json` | Text prefix + JSON | Offline catalogue: province → city adcode with **separate `map_size` and `route_size`**. Offline map data and offline routing data are separate downloads. | [O] |
| `international_bus_config_*.json` | JSON | Three tiers of region codes: an overseas public-transport coverage list. | [O] keys / [I] meaning |
| `tab_mock.json` | JSON | Mock data for a POI-detail tab for a large venue: shops inside grouped by category, a parking guide, opening hours, a "fill in missing info" prompt. | [O] |
| `cloudres_internal`, `cloudres_master` | Tiny JSON | Pointers to cloud-resource templates on an `amap.com` CDN | [O] |
| `map_assets/` | zstd styles (already in pass 1) | Style families confirmed: main standard D/N with size and LOD variants, public-transport D/N, driving-navigation D/N, two "Uni" variants, rule/material/icon lists, lane profiles (low/mid/travel), power-saving HD sky | [O] |
| `dinamicx/`, `template/megaability/`, `container/modules.fb` | Templates, FlatBuffers | Server-driven UI ability templates (loading, menu pop-up, toast) | [O] |

### 1.3 What the guidance configs show (property names only) [O names, I meaning]

| Config | Shows the engine handles |
|---|---|
| `common_config` | Visual landmark marks in instructions ("mark" description, direction and distance), custom marks, yaw (off-route) variants, templated scenes |
| `cloud_base_config` (1,838 identifiers) | A rule language over road class, main/assist action, link type, tunnel, roundabout and formway. Also current lane, next lane count, advance lane, limit speed, camera code, count, range and penalty, bus lane, slope, distance to the next light, red-light flag, queue-end flag, wait time, traffic status. So lane advice, camera and limit alerts, **traffic-light distance and waiting**, and **queue-end warnings** are scripted by server-updatable rules |
| `lane_navi_config` | Lane-level view: zoom in/out near anchors (freeway vs normal), solid-line handling, "occupy special lane" text, merge bubbles, direct arrows before and after a junction, HD path recovery |
| `lane_sound_config` | Lane voice prompts: merge counts, cannot-merge-over-solid-line, target lane, extended lane, construction, "is BeiDou supported" (lane-level GNSS) |
| `odd_config` | Navigation-start scenarios: in a tunnel, weak GPS, parking-lot exit, abnormal destination, ETA restriction, truck restriction, motorbike, AOI name |
| `walk_config` | Building gates in/out, floor names (current and target), barrier-free routing, deviation angle, remaining lights, weather |
| `bike_config`, `elebike_config` | Gate passing, roundabouts, U-turns, milestone distance, light count, incident notices, weather |
| `bus_config` | Get on, next station, transfer, same-station transfer, **arrive soon / get off**, barrier-free scene, weak GPS, "off forecast" |
| `sports_*_config` (run, walk, bike, indoor run) | Pace, target pace, milestones, auto-pause/resume, encouragement prompts |
| `voice_table*`, `custom_voice_*`, `changeplay` | Personality voice scripts by mode: start, passing a light, road, square, park, underpass, rain/snow/haze start, weak GPS. Celebrity and character voice IDs. Dialects. Hazard phrases (school, village, sharp turn, steep up/down slope, slippery, narrowing, crosswind, service area, railway crossing, accident area, congestion) |

### 1.4 Dex string pool (plaintext registry)
- 412,905 unique strings across 8 dex files. [O]
- **252 distinct script page names** across 73 bundle roots. Some pages appear under legacy roots too (`amap_drive/…`, `amap_lifeservice/…`, `amap_basemap/…`), a sign of a monorepo split. [O]
- **120 `amapuri://` internal routes** and 4 extra `androidamap://` actions beyond those in pass 1. [O]
- **99 `amap_bundle_*` identifiers.** [O]
- **~143 concrete native `*Page` classes** (plus 40 activities) for map hosts, photo, permission, web, mini-app and car-projection pages. [O]
- 1,837 switch-like identifiers (`*Switch`, `*_enable`, …), used for the theme counts in §5. [O]

---

## 2. Screen and page inventory by area

Counts are distinct page names. "Script" means AJX page evidence (`*.page.js`); "native" means a Java `*Page`/activity; "route" means an `amapuri://` path. Purposes are paraphrased from the names.

### 2.1 Home, shell and tabs (≈ 24)

| Screen | Evidence | Tag |
|---|---|---|
| Home map with search bar and cards | script `search_home/HomePage` + preload; native `MapHomePage`, `MapHomeTabPage`, `IAMapHomePage` | [O] |
| Bottom tab host (Home · Nearby · Taxi · Messages · Me) | native `TabHostPage`, `NewTabHostPage`, `TabbarPage`, `BootHomeTabPage`, `TaxiTabAjx3Page`, `MineAjx3Page`, `MessageAjx3Page`, `Tab2DynamicAjxShellPage` (server-defined tab), `C3TabHostPage` | [O] pages / [I] exact tab set |
| Nearby / local discovery | script `BizNearbyIndex`; native `NearbyTabDataManager` | [O] |
| Message tab and message box (channels, my messages) | script `MessageTab`, `MessageBoxPage`, `MessageBoxChannelPage`, `MessageBoxMyMsgPage`; routes `messagetab`, `messagebox` | [O] |
| Toolbox (all tools) | script `ToolboxHomepage`; toolbox widget; launcher card JSON | [O] |
| Quick services hub | script `QuickServiceRedesign` | [O] |
| Content centre / feed | script `ContentCenter`; native `FeedAjx3Page` | [O] |
| Ranked lists landing ("best of" lists) | script `RankNewPage`; route `ajx_landingpage/rankLanding` | [O] |
| Drive news on map | script `basemap/DriveNews` | [O] name / [U] content |
| Splash screens (quick, OEM "magic text"), safe mode, CPU-arch error | native activities (pass 1) | [O] |
| City switch, language dialog, layers panel | routes `settings/citychange`, `setting/languageSettingsDialog`, `setting/layer`; script `CLCitySelectorPage`; native `SelectCityPage` | [O] |
| GPS button / locate states | native `GPSButtonNewMainPage` | [O] |
| Server-driven bundle loader and error pop-up | script `CloudBundleLoader`, `CloudBundleTemplateLoading`, `error_popup` | [O] |

### 2.2 Search (≈ 14)

| Screen | Evidence | Tag |
|---|---|---|
| Search container, loading state, results (two generations) | native `SearchContainerPage`; script `SearchLoadingPage`, `SearchResultPage` (.tsx), `SearchResultPageNext2` | [O] |
| "Search nearby" input | script `BizAroundSearchInputPage` | [O] |
| **All-categories page** | script `search_around/AllCategoryPage` | [O] |
| City suggestion / did-you-mean | native `SearchCitySuggestionPage` | [O] |
| In-depth query cards (city card, scenic search) | script `IDQCityCardPage`, `IDQPlusPage`, `SearchIdqMaxPage` | [O] / [I] purpose |
| Search inside route planning | script `TripSearchPage` | [O] |
| Search while driving (voice window) | native `drive/search/fragment` (5) | [O] |
| Pick a result by voice ("the first one") | script `VuiSelectPoiPage`; voice card "pick point before trip" | [O] |
| Point picking on the map (point, fixed point, road) | native `SelectPoiFromMapPage`, `SelectFixPoiFromMapPage`, `SelectRoadFromMapPage`, `PoiSelectPage`; script `locationselect/Homepage` | [O] |
| QR scan | native `QRScanPage`; route `qrscan/mainView` | [O] |

### 2.3 POI detail and place content (≈ 22)

| Screen | Evidence | Tag |
|---|---|---|
| POI detail sheet (with splash skeleton) | script `poi.jsx`, `FirstPoint`; splash XML/CSS; native `IPoiDetailPage`, `AbstractSlidablePage` | [O] |
| **Venue tab: shops inside by category, parking guide, hours** | `tab_mock.json` | [O] data / [I] screen |
| Photos: grid, preview, detail, select, crop, upload success, video record | native `ImageGridNodePage`, `ImagePreviewPage`, `ImageDetailPage`, `AjxPhotoSelectPage`, `CropPhotoPage`, `PoiPhotoSuccessPage`, `VideoRecordPage`; album pages | [O] |
| Reviews: write/edit, my reviews | script `comment/Edit`, `MyComment`; native `ReviewPage` | [O] |
| Favourites home and list | script `FavoriteIndex`, `FavoritesListPage`; route `featureName=Favorite` | [O] |
| Share (native share, text "passphrase" copied/detail) | script `ShareNative`, `BizPassphraseCopiedPage`, `BizPassphraseDetailPage` | [O] |
| POI error / new POI / location feedback | script `POINormalFeedback`, `NewPoiFeedback`, `FeedbackLocation(Add)` | [O] |
| Product shelf (goods at a place) | script `hkf/ProductShelfListPage`; route `hkf/HkfPortal` | [O] / [I] |
| Hotel portal, order centre | routes `hotel/portal`, `orderCenter/list` | [O] |
| Check-in at a place | route `geoecho/checkIn` | [O] |
| POI card for OEM external surfaces | script `MagicTextPoiDetailPage`, `MagicTextRoutePlanPage` | [O] |

### 2.4 Route planning by mode (≈ 40)

| Mode / screen | Evidence | Tag |
|---|---|---|
| Plan home (shared shell with mode tabs) | native `PlanHomePage`, `AjxPlanHomePage`; script `basemap_route/index`; routes `routePlan/home`, `route/plan` | [O] |
| Mode tabs: **Car, Truck, Motorbike, Ride (bike/e-bike), Foot, Bus, Train, Coach, Air, "ETrip"** | script `CarPage`, `TruckPage`, `MotorPage`, `RidePage`, `FootPage`, `BusPage`, `TrainPageTemp`, `CoachPage`, `AirPage`, `ETripPage` | [O] / [U] ETrip |
| Car results; route detail; tips detail | script `CarResultPage`, `RouteDetailPage`, `CarTipsDetailPage` | [O] |
| **EV ("new energy") results** | script `EnergyResultPage`; native `AjxRouteEnegryResultPage` | [O] |
| Truck results | script `TruckResultPage` | [O] |
| Motorbike results and tips | script `MotorResultPage`, `MotorBikeResultPage`, `MotorBikeTipsDetailPage` | [O] |
| Walk and ride results, previews | script `FootResultPage`, `FootPreviewPage`, `RideResultPage`, `RidePreviewPage` | [O] |
| Bus/metro results, path detail, pop-up | script `BusIndex`, `BizRPBusResult`, `BusPathDetailPage`, `BusDetailPage`, `BizRPBusPopUpView` | [O] |
| Train, coach, flight results (+ flight calendar, city, airport and filter pages) | script `TrainResult`, `CoachResult`, `AirTicketResultPage`, `CalendarPage`, `CitySelectPage`, `AirPortFilterPage`, `FilterPage` | [O] |
| **Events on route** (incident detail) | script `TripEventDetailPage`, `CarEventDetail` | [O] |
| **Restriction detail** (plate/area/vehicle) | script `CarRestrictPage`, `MotorBikeRestrictPage`; route `carRestrict/showRestrictDetail` | [O] |
| **Departure-time planner (ETD)** | script `RouteETDPage`; route `drive_web/RouteETDPage` | [O] |
| **Long-trip card** (long-distance summary) | script `TripLongCardPage` | [O] / [I] content |
| **Multiple via-points** | route `drive/multiViaPointPlan`; voice "go via X", "first X then Y" | [O] |
| Vehicle select | route `drive/vehicleSelect`; layout `drive_navi_type_choose_*` (pass 1) | [O] |
| Route and navigation preferences (+ custom) | script `TripSettingPage`, `TripCustomSettingPage` | [O] |
| Taxi, carpool, chauffeur and third-party taxi tabs inside planning | native `PlanThirdTaxiAjxPage`, `PlanCarpoolAjxPage`, `PlanHitchAjxPage`, `PlanChauffeurAjxPage` | [O] |
| Integrated mobility plan (mixes modes) | script `imobility/PlanPage` | [O] / [I] |

### 2.5 Navigation (≈ 30)

| Screen / capability | Evidence | Tag |
|---|---|---|
| Car navigation, simulation, preview | script `CarNaviPage`, `CarNaviSimulatePage`, `CarPreviewPage` | [O] |
| Pre-navigation agreement/disclaimer | script `TripNaviAgreementPage` | [O] |
| **End-of-trip page** (+ group rankings) | script `EndPage`, `EndPageGroupRank` | [O] |
| In-navigation error report | script `CarErrorReportPage`, `MotorBikeErrorReportPage` | [O] |
| Gamified navigation landing | script `NaviGamingLandingPage` | [O] / [U] mechanics |
| Drive radar (surroundings while driving) | script `DriveRadar`; `IDriveRadarListener` | [O] / [I] |
| **Cruise (free drive)**: congestion, facilities, time/distance | script `CarCruisePage`; JNI `CruiseInfo`, `CruiseCongestionInfo`, `CruiseFacilityInfo`; OEM intent | [O] |
| Motorbike navigation, simulation, preview, end, **set plate number** | script `MotorBikeNaviPage`, `…SimulatePage`, `…PreviewPage`, `…EndPage`, `MotorBikeSetNumber` | [O] |
| Walk navigation, preview, end, review, browser | script `FootNaviPage`, `FootPreviewPage`, `FootEndPage`; native `FootNaviReviewPage`, `AjxFootBrowserPage` | [O] |
| Ride navigation, preview, end | script `RideNaviPage`, `RidePreviewPage`, `RideEndPage` | [O] |
| Parking page near destination | route `drive/ParkingPage`; JNI `LocParkingInfo`, `LocParkingExitInfo` | [O] |
| Voice packs list / record in navigation | native `drive/navi/navitts/fragment` (3) | [O] |
| Floating navigation overlay, immersive nav service | pass 1 services | [O] |
| **Engine data types** (JNI) | `LaneInfo`, `LongSolidLane`, `CrossNaviInfo` (junction view), `RouteCamera`/`RouteCamera3d`, `LightBarInfo` (traffic bar), `JamInfo`/`JamSegment`, `AvoidJamArea`, `RestAreaInfo` (service areas), `InspectionStationInfo`, `ForbiddenWideHighWeightInfo` (truck size/weight bans), `RestrictionInfo`, `RoadClosedArea`, `RouteIncident`, `WeatherSegment` (weather along the route), `NaviQuickPayInfo` (in-nav toll/parking pay), `RerouteOption`, `CRouteDivergeMerge`, `TmcRoutePath`, `VehicleType` | [O] |
| Positioning features (JNI) | Raw GNSS measurements, **RTK check**, dead reckoning, indoor/outdoor door detection (`LocDoorIn`), parking-exit detection, overhead/elevated-road detection (`LocOverheadResultInfo`), plane matching, Wi-Fi/cell/Bluetooth fixes | [O] names / [I] use |
| Traffic-light countdown and green wave | Horus pack names; `cloud_base_config` light distance/wait fields; `TrafficLightNewService` | [I] |
| HUD mirror mode | **no evidence** (0 matches) | [U] |
| Landscape mode | voice command "landscape mode" in the navigation card | [O] |

### 2.6 Public transport (≈ 14)

| Screen | Evidence | Tag |
|---|---|---|
| Bus/metro plan home and results | see §2.4 | [O] |
| **Real-time bus home, detail, followed lines/stops** | script `realtime_index`, `realtime_detail`; routes `realtimeBus/home`, `ajx_realbus/RealBusAttentionPage` | [O] |
| Subway map | routes `subway`, `ajx_realbus/Subway` | [O] |
| Bus line page | route `busline`; `featureName=BuslineSearch` | [O] |
| Bus commute list and detail | script `CommuteBusListPage`, `CommuteBusDetailPage`; native `BusCommute*` | [O] |
| Bus QR-code payment | script `HorQrCodePay` | [O] |
| Real-time bus error report | script `RealBusError` | [O] |
| **Ride reminder (get-off alert)** | service `BusRideRemindService` (pass 1); `bus_config` arrive-soon/get-off | [O] |
| Bus-journey review | layout `ugc_bus_navi_review_layout` (pass 1) | [O] |
| Overseas transit coverage | `international_bus_config` | [O] / [I] |

### 2.7 Ride-hailing and shared mobility (≈ 30)

| Screen | Evidence | Tag |
|---|---|---|
| Taxi main home, standalone home, order page | script `TaxiMainHome`, `TaxiIndependentHome`, `TaxiIndex`; route `drive/takeTaxi` | [O] |
| Pick-up point select / modify | routes `sharedtrip/taxi/lbs/StartPointSelect`, `ModifyStartPoint` | [O] |
| Trip over, cancel-and-stay retention | script `TaxiRouteOverPage`; routes `…/order/RouteOver`, `TaxiCancelStay` | [O] |
| Designated driver (chauffeur) | script `DrivingTabIndex` | [O] |
| Intercity car | script `IntercityTabIndex` | [O] |
| Hitch / carpool (passenger and driver) | script `HitchIndex`, `HitchTabIndex`; routes `sharetrip/hitch/driver/TravelPage` | [O] |
| Shared bike: scan QR, unlock, check lock, scan result, wallet, history, help, agreement, authorise, login, banner, tips | script `ShareBike*` (13), `UnLockPage`, `CheckLock`, `WalletListPage` | [O] |
| Healthy-ride history | route `healthyRide/historyPage` | [O] |

### 2.8 Travel and local services (≈ 35)

| Screen | Evidence | Tag |
|---|---|---|
| **Scenic-area mode**: map home, live view, must-see, topics, park detail, ticket detail, shuttle bus detail, banner detail, "universe" map, **walking plan** | script `BizScenic*` (12), `EyrieMapPage`; JNI `eyrie` (100 classes) | [O] |
| **Audio guide ("walkman")**: map, albums, explanation, coupons, orders | script `BizScenicWalkman*` (5), `BizScenicWalkmanMapPage` | [O] |
| Scenic share / jigsaw (immersive render) | routes `immersiverender/ScenicShare`, `ScenicSpotJigsaw` | [O] |
| Travel city page, tour detail/author (video guides) | script `BizTravelCityPage`, `TourDetail`, `TourAuthor`; native `tourvideo` (5) | [O] |
| Fun-trip activities: index, list, detail, add, my trail | script `ft_*` (5) | [O] |
| Tickets: orders, secondary page, train ticket, traffic ticket (fine?) | script `OrderListPage`, `TicketSecondaryPage`, `TrainTicketDetail`, `TrafficTicketDetail` | [O] / [U] traffic ticket |
| Wallet: main, bill, withdrawal | native `WalletMainPage`, `WalletBillPage`, `WalletWithDrawalPage` | [O] |
| Food-delivery authorisation, mini-apps | route `eleme/authorize`; mini-app pages | [O] |
| Fuel discount, petrol station widgets | widget providers | [O] |

### 2.9 User and profile (≈ 30)

| Screen | Evidence | Tag |
|---|---|---|
| Me page (+ guide splash) | script `MinePage`; routes `mine/UserCenter(New)` | [O] |
| Profile, account and security, bind phone, linked accounts, login, quick login | script `UserInfo`, `AccountAndSecurity`, `AccountBindPhone`, `AccountBindingManager`, `DefaultLogin`, `QuickLoginNative` | [O] |
| **Footprint**: main, city list, tracks list/detail, mark a point (+ success tip), make/play/share a video, help | script `FootPrintMainPage`, `CityListPage`, `LocusListPage`, `LocusDetailsPage`, `MarkPoint`, `MarkPointEntry`, `MarkPointSuccessTip`, `FootprintVideo*` (3), `HelpCenterPage`; route `footprint/footprintWorld` | [O] |
| **Frequent locations manager** | script `FrequentLocationManage`; route `frequentlocation` | [O] |
| **My car**: home, list, add, edit, brand, style, licence plate, logo, scan guide, login guide | script `Car*Controller` (11); routes `carownerservice/*` | [O] |
| Car-icon skins, map skins, purchase ranking | widgets `MyCarlogo`, `PaidCarlogo`, `MySkin`; routes `mainmap/carlogoEffect`, `asset/purchaseRanking` | [O] |
| Gold coins / membership | `featureName=GoldCoin`; `MemberWidgetProvider` | [O] |
| Measure distance | native `MeasurePage` | [O] |

### 2.10 Settings and privacy (≈ 16)

| Screen | Evidence | Tag |
|---|---|---|
| Settings home, map settings, about, city change, language | routes `settings/home`, `settings/mapsettings`, `settings/about`, `settings/citychange`; native `sysabout` | [O] |
| Navigation settings (+ custom) | script `TripSettingPage`, `TripCustomSettingPage`; native `drive/setting/navisetting` | [O] |
| Commute settings: address, guide, download guide | script `CommuteSetting`, `CommuteAddrSettingPage`, `CommuteGuideSetting`, `CommuteGuideDownloadPage`, `DriveCommutePage` | [O] |
| Privacy consent, permission page, scene permission guide, battery/auto-start guide | native `PrivacyPermissionPage`, `PermissionPage`, `ScenePermissionGuidePage`, `BatteryAutoStartPermissionPage`; route `request_permission` | [O] |
| Widget agreement | script `DesktopWidgetAgreementPage` | [O] |
| Family-location authorisation settings | route `WatchFamily/jumpToAuthSettingPage` | [O] |
| Debug routes left in release | routes `ajxdebug`, `archdebug`, `infodebug/main`, `QABug/BugSwitchEnable`, `debugAudioInterface`; native `SplashScreenDebugPage`, `AutoTestAlcPage` | [O] |

### 2.11 Offline (≈ 8)

| Screen | Evidence | Tag |
|---|---|---|
| Offline home, settings, storage | script `offline/HomePage`, `SettingPage`, `StoragePage`; route `offlinemap/home` | [O] |
| **Offline data for cities along a route** (+ city list) | script `offline/alongwayquery`, `…/citylist` | [O] |
| Send offline data to the car | script `offline/auto/sendcarapk` | [O] / [I] |
| Offline prompt; download page | route `common/offlineprompt`; native `DownloadPage` | [O] |
| Separate map and route packs per city | `all_city_compile_v2.json` | [O] |

### 2.12 Voice and AI (≈ 20)

| Screen | Evidence | Tag |
|---|---|---|
| Global voice card (old and new) | script `globalvoice`, `NewGlobalVoice` | [O] |
| LLM voice, LLM speech recorder, chat, A2UI chat, **Explore**, session history | script `LLMGlobalVoice`, `LLMGlobalSpeechRecorder`, `ChatPage`, `AIChatPage`, `ExplorePage`, `SessionHistoryPage`; native `AGenUIChatPage` | [O] |
| Voice help centre (command list) | script and native `VUIHelpCenterPage` | [O] |
| Voice scenes and steps; skill editor | native `VUIScenePage`, `VUIStepPage`, `SkillEditPage` | [O] / [U] skills |
| **AI phone call** | native `AiCallPage`; mic foreground service | [O] / [I] |
| Dialect home | route `dialect/home` | [O] |
| Voice-pack square, IP voices, record own voice | script `IpSquarePage`; 80 manifests; record fragment (pass 1) | [O] |
| Wake word | switches `voice_wakeup_switch`, `AgentVuiVoiceAwakeSwitch`; `kws.bin` (pass 1) | [O] |
| In-chat translation | strings "voice translating / translation succeeded" | [O] / [I] |

### 2.13 AR (≈ 4)

| Capability | Evidence | Tag |
|---|---|---|
| AR walking navigation (+ indoor AR view) | JNI `arwalk` (30), `ARWalkIndoorView`; camera-permission strings | [O] |
| AR driving-navigation skin | cloud bundle `amap_bundle_cloud_ar_navi_skin` | [O] name / [I] |
| AR engines | ARCore, Huawei HiAR, EasyAR, `com.amap.jni.ar` (51), `ArManager` | [O] |

### 2.14 Community, reports and UGC (≈ 18)

| Screen | Evidence | Tag |
|---|---|---|
| Feedback home, router by issue type, entry list | script `FeedbackHomePage`, `FeedbackRouter`, `EntryList`; routes `feedback`, `feedback/location`, `feedback/otherIssue` | [O] |
| Location wrong / add location / new POI / POI error | script `FeedbackLocation`, `FeedbackLocationAdd`, `NewPoiFeedback`, `POINormalFeedback` | [O] |
| **My feedback list and detail (status tracking)** | script `BizUserFeedBackList`, `BizUserFeedBackDetail` | [O] |
| Traffic report submit, traffic event page | native `TrafficSubmitPage`, `AbstractTrafficSubmitPage`; script `BizTrafficPage` | [O] |
| In-navigation error reports (car, motorbike) | see §2.5 | [O] |
| UGC chat room | route `ugc/chatroom` | [O] |
| Reviews, photos, check-ins | see §2.3 | [O] |

### 2.15 Car, projection and wearables (≈ 12)

| Screen | Evidence | Tag |
|---|---|---|
| HiCar home, result, navigation container | script `HCHomePage`, `HCResultPage`, `HCNaviContainerPage` | [O] |
| Car projection home and result | native `CarProjectionHomePage`, `CarProjectionResultPage` | [O] |
| Car-link navigation, car-link manager | script `AmapCarNaviPage`; native `AliCarLinkManagerPage`; route `amapcar/main` | [O] |
| Wearables (watch link), Huawei WearEngine | `com.amap.bundle.wearable` (183 classes) | [O] |
| Car mount / landscape | voice "landscape mode" | [O] |

### 2.16 Family, group and safety (≈ 18)

| Screen | Evidence | Tag |
|---|---|---|
| **Family map**: join family, my family | script `JoinFamily`, `MyFamily`; routes `WatchFamily/myFamily`; clipboard invite service | [O] |
| **Team trip (A-Group)**: main, join team, notice, settings, team-name editor, remove member, my group | script `IMAgroupMainPage`, `BizBasemapAgroup*` (6); route `AGroup/joinGroup` | [O] |
| Team play: login guide, member detail, my group, notice editor, settings | script `TeamPlay*` (5) | [O] |
| Convoy | script `convoy/index` | [O] |
| **Safety assistant** (+ detail) | script `BizSecureAidePage`, `BizSecureAideDetailPage` | [O] / [I] trip safety |
| Collision report | JNI `CollisionReportManager` | [O] name / [I] crash detection |

### 2.17 Sports and health (≈ 6)

| Screen | Evidence | Tag |
|---|---|---|
| Sport index, shortcut | routes `ajx_sports_health/SportIndex`, `ajx_sports-health/Shortcut` | [O] |
| Run, walk, ride and indoor-run guidance | `sports_*_config` | [O] |
| Weekly report, achievements, team rank, routes | widget providers (12 sport widgets) | [O] |
| Step counter | `com.amap.bundle.stepcounter` | [O] |

### 2.18 Totals

| Kind | Count |
|---|---|
| Distinct script pages | **252** [O] |
| Concrete native page classes | **~143** [O] |
| Activities | 40 named activity classes in app packages (156 in the manifest) [O] |
| Internal routes | **120** `amapuri://` routes [O] |
| Feature bundles | **99** `amap_bundle_*` names [O] |
| App widgets | **46** widget provider classes [O] |
| Functional areas | 18 (above) |
| Distinct user-facing features in this inventory | **≈ 190** (screens merged where several pages serve one feature) [I] |

---

## 3. Key end-to-end flows (reconstructed)

Each step names its evidence. Order is inferred from page names and route shapes [I] unless marked.

**F1. First run**
1. Splash.
2. Privacy consent page; a second consent pop-up if the user declines (strings "privacy agreement second pop-up: agree and continue").
3. Scene permission guide with an illustration (location first).
4. OEM battery/auto-start guide (`permission_guide_*` keys by OEM).
5. Home map.

**F2. Search → place → drive → arrive**
1. Home search bar → search container with preload.
2. Suggestions/history → result list (did-you-mean / city suggestion).
3. POI detail sheet: photos, reviews, venue tab, favourite, share.
4. "Directions" → plan home on the Car tab.
5. Results with alternatives; tips, events and restriction detail.
6. Optional: departure time (ETD), via-points, vehicle select, preferences.
7. Pre-navigation agreement → car navigation (lanes, junction view, cameras, lights, traffic bar).
8. Optional: in-navigation report or along-route search by voice.
9. End page: trip summary, parking near the destination, group rank, report.

**F3. Voice control**
1. Wake word or mic tap → voice card for the current page.
2. Command (e.g. "via a petrol station", "avoid tolls", "how long left", "report congestion", "landscape mode").
3. If ambiguous → POI-select page → "the first one".
4. The action runs. LLM chat/Explore handles open questions; session history is kept.

**F4. Transit trip**
1. Plan home, Bus tab → results → path detail.
2. Real-time arrivals; follow a line or stop.
3. Start transit guidance: get on → next station → transfer → arriving soon → get off (`bus_config`).
4. Get-off reminder runs as a service.
5. Journey review at the end.

**F5. Taxi**
1. Plan home taxi tab or Taxi tab → main home.
2. Pick-up point select/modify → order (aggregated third-party fleets [I]).
3. Driving page → trip over page.
4. A cancel prompt offers retention ("cancel and stay").
5. Optional: safety assistant during the trip [I].

**F6. Offline maps**
1. Offline home → city list (map pack and route pack sizes).
2. Download → storage page / settings.
3. When planning a long route, offer to download the cities along it (`alongwayquery`).
4. Optional: send data to the car.

**F7. Map feedback**
1. Feedback home → router by type (location wrong, add a place, new POI, road not passable, real-time bus error, other).
2. Pick a point on the map, add photos → submit.
3. "My feedback" list → detail with processing status.

**F8. Family location**
1. An invite arrives as a link or clipboard text (clipboard service).
2. Join family → my family map.
3. Authorisation settings page.
4. A background location FGS reports position (pass 1).

**F9. Team trip / convoy**
1. Join a team via link → shared map with members.
2. Team notice / announcement, settings, rename, remove member.
3. Overtake/group sounds (`overtake_sound_agroup.mp3`).

**F10. Scenic visit**
1. Scenic POI → scenic map home → must-see / topics.
2. Walking plan → audio-guide map and explanations.
3. Tickets, park and shuttle detail.
4. Share or jigsaw image.

**F11. Footprint**
1. Check-in or "mark a point" (+ success tip).
2. Track list/detail → cities visited.
3. Generate a footprint video → play → share (needs screen recording).

**F12. Commute**
1. Commute guide → set home/work addresses.
2. Drive or bus commute page → home-screen widget (go to work / go home / settings).

**F13. Cruise**
1. Start free drive, or an OEM intent opens cruise from a traffic-light card.
2. Congestion, facilities, cameras and lights are announced without a destination.

---

## 4. Proprietary-pack findings that matter for product depth
- **Navigation craft is rule-driven and server-tunable.** The cloud base config is an expression language over road class, action and link type, with lane, camera, light, queue-end and slope fields. Lane and lane-sound configs hold dozens of distance thresholds. [O names / I mechanism]
- **Hazard alerts go well beyond cameras**: railway crossings, villages, schools, sharp/winding/Z roads, narrowing, merges, slippery roads, falling rocks, crosswind, steep slopes, accident black spots, service areas. [O]
- **Walking guidance knows buildings and floors** (gates in/out, current/target floor) and has a barrier-free mode. [O]
- **Transit guidance is a full announcement state machine**: get on, transfer, arriving soon, get off. [O]
- **Voice is a product line**: 80 downloadable neural language voices of about 30 MB each, gated by gray-release % and device score; character and celebrity voice scripts per mode; dialects. [O]
- **Offline is two layers**: map packs and route packs per city, plus "along the route" suggestions. [O]

---

## 5. Feature-flag themes

AMap's own switches are spread through the dex as `*Switch` / `*_enable` names (1,837 matched). The bundled `default_config.json` is almost all Alipay container config. Themes by match count [O]:

| Theme | ≈ switches | Examples (identifiers) |
|---|---|---|
| Telemetry / logging / upload | 151 | trace and log upload, impression and APM switches |
| Performance / startup / preload | 116 | preload, lazy init, cache, memory/ANR guards |
| Web / mini-app container | 95 | h5 / UC / nebula / ariver |
| Voice / AI | 78 | wake-word switches, voice chat enable, LLM agent |
| Map rendering | 70 | weather effect on map, traffic layer, skins, 3D |
| Location | 55 | GPS/Wi-Fi compensation, RTK, upload controls |
| Car / devices | 29 | projection cruise auto, projection lane switch, UCar nav mode |
| Navigation | 28 | yaw (off-route) enable, float guide enable, TMC guide, navigation volume gain, foot-navigation switch, cruise switch, voice before navigation |
| Privacy / permission | 21 | auth-guide switch, scene-permission config, OEM permission guides |
| Search / POI | 17 | POI voice-select animation, local search downgrade |
| Transit | 8 | real-time bus |
| Widgets | 7 | desktop widget refresh |

Other config themes [O]:
- gray release by percentage and device score (voice packs)
- OEM permission-guide paths
- a scheme whitelist / jump-verification
- downgrade switches for every heavy surface (LLM, AR, 3D, video)

---

## 6. Supporting detail

### 6.1 Additional internal routes (120 total; selection) [O]
- Navigation: `drive/navi`, `drive/CarCruisePage`, `drive/ParkingPage`, `drive/multiViaPointPlan`, `drive/vehicleSelect`, `footNavi`, `foot/footExplorePage`, `edog/home` (camera-alert home), `routecommute`, `carRestrict/showRestrictDetail`
- Search and places: `search/home`, `search/general`, `poi/tip`, `frequentlocation`, `geo/home`, `geoecho/checkIn`
- Transit: `realtimeBus/home`, `realtimeBus/detail`, `subway`, `busline`
- Mobility: `sharedtrip/taxi/*` (8), `sharetrip/hitch/*`, `healthyRide/historyPage`
- Me: `mine/UserCenter`, `mine/markPoint`, `footprint/*`, `carownerservice/*` (5), `orderCenter/list`
- Settings: `settings/*` (4), `setting/layer`, `setting/languageSettingsDialog`, `offlinemap/home`, `request_permission`
- AI: `c3/chat/chatPage`, `dialect/home`, `ugc/chatroom`
- Car: `amapcar/main`; `refresh_desktop_widget`; `immersiverender/*`

### 6.2 Widgets (46 providers) [O]
- Commute
- Real-time bus
- Taxi
- Toolbox
- Petrol station, fuel discount, EV charging
- Truck travel
- Footprint (5 variants)
- Sport (12)
- Member, rank list, billboard
- Car-icon and skin, voice (my voice, free voice, voice recommendations)
- Subscriptions
- OEM card containers

### 6.3 Voice-command catalogue (paraphrased from `vui_card_setting.json`) [O]

| Page | Command groups |
|---|---|
| Home / search / plan / nearby / end | Plan a route (to a category, multi-stop "first X then Y", from A to B, navigate to …), with city-specific examples |
| Car and truck results | Plan, start navigation, via-points / change destination, preferences (highway first, no highway, avoid tolls), queries (weather, plate restriction, refresh route), take a taxi |
| Motorbike results | Same set, minus taxi |
| Car navigation | **Search along the route** (fuel, service area, toilet, ATM, repair); remaining time/distance, next turn, traffic ahead; via-points / change destination; preferences (avoid congestion …); map actions (refresh, overview, zoom); queries (restriction, weather, where am I, time, congestion ahead); **report and settings** (feedback, report congestion/accident, concise announcements, landscape, brightness, volume, mute, traffic layer) |
| Truck navigation | Same, minus along-route search |
| Pre-trip point picking | Choose by ordinal |

---

## 7. What Bharat Map has and lacks (v0.4 baseline)

Bharat status comes from `README.md` (v0.4) and `docs/AUDIT.md`. ✅ = has, 🟡 = partial, ⛔ = lacks. Effort: S ≤ 2 days, M ≤ 2 weeks, L > 2 weeks. "Opp #" points at `OPPORTUNITIES.md` (existing 1–27, new D1–D24).

| Area | AMap feature | Bharat | Legitimate open route | Effort | Opp # |
|---|---|---|---|---|---|
| Home | Bottom tab shell (map, nearby, services, me) | 🟡 Map + sheet; Shop separate | Keep the map-first shell; add a "Nearby" sheet tab rather than tabs | S | — |
| Home | Toolbox: measure distance, compass, coordinates, my car, offline, speedometer | ⛔ (DIGIPIN only) | Turf.js (MIT) for measuring; device sensors; own UI | S | D14 |
| Search | All-categories page | 🟡 12 chips | Grid of ~60 OSM tag groups → Overpass | S | D13 |
| Search | Search along route | ⛔ | Overpass `around:` on a simplified route polyline, ranked by detour | M | D2 |
| Search | Voice search and voice commands | ⛔ | Android `SpeechRecognizer` / Web Speech + the existing deterministic intent engine | M | D6 |
| Search | Frequent locations learned | ⛔ (Home/Work manual) | On-device clustering of past destinations only; never uploaded | S–M | D17 |
| POI | Venue / large-area mode (shops inside, gates, toilets, parking, walking loop) | ⛔ | OSM area polygon + Overpass children + `entrance=*`; own walking-loop planner | M | D7 |
| POI | Reviews and photos | ⛔ | Mangrove Reviews (open, CC-BY-4.0 dataset); Panoramax / Wikimedia Commons photos | M | D15 |
| POI | Child POIs / entrances | ⛔ | (existing) | M | #24 |
| Route | Multiple via-points, reorder | 🟡 (Shop optimiser only) | OSRM/Valhalla waypoints; drag to reorder | S–M | D1 |
| Route | Vehicle profile (2W / car / EV / truck dims, plate) | 🟡 2W real, truck = speed factor | Valhalla `truck` costing (height/weight/width/hazmat), `motor_scooter`; EV connector filter for OCM | M | D8 |
| Route | EV results with charging stops | ⛔ | Own planner: range model + Open Charge Map/OSM chargers along the corridor | L | D19 |
| Route | Events and closures on route | ⛔ | OSM `construction`, `access:conditional`, `highway=construction`; own incident reports (#10) | M | D11 |
| Route | Weather along route | ⛔ | Open-Meteo forecast (CC-BY 4.0, keyless), sampled at ETA points | S | D11 |
| Route | Departure-time planner | 🟡 transit schedules exist | Depart-at / arrive-by in the RAPTOR planner (real for metro); driving labelled free-flow | S–M | D4 |
| Route | Long-trip card (service areas, fuel, tolls, cities, weather) | 🟡 tolls listed | OSM `highway=services/rest_area`, `amenity=fuel/toilets` along the corridor + Open-Meteo | M | D2 |
| Route | Train / coach / flight tabs | ⛔ | Hand off to official sites (IRCTC, state RTCs) by deep link; no scraping | S | D23 |
| Nav | Lane guidance, speed limits, earcons, night style | ⛔ | (existing) | S–M | #4, #5, #8, #9 |
| Nav | **Road-hazard alerts** (rail crossings, schools, speed breakers, sharp curves, ghat roads, black spots) | ⛔ | OSM `railway=level_crossing`, `traffic_calming=*`, `hazard=*`, `amenity=school`, `incline`; curvature from geometry; MoRTH/state black-spot lists where published as open data | M | D3 |
| Nav | Arrival page (summary, parking near destination, last-mile walk, report) | 🟡 arrival detection | Own page; Overpass `amenity=parking` near the destination; foot route for the last leg | S | D9 |
| Nav | Navigation settings (verbosity, landscape, volume, auto-night, keep screen on) | 🟡 mute | Own settings page + Capacitor KeepAwake / screen orientation | S | D5 |
| Nav | Route overview while navigating | 🟡 step list | "Overview" button = fit the remaining route | S | D5 |
| Nav | Cruise / free drive | ⛔ | (existing) | M | #25 |
| Nav | Junction view, lane-level HD, traffic-light countdown, green wave | ⛔ | Not feasible without licensed HD/signal data. A simplified junction diagram from OSM geometry is possible later | L | ⛔ |
| Nav | AR walking | ⛔ | (not recommended) | L | ⛔ |
| Transit | Real-time arrivals | ⛔ | Only if an operator publishes GTFS-RT; loader ready for static GTFS | M | D10 |
| Transit | Followed lines/stops with next departures | ⛔ | Static GTFS "next scheduled" for saved stops, labelled scheduled | S | D10 |
| Transit | Get-off alert / transit guidance | ⛔ | GPS + GTFS stop sequence: "2 stops to go", "get off next" (voice + vibration) | S–M | D4 |
| Transit | Schematic metro map | ⛔ | Own schematic drawn from HMRL GTFS/OSM (original design) | M | D18 |
| Mobility | Ride-hailing / auto aggregator | ⛔ | ONDC open mobility (Beckn protocol; Namma Yatri is open source and on ONDC) as a buyer app; otherwise deep links to installed apps with pickup and drop prefilled | M–L | D12 |
| Mobility | Shared bikes | ⛔ | Partner APIs only; skip | L | — |
| Safety | Live location / trip sharing with trusted contacts, time-boxed | ⛔ | Self-hosted relay (existing SSE tracking) with an expiring link; end-to-end encryption by a link secret; opt-in | M | D16 |
| Safety | Safety assistant (112 button, share trip, emergency contacts) | ⛔ | India ERSS 112 via a dialer intent; share-trip from D16 | S | D16 |
| Safety | Crash detection | ⛔ | Accelerometer threshold + countdown + user-confirmed share; opt-in, clearly beta | M | D24 |
| Group | Team trip / convoy | ⛔ | Same relay as D16 with a group room | M | D16 |
| Profile | Footprint / timeline / GPX | ⛔ | On-device trip log, GPX export (open format), never uploaded by default | M | D20 |
| Profile | My vehicle page | ⛔ | Part of D8 | M | D8 |
| Offline | Region download | ✅ (9 regions) | — | — | — |
| Offline | Offline routing (route packs) | ⛔ (straight-line estimate) | Per-region compact routing: Valhalla tiles + valhalla-mobile builds, or GraphHopper on Android; size-budgeted | L | D21 |
| Offline | Suggest regions along a planned route | ⛔ | Intersect the route bbox with `regions.json` | S | D22 |
| Voice | Voices in more Indian languages | 🟡 en/hi/te | Templated guidance phrases for ta, kn, ml, bn, mr, gu, pa, or via device TTS; native review | M | #18 (extend) |
| Voice | Character / celebrity / neural voice packs | ⛔ | Not recommended (consent and licensing) | — | ⛔ |
| AI | LLM chat / Explore | 🟡 deterministic NL intents | Keep deterministic; an optional on-device or self-hosted model later | L | — |
| Community | OSM-note feedback + my-reports status | ⛔ | OSM Notes API (create, then poll status); "my reports" list stored on device | S on top of #10 | #10 |
| Community | In-navigation one-tap report (jam, accident, waterlogging, closure) | ⛔ | Bharat `/api/reports` (#10) with expiry | S | #10 |
| Car | Android Auto / projection | ⛔ | (existing) | L | #26 |
| Widgets | Commute, toolbox, transit, fuel/EV widgets | ⛔ | (existing #15); add a nearby-petrol/EV widget later | M | #15 |
| Sports | Run/ride tracking with pace prompts | ⛔ | On-device GPS + TTS milestones; GPX (with D20) | M | D20 |

---

## 8. What stayed unknown or protected
- **Protected (not opened, by policy):** module names, file names and payloads of the 50 `spx` modules in `bundles.oajx`; `baseline2.bin` / `baseline_diff.bin`; compressed `AMAP` packs (only names leaking through literal runs were read); native security libraries.
- **Unknown:**
  - the real copy and layout of every page
  - the exact bottom-tab set
  - what "ETrip", "skill editor", gamified navigation, "traffic ticket" and "drive news" do
  - whether traffic-light countdown and green wave are live in this build (only assets and config names exist)
  - HUD mode (no evidence)
  - whether crash detection is user-facing
  - which of the 99 bundle names ship in the APK and which are cloud-delivered
  - which UI languages beyond zh/en are actually offered (voice packs exist for 80 languages; the UI language list has 81 codes)
- **Release-hygiene note:** debug routes (`ajxdebug`, `archdebug`, `infodebug`, a QA bug-switch route) are registered in the release build. They may be gated at runtime. [O names / U gating]
