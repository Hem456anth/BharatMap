# Contributing

Rules for anyone (human or agent) changing this repository. Start with [CLAUDE.md](CLAUDE.md).

## Workflow

1. Read [CLAUDE.md](CLAUDE.md), then the root doc for the area you touch ([ARCHITECTURE.md](ARCHITECTURE.md),
   [API.md](API.md), [DATABASE.md](DATABASE.md), [SETUP.md](SETUP.md)).
2. Pick a task from [TASKS.md](TASKS.md). Owner-gated tasks need the owner's explicit yes first.
3. Work on `main` in small commits (the project has used direct pushes to `main`; every push runs CI and **publishes a
   release** `v0.7.<run>`), or on a branch + pull request when the change is risky (CI also runs on pull requests, but
   only pushes to `main` publish releases).
4. Run `npm test` (247 today) and, for any UI change, the E2E suite with the server on :8080
   (`scripts/dev-restart.sh && node tests/e2e.mjs`; Chromium + `fonts-noto-core` required).
5. Update docs in the same commit (see "Docs" below).

## Commits

- Author/committer **must** be `Hem456anth <183790673+Hem456anth@users.noreply.github.com>` (GitHub e-mail privacy):
  `git -c user.name=Hem456anth -c user.email=183790673+Hem456anth@users.noreply.github.com commit …`.
- Docs-only commits: add **`[skip ci]`** to the message so no release is published.
- Message style used so far: `<version or area>: <what changed>` with the test counts, e.g.
  `docs: 0.7.20 test report — CI run 20 green (247 unit/API, 152 E2E) [skip ci]`.
- **Never stage** `dist/india-mapos-demo.html`, `docs/perf-v04.json`, or regenerated v03–v06 / v0718 screenshots
  (E2E and the demo build rewrite them). Stage files explicitly (`git add <paths>`), not `git add -A`.
- Never commit secrets, keystores (`signing/`, `*.jks`, `*.keystore` are gitignored), `.env`, `data/*.db`, `www/`,
  `osm/`, `valhalla/`, or third-party screenshots/assets. CI greps for key patterns and fails on matches.

## Code conventions

- **ES modules**, Node ≥ 22.13, no build step for the server; the client is plain ES modules + vendored MapLibre.
- Logic that both server and client need goes in `shared/` as **pure, unit-tested** functions; DOM code goes in
  `web/ui/`, `web/nav/`, `web/map/`; network code in `web/services/` (client) or `server/providers/` (server).
- Dependency-light: security headers, gzip, rate limiting, JWT and scrypt are implemented in-repo; add a dependency
  only with a licence check and a line in `docs/THIRD_PARTY.md` if code is copied.
- **Inputs**: validate every coordinate with `inIndia` (`shared/geo.js`); cap string lengths (`str(v, max)`); cap list
  sizes; return `{error:'code'}` with a proper status.
- **Money**: integer INR in the DB and API (GST-inclusive by convention); paise only at the gateway boundary.
- **SQL**: prepared statements only; multi-statement writes through the `tx()` helper (always rolls back); new schema =
  new `db/migrations/00N_*.sql` (never edit an applied one) plus a PostGIS mirror under `db/postgis/`.
- **Honesty**: new place-card values carry a label and source; Demo never Live; no fabricated prices, fares, showtimes
  or ETAs; fixtures that are not real captures are named `*-SYNTHETIC.*`.
- **Deep links**: only documented formats or verified App Links; never guessed parameters; never payment schemes.
- **Strings**: add keys to the current `shared/i18n-v*.js` file with en complete; hi/te drafts must be flagged for
  native review; other languages fall back to English (log once).
- **Privacy**: request location only on user action; nothing personal in logs; community data stays anonymous.
- **Tests**: new behaviour needs a `node:test` case in a file listed in the `npm test` script (`package.json`) — a new
  test file is not run until it is added there. UI changes need E2E steps in `tests/e2e.mjs` with fixtures from
  `tests/fixtures/` (the browser has no internet).
- After changing `shared/services/catalog.js`, run `node scripts/gen-integration-matrix.mjs`
  (`tests/v07.test.js` compares the generated `docs/INTEGRATION_MATRIX.md`).

## Docs

- Root docs are canonical; `docs/` holds deep references (ADR-018). Do not create a second copy of a topic.
- When you change routes → [API.md](API.md); tables → [DATABASE.md](DATABASE.md); env vars / scripts / release steps →
  [SETUP.md](SETUP.md); feature status → [FEATURES.md](FEATURES.md); a decision → new ADR in [DECISIONS.md](DECISIONS.md);
  a release → [CHANGELOG.md](CHANGELOG.md) and `docs/TEST-REPORT.md`.
- Document env vars by **name and purpose only**.
- Mark anything you could not verify as unverified.

## Releases

See [SETUP.md](SETUP.md#android-release-and-signing). In short: CI publishes `v0.7.<run>` with the debug APK; the
release APK is signed offline from CI's unsigned artifact and attached with `attach-apk.yml` until the owner adds the
signing secrets. Never print or commit the keystore or its passwords.
