# Bharat Map — upgrade report, November 2026 (0.7.18 → 0.7.19 audit → 0.7.20 competitor gaps)

Report date: 3 Nov 2026 (IST). Owner: Hem456anth. Repository: https://github.com/Hem456anth/BharatMap.
This report ties together three pieces of work done on 3 Nov 2026:

1. **Competitor research** — `docs/re/COMPETITOR_ANALYSIS_2026-11.md` (12 apps, 52 + 4 feature rows, 105 sources,
   user-feedback themes, issue-tracker demand). Raw notes stay outside the repo in `re-staging/competitor-2026-11/`
   because they quote reviews.
2. **Technical / security audit** — `docs/AUDIT-2026-11.md` (41 findings), fixed in commit `4ae5bed`, released by CI as
   v0.7.19.
3. **Competitor-gap upgrade** — gaps G1, G2, G6–G10 and part of G3, commit `810a020`, released as
   **v0.7.20** with a release-key-signed APK.

Constraints kept: no APK slimming (cities, R8 and font trimming still wait for the owner's approval); clean-room (no
third-party code, screenshots or assets; public pages only); honesty labels everywhere (Live / Scheduled / Estimate /
Unverified / Not applied).

---

## 1. Competitor analysis — summary

**Who matters in India.** Google Maps is the default for nearly everyone (Play 3.3★ from 1.96 Cr ratings, 1,000 Cr+
installs) and keeps adding India-first features (flyover voice in 9 languages, two-wheeler Navatars, accident-prone-area
alerts in 4 cities, Ask Maps in Hindi). Mappls (MapmyIndia) is the India-specific challenger (3D junctions, signal timers
in Bengaluru, DIGIPIN, 18-city transit) but keeps offline in a separate paid app. The FOSS apps that Bharat Map takes
its architecture from (CoMaps, Organic Maps, OsmAnd) are strong offline but weak in India on POIs, addresses,
two-wheelers and legally compliant boundaries. Namma Yatri, Chalo and Where is my Train each own one mobility niche.

**What users complain about** (distinct items read, `USER_FEEDBACK.md`): A search/POI/address coverage (n = 12) ·
B bad routes — narrow lanes, footpaths, dead ends (10) · E unreliable public transport (10) · G clunky OSM-app
navigation (7) · K India-specific guidance is why people switch (7) · C traffic (6) · D offline friction (6) ·
F unwanted AI/voice and silent reroutes (6) · H two-wheeler demand (6) · J privacy praised (6) · I refunds (5) ·
L Indic language quality (5) · O Survey-of-India boundaries (2).

**Ranked gaps** (impact × effort, `GAPS_RANKED.md`): G1 road-quality guardrails (15) · G2 locality-aware search (10) ·
G3 bus + more metro feeds (10) · G4 Survey-of-India boundaries (10, launch blocker) · G5 on-device routing (10) ·
G6 POI density + add a missing place (10) · G7 arrival / get-off alarms (9) · G8 on-route incidents with confirmation
(9) · G9 precise pickup hand-off (9) · G10 "your route, your voice" (9) · G11–G20 lower.

### 1.1 Matrix (Bharat Map column; full 12-competitor matrix in `docs/re/COMPETITOR_ANALYSIS_2026-11.md` §4–§5)

| Bucket | Before — 0.7.18 (52 rows) | After — 0.7.20 (56 rows) |
|---|---|---|
| ✅ implemented + tested (no real device yet) | **26** | **31** (+ row 34 incidents, + new rows 53 locality search, 54 alarms, 55 no silent reroute, 56 add a missing place) |
| 🟡 prototype / partial / labelled estimate | **10** | **9** (row 34 moved to ✅; row 38 metro stays 🟡 with Bengaluru added) |
| 💰 needs a paid key / partner | **1** (live traffic) | **1** |
| ❌ missing | **14** | **14** (offline routing, map deltas, satellite, street imagery, SoI boundaries, photos, Android Auto, disruption alerts, authority safety data, signal timers, bus, live vehicles, trains, widget) |
| Row 52 platforms | Android + web ✅, iOS ❌ (outside the buckets) | unchanged |

Rows that changed in 0.7.20:

| # | Feature | Before | After | Gap |
|---|---|---|---|---|
| 25 | Flyover / service / narrow-road hints | ✅ hints after routing | ✅ + "Prefer main roads" routing costing | G1 |
| 34 | Crowd incident reports | 🟡 map only | ✅ + on-route alerts and "Still there?" | G8 |
| 38 | Metro journey planning | 🟡 Hyderabad only | 🟡 Hyderabad + Bengaluru (unofficial GTFS) | G3 (part) |
| 43 | Ride-hailing hand-off | ✅ Uber link | ✅ + exact pin, DIGIPIN, landmark in every hand-off | G9 |
| 53 | Locality-aware, typo-tolerant search | ❌ | ✅ | G2 |
| 54 | Arrival / get-off alarm | ❌ | ✅ (foreground) | G7 |
| 55 | No silent reroute | 🟡 | ✅ | G10 |
| 56 | Add a missing place | 🟡 free-text note | ✅ structured note | G6 (part) |

Where Bharat Map is now **ahead of every FOSS competitor** in India: two-wheeler routing, DIGIPIN, Indic transliterated
offline search with locality context (Organic Maps #10566 / OsmAnd #16127 still open), city-sized offline packs,
landmark instructions, metro planning offline in two cities. Where it is **still behind Google / Mappls**: offline
routing (C1), compliant boundaries (G4), live traffic (paid key), buses and live vehicles, POI density, reviews/photos,
Android Auto, iOS.

---

## 2. Technical audit (0.7.19)

Full findings: `docs/AUDIT-2026-11.md`. Scope: whole repo at `9ced124`; manual review of every route, SQL statement,
auth path, payment flow, CSP, service worker, 92 HTML sinks and the Android shell; tools: `npm audit`, semgrep,
gitleaks (all 28 commits), ESLint 9, licence census.

| Severity | Found | Fixed | Open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 4 | 4 | 0 |
| Medium | 11 | 11 | 0 |
| Low | 20 | 6 | 14 |
| Info | 6 | — | — |
| **Total** | **41** | **21** | **14** |

**Fixed (all with regression tests in `tests/audit-2026-11.test.js`, commit `4ae5bed`, CI run 19 green first try).**
High: AUD-01 production demo accounts no longer share the README password · AUD-02 unpaid online orders expire after
30 min (max 5 open per customer) so stock and riders cannot be locked · AUD-03 style-proxy `Host` cache poisoning ·
AUD-17 body-parser DoS advisory. Medium: roles re-read from the DB on every request (AUD-04), async scrypt + bounded
login-failure map + no account enumeration (AUD-07), SSE connection caps, FileProvider scoped to the cache dir
(AUD-19), CI token read-only with SHA-pinned actions (AUD-20), release certificate pinned by SHA-256 in CI and in
`attach-apk.yml` (AUD-21), and the remaining Mediums listed in the audit.

**Open Lows, with reasons** (14):

| ID | Item | Why it is open |
|---|---|---|
| AUD-22 | 4 moderate advisories in the build-time `@capacitor/cli` chain | npm's only fix downgrades the CLI; resolved by Capacitor 8 |
| AUD-23 | Express 5, Capacitor 8, TTS 8 majors | need migration + device testing |
| AUD-24 | anyone can register as `seller` | product decision on seller onboarding |
| AUD-25 | legacy `/api` limiter is a resettable fixed window | low impact; `/api/v1` and auth already hardened |
| AUD-26 | CSP allows `*.onrender.com` | needs the final backend host |
| AUD-27 | SSE token in the query string | needs a per-stream token or cookie (client change) |
| AUD-28 | incident votes de-duplicated by IP + UA hash | by design (anonymous, labelled unverified) |
| AUD-29 | service-worker config caching and O(n) tile eviction | needs a full offline regression pass |
| AUD-32 | Cashfree webhook timestamp not checked | low; `markPaid` is idempotent |
| AUD-33 | link-out plugin accepts `http://` | drop after all catalogue links are confirmed https |
| AUD-34 | `ACCESS_BACKGROUND_LOCATION` declared | Play policy declaration needed at publishing |
| AUD-36 | 100 unbundled modules, 12.5 MB search index parsed at once | performance bundling round |
| AUD-37 | 8 unused variables (ESLint) | cosmetic |
| AUD-38 | gateway refunds are manual (`refund_required` flag) | needs gateway sandbox keys |

---

## 3. Issues found and fixed during this upgrade

| # | Issue | Fix | Evidence |
|---|---|---|---|
| 1 | Faster-route offer and "Still there?" chips in night navigation: the ghost button ("Keep my route", "No, gone") was dark text on a dark chip — unreadable | `.nav-chip .btn.ghost { color: inherit; border-color: currentColor }` | `web/styles.css`; `docs/screenshots/v0720/e2e-*-07-still-there.png`, `*-08-faster-offer.png` |
| 2 | "Add a missing place" form: labels ran inline after the inputs on narrow screens | labels and fields stacked as blocks in `#reportPlace` | `web/styles.css`; `docs/screenshots/v0720/e2e-mobile-09-missing-place.png` |
| 3 | The "Check this field" error stayed after the user corrected the field | any input in the form clears the status line | `web/ui/report.js` |
| 4 | `docs/re/COMPETITOR_ANALYSIS_2026-11.md` had lost its §3 theme table, 36 matrix rows and §5 | rebuilt from the research notes (`MATRIX.md`, `USER_FEEDBACK.md`) with before/after columns | the doc itself |
| 5 | The long local E2E run was killed part-way (sandbox memory pressure, 115 PASS / 0 FAIL at that point) | the remainder was re-run in a chunk; the authoritative full run is CI's | §5 |
| 6 | `apicall github workflow_dispatch` dropped the `inputs` object for the attach run (HTTP 422 "Required input 'url' not provided") | dispatched through the REST endpoint directly with a JSON body (204) | attach run 6 |

---

## 4. Features implemented, per gap (0.7.20)

Every feature below has unit tests in `tests/v0720.test.js` (19 tests) and desktop + mobile E2E steps (`v0720 …` in
`tests/e2e.mjs`), with after-screenshots in `docs/screenshots/v0720/`. Strings are in en/hi/te
(`shared/i18n-v0720.js`); other languages fall back to English. Nothing has been run on a real phone yet.

### G1 — India road-quality guardrails ("Prefer main roads")
**Evidence.** Theme B (n = 10): narrow lanes in car mode, footpaths/stairs used as shortcuts by delivery riders, dead
ends; Google added narrow-road callouts in 8 cities; Bharat Map only warned about narrow roads *after* routing.
**Built.** `shared/guardrails.js` + `MAIN_ROADS` costing in `shared/valhalla.js`: documented Valhalla options
(`use_living_streets` low, higher `service_penalty`/`service_factor`, `use_tracks: 0`, unpaved excluded) for `auto` and
`motor_scooter`. Default ON for two-wheelers, OFF for cars (turning it on moves car routing to Valhalla, whose shared
FOSSGIS instance has a 1 req/s policy). The server routes main-roads requests to Valhalla first; if it falls back to
OSRM the response says `main_roads_applied=false` and the directions sheet shows "Prefer main roads isn't applied".
Reroutes keep the setting. **Not built:** gate/entrance snapping, "never route me here" polygons.

### G2 — Locality-aware, typo-tolerant search
**Evidence.** Theme A (n = 12, the top complaint); Organic Maps #10566 ("Al-Shifa Hospital, Perinthalmanna" returns
every Al-Shifa in India), OsmAnd #16127 (`addr:place` addresses). Bharat's index required every word in the place name.
**Built.** `shared/search-locality.js`: "name, locality[, city][, state]" and "name locality" forms; context parts
resolve against city/town/suburb/neighbourhood/locality rows or a 6-digit PIN; states/country ignored; matches
re-ranked by distance to the locality; one-edit typo fallback for words ≥ 5 letters. The same logic runs on the server
FTS5 path (`server/lib/search-fts.js`). Golden queries on the real bundled OSM index: "Apollo Hospitals, Jubilee
Hills", "hospital, Pendurthi", "kailasgiri" → Kailasagiri.

### G3 (part) — Bengaluru Namma Metro
**Evidence.** Theme E (n = 10); Organic Maps #5331 (121 reactions); competitors plan transit in 17–1,900 cities;
Bharat had Hyderabad only. **Built.** Unofficial BMRCL GTFS by Vonter (ODbL 1.0, valid 17 Aug 2026 – 17 Aug 2027;
3 routes, 170 stations) bundled with `ATTRIBUTION.txt` and compiled to `web/transit/bmrcl.json` (87 KB) for on-device
planning; every result says *Scheduled* and the attribution says intermediate stop times are approximated.
**Not built:** BMTC buses (feed size), Delhi OTD (its terms are a click-through form, not a verified open licence),
GTFS-RT live vehicles.

### G6 (part) — Add a missing place
**Evidence.** POI density is the #1 data complaint about open maps in India (theme A). **Built.** A third tab in the
report dialog: name, kind (19 kinds mapped to suggested OSM tags), optional phone / opening hours / website
(validated), pin + DIGIPIN + nearest landmark → one structured, anonymous OSM note (same Notes API and rate limit as
"Report a map problem"; nothing is written to the OSM database). **Not built:** Overture Places merge.

### G7 — Arrival / get-off alarms
**Evidence.** Where is my Train's destination alarm (50 Cr+ installs); a Hyderabad commuter's self-built "alarm within
~1 km of your stop". **Built.** `shared/alarms.js` + `web/nav/alarms.js`: "Alert me before <station>" on metro legs and
a destination alarm in navigation; default radius by kind (metro 1 km, destination 500 m); fires once after 2 fixes
inside the radius; fixes with poor accuracy or older than 60 s are ignored; local notification + banner.
**Limit:** foreground only (no background geofence); the navigation foreground service keeps fixes coming with the
screen off.

### G8 — Incidents along the route with "Still there?"
**Evidence.** HERE WeGo's "confirm it is still active"; Mappls users asking to mark accidents / waterlogging; Bharat's
v0.5 incidents were map-only. **Built.** `shared/route-alerts.js`: incidents within 50 m of the remaining route,
announced once ≤ 500 m ahead ("not verified"), then one "Still there? Yes / No, gone" chip after passing; votes follow
the server rules (yes extends ≤ 2 h; two "gone" more than "still there" remove), device-only votes stay on the device.

### G9 — Precise pickup hand-off
**Evidence.** Namma Yatri reviews ("locations are shown incorrectly to drivers despite my pinning the point
accurately"). **Built.** `shared/handoff.js`: every ride hand-off carries the 6-decimal pin, DIGIPIN and nearest
landmark — inside Uber's documented universal-link fields, and on the clipboard (with a toast) for Rapido, Namma Yatri,
Bharat Taxi, Yatri Sathi and Ola without an affiliate token, which have no documented pickup parameter. "Copy pickup
for driver" gives a WhatsApp-ready message with a `geo:` URI and an OSM link (`web/lib/clipboard.js`).

### G10 — "Your route, your voice"
**Evidence.** Theme F (n = 6): silent reroutes and the forced new voice in Google Maps (Oct 2026). **Built.**
`shared/reroute.js`: on-route, a faster route is only *offered* ("Faster route · saves N min — Switch / Keep my
route") when it saves ≥ 2 min and ≥ 10 %; automatic switching is opt-in and always announced; off-route reroutes keep
main roads / avoid tolls / avoid highways; the chosen guidance voice is never overwritten when a device lacks it
(per-utterance fallback). Offers compare free-flow durations unless a traffic key is configured, so they are rare.

---

## 5. Testing

| Suite | 0.7.18 (`9ced124`) | 0.7.19 audit (`4ae5bed`) | 0.7.20 (`810a020`) |
|---|---|---|---|
| Unit + API (`npm test`) | 209 / 209 | 228 / 228 | **247 / 247** (+19 in `tests/v0720.test.js`) |
| Browser E2E (`tests/e2e.mjs`, desktop + mobile Chromium) | 137 / 137 | 137 / 137 | **152 PASS / 0 FAIL** (+15 v0720 steps) |
| CI | run 18 | [run 19](https://github.com/Hem456anth/BharatMap/actions/runs/41678130550) | [run 20](https://github.com/Hem456anth/BharatMap/actions/runs/41691102925) — all three jobs green on the first push (247 / 247, 152 PASS / 0 FAIL E2E, Android build); 0 fix rounds |

Local E2E: the full run reached 115 PASS / 0 FAIL before the sandbox killed it under memory pressure; the remaining
v0718 + v0720 steps were run as a chunk (34 PASS / 0 FAIL), and the v0720 steps again after the visual fixes
(17 PASS / 0 FAIL). The authoritative single full run is CI's.

Device testing: **none** — all checks are headless Chromium plus apksigner/aapt on the APK.

## 6. Release

| Item | Value |
|---|---|
| Release | https://github.com/Hem456anth/BharatMap/releases/tag/v0.7.20 |
| APK | `bharat-map-0.7.20.apk`, 100,688,504 bytes, SHA-256 `e91febdbcb6d4a871e4b22cb12730e92befd252047e4d7f3041e587d4af04d0e` |
| Signing | release key (alias `bharatmap`, cert SHA-256 `d04d20f9…7c6c`), v1 + v2 + v3 verified, zipalign OK, not debuggable, no R8/minification |
| Attach run | [attach run 6](https://github.com/Hem456anth/BharatMap/actions/runs/41692882097) (SHA-256 checked and signature re-verified on GitHub; asset re-downloaded and hash matched) |

## 7. Remaining risks

- **No real-device run** for anything in 0.7.x: alarms, background navigation, voices, hand-offs to installed apps.
- **Survey-of-India boundaries are not rendered** (G4) — a launch blocker for distribution in India.
- **Routing depends on shared public servers** (FOSSGIS Valhalla/OSRM) until a self-hosted backend exists; "Prefer
  main roads" on cars adds load to Valhalla.
- **Bengaluru metro times are approximated** (unofficial feed); users could miss a train if they trust minutes.
- **Community data is unverified** and can be gamed (AUD-28); it is labelled as such everywhere.
- **Hindi / Telugu strings need native review**; 8 other languages fall back to English for v0.7 strings.
- **Payments**: refunds are manual (AUD-38); gateways never tested against sandboxes.
- **APK size ~100 MB** (11 bundled cities); slimming awaits the owner.

## 8. Roadmap

| # | Item | Depends on |
|---|---|---|
| 1 | **C1 / G5 on-device offline routing** (valhalla-mobile Capacitor plugin, graph per city pack; Vizag graph already built) | device testing on 2–3 GB phones |
| 2 | **G4 Survey-of-India boundary layer** (official outline overlay, hide OSM disputed lines inside India, CI render test) | confirming the official download and its terms |
| 3 | **BMTC (Bengaluru buses) and Delhi OTD feeds** + GTFS-RT live vehicles | licence confirmation; feed size / per-city packs |
| 4 | **APK slimming** (bundle Vizag + Hyderabad, downloadable packs for the rest, fonts, R8) | owner's approval (conflicts with the earlier "do not slim" direction) |
| 5 | **Real-device test pass** (alarms, background nav, voices, App Links, low-end tiers) | phones |
| 6 | **Native i18n review** (hi, te first; then the 8 fallback languages; G11 grammar-aware turn text) | native speakers |
| 7 | **Gateway refunds** (Razorpay / Cashfree refund API + webhook) | sandbox keys |
| 8 | **Express 5 / Capacitor 8** majors (clears AUD-22/23) | migration + device testing |
| later | G12 weekly region packs + deltas · G13 authority safety layers · G14 Mangrove reviews · G16 railways · G18 widget · G19 Android Auto · G20 iOS | see `GAPS_RANKED.md` |
