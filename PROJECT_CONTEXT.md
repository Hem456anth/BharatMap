# Project context

## What Bharat Map is

An India-first map app with its own map-services backend, for Android (Capacitor) and the web. A calm full-screen map
with a floating search pill and a three-height bottom sheet; real places from OpenStreetMap; routes for drive,
two-wheeler, cycle, walk, truck and scheduled metro; turn-by-turn voice navigation with landmark-led instructions in
English, Hindi and Telugu; offline maps and search for 11 Indian cities; and a **Shop** area that keeps the original
v0.2 commerce flow (product search → seller → order → rider tracking) on **fictional demo data**.

The original vision (`docs/PRD.md`, v0.1): one map that connects places → businesses → products → transport →
delivery, with Indian landmark addresses that resolve (DIGIPIN, "opp. temple, behind bus stand").

**Status: working prototype.** Map, search, places, routing and navigation use real open data; Shop sellers, products
and riders are fictional; live traffic and live transit arrivals are not included; nothing has been tested on a real
phone. Feature-by-feature status: [FEATURES.md](FEATURES.md).

## People and accounts

| | |
|---|---|
| Owner | GitHub **Hem456anth** (the owner approves all owner-gated items) |
| Repository | https://github.com/Hem456anth/BharatMap (public), default branch `main` |
| Commit identity | `Hem456anth <183790673+Hem456anth@users.noreply.github.com>` (GitHub e-mail privacy) |
| Releases | GitHub Releases `v0.7.<CI run>`; latest **v0.7.20** (3 Nov 2026) |
| Backend | none deployed; `render.yaml` prepared (needs the owner's Render account) |
| Work style | AI-assisted development; Claude Code picks up from [CLAUDE.md](CLAUDE.md) |

## Timeline

| Date (2026, IST) | Milestone |
|---|---|
| 18 Oct | "India MapOS" v0.2 (Capacitor app, Razorpay test, admin, CI) → renamed **Bharat Map** the same day → v0.3 map-first app |
| 18–19 Oct | v0.4 `/api/v1` backend (Valhalla, OSRM, Photon, Nominatim, Overpass, OCM), HMRL metro, tolls, offline regions; v0.5 navigation polish, community, 11 offline cities; sprint 0.5.11 device tiers, offline search v2, road hints; 0.5.13 first release-signed APK |
| 19–20 Oct | v0.7 place-card services + payments screen; verified app hand-offs (0.7.15–0.7.16); CoMaps adopted as blueprint (0.7.17); UI/UX pass (0.7.18) |
| 3 Nov | Technical/security audit (0.7.19); competitor research + gap upgrade (0.7.20) |
| 4 Nov | Documentation handoff package for Claude Code (this set of root docs) |

Full history: [CHANGELOG.md](CHANGELOG.md). Decisions and their reasons: [DECISIONS.md](DECISIONS.md).

## Reference projects and how they are used

| Reference | Role | Rule |
|---|---|---|
| **CoMaps** (Organic Maps fork, Apache-2.0) | **Main architectural blueprint**: offline-first, region packs, on-device routing/search, lean core | Studied (`docs/re/COMAPS_TEARDOWN.md`); no code copied (`docs/THIRD_PARTY.md`) |
| Apple Maps (web) | UI/UX reference only (0.7.18 pass) | Behaviour notes kept outside the repo; **no Apple screenshots or assets committed** |
| AMap, Google Maps, HERE WeGo | Earlier teardowns (feature ideas, India gaps) | Behaviour-only (`docs/re/AMAP_DEEP_DIVE.md`, `docs/re/APK_ANALYSIS.md`, `docs/re/GMAPS_HERE_TEARDOWN.md`) |
| Mappls, Namma Yatri, Chalo, Where is my Train, OsmAnd, Organic Maps | Competitor analysis (Nov 2026) | Public pages only (`docs/re/COMPETITOR_ANALYSIS_2026-11.md`) |

## Non-negotiable project rules

1. **Clean-room**: OSM and open data only; no Google/Mappls code or data; reverse engineering is behaviour-only.
2. **Honesty**: every value labelled (Live / Scheduled / Estimate / Link-out / Demo / Unavailable); nothing fabricated;
   demo sellers/riders are fictional and say so; always report implemented / prototype / external separately.
3. **India conventions**: prices are INR integers, GST-inclusive; every coordinate must be inside the India bbox;
   times shown in IST.
4. **Payments**: only server-verified gateway payments confirm an order; no `upi://` intents; keys only on the server.
5. **Privacy**: location only on user action or during navigation; anonymous community reports (salted hash, no IP);
   privacy dashboard with export/delete (DPDP Act 2023).
6. **Owner approval** before: APK slimming, deleting releases (e.g. stale v0.5.11), anything that spends money,
   publishing to stores, or changing signing.
7. **Secrets** never in the repo, docs or logs; the release keystore lives outside the repo (`signing/`).

## Constraints of the working environment

- The development sandbox is **aarch64**: Android APKs cannot be built locally — CI builds them.
- Headless Chromium in the sandbox has **no internet**: E2E serves third-party responses from `tests/fixtures/` and the
  basemap through the `/map` tile proxy.
- Long local E2E runs can be killed by memory pressure; CI's full run is authoritative.
- The automation's GitHub access cannot write Actions secrets or upload release assets directly; signed APKs are attached with
  `.github/workflows/attach-apk.yml`.

## Open questions for the owner

- Approve or reject APK slimming (ADR-012).
- Delete the stale v0.5.11 release?
- Render account for the backend; CI signing secrets.
- Survey-of-India boundary source and terms (G4).
- Phones for a real-device test pass; native reviewers for Hindi/Telugu.
- Specs for UI items A8–A14, A16–A18 (kept outside the repo).
