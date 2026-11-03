# Known limitations (v0.7, + verified app deep links)

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

- **App deep links not tried on a phone.** App Links (Swiggy, Zomato, District, BookMyShow, Blinkit, Agoda,
  MakeMyTrip, Park+, Apollo 24|7, Tata 1mg) and the Rapido intent URL were checked against the APK manifests and the
  sites' `assetlinks.json`, and the native `ExternalApp` opener compiles in CI, but nothing was opened on a real device
  with the apps installed. If Android has not verified a domain on that phone, the same https page opens in the browser.

## By design (honesty rules)
- **Deep links carry no guessed parameters** (`docs/re/DEEPLINKS.md`). Only Uber (documented universal link) gets
  pickup/drop. Swiggy/Zomato restaurant-name search and BookMyShow city pages from v0.7 were removed (undocumented
  formats); those apps open at their home/section page. Rapido opens its app home via the manifest-declared
  `rapido://open` (labelled Declared · Unverified) or www.rapido.bike. No deep links to PhonePe or Google Pay; EasyPark
  (not an India service) is catalogued Unavailable and never linked.
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
- **v0.7.20 (competitor gaps, see `docs/UPGRADE_REPORT_2026-11.md`)**:
  - "Prefer main roads" is applied only when the route comes from Valhalla (documented costing options). On OSRM (car
    default, or a Valhalla outage) it is **not** applied and the directions sheet says so. Default: on for two-wheelers,
    off for cars (turning it on moves car routing to the shared FOSSGIS Valhalla, 1 req/s policy). Gate/entrance snapping
    and "never route me here" polygons are not built.
  - Arrival / get-off alarms are **foreground only**: they fire on fixes the app receives while it is open or navigating
    (the navigation foreground service keeps fixes coming with the screen off during navigation). No background geofence.
  - Incident alerts along the route use the same unverified, 2-hour community reports (own server or this device only);
    device-only votes stay on the device.
  - Ride hand-offs: only Uber's documented link carries the pickup (pin, nickname, `formatted_address` with DIGIPIN +
    landmark); Ola only with an affiliate token; Rapido / Namma Yatri / Bharat Taxi / Yatri Sathi get the details on the
    clipboard. Landmark = nearest curated landmark within 300 m (none when far from one).
  - Faster-route offers compare free-flow durations unless a traffic key is configured, so they are rare; checks run every
    5 min during GPS navigation.
  - Bengaluru Namma Metro timetable is an **unofficial** GTFS (ODbL) whose intermediate stop times are approximated from
    BMRCL's published first/last trains and headways; the attribution line says so. No BMTC bus feed bundled (size; the
    repo is ~1.7 GB) and no Delhi OTD feed (its terms are a click-through form, not an open licence — not verified open).
  - Survey-of-India boundaries are **not** rendered yet (plan in `docs/UPGRADE_REPORT_2026-11.md` §G4).
- Provider URLs were checked on 20 Oct 2026; Ahmedabad Metro (HTTP 500), Kerala RTC and Kolkata Metro (no response)
  could not be reached from the build sandbox at that time, and Swiggy/DMart blocked automated requests (403).
- Truck routing depends on Valhalla truck costing and OSM `maxheight`/`maxweight` tagging, which is sparse in India; the
  public Valhalla instance is dev-only.
- Landmark address resolution (`/api/v1/address/resolve?offline=1`) uses the bundled offline index only; a Madhapur
  anchor fixture used in tests is **synthetic** (`tests/fixtures/overpass-anchors-madhapur-SYNTHETIC.json`).
- v0.7 UI strings (`shared/i18n-v07.js`): full en/hi/te sets (hi/te need native review); the other 8 languages have only the honesty labels (machine-assisted drafts) and fall back to English for the rest.
- Admin Listings verification counts refresh on the next render, not instantly, after toggling a link.
