# Bharat Map v0.3 — Test report

Run date: 18 Oct 2026 (IST), on the release commit. Raw outputs: `docs/test-output.txt` (npm test),
`docs/e2e-results.txt` (Chromium E2E), `docs/e2e-demo-results.txt` (single-file demo E2E). Screenshots: `docs/screenshots/v03-*.png`.

## Summary
| Suite | Result |
|---|---|
| Unit + API (`npm test`, node:test) | **64 / 64 pass**, 0 fail |
| Browser E2E (`tests/e2e.mjs`, Chromium) | **43 / 43 pass** — desktop 26, mobile 17 |
| Single-file demo E2E (`tests/e2e-demo.mjs`) | **6 / 6 pass** |
| Demo build (`npm run build:demo`) | OK — `dist/india-mapos-demo.html` (333 KB) |
| CI (GitHub Actions) | tests + audit + secret scan, E2E, Android APK build and release — see the run linked from the release |

## Unit + API (64)
| File | Tests | Covers |
|---|---|---|
| `tests/unit.test.js` | 20 | geo (haversine, DIGIPIN vs India Post reference, round-trip), address resolver (landmark/locality/pincode, Telugu), i18n (11 languages), query parsing, search ranking, pricing, rider assignment, tracking, route optimisation |
| `tests/api.test.js` | 12 | health + security headers, search validation, geocode/route/optimize, auth + lockout + RBAC, the full order → rider → tracking → delivered flow, order validation, wholesale, seller dashboard, SQL-injection inertness, metrics |
| `tests/phase2.test.js` | 12 | migrations, config without secrets, CORS (Capacitor origin only), Razorpay order/signature/webhook, notifications, admin (RBAC, CSV, deactivation, user disable, GSTIN) |
| `tests/v03.test.js` | 16 | opening_hours parser, off-route detector (3 fixes > 50 m, accuracy-aware), route tracker, maneuver text en/hi/te, landmark instructions (≤ 150 m), distance rounding, sheet detent maths, Overpass query/parse, OSRM URL/parse/fallback, geocode parsing, saved-places model, i18n completeness for en/hi/te |
| `tests/v03-api.test.js` | 4 | saved places API (auth, round-trip, per-user isolation, size cap), CSP header = app-shell `<meta>`, version 0.3 + migration 003 + style-proxy allow-list, service-worker precache list only names existing files |

## Browser E2E journeys
Viewports: desktop 1366×820, mobile 390×844 (touch). Every journey passed on each viewport it runs on.

| Journey | Desktop | Mobile |
|---|:-:|:-:|
| Map-first home (search pill, 12 category chips, saved, recents) | ✅ | ✅ |
| Sheet detents (keyboard on grabber, drag, fling) | ✅ | ✅ |
| Category "Petrol" → OSM POIs → list + markers | ✅ | ✅ |
| Place card (category, distance, address, actions) | ✅ | ✅ |
| Save to Favourites + set Home → shown on home sheet | ✅ | ✅ |
| Search "RK Beach" → directions with alternatives | ✅ | ✅ |
| Modes: two-wheeler estimate label, walk = foot profile, transit stops (no timetable) | ✅ | ✅ |
| Simulated drive → nav banner, en-IN voice, mute, arrival | ✅ | ✅ |
| GPS off-route (3 fixes > 50 m) → reroute | ✅ | — |
| Landmark + Telugu instructions in step list and voice | ✅ | — |
| Drop pin (right-click / long-press) → reverse geocode → place card | ✅ | ✅ |
| Photon type-ahead | ✅ | — |
| Layers sheet (style, 3D, transit, overlays, traffic disabled) | ✅ | — |
| Offline maps screen (bundled regions + sizes) | ✅ | — |
| Dark mode (settings → dark map + tokens) | ✅ | ✅ |
| Auto dark theme from `prefers-color-scheme` | — | ✅ |
| Offline fallback: network map fails → bundled PMTiles; routing fails → labelled estimate | — | ✅ |
| Shop: "LED TVs near me" → sellers + price markers | ✅ | ✅ |
| Telugu UI + native-script product query | ✅ | ✅ |
| Cart → sign in → order → live tracking | ✅ | ✅ |
| Assistant supplier discovery | ✅ | ✅ |
| Saved places sync to server when signed in | ✅ | — |
| Seller dashboard edit · mobility + address intelligence · admin dashboard · notifications · settings | ✅ | — |
| Console errors = 0 | ✅ | ✅ |

Single-file demo (`file://`, no server): shell boots and Shop search renders, in-browser backend active, order placed,
tracking progresses, category search, page errors 0.

## Fixtures caveat (read this)
The test sandbox has **no outbound internet**. Third-party map services the app calls — Overpass, Nominatim, Photon,
OSRM (routing.openstreetmap.de) and OpenFreeMap tiles/styles — are intercepted by `tests/e2e-net.mjs` and answered from
**real responses captured from those services** (`tests/fixtures/*.json`, Visakhapatnam / Hyderabad areas). The E2E
therefore proves the app parses and renders genuine service payloads, but not live availability, rate limits or
latency of the public endpoints. Web Speech is stubbed to record utterances (language + text) rather than play audio.
On real devices and in CI's live Chromium, these services are reached over the network.

## Accessibility and contrast
- Text tokens are ≥ 4.5:1 on their surfaces in both themes (computed; e.g. white on action green ≈ 6:1).
- E2E asserts ARIA state: sheet handle `aria-label` (collapsed/half/full), route options `aria-checked`, mute `aria-pressed`;
  navigation instructions are in an `aria-live` region; sheet operable by keyboard (↑/↓, Home/End).
- Release fixes from the screenshot review: (1) dark basemap street/place labels were dim grey (~2:1); they are now
  drawn light grey (#B9BDCB) with a dark halo (≈ 9–10:1 on the dark base) in `web/map/style.js`; (2) the map scale bar showed through/under the
  navigation banner — it is now hidden during navigation (`web/styles.css`).
- Not done: an external audit tool (axe) run, or TalkBack testing on a physical device.

## Privacy and security
- Location is requested only on a user action (locate, directions from current location, navigation).
- Recents and saved places stay on the device; they sync to `/api/me/places` only when signed in to a server. Settings has "Clear search history".
- One CSP (`shared/csp.js`) is used for the server header and the app-shell `<meta>` (Android); `connect-src` lists only
  OpenFreeMap, Overpass, Nominatim, Photon, OSRM, Razorpay and the backend host. A unit test enforces header = meta.
- Server also sends `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: geolocation=(self), camera=(), microphone=()`.
- CI fails on high/critical `npm audit` findings and on committed secret patterns.

## Known gaps
- No live traffic and no transit timetables (need licensed feeds); two-wheeler ETA uses the car graph and is labelled an estimate.
- Third-party services covered by fixtures only in the sandbox (see above); public OSM endpoints have fair-use limits and need self-hosting at scale.
- Hindi and Telugu are complete; 8 other languages fall back to English for v0.3 strings.
- Android: background navigation (foreground service) and push while the app is closed (FCM) are not built; the APK is debug-signed unless release secrets are set.
- Native plugin behaviour (Share sheet, back button, native TTS) is compiled by CI but not exercised by automated tests on a device/emulator.
- Shop sellers, products and riders are fictional demo data.
