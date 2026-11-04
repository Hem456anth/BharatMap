# Roadmap

Where Bharat Map goes next, in priority order. Sources: `docs/UPGRADE_REPORT_2026-11.md` §8 (roadmap after 0.7.20),
`docs/AUDIT-2026-11.md` (open Lows), `docs/re/OPPORTUNITIES.md` (CoMaps C1–C17, AMap D1–D24),
`docs/re/UI_UX_V0718.md` (A8–A18) and `docs/re/COMPETITOR_ANALYSIS_2026-11.md` (gaps G1–G20). Actionable items with
acceptance criteria are in [TASKS.md](TASKS.md). Items marked **owner** cannot start without the owner's decision,
account or keys.

## Now (next releases)

| # | Item | Why | Depends on |
|---|---|---|---|
| 1 | **C1 / G5 on-device offline routing** — valhalla-mobile (MIT) Capacitor plugin, one graph per city pack (Vizag graph already built: 71 tiles, 10.9 MB tar), per-city search DB | Biggest gap vs Google/Mappls; offline routing is a straight line today | Device testing on 2–3 GB phones; native build in CI |
| 2 | **G4 Survey-of-India boundary layer** (official outline overlay, hide OSM disputed lines inside India, CI render test) | Launch blocker for distribution in India | Confirming the official download and its licence/terms (**unclear**) |
| 3 | **Real-device test pass** (alarms, background nav, voices, App Links, low-end tiers, payment screen) | Nothing in 0.7.x has run on a phone | Phones (**owner**) |
| 4 | **Backend deploy on Render**, then the `MAPOS_API_BASE` repo variable | APK still runs on public services / on-device | Owner's Render account + `ADMIN_PASSWORD` (**owner**) |
| 5 | **CI signing secrets** (`ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) | Ends offline signing | Owner adds them in GitHub UI (**owner**) |

## Next

| # | Item | Depends on |
|---|---|---|
| 6 | **BMTC (Bengaluru buses) and Delhi OTD feeds** + GTFS-RT live vehicles | Licence confirmation; feed size → per-city packs |
| 7 | **Gateway refunds** (Razorpay / Cashfree refund API + webhook) — clears AUD-38 | Sandbox keys (**owner**) |
| 8 | **Native i18n review** (hi, te first; then the 8 fallback languages; G11 grammar-aware turn text) | Native speakers |
| 9 | **Express 5 / Capacitor 8** (+ TTS 8) majors — clears AUD-22/23 | Migration + device testing |
| 10 | **Remaining audit Lows** (AUD-24…38, 14 items) | Some need product decisions (seller onboarding) or the final backend host |
| 11 | **UI/UX A8–A14, A16–A18** (item descriptions are in owner notes outside the repo; only the ids are recorded here) | Owner's spec notes |
| 12 | **APK slimming** (bundle Vizag + Hyderabad, downloadable packs for the rest, font trim, R8 → ≈ 30–40 MB) | **Owner approval** — conflicts with the earlier "do not slim" direction (ADR-012) |

## Later

| Item | Notes |
|---|---|
| FCM push when the app is closed | Firebase project + `google-services.json` + server sender (none exists) |
| Rider GPS app / rider foreground service | Rider movement is simulated today |
| PostGIS + Redis | Required before multi-replica (ADR-008) |
| ONDC: registry onboarding, ed25519 request signing, real BPPs | `ONDC_SIGNING_KEY` not read yet |
| Play Store release | Needs `ACCESS_BACKGROUND_LOCATION` declaration (AUD-34), privacy policy, signing via Play |
| Region packs v2 (C2), "download for this view/route" (C4, D22), delta updates (C16, G12) | CoMaps-style catalogue with size, sha256, version, mirrors |
| Screen-off track recording (C9), receive GPX/KML intents (C10), font-coverage CI gate (C11), custom maps server (C12), real OSM editing (C14), transit map style (C15) | `docs/re/OPPORTUNITIES.md` |
| Authority safety layers (G13), open reviews (G14, Mangrove), railways (G16), widget (G18), Android Auto (G19, C17), iOS (G20) | `docs/re/COMPETITOR_ANALYSIS_2026-11.md` |
| AMap-derived backlog D1–D24 not yet done (e.g. search along route D2, road hazards D3, venue mode D7, toolbox D14, trip sharing + 112 D16) | `docs/re/OPPORTUNITIES.md` |

## Not planned (by decision)

- Google/Mappls data or SDKs; Bhuvan data (ToS); guessed deep-link parameters; `upi://` intents; fabricated live data
  (ADR-002, ADR-006, ADR-007, ADR-014).
