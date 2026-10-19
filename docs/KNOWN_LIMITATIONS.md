# Known limitations (v0.7)

What Bharat Map v0.7 does **not** do yet, or has not been verified to do. Earlier per-release gaps are in
`docs/AUDIT.md` ("Remaining gaps") and still apply unless fixed there.

## Not verified outside the test harness
- **No real-device run.** The APK was built and signed, but not installed and exercised on an Android phone for v0.7
  (panels, payment screen, link-outs into installed apps, Uber/WhatsApp app hand-off). All UI checks are headless
  Chromium E2E with captured or synthetic fixtures.
- **No payment-gateway sandbox run.** No gateway keys exist in this build. Razorpay's flow is the v0.2 test-mode flow
  plus fixture tests; **Cashfree, PhonePe and Paytm adapters are prototypes** written from public docs and checked only
  with locally computed signatures/checksums. A real sandbox order, verification and webhook is required per gateway
  before enabling it.
- **No ONDC network.** `ONDC_PROTOTYPE=1` runs a Beckn-shaped buyer flow against Bharat's own demo catalogue
  (`network: "bharat-demo (not ONDC)"`). No registry subscription, no request signing (`ONDC_SIGNING_KEY` unused), no
  real seller/BPP. ONDC metro ticketing coverage is informational.
- **No live traffic.** No TomTom/HERE key is configured, so the app always shows "Live traffic unavailable" and drive
  times are free-flow estimates. The tile proxy is tested with a mocked provider only.

## By design (honesty rules)
- **Link-out only** for almost every Indian provider (Swiggy, Zomato, District, PVR INOX, Bharat Taxi, Yatri Sathi,
  KSRTC, TNSTC, DMart Ready, JioMart, ParkMate, Highway Delite, ChargeZone, non-Hyderabad metros, …): no API access, so
  no menus, prices, slots, showtimes, fares or availability are shown. Ola needs an affiliate token; BluSmart is shown
  Unavailable (no link).
- **Ride ETAs are routing estimates** labelled Estimate; fares are Unavailable.
- **Metro departures are Scheduled** (HMRL GTFS) and only for Hyderabad; live arrivals are Unavailable everywhere.
- **Showtimes are Unavailable**: `SHOWTIMES_FEED_URL` is a placeholder; no licensed feed adapter exists.
- **Demo sellers are fictional** and always labelled Demo; Demo is never Live.
- **No `upi://` intents**: UPI (incl. Google Pay) only inside a configured gateway checkout.
- **Toll fees unknown**: plazas on route are listed from OSM; there is no open fee data.
- **Courier partners (Shiprocket, Delhivery) are stubs** returning `501 partner-pending`.

## Data and coverage
- Provider URLs were checked on 20 Oct 2026; Ahmedabad Metro (HTTP 500), Kerala RTC and Kolkata Metro (no response)
  could not be reached from the build sandbox at that time, and Swiggy/DMart blocked automated requests (403).
- Truck routing depends on Valhalla truck costing and OSM `maxheight`/`maxweight` tagging, which is sparse in India; the
  public Valhalla instance is dev-only.
- Landmark address resolution (`/api/v1/address/resolve?offline=1`) uses the bundled offline index only; a Madhapur
  anchor fixture used in tests is **synthetic** (`tests/fixtures/overpass-anchors-madhapur-SYNTHETIC.json`).
- v0.7 UI strings (`shared/i18n-v07.js`): full en/hi/te sets (hi/te need native review); the other 8 languages have only the honesty labels (machine-assisted drafts) and fall back to English for the rest.
- Admin Listings verification counts refresh on the next render, not instantly, after toggling a link.
