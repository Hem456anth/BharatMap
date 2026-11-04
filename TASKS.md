# Tasks

Actionable backlog for the next sessions, derived from [ROADMAP.md](ROADMAP.md). Each task says what "done" means and
what blocks it. **Owner-gated** tasks must not be started (or only prepared, without merging behaviour changes) until
the owner says so. Update this file when a task starts or finishes, and record outcomes in [CHANGELOG.md](CHANGELOG.md).

## Owner-gated (ask first)

| ID | Task | Blocker / what to ask |
|---|---|---|
| T-OWN-1 | Add the 4 CI signing secrets (`ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) | Owner adds them in GitHub → Settings → Secrets (the automation token cannot). Never paste the values anywhere |
| T-OWN-2 | Deploy the backend on Render (`render.yaml`), then set repo **variable** `MAPOS_API_BASE` | Owner's Render account + `ADMIN_PASSWORD` (≥ 12). After deploy: narrow the CSP from `*.onrender.com` to the real host (AUD-26) |
| T-OWN-3 | APK slimming (C3 + C13) | Explicit approval (ADR-012). Until then: no bundle changes, no R8, no font trimming |
| T-OWN-4 | Delete stale release **v0.5.11** (failed E2E) | Ask before deleting |
| T-OWN-5 | Gateway sandbox runs + refunds (AUD-38) | Sandbox keys for Razorpay (and Cashfree/PhonePe/Paytm if wanted) |
| T-OWN-6 | Traffic key (TomTom/HERE) | Paid key |
| T-OWN-7 | Real-device test pass | Phones; what to cover: `docs/UPGRADE_REPORT_2026-11.md` §7 (remaining risks) and FEATURES.md "Not verified outside the test harness" |
| T-OWN-8 | Seller self-registration policy (AUD-24) | Product decision |

## Engineering (can start)

| ID | Task | Done when | Notes |
|---|---|---|---|
| T-1 | **C1 spike: on-device routing** with valhalla-mobile in a Capacitor plugin, Vizag graph from `scripts/build-graph.sh` | A route Dwaraka Nagar → RK Beach computed on device offline; labelled; unit-tested JS bridge; CI builds the APK | Native build only in CI (aarch64 sandbox); size impact reported, not optimised (ADR-012). See `docs/OFFLINE_ROUTING.md`, `docs/re/OPPORTUNITIES.md` C1 |
| T-2 | **Per-city search DB** for the device (FTS5 or token index per pack) | Same ranking as `shared/search-index.js#rankCandidates`; parity test vs server FTS5 | Part of C1/C2 |
| T-3 | **G4 Survey-of-India boundaries: licence research first** | A written note in `docs/` naming the official source and its terms; only then a render layer + CI render test | Do not ship any boundary data whose licence is unclear |
| T-4 | **Audit Lows** that need no owner input: AUD-25 (sliding-window legacy limiter), AUD-27 (SSE token out of the query string), AUD-29 (SW config caching + tile eviction), AUD-32 (Cashfree webhook timestamp), AUD-33 (drop `http://` in the link-out plugin after confirming https links), AUD-36 (bundle modules, stream the 12.5 MB index), AUD-37 (8 unused variables) | Each with a regression test in `tests/audit-2026-11.test.js` or a new file added to `npm test`; `docs/AUDIT-2026-11.md` status updated | AUD-22/23 → T-5; AUD-24/26/34/38 owner-gated; AUD-28 by design |
| T-5 | **Express 5 / Capacitor 8 / TTS 8** upgrade (AUD-22, AUD-23) | `npm test` + E2E green; CI APK builds; `npm audit` clean of the moderate CLI advisories | Device test still needed before release |
| T-6 | **BMTC / Delhi OTD feeds** | Licence confirmed and recorded in `server/transit/feeds/<id>/ATTRIBUTION.txt`; size handled (per-city pack or server-only) | Do not bundle without a verified open licence |
| T-7 | **i18n** hi/te native review hooks; fill the 8 fallback languages | Strings reviewed by native speakers (not machine output presented as final) | Keep fallback logging |
| T-8 | **UI items A8–A14, A16–A18** | Per item: unit + E2E, before/after screenshots of our own app only | Item specs live outside the repo (ask the owner for them) |
| T-9 | **FCM push** (closed-app notifications) | Sender in `server/notify.js` behind an env var, client registration, tests with a mocked FCM | Needs a Firebase project (owner) for real use |
| T-10 | **Rider GPS** (foreground service for riders, pings into tracking) | Tracking switches from simulation to pings when present | Rider app scope to agree with the owner |
| T-11 | **PostGIS + Redis** path | `db/postgis/` mirrors migrations 003/004/006; a `DATABASE_URL` adapter; shared limiter/cache in Redis | Needed before more than one replica |
| T-12 | **ONDC signing** (ed25519, registry) | Signed Beckn calls against the ONDC staging registry | Needs onboarding |
| T-13 | **Play Store release** | Background-location declaration (AUD-34), privacy policy, store listing | Owner account |
| T-14 | Fix the small doc/code inconsistencies listed in [FEATURES.md](FEATURES.md#known-code-and-doc-inconsistencies) (workflow comment AUD numbers, `VERSION` constant, stale `docs/test-output.txt`) | Changed in a normal (CI-running) commit | Not done in the docs-only pass because they touch config/code |

## Definition of done (every task)

1. `npm test` green (currently 247) with new tests for new behaviour; E2E steps for UI changes
   (`node tests/e2e.mjs`, server on :8080).
2. Honesty rules kept (labels, no fabricated data), India bbox validation on new inputs, INR integers.
3. Docs updated: [FEATURES.md](FEATURES.md) status, [CHANGELOG.md](CHANGELOG.md), [API.md](API.md) /
   [DATABASE.md](DATABASE.md) / [SETUP.md](SETUP.md) when routes, tables or env vars change, a new ADR in
   [DECISIONS.md](DECISIONS.md) for a decision.
4. Commit as `Hem456anth <183790673+Hem456anth@users.noreply.github.com>`; never stage `dist/india-mapos-demo.html`,
   `docs/perf-v04.json` or regenerated screenshots ([CONTRIBUTING.md](CONTRIBUTING.md)).
