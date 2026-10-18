# Opportunities for Bharat Map from the AMap APK teardown

Date: 18 Oct 2026. Evidence: `APK_ANALYSIS.md` (AMap v17.01.0.2012, static analysis), `REVERSE_ENGINEERING_REPORT.md`, `FEATURE_COMPARISON.md`, Bharat v0.3 `README.md` and `docs/AUDIT.md`.

**Rules.**
- Every item is a clean-room idea that uses open data, open-source libraries or platform APIs.
- Nothing here copies AMap code, assets, styles, sounds or text.
- AMap is cited only as evidence that a pattern matters.

**Scoring.**
- Impact: H / M / L, for Indian users of a map app.
- Effort: S (≤ 2 days), M (≤ 2 weeks), L (longer).
- Rank = impact first, then lower effort.
- A "Bharat today" column shows what v0.3 already has.

## Size baseline (measured in this repo)
| | AMap 17.01 | Bharat v0.3 |
|---|---|---|
| Download | 194 MB (arm64 only) | ~29 MB (per project notes) |
| Unpacked | 344 MB + 121 MB extracted native libs | — |
| Biggest single item | 92 MB script UI bundle | `web/offline/fonts` ≈ 11.5 MB: 4 font stacks × 256 glyph ranges. Noto Sans Regular is 6.1 MB, Medium 3.6 MB, Italic 1.3 MB, Devanagari 0.5 MB. |
| Offline map data | downloaded per city | Vizag 4.1 MB + Hyderabad 9.3 MB PMTiles in the APK |

Bharat's fonts plus PMTiles are about 25 MB of the 29 MB. The fastest size win is the fonts, not code.

## Ranked list

| # | Opportunity | Area | Impact | Effort | Bharat today | AMap evidence | Open, legitimate route |
|---|---|---|---|---|---|---|---|
| 1 | **Trim glyph PBFs to Indian + Latin ranges.** Drop unused ranges and, if the style allows, the Italic stack. Keep Devanagari and Telugu, and add Tamil, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi and Odia ranges as those languages ship. | Performance / size | H | S | All 256 ranges per stack shipped (~11.5 MB) | AMap ships only the faces it needs: number font, BMFont numerals | Script in `scripts/`: read the style's `text-font`, keep ranges such as 0–255, 256–511, 2304–2559 (Devanagari), 3072–3327 (Telugu) and other Indic blocks, then delete the rest. Fonts are Noto (OFL). Measure the APK before and after. Estimate: several MB saved. [I] |
| 2 | **APK size budget in CI.** Fail the build if the APK is over 30 MB. Report a size breakdown per release. | Performance | H | S | No budget | 194 MB super-app, 47% one bundle | `apkanalyzer`/`unzip -l` step in GitHub Actions; also turn on `minifyEnabled true` + `shrinkResources true` (now false) |
| 3 | **Move the second city out of the base APK.** Download the Hyderabad PMTiles (and future cities) on demand, showing the size first. | Size / offline | H | M | Both cities bundled; in-app region download ⛔ | City catalogue DB + download service | Host `pmtiles extract` outputs on a CDN (Cloudflare R2 / GitHub Releases) with a `regions.json` (size, sha256, version). Download with the Capacitor Filesystem/`fetch` into app storage and verify the hash. PMTiles supports range reads. |
| 4 | **Lane guidance from OSM** in the maneuver banner | Navigation / accuracy | H | S–M | ⛔ in AUDIT | `lane_navi_config`, `lane_sound_config`, lane profiles | OSRM already returns `intersections[].lanes` (from OSM `turn:lanes`) when `steps=true`, which `services/routing.js` already sends. Parse it and render original lane-arrow SVGs. Show nothing when lanes are absent. |
| 5 | **Speed limit + overspeed chime** | Navigation / safety | H | S–M | ⛔ | `raw/speedover`, e-dog strings | OSRM `annotations=maxspeed` (OSM `maxspeed`) plus GPS speed. Show the limit only when tagged and label coverage as partial. Use an original chime made with the Web Audio API. Speed cameras stay ⛔. |
| 6 | **Background navigation (screen off / app switched)** with a proper foreground service | Navigation | H | M | ⛔ | 11 location FGS; floating nav overlay | `@capacitor-community/background-geolocation` (MIT) or a small Kotlin FGS with `foregroundServiceType="location"`. Request `ACCESS_BACKGROUND_LOCATION` **only** when the user turns on "keep guiding when screen is off". A persistent notification shows the next maneuver. |
| 7 | **Permission rationale screens before every OS prompt** (location, notifications, mic if voice search), each tied to the action that needs it, plus a gentle in-map banner when permission is denied | Usability / privacy (DPDP) | H | S | Location asked only on user action, but with no rationale UI | `privacy_permission_page`, `scene_permission_guide`, `permission_guide_bottom_float`, permission Lottie set | Original sheets in `ui/`. Copy written in-house in en/hi/te. Link to a plain-language privacy notice. Log consent locally with a timestamp. |
| 8 | **Earcon set by event:** maneuver approaching, reroute, arrival, overspeed, GPS lost | Navigation UX | M | S | Voice only | Separate raw sounds per event | Generate short original tones with the Web Audio API (no sound files needed). Play them with voice muted too. Add a setting to turn them off. |
| 9 | **Dedicated navigation map style (day + night):** dim POIs, stronger road hierarchy, larger road labels, route casing; switch to night by sunset/sunrise, not only by the OS theme | Design / legibility | M | S–M | Light/dark main styles only | Separate `DrvNavS` day/night styles from the main styles | A third style variant in `map/style.js` built from Protomaps/OpenMapTiles layers. Sun times from `suncalc` (BSD-2) for the current position. |
| 10 | **"Report a map problem" → OSM Notes,** plus Bharat's own incident reports (closure, waterlogging, pothole) | Accuracy | H | M | Not built (incident reporting 🟡 in plan) | `feedback_*` (136 strings), `traffic_report_*` layouts, barrier-free contributions, bus-journey review | Map errors: OSM Notes API (`/api/0.6/notes`, anonymous allowed, ODbL-friendly) with a coordinate and a structured description. Time-bound incidents go to Bharat's own `/api/reports` with expiry ("expired" state) and a confidence threshold before showing them to others. |
| 11 | **Tabular numerals for distance / ETA / speed** in the nav banner and route cards | Design | M | S | Body font | Dedicated numeric fonts | CSS `font-variant-numeric: tabular-nums` on Noto Sans, or a bold numeric weight at a larger size. No new font needed. |
| 12 | **Mode disclaimers before 2W / walking / truck guidance:** one-time, short, dismissible; states what is estimated | Trust | M | S | "Estimate" labels | `navi_truck_declare`, `navi_motorbike_declare`, `navi_energy_declare`, `onfoot_declare_msg` | Original copy in `shared/i18n.js`. Remember dismissal per mode in localStorage. |
| 13 | **Deep links and intents:**<br>• handle `geo:` URIs and `https://<bharat-domain>/p/…`, `/r/…` App Links<br>• own scheme `bharatmap://` with shapes `place`, `route`, `navigate`, `search` | Functionality / reach | M | S–M | Share produces links; no intent filters | 24 `androidamap://` actions, `geo:`, App Links with autoVerify | Intent filters in `AndroidManifest.xml` + Capacitor `App.addListener('appUrlOpen')`. Host `/.well-known/assetlinks.json`. Do **not** intercept other vendors' domains. |
| 14 | **App shortcuts:** long-press launcher icon → Home, Work, Search nearby petrol, Offline maps | Usability | M | S | — | Launcher shortcut permissions, toolbox widget | Static `res/xml/shortcuts.xml` (no permission needed) that opens the deep links from #13 |
| 15 | **Commute card:** on open, Home ↔ Work ETA (free-flow, labelled); later an Android home-screen widget | Usability | M | M (card) / L (widget) | Home/Work saved | `RouteCommuteWidgetProvider`, commute strings | Card: reuse routing. Widget: a Kotlin `AppWidgetProvider` in the Capacitor Android project, reading the last computed ETA from shared prefs (no background location). |
| 16 | **Location smoothing and snap-to-route during navigation:** accuracy gating, a 1-D Kalman filter on position and speed, heading from movement when the compass is noisy | Accuracy | H | M | Off-route uses accuracy-aware 3-fix rule | On-device positioning engine + location decision-tree models | Own small filter in `nav/tracker.js` (unit-testable with recorded fixes). Optional OSRM `/match` for post-trip quality checks. No proprietary models. |
| 17 | **Accessibility lead:**<br>• TalkBack pass on a device<br>• label every icon button<br>• spoken maneuver summary on focus<br>• wheelchair info shown and editable (OSM `wheelchair`) | Accessibility | M | S–M | Strong web a11y; not device-tested | About 16% of AMap image views labelled; barrier-free UGC exists | Android Accessibility Scanner + TalkBack manual script in `docs/TEST-REPORT.md`. Wheelchair edits go through OSM Notes (#10). |
| 18 | **Voice choice per language:** list installed TTS voices (en-IN / hi-IN / te-IN …), preview, set speech rate | Navigation UX | M | S | One voice per language | Voice-pack list + record screens, neural voice models | `speechSynthesis.getVoices()` / the TTS plugin's `getSupportedVoices`. No custom voice cloning (⛔: cost, consent risk). |
| 19 | **Device-tier rendering profile:** lower pitch, no 3D extrusions and fewer labels on low-RAM phones, chosen automatically | Performance | M | S | Same style for all devices | `laneprofile_low/mid`, `mapprofile_*` | `navigator.deviceMemory`/`hardwareConcurrency` + measured frame time → set MapLibre options (`maxPitch`, layer visibility, `fadeDuration`). |
| 20 | **Width-bucket QA** at 360, 390 and 411 dp (most Indian Android phones), plus large font scale (1.3×) | Design | M | S | E2E at 390×844 | `values-sw340/360/390/411dp` buckets | Add Playwright/Chromium viewports and a font-scale run to `tests/e2e.mjs`. |
| 21 | **Motion tokens:** 200 ms for small, 300 ms for standard, 500 ms for large sheet moves; one emphasised easing; respect reduced motion (already done) | Design | L | S | Ad-hoc durations | Durations cluster at 300 / 200 / 500 ms | CSS custom properties in the design tokens. Easing values from the public Material 3 spec, not from AMap. |
| 22 | **Privacy as a feature:**<br>• publish a "what we collect" page<br>• keep zero ad/analytics SDKs<br>• keep cleartext off and `allowBackup=false` (already done)<br>• no `QUERY_ALL_PACKAGES`<br>• no background location unless #6 is on | Trust | H | S | Already ahead on manifest hygiene | Global cleartext, background location, installed-app inventory, multiple trackers in AMap | A docs page plus an in-app Settings → Privacy screen, and a CI check that fails on new dangerous permissions in the manifest |
| 23 | **Clipboard address → route suggestion,** strictly opt-in: only when the user opens search, on-device parse with the existing address/DIGIPIN engine | Usability | M | S | Address intelligence exists | `clip_board_in_route_alert_view` | Clipboard read only after a user gesture (Android 12+ shows a toast anyway). Never send it to a server. |
| 24 | **Child POIs / entrances** (gates, metro exits, hospital blocks) on the place card and as routing targets | Accuracy | M | M | — | `elipsized_child_poi_layout` | OSM `entrance=*` nodes and `railway=subway_entrance` from Overpass within the POI polygon; route to the chosen entrance |
| 25 | **Free-drive ("cruise") mode:** no destination, shows current road name, speed limit and upcoming junction names | Navigation | L | M | — | `BackgroundCruiseService`, `amapuricruise` | Reverse-geocode the snapped road (OSRM `/nearest`) + maxspeed. Foreground only unless #6. |
| 26 | **Android Auto** (navigation category) | Reach | M | L | — | HiCar / UCar / CarKit integrations | `androidx.car.app` (Apache-2) templates. Needs Play review for the navigation category. Later. |
| 27 | **Server-driven UI / live updates of web assets** | Velocity | L | M | Rebuild APK per change | AJX/DinamicX bundles with baseline + diff | Optional self-hosted Capacitor live updates (signed bundles). Check the Play policy on interpreted-code updates. Not needed yet. |

### Explicitly not recommended
These are ⛔ for Bharat now, with the reason:
- **Speed / red-light camera alerts and traffic-light countdown**: no licensable India data; legal sensitivity.
- **AR walking navigation**: ARCore Geospatial needs a Google Cloud key and quota. The value is low in Indian streets at this stage.
- **Neural custom voice packs**: model size, voice-consent and licensing risk.
- **Mini-program / super-app containers**: they drive AMap's 72,804 classes and 194 MB. Bharat's Shop should stay a lazily loaded module.
- **Satellite SMS, wearables, face-KYC**: out of scope.
- **Intercepting other vendors' map URLs**: not ours to claim.

## Suggested sequencing
1. **v0.3.x quick wins**, about a week: #1, #2, #4, #5, #7, #8, #11, #12, #14, #20, #22.
2. **v0.4**: #3, #6, #9, #10, #13, #16, #17, #18, #19.
3. **Later**: #15 widget, #24, #25, #26, #27.
