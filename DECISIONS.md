# Architecture decision records

ADR-style log. Each entry has a date, the decision, the reasoning, the status and the evidence it was checked against
(commit, file or doc). Where the reasoning is not written down anywhere in the repo it is marked **(inferred)** or
**(owner-stated)** — the latter means it came from the owner's instructions, not from a file. Statuses: Accepted ·
Superseded · Pending (owner decision) · Proposed.

---

### ADR-001 — Capacitor (web app in an Android WebView) instead of a native Android app
- **Date:** 18 Oct 2026 · **Status:** Accepted
- **Decision:** One web client (`web/`) runs in the browser and, via Capacitor 7 (`android/`, `capacitor.config.json`,
  `webDir: www`), as the Android app. Native code is limited to small plugins (`BackgroundNavPlugin`,
  `NavLocationService`, `ExternalAppPlugin`) plus community/official Capacitor plugins.
- **Reasoning:** one code base for web and Android, the isomorphic `shared/` core runs identically on server, browser
  and app, and CI can build an APK on every push (inferred from the layout and the v0.2 commit). Known costs: MapLibre GL
  JS in a WebView (no complex Indic shaping, `docs/ANDROID.md`), Android Auto would need MapLibre Native
  (`docs/ANDROID_AUTO.md`); `docs/RESEARCH.md` lists MapLibre Native as the long-term mobile renderer.
- **Evidence:** `a0d17f9`, `docs/ANDROID.md`, `package.json` (`@capacitor/*` 7.x).

### ADR-002 — Clean-room, OpenStreetMap and open data only
- **Date:** 18 Oct 2026 (re-affirmed 20 Oct 2026 and 3 Nov 2026) · **Status:** Accepted
- **Decision:** All map data, POIs and routing come from OSM and openly licensed datasets; no Google, Mappls/MapmyIndia
  or other proprietary code, tiles or data. Reverse-engineering work in `docs/re/` is **behaviour-only** (public pages,
  manifests, signer certificates; nothing decompiled for code). No third-party screenshots, icons, fonts or copy are
  committed; Apple Maps screenshots are never committed. Code reuse only when the licence allows and it is listed in
  `docs/THIRD_PARTY.md` (currently no copied code).
- **Reasoning:** legal safety (ODbL attribution, no ToS violations), an original identity ("Deccan dusk"), and honesty.
  Bhuvan was ruled out because its ToS forbids derivative and navigation use (`docs/RESEARCH.md`).
- **Evidence:** `README.md` attribution, `docs/THIRD_PARTY.md`, `docs/re/DEEPLINKS.md` scope note,
  `docs/re/UI_UX_V0718.md`, `docs/re/APPLE_MAPS_APK_CHECK.md`.

### ADR-003 — OpenFreeMap online, Protomaps PMTiles offline, MapLibre GL JS
- **Date:** 18 Oct 2026 (v0.2/v0.3) · **Status:** Accepted
- **Decision:** Online basemap from OpenFreeMap (`liberty`, `dark`) directly or through the same-origin `/map` proxy;
  offline maps as bundled PMTiles cut from the Protomaps daily build (`scripts/make-region.sh`), 11 cities since v0.5;
  rendered with vendored MapLibre GL JS (BSD-3, no runtime CDN).
- **Reasoning:** free, ODbL, no keys, works offline from a single file per city; the target is self-hosted PMTiles on
  object storage + CDN with Survey-of-India boundaries (`ARCHITECTURE.md` §2).
- **Evidence:** `web/map/style.js`, `web/offline/`, `server/app.js` tile proxy, `docs/re/STACK_RESEARCH.md`.

### ADR-004 — Valhalla primary, OSRM secondary, Photon + Nominatim for geocoding, Overpass for POIs
- **Date:** 18 Oct 2026 (v0.3 research, v0.4 backend) · **Status:** Accepted (self-hosting pending)
- **Decision:** `/api/v1` fronts env-configurable upstreams with fallback chains: route = Valhalla ⇄ OSRM →
  labelled straight-line; geocode = Photon → Nominatim; EV = Open Charge Map (keyed) → OSM. Two-wheeler uses Valhalla
  `motor_scooter`; truck uses Valhalla truck costing; "Prefer main roads" is Valhalla-only (0.7.20).
- **Reasoning:** Valhalla has Indian-relevant costings (2W, truck, avoid tolls/highways) and is MIT; OSRM is fast and
  good for matrices; public FOSSGIS/komoot/OSMF instances are **dev-only** (1 req/s, identifying UA) and must be replaced
  by self-hosted services for production (`docs/re/STACK_RESEARCH.md` "Routing verdict").
- **Evidence:** `server/providers/index.js`, `server/lib/upstream.js`, `docs/SELF_HOSTING.md`, `836fdb5`.

### ADR-005 — Two service modes: own backend when configured, public OSM services otherwise
- **Date:** 18 Oct 2026 (v0.4) · **Status:** Accepted
- **Decision:** `web/services/server.js#serverBase()` uses `/api/v1` when a backend is configured (`MAPOS_API_BASE`,
  Settings, or `CLIENT_SERVICES=server`) and falls back to direct public calls; with no backend the APK runs fully
  on-device with fictional Shop data (`web/mock-api.js`).
- **Reasoning:** the app must work before any backend is deployed (none is deployed yet) and degrade gracefully.
- **Evidence:** `docs/re/STACK_RESEARCH.md` ("switch service without a software update"), `web/services/server.js`.

### ADR-006 — Honesty labels; no fabricated values
- **Date:** 20 Oct 2026 (v0.7) · **Status:** Accepted
- **Decision:** Every place-card value is labelled Live / Scheduled / Estimate / Link-out / Demo / Unavailable; Demo is
  never Live; no invented prices, fares, showtimes, slots or ETAs; demo sellers/riders are fictional and labelled; a
  self-check runs in tests over every sample place. Implemented / prototype / external work is always reported separately.
- **Reasoning:** trust, and to avoid implying partnerships or data the project does not have.
- **Evidence:** `shared/services/labels.js`, `shared/services/build.js`, `tests/v07.test.js`, `shared/seed.js` header.

### ADR-007 — Payments only through server-verified gateways; no `upi://` intents
- **Date:** 18 Oct 2026 (Razorpay, v0.2) · 20 Oct 2026 (separate payment screen, multi-gateway, v0.7) · **Status:** Accepted
- **Decision:** Online orders are created `pending_payment` and confirmed only after a server-verified payment
  (signature, server-to-server re-check, or signed webhook). Each gateway is enabled only by its own server-side keys.
  The app never builds `upi://` or other payment-scheme intents (UPI apps appear only inside the gateway checkout);
  payment schemes are refused by `intentUrl()`, `safeIntent()`, `safeLinkout()` and the native plugin. Simulated UPI is
  off unless `ALLOW_SIMULATED_UPI=1` and never marks anything paid.
- **Reasoning:** no client-trust payments, no key leakage, and avoiding unverified payment intents.
- **Evidence:** `server/payments/index.js`, `server/app.js` `markPaid`, `docs/re/DEEPLINKS.md`, `340e23b`.

### ADR-008 — SQLite now, PostGIS + Redis later
- **Date:** 18 Oct 2026 · **Status:** Accepted (migration pending)
- **Decision:** Run on SQLite via built-in `node:sqlite` (WAL, auto-migrations); keep a PostGIS schema in `db/postgis/`
  as the production target; move to PostGIS + Redis before multi-replica deployment.
- **Reasoning:** zero-ops pilot with no native builds (`ARCHITECTURE.md` §5 "Zero-ops pilot → spatial scale"); in-memory
  limiters/caches are per-process, so scale-out needs shared state.
- **Evidence:** `server/db.js`, `db/postgis/*.sql`, [DATABASE.md](DATABASE.md).

### ADR-009 — Rename to "Bharat Map"; keep folder and package id
- **Date:** 18 Oct 2026 · **Status:** Accepted
- **Decision:** The product is "Bharat Map" (commit `8d57c5b`, release v0.2.4). The repository folder `india-mapos/`, the
  Android package id `com.indiamapos.app` (also `namespace`), the Render service name `india-mapos-api` and internal
  names (`mapos_*` metrics, `__MAPOS_CONFIG__`, `MAPOS_API_BASE`, `data/mapos.db`) are kept.
- **Reasoning:** changing the package id would stop updates installing over existing builds; a reverse-domain id such
  as `in.bharatmap…` is unusable because `in` is a Java keyword (owner-stated).
- **Evidence:** `8d57c5b`, `android/app/build.gradle`, `capacitor.config.json`.

### ADR-010 — Version scheme `0.7.<CI run>`; every push to `main` releases
- **Date:** 19–20 Oct 2026 · **Status:** Accepted
- **Decision:** CI (`ci.yml`) builds on every push to `main` and publishes GitHub release `v0.7.<run_number>` with
  `VERSION_CODE = run_number`. Docs-only commits use `[skip ci]` so they do not create releases.
  `package.json`/`server/app.js` versions stay `0.7.0`.
- **Evidence:** `.github/workflows/ci.yml` (`VER: 0.7.${{ github.run_number }}`), `340e23b`, [CHANGELOG.md](CHANGELOG.md).

### ADR-011 — Release key kept outside the repo; offline signing until CI has secrets
- **Date:** 19 Oct 2026 (key created, v0.5.13) · 20 Oct 2026 (`attach-apk.yml`, `1ec883f`) · 3 Nov 2026 (cert pinned, AUD-21) · **Status:** Accepted
- **Decision:** The release keystore (alias `bharatmap`, cert SHA-256 `d04d20f9…b7997c6c`) lives in the project-root
  `signing/` folder outside the repo (gitignored). CI builds an unsigned release artifact when the four `ANDROID_*`
  secrets are absent; the APK is signed offline (`zipalign -P 16 4`, `apksigner`, in `/tmp`) and attached through the
  manual `attach-apk.yml` (url, sha256, tag, name), dispatched via the REST workflow-dispatch endpoint. Both workflows
  pin the certificate SHA-256. Release builds are not debuggable and have no R8/minification or resource shrinking.
- **Reasoning:** the automation's GitHub token cannot write Actions secrets or upload release assets directly; the owner has not
  added the secrets yet. Losing the key would break updates for every install.
- **Evidence:** `4c89851`, `f6f850d`, `1ec883f`, `4ae5bed`, [SETUP.md](SETUP.md#android-release-and-signing).

### ADR-012 — APK size: "do not slim" (19 Oct) → "smoother and lighter" requested (20 Oct) → pending
- **Date:** 19 Oct 2026 / 20 Oct 2026 · **Status:** Pending (owner decision) — **do not implement without explicit approval**
- **Decision so far:** The APK stays ≈ 100 MB with 11 bundled cities (PMTiles 81,396,970 bytes), full fonts and no R8.
  On 19 Oct the owner said not to slim (bigger and more powerful preferred). On 20 Oct he asked for "smoother and
  lighter"; a plan was proposed — bundle only Visakhapatnam + Hyderabad and make the other 9 cities downloadable (C3,
  APK ≈ 32 MB), trim glyph fonts + R8 (C13), target ≈ 30–40 MB — and **not approved**.
- **Evidence:** `docs/re/COMAPS_TEARDOWN.md` §6, `docs/re/OPPORTUNITIES.md` C3/C13 (⏸ approval),
  `docs/UPGRADE_REPORT_2026-11.md` constraints and roadmap item 4.

### ADR-013 — CoMaps is the main architectural blueprint; Apple Maps web is UI/UX-only
- **Date:** 20 Oct 2026 · **Status:** Accepted
- **Decision:** CoMaps (Organic Maps fork, Apache-2.0) is the primary architecture reference: offline-first,
  downloadable region packs, on-device routing and search, lean core. Apple Maps (web) informs UI/UX only (0.7.18 pass;
  notes kept outside the repo). AMap, Google Maps and HERE teardowns are earlier references. CoMaps code is not embedded
  (no two-wheeler router; state-level packs too large); the recommended on-device engine is valhalla-mobile + SQLite
  FTS5 per city pack.
- **Evidence:** `a9e29d9`, `docs/re/COMAPS_TEARDOWN.md`, `docs/re/OPPORTUNITIES.md` (C1 verdict), `docs/THIRD_PARTY.md`.

### ADR-014 — App hand-offs: documented links and verified App Links only; nothing guessed
- **Date:** 20 Oct 2026 (0.7.15, 0.7.16) · **Status:** Accepted
- **Decision:** Outbound links to provider apps are built only from evidence: **Documented** formats (Uber pickup/drop;
  Ola only with an affiliate token), **App Links** on https hosts whose own `/.well-known/assetlinks.json` lists the
  package (and, where an APK was supplied, the same signer certificate), with no query parameters; **Declared ·
  Unverified** custom-scheme entry points only with an official https fallback and a warning label (Rapido); **Store**
  links only for packages confirmed on the official site/Play listing; otherwise **Web-only** with a reason. Nothing is
  decompiled; no scrapers or mirrors; no payment schemes. Inbound, the app handles `geo:` and `bharatmap://`
  (no verified inbound App Link domain is declared in `AndroidManifest.xml`).
- **Evidence:** `docs/re/DEEPLINKS.md`, `shared/services/deeplinks.js`, `shared/services/deeplinks-web.js`,
  `data/deeplinks/`, `5cb9301`, `113fbe2`.

### ADR-015 — Security posture from the November 2026 audit
- **Date:** 3 Nov 2026 · **Status:** Accepted
- **Decision:** No known passwords in production (`ADMIN_PASSWORD`, `DEMO_PASSWORD` rules), `JWT_SECRET` fail-fast,
  roles re-read per request, unpaid orders expire, SSE caps, least-privilege CI with SHA-pinned actions, release cert
  pinned. 14 Low findings left open with reasons (see [TASKS.md](TASKS.md)).
- **Evidence:** `docs/AUDIT-2026-11.md`, `4ae5bed`, `tests/audit-2026-11.test.js`.

### ADR-016 — Dark-mode cards darker than the panel (owner's call)
- **Date:** 20 Oct 2026 · **Status:** Accepted, revisit after device testing
- **Decision:** Shipped as the owner asked, although the internal gap list advised against it for sunlight legibility;
  secondary text contrast kept ≥ 8:1.
- **Evidence:** `docs/re/UI_UX_V0718.md` "Deliberate deviation".

### ADR-017 — Unofficial Bengaluru metro feed allowed, labelled; BMTC/Delhi feeds held back
- **Date:** 3 Nov 2026 · **Status:** Accepted (BMTC/Delhi pending licence and size)
- **Decision:** Bundle the unofficial BMRCL GTFS (ODbL 1.0, Vonter) with attribution that says intermediate times are
  approximated. Do not bundle BMTC (size) or Delhi OTD (click-through terms, open licence not verified).
- **Evidence:** `server/transit/feeds/bmrcl/ATTRIBUTION.txt`, `docs/UPGRADE_REPORT_2026-11.md` G3.

### ADR-018 — Root docs are canonical; `docs/` holds deep references
- **Date:** 4 Nov 2026 · **Status:** Accepted
- **Decision:** The 13 root documents are the canonical handoff set. A `docs/` file whose topic is now covered by a root
  file was merged into it and replaced by a one-line pointer (`docs/ARCHITECTURE.md`, `docs/API.md`,
  `docs/CONFIGURATION.md`, `docs/DEPLOYMENT.md`, `docs/KNOWN_LIMITATIONS.md`). All other `docs/` files (audits, test
  reports, research, `docs/re/` teardowns, Android/self-hosting/offline-routing guides, the generated integration matrix)
  stay in place as deep references and are linked, not copied.
- **Evidence:** [CLAUDE.md](CLAUDE.md) "Documentation map".
