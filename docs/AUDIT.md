# Final Audit — India MapOS v0.1 (18 Oct 2026)

Legend: ✅ Implemented & tested · 🟡 Prototype / partial / simulated · 🔌 External dependency · ⛔ Not built

## 1. Feature matrix
| Area | Item | Status | Evidence / notes |
|---|---|---|---|
| Maps | Vector map, zoom/pan/scale, locate me | ✅ | MapLibre GL JS 6.15 (vendored), E2E screenshots |
| Maps | Local-language labels | 🟡 | Uses OSM `name:<lang>` where present; coverage varies by area |
| Maps | 3D tilt + extruded buildings | ✅/🔌 | Pitch toggle; extrusions come from OpenFreeMap "liberty" style |
| Maps | Offline | 🟡 | Service worker caches app shell + viewed tiles; downloadable offline regions (PMTiles) ⛔ |
| Maps | Turn-by-turn voice navigation | ⛔ | Route line + distance/time only |
| Maps | Survey-of-India boundaries | ⛔ | Required before public launch (RESEARCH §2) |
| Marketplace | Business types, verified badge, rating, hours, catalogue, MRP/discount, stock, wholesale tiers | ✅ | 15 **fictional** businesses, 2 cities |
| Marketplace | Seller onboarding/KYC/GSTIN verification | 🟡 | Admin verify endpoint only; no document workflow |
| Killer flow | Search → map pins → product → cart → checkout → rider → live tracking | ✅ | API test "KILLER FLOW", Chromium E2E desktop + mobile |
| Quick commerce | In-stock-first, cheapest sort, size/price filters, locality re-centre, pickup | ✅ | unit tests |
| Payments | COD + "UPI (simulated)" | 🟡 | No PSP integration; no money moves |
| Logistics | Fee rules, bulky handling, vehicle policy, nearest-rider assignment | ✅ | unit tests |
| Logistics | Road routing | ✅/🔌 | OSRM (public demo by default → self-host); offline fallback estimate |
| Logistics | Truck navigation (restrictions) | 🟡 | `profile=truck` = speed factor only; true truck costing needs Valhalla/GraphHopper ⛔ |
| Logistics | Multi-stop route optimisation | ✅ | NN + 2-opt API (≤25 stops); VROOM for production |
| Logistics | Live tracking | 🟡 | SSE + polling work end-to-end; **rider position is simulated along the real route** (no rider GPS app) |
| Logistics | Fleet / warehouses | 🟡 | Admin fleet list; warehouse records; no warehouse inventory transfer |
| AI | NL intents (search, supplier discovery, route, mobility, geocode), multilingual | ✅ | Deterministic engine, tested |
| AI | LLM rewrite | 🟡/🔌 | Optional OpenAI-compatible hook (`LLM_*` env); untested without key |
| Mobility | Metro/rail/bus/airport/EV/parking/toll POIs | 🟡 | 13 **illustrative sample** points |
| Mobility | Live EV/parking/fuel/bus stops | ✅/🔌 | OpenStreetMap via Overpass (`live=1`) |
| Mobility | Live traffic, toll rates, train/bus schedules | ⛔/🔌 | Need licensed feeds / GTFS (RESEARCH §4) |
| Address | Landmark + relation + locality + pincode + DIGIPIN parsing w/ confidence | ✅ | 9 localities/landmarks per city in seed; tested |
| Address | DIGIPIN encode/decode | ✅ | Matches India Post reference `39J-49L-L8T4` |
| Address | Nominatim fallback | ✅/🔌 | Public server for dev only |
| i18n | 11-language UI, native-script query understanding | ✅/🟡 | Machine-assisted strings → native review required |
| Accounts | Customer/seller/rider/admin roles, JWT, RBAC, seller dashboard, admin | ✅ | Rider *app* ⛔ (role & API only) |
| ONDC | Beckn `on_search` catalogue mapping | 🟡 | Unsigned, not registered; select/init/confirm ⛔ |
| Android | PWA installable; Capacitor config | 🟡 | No APK built |
| Deploy | Dockerfile, compose (app+OSRM, PostGIS/Valhalla profile), env, guides | ✅ | Not deployed to a public production host from this environment |

## 2. Test results
- **Unit + API integration**: 32/32 pass (`npm test`, `docs/test-output.txt`) — geo, DIGIPIN, address, i18n, query parsing, ranking, assistant, pricing, rider assignment, tracking monotonicity, route optimisation, auth/lockout/RBAC, IDOR, stock race protection, validation, seller/admin, SQLi, metrics.
- **E2E (real Chromium)**: 17/17 pass against the server (desktop 1366×820 + mobile 390×844), 0 console errors (`docs/e2e-results.txt`, screenshots in `docs/screenshots/`).
- **Serverless demo E2E**: 5/5 pass (`docs/e2e-demo-results.txt`).
- **Load** (1 Node process, sandbox VM, demo catalogue, external calls off): 23,555 requests in 15 s at 50 concurrency → **~1,570 rps, p50 30 ms, p95 48 ms, p99 64 ms, 0 errors** (`docs/load-results.txt`). Rate limiter verified (429 after limit).
- **Dependencies**: `npm audit` → 0 vulnerabilities (MapLibre upgraded 4.7 → 6.15 to clear GHSA-jrc7-96c5-q579).
- Exception: the standalone demo file (`dist/`, published Page) loads MapLibre **5.24 UMD** from unpkg, because the static host rejects ES modules and 6.x is ESM-only. 5.x is in the advisory range (XSS in `DOM.sanitize`, used for HTML popups/attribution); the demo renders no user-supplied HTML popups and holds only fictional data. The real app (server-hosted) uses 6.15.

## 3. Security
Implemented: scrypt password hashing (N=16384), HS256 JWT with alg pinning + expiry + timing-safe compare, required secret in production, RBAC on every mutating route, object-level authorisation on orders (404 for others → no IDOR), login lockout (5 fails / 5 min), per-IP rate limiting, JSON body limit 64 KB, parameterised SQL everywhere, input clamping (coords inside India, qty 1–500, prices), atomic conditional stock decrement in `BEGIN IMMEDIATE` (no overselling), CSP (`script-src 'self'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS in production, CORS allow-list, HTML escaping in all client rendering, request IDs, audit log table, no secrets in logs (paths only, no query strings).

Known gaps / risks:
| Risk | Severity | Fix |
|---|---|---|
| JWT stored in localStorage (XSS → token theft) | Medium | HttpOnly SameSite cookie + CSRF token; refresh-token rotation |
| SSE uses `?token=` (may land in proxy logs) | Low | Short-lived stream ticket endpoint |
| Rate limit / lockout / tile cache are in-memory per process | Medium at scale | Redis |
| `/map/*` tile proxy not rate-limited and could be used as bandwidth relay to the upstream | Low | Limit to tile paths + rate limit, or serve PMTiles from CDN directly |
| `style-src 'unsafe-inline'` (inline style attributes for progress bar) | Low | Move to classes / nonces |
| Seeded demo accounts with shared password | High if deployed as-is | Disable seed / set `DEMO_PASSWORD`, remove demo users |
| No payment integrity (simulated UPI) | N/A until PSP | Server-side PSP verification + webhooks |
| Personal data (drop locations) without DPDP consent/retention policy | Medium | Consent, privacy notice, retention jobs |

## 4. Performance
- Server: search is an in-process scan of the catalogue (fine for ~10k businesses per city, measured ~1.5k rps). Beyond that: PostGIS `ST_DWithin` + GiST and tsvector/trigram (schema provided), Redis cache for hot queries, search index (OpenSearch/Typesense).
- Client: 93 KB single-file demo bundle (excl. MapLibre 1.1 MB, cached by SW); results render as HTML markers (OK for < ~200 pins; switch to a GeoJSON symbol layer with clustering beyond that); typeahead debounced 220 ms.
- Routing: public OSRM adds 100–600 ms and has usage limits → self-host; routes cached 10 min.
- Tracking is computed statelessly per request (no timers per order on the server); SSE interval 1.5 s.

## 5. Accessibility (WCAG 2.1 AA intent — not formally audited)
Done: semantic landmarks, skip link, labelled inputs/selects, `aria-live` for results/chat/toast, `role=tablist/tab/tabpanel` with `aria-selected`, keyboard-focusable cards and buttons with visible focus ring (3 px), `lang` attribute switches with language, progressbar semantics, reduced-motion support, ≥ 4.5:1 text contrast on primary colours (white on #0f6e56 ≈ 6.0:1), touch targets ≥ 38–44 px, map markers are `<button>`s with descriptive labels.
Gaps: tab arrow-key navigation, map canvas has no non-visual equivalent beyond the results list (list mirrors pins), no screen-reader test pass (NVDA/TalkBack), confirm() dialog for cart replacement.

## 6. SEO & mobile
Title/description/OG tags, JSON-LD `WebApplication`, theme colour, manifest + icon (installable PWA), responsive bottom-sheet layout < 820 px, viewport-fit for notches. SPA content (shop pages) is not server-rendered → add SSR/static business pages (`/b/<slug>`) with LocalBusiness JSON-LD for organic discovery.

## 7. Licensing
| Component | Licence | Obligation |
|---|---|---|
| OpenStreetMap data (tiles, Overpass, Nominatim, OSRM graph) | ODbL 1.0 | Attribution shown on map ✅; share-alike for derived *databases* if we publish them |
| OpenFreeMap tiles / OpenMapTiles schema & style | Open (see each project's licence page; verify before launch) | Attribution shown ✅; heavy use of the public instance → self-host |
| MapLibre GL JS | BSD-3-Clause | Licence file shipped in `web/vendor/LICENSE.txt` ✅ |
| OSRM | BSD-2-Clause | – |
| Express | MIT | – |
| DIGIPIN algorithm | Published openly by India Post (see RESEARCH §1.2) | Our implementation is independent, verified against India Post's example output |
| Google Maps / Mappls | Proprietary | **No code, data or API output used or stored** ✅ (clean-room, RESEARCH §2) |
| Public demo servers (OSRM, Nominatim, Overpass, OpenFreeMap) | Usage policies | Dev only; self-host before launch |
| Project code | UNLICENSED (owner's choice) | Choose a licence before publishing |

## 8. Scalability path
1. **City pilot (now)**: 1–2 containers, SQLite WAL, self-hosted OSRM → hundreds of orders/day.
2. **Multi-city**: PostgreSQL+PostGIS (schema ready), Redis, event bus, Valhalla, Photon/Nominatim, PMTiles on CDN; stateless API pods behind LB; rider GPS ingest via WebSocket gateway; VROOM batching.
3. **Nationwide**: partition orders/pings by time & region, H3-sharded supply/demand, search cluster, ONDC as BAP/BPP, multi-region active-passive in India.

## 9. Verdict
A working, tested MVP of the core loop (find → compare → order → dispatch → track) with India-specific address intelligence and 11-language UX, built only on legitimate open data. Not production-launch-ready until: real sellers/inventory, payments, rider app with GPS, self-hosted map stack with Survey-of-India boundaries, cookie-based auth, Redis/PostGIS, DPDP compliance, and native-speaker i18n review.

## v0.2 audit (2026-10-18)
- `npm test`: **44/44 pass** (32 v0.1 + 12 new: migration 002 integrity, Razorpay order/verify/webhook with stubbed HTTP, disabled-payments 503, notifications, admin RBAC/overview/CSV, product deactivation, user disable revokes live JWT, GSTIN validation, Capacitor CORS).
- Chromium E2E against server: **21/21 pass** (desktop + mobile), 0 console errors; new steps: offline map renders bundled PMTiles with zero online tile requests, admin dashboard (verify seller, products, users, audit, CSV download), notifications bell, settings URL validation.
- Migration 002 verified on a v0.1 database with existing orders: rows and order_items preserved, `PRAGMA foreign_key_check` clean, cascades still active.
- Security changes: production refuses to seed without `ADMIN_PASSWORD` (≥12 chars); disabled users lose access immediately; Razorpay signatures checked with constant-time compare; webhook verified over raw bytes; CSV export guards against formula injection; CSP extended only for checkout.razorpay.com; Android `allowBackup=false`, cleartext disabled.
- APK: built in CI (GitHub Actions, x86 runner). The Hark sandbox is aarch64, where Google ships no Android build-tools, so no APK is built locally.
