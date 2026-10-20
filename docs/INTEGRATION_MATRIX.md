# Integration matrix (generated)

Generated from `shared/services/catalog.js` by `node scripts/gen-integration-matrix.mjs`. Do not edit by hand: `npm test` checks this file is current.

Classes: **Functional** works end to end in Bharat Map · **Deep link** documented URL format hands off with context · **Prototype** adapter exists behind config, not connected to the real network / not verified live · **Partner-pending** API exists but needs a contract or approval we do not have · **Link-out** official site/app only · **Unavailable** not usable (reason shown, no link) · **Demo** Bharat's fictional data.

Adapter status (`GET /api/v1/integrations`): Functional/Demo → `live`, Deep link/Link-out → `link-out`, Prototype/Partner-pending → `partner-pending`, Unavailable → `unavailable`. Env-configurable upgrades (e.g. `ONDC_PROTOTYPE=1`, `OLA_XAPP_TOKEN`, payment keys, `TRAFFIC_PROVIDER`) are applied at runtime by `server/integrations/index.js`.

Totals: Functional 6 · Deep link 1 · Prototype 6 · Partner-pending 10 · Link-out 64 · Unavailable 5 · Demo 1 · **93 providers**.

"Link checked" = official URL confirmed from an official/primary source (docs/INTEGRATIONS.md sources or the 20 Oct 2026 check); "not re-fetched" = official domain from general knowledge, flagged as unverified in the link-out interstitial.

## Food

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| Swiggy | Partner-pending | `partner-pending` | <https://www.swiggy.com/> | yes | App Link `in.swiggy.android` (APK manifest) | Swiggy Builders Club MCP is invite-only; until approved Bharat opens the Swiggy app via its verified App Link (www.swiggy.com, home — no restaurant search, the format is undocumented) |
| Zomato | Link-out | `link-out` | <https://www.zomato.com/> | yes | App Link `com.application.zomato` (APK manifest) | Zomato MCP forbids third-party apps; verified App Link to the Zomato home only (no search parameter: undocumented) |
| magicpin | Link-out | `link-out` | <https://magicpin.in/> | not re-fetched | App Link `com.magicpin.local` (assetlinks.json) | Largest F&B seller app on ONDC; reachable in-app only through an ONDC buyer integration (prototype); otherwise link-out |
| ONDC (food & beverage) | Prototype | `partner-pending` | <https://ondc.org/> | yes | Web-only | Beckn buyer flow implemented against Bharat's demo network only (ONDC_PROTOTYPE=1); real network needs registry onboarding + signing |
| EazyDiner | Link-out | `link-out` | <https://www.eazydiner.com/> | not re-fetched | App Link `com.easydiner` (assetlinks.json) | Table reservations in the EazyDiner app/site; no public API found |
| Swiggy Dineout | Link-out | `link-out` | <https://www.swiggy.com/dineout> | yes | App Link `in.swiggy.android` (APK manifest) | Dineout was acquired by Swiggy (May 2022) and lives inside Swiggy; table booking via Swiggy (Builders Club Dineout tools are invite-only) |
| Restaurant websites | Link-out | `link-out` | — | — | Web-only | From OSM website / website:menu / reservation:url tags when mapped; never scraped |

## Movies & events

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| BookMyShow | Link-out | `link-out` | <https://in.bookmyshow.com/> | yes | App Link `com.bt.bms` (APK manifest) | No public API (partner portal is for cinemas/organisers); verified App Link to the BookMyShow home, no showtimes |
| District (Zomato/Eternal) | Link-out | `link-out` | <https://www.district.in/> | yes | App Link `com.application.zomato.district` (APK manifest) | No developer programme; verified App Link (www.district.in/movies/). Paytm Insider and TicketNew were folded into District |
| PVR INOX | Link-out | `link-out` | <https://www.pvrcinemas.com/> | yes | Store `com.net.pvr` (Play listing) | No public API (private endpoints must not be used); link-out on PVR/INOX cinemas |
| Cinépolis India | Link-out | `link-out` | <https://www.cinepolisindia.com/> | yes | Store `com.ia.cinepolis.india` (official site) | No public API; link-out on Cinépolis cinemas |
| TicketNew | Unavailable | `unavailable` | — | — | None | Acquired by Zomato (Aug 2024) and consolidated into District; use District |
| Paytm Insider | Unavailable | `unavailable` | — | — | None | Acquired by Zomato (Aug 2024) and consolidated into District; use District |

## Grocery & quick commerce

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| Blinkit | Link-out | `link-out` | <https://blinkit.com/> | yes | App Link `com.grofers.customerapp` (APK manifest) | No official API; home page link-out |
| Zepto | Partner-pending | `partner-pending` | <https://www.zepto.com/> | yes | App Link `com.zeptoconsumerapp` (assetlinks.json) | Official consumer MCP exists; third-party app use not cleared — App Link to the Zepto home (www.zepto.com assetlinks.json lists com.zeptoconsumerapp) until Zepto confirms |
| Swiggy Instamart | Partner-pending | `partner-pending` | <https://www.swiggy.com/instamart> | yes | App Link `in.swiggy.android` (APK manifest) | Swiggy Builders Club (invite-only); link-out |
| Flipkart Minutes | Link-out | `link-out` | <https://www.flipkart.com/> | not re-fetched | App Link `com.flipkart.android` (assetlinks.json) | No API; Minutes is chosen inside Flipkart |
| BigBasket | Link-out | `link-out` | <https://www.bigbasket.com/> | not re-fetched | App Link `com.bigbasket.mobileapp` (assetlinks.json) | No API found; link-out |
| JioMart | Link-out | `link-out` | <https://www.jiomart.com/> | yes | App Link `com.jpl.jiomart` (assetlinks.json) | No public API found; link-out |
| DMart Ready | Link-out | `link-out` | <https://www.dmart.in/> | yes | App Link `in.dmart` (assetlinks.json) | DMart's online service (delivery + pick-up points in select cities); no API; link-out |
| ONDC (retail / grocery) | Prototype | `partner-pending` | <https://ondc.org/> | yes | Web-only | Beckn buyer flow against Bharat's demo network (ONDC_PROTOTYPE=1) |
| Bharat Shop (demo sellers) | Demo | `live` | — | — | None | Fictional sellers, prices and stock; full order → payment → tracking flow |

## Rides

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| Uber | Deep link | `link-out` | <https://m.uber.com/> | yes | Documented `com.ubercab` (APK manifest) | Documented universal link with pickup/drop (client_id from server config); Ride Request API is partner-only; no fares in Bharat |
| Ola | Partner-pending | `partner-pending` | <https://book.olacabs.com/> | yes | App Link `com.olacabs.customer` (assetlinks.json) | App Link to book.olacabs.com (assetlinks.json lists com.olacabs.customer); the documented pickup/drop deep link needs an Ola affiliate token (OLA_XAPP_TOKEN) — without it no pickup/drop |
| Rapido | Link-out | `link-out` | <https://www.rapido.bike/> | yes | Declared · Unverified `com.rapido.passenger` (APK manifest) | No documented deep link or ride API: opens the app home via the manifest-declared rapido://open entry point (Unverified, no pickup/drop), www.rapido.bike without the app |
| Namma Yatri | Link-out | `link-out` | <https://nammayatri.in/> | not re-fetched | App Link `in.juspay.nammayatri` (assetlinks.json) | Rides via ONDC mobility once Bharat is an onboarded buyer app; no documented consumer deep link |
| Bharat Taxi | Link-out | `link-out` | <https://www.bharattaxiapp.com/> | yes | App Link `in.mobility.bharatTaxi` (assetlinks.json) | Cooperative ride app (Sahakar Taxi Cooperative, launched Feb 2026; Delhi-NCR, Gujarat, Maharashtra, Rajasthan); live on ONDC mobility — no consumer deep link |
| Yatri Sathi | Link-out | `link-out` | <https://yatrisathi.in/> | yes | App Link `in.juspay.jatrisaathi` (assetlinks.json) | Government of West Bengal ride app (Kolkata, Siliguri, Durgapur, Asansol); live on ONDC mobility — no consumer deep link |
| BluSmart | Unavailable | `unavailable` | — | — | None | Shut down: services suspended 16–17 Apr 2025; insolvency plea admitted Oct 2025 |
| ONDC mobility (rides) | Partner-pending | `partner-pending` | <https://ondc.org/> | yes | Web-only | Beckn TRV search/confirm/track needs ONDC onboarding; no fares shown until a provider quotes |

## Transit (metro, bus, rail)

| Provider | Class | Status | Ticketing (official only) | Official link | Link checked | Why |
|---|---|---|---|---|---|---|
| Hyderabad Metro (HMRL / L&T) | Functional | `live` | Official WhatsApp + app | <https://ltmetro.com/> | yes | Bundled HMRL GTFS → scheduled departures + journeys (Functional); tickets via HMRL WhatsApp / TSavaari app (link-out); not on ONDC |
| Chennai Metro (CMRL) | Link-out | `link-out` | ONDC buyer apps + official app | <https://chennaimetrorail.org/> | yes | On ONDC ticketing (first metro, Feb 2024); no open GTFS — info + official site |
| Delhi Metro (DMRC) | Link-out | `link-out` | ONDC buyer apps + official app | <https://www.delhimetrorail.com/> | yes | On ONDC ticketing + Delhi Metro Sarthi app; OTD GTFS is stale (2023) and not bundled |
| Namma Metro (BMRCL) | Link-out | `link-out` | ONDC buyer apps + official app | <https://english.bmrc.co.in/> | not re-fetched | On ONDC ticketing (Jul 2025); GTFS shared only with partners |
| Mumbai Metro (MMRCL L3, MMOPL L1, MMMOCL 2A/7) | Link-out | `link-out` | ONDC buyer apps + official app | <https://mmrcl.com/en/ticketing-and-access> | yes | All three operators on ONDC ticketing (Jun 2026) |
| Kochi Metro (KMRL) | Link-out | `link-out` | ONDC buyer apps + official app | <https://kochimetro.org/> | not re-fetched | On ONDC ticketing; open GTFS exists but is not bundled yet |
| Pune Metro (Maha Metro) | Link-out | `link-out` | ONDC buyer apps + official app | <https://www.punemetrorail.org/> | not re-fetched | On ONDC ticketing (Apr 2026) |
| Nagpur Metro (Maha Metro) | Link-out | `link-out` | ONDC buyer apps + official app | <https://www.metrorailnagpur.com/> | not re-fetched | On ONDC ticketing (Apr 2026) |
| Ahmedabad Metro (GMRC) | Link-out | `link-out` | Official app | <https://www.gujaratmetrorail.com/ahmedabad/> | yes | QR tickets in the official "Ahmedabad Metro (Official)" app; ONDC planned, not live |
| Jaipur Metro (JMRC) | Link-out | `link-out` | Info only | <https://transport.rajasthan.gov.in/jmrc> | not re-fetched | Official e-ticketing not verified in this pass — info only |
| Lucknow Metro (UPMRC) | Link-out | `link-out` | Official app | <https://lucknow.upmetrorail.com/> | yes | QR tickets in the official "Lucknow Metro Official" app (Feb 2026); UP Metro on ONDC planned |
| Kanpur Metro (UPMRC) | Link-out | `link-out` | Info only | <https://upmetrorail.com/> | yes | Official mobile e-ticketing not verified in this pass — info only |
| Noida Metro (NMRC Aqua Line) | Link-out | `link-out` | Official app | <https://www.nmrcnoida.com/> | yes | QR tickets in the official "NMRC Tickets" app (also issues DMRC QR) |
| Kolkata Metro (Metro Railway) | Link-out | `link-out` | Official app | <https://mtp.indianrailways.gov.in/> | yes | QR tickets in the official "Aamar Kolkata Metro" app (CRIS) and station QR stickers |
| TGSRTC (formerly TSRTC) | Link-out | `link-out` | Official app | <https://www.tgsrtc.telangana.gov.in/> | yes | One operator (TSRTC renamed TGSRTC, 2024). Open GTFS (commercial use allowed) not bundled yet; mobile ticketing in its app; Gamyam for live tracking |
| APSRTC | Link-out | `link-out` | Official website/app | <https://www.apsrtconline.in/> | yes | Online reservations on apsrtconline.in; no official GTFS (community feed expired) — info only for city buses |
| KSRTC (Karnataka) | Link-out | `link-out` | Official website/app | <https://ksrtc.in/> | yes | Official reservations on ksrtc.in, AWATAR app and WhatsApp 6364940880 (intercity) |
| KSRTC (Kerala) | Link-out | `link-out` | Official website/app | <https://www.keralartc.com/> | yes | Official online reservations (keralartc.com) |
| BMTC | Link-out | `link-out` | ONDC buyer apps + official app | <https://mybmtc.karnataka.gov.in/> | not re-fetched | BMTC tickets on ONDC (Jul 2025); GTFS shared only with partners |
| TNSTC / SETC | Link-out | `link-out` | Official website/app | <https://www.tnstc.in/OTRSOnline/> | yes | Official online reservation (OTRS) and WhatsApp 9444018898 (intercity) |
| MTC Chennai | Link-out | `link-out` | Info only | <https://mtcbus.tn.gov.in/> | not re-fetched | No open GTFS; Chennai One (CUMTA) app covers MTC — mobile ticketing not verified here, info only |
| DTC (Delhi buses) | Link-out | `link-out` | ONDC buyer apps + official app | <https://dtc.delhi.gov.in/> | not re-fetched | DTC tickets on ONDC (One Delhi app); OTD GTFS-RT needs a key (not configured) |
| BEST (Mumbai buses) | Link-out | `link-out` | ONDC buyer apps + official app | <https://www.bestundertaking.com/> | not re-fetched | BEST city-bus ticketing live on ONDC (Jun 2026) and in Chalo |
| PMPML (Pune buses) | Link-out | `link-out` | Info only | <https://pmpml.org/> | not re-fetched | Official e-ticketing not verified in this pass — info only |
| Chalo | Link-out | `link-out` | Official app | <https://chalo.com/> | not re-fetched | Bus tracking/ticketing app; live on ONDC (BEST and other cities) |
| Tummoc | Link-out | `link-out` | Info only | <https://tummoc.com/> | not re-fetched | Multi-modal journey planner on ONDC; Bharat links out for info |
| ONDC public transport (metro/bus QR) | Prototype | `partner-pending` | Info only | <https://ondc.org/> | yes | Adapter returns operator coverage only; real tickets need ONDC onboarding. Hyderabad Metro is not on ONDC; never shows a fare without a quote |
| Indian Railways (IRCTC) | Link-out | `link-out` | Official website/app | <https://www.irctc.co.in/> | yes | Booking only via IRCTC (PSP contract needed for APIs); link-out |

## Hotels & stays

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| MakeMyTrip | Link-out | `link-out` | <https://www.makemytrip.com/hotels/> | yes | App Link `com.makemytrip` (APK manifest) | No public API (B2B under contract); link-out, no rates in Bharat |
| Booking.com | Partner-pending | `partner-pending` | <https://www.booking.com/> | yes | App Link `com.booking` (assetlinks.json) | Demand API needs a Managed Affiliate contract; link-out until then |
| Agoda | Link-out | `link-out` | <https://www.agoda.com/en-in/> | yes | App Link `com.agoda.mobile.consumer` (APK manifest) | Affiliate/partner programme only; no public API used; link-out |
| Goibibo | Link-out | `link-out` | <https://www.goibibo.com/hotels/> | yes | App Link `com.goibibo` (assetlinks.json) | MakeMyTrip group; no public API; link-out |
| Cleartrip | Link-out | `link-out` | <https://www.cleartrip.com/hotels> | yes | Store `com.cleartrip.android` (Play listing) | No public API used; link-out |
| EaseMyTrip | Link-out | `link-out` | <https://www.easemytrip.com/hotels/> | yes | App Link `com.easemytrip.android` (assetlinks.json) | No public API used; link-out |
| Incredible India | Link-out | `link-out` | <https://www.incredibleindia.gov.in/> | not re-fetched | Store `org.incredibleindia` (official site) | Government tourism INFORMATION portal — not a booking site |

## Parking & tolls

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| Park+ | Link-out | `link-out` | <https://parkplus.io/> | yes | App Link `com.ovunque.parkwheels` (APK manifest) | B2B only; no public API; link-out |
| EasyPark | Unavailable | `unavailable` | — | — | None (not in India) | Not an India service (Europe/US parking app); APK analysed on request, skipped — never linked |
| ParkMate | Link-out | `link-out` | <https://parkmate.in/> | yes | Store `io.pspot.user` (official site) | Valet/parking app (select cities); no public API; link-out |
| NHAI (TIS toll info) | Functional | `live` | <http://tis.nhai.gov.in/> | yes | Store `com.nhai.rajmargyatra` (official site) | Toll plazas on route from OSM (functional); fees are NOT available as open data — "fee unknown" + TIS link-out |
| Highway Delite | Link-out | `link-out` | <https://www.highwaydelite.com/> | yes | Store `com.highwaydelite.highwaydelite` (Play listing) | Highway amenities / FASTag app; no public API; link-out |

## Fuel

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| IndianOil (IOCL) | Link-out | `link-out` | <https://iocl.com/petrol-diesel-price> | yes | Store `cx.indianoil.in` (Play listing) | Prices published on its web page (no feed, framing disallowed); link-out — Bharat shows no fuel price |
| HPCL | Link-out | `link-out` | <https://www.hindustanpetroleum.com/> | not re-fetched | Store `com.drivetrackplusrefuel` (official site) | No public price/stock API; link-out on HP stations |
| Jio-bp | Link-out | `link-out` | <https://www.jiobp.com/> | not re-fetched | Web-only | No public API; link-out on Jio-bp stations |

## EV charging

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| Open Charge Map | Functional | `live` | <https://openchargemap.org/> | yes | Web-only | Free API (key on server, OCM_API_KEY) — charger locations and status when the key is set; OSM fallback otherwise |
| ChargeZone | Link-out | `link-out` | <https://www.chargezone.co.in/> | yes | Store `com.chargezone` (official site) | No public API; app link-out |
| Statiq | Partner-pending | `partner-pending` | <https://www.statiq.in/> | yes | Store `com.statiq` (official site) | OCPI roaming via EVlinq needs an eMSP contract; link-out |
| Tata Power EZ Charge | Link-out | `link-out` | <https://www.tatapower.com/ezcharge> | yes | Store `com.tatapower.evapp` (official site) | No public API; app link-out |

## Health & emergency

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| Apollo Pharmacy | Link-out | `link-out` | <https://www.apollopharmacy.in/> | yes | App Link `com.apollo.patientapp` (APK manifest) | No public API; link-out — Bharat never shows medicine stock |
| Tata 1mg | Link-out | `link-out` | <https://www.1mg.com/> | yes | App Link `com.aranoah.healthkart.plus` (APK manifest) | No public API; link-out |
| Netmeds | Link-out | `link-out` | <https://www.netmeds.com/> | yes | App Link `com.NetmedsMarketplace.Netmeds` (assetlinks.json) | No public API; link-out |
| Practo | Link-out | `link-out` | <https://www.practo.com/> | yes | App Link `com.practo.fabric` (assetlinks.json) | No public booking API used; link-out |
| Apollo 24\|7 | Link-out | `link-out` | <https://www.apollo247.com/> | yes | App Link `com.apollo.patientapp` (APK manifest) | No public API; link-out |
| eSanjeevani | Link-out | `link-out` | <https://esanjeevani.mohfw.gov.in/> | not re-fetched | Web-only | Government telemedicine (C-DAC/MoHFW); no public API; link-out |
| 112 India (ERSS) | Functional | `live` | <https://112.gov.in/> | yes | Store `in.cdac.ners.psa.mobile.android.national` (Play listing) | tel:112 and tel:108 dialer actions always work (offline too); no third-party API |

## Courier & post

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| India Post | Functional | `live` | <https://www.indiapost.gov.in/> | yes | Store `info.indiapost.daksewa` (official site) | Pincode + DIGIPIN offline (functional); parcel tracking is a captcha web form — link-out |
| Shiprocket | Partner-pending | `partner-pending` | <https://www.shiprocket.in/> | not re-fetched | Store `com.shiprocket.shiprocket` (official site) | Self-serve API needs a seller account (SHIPROCKET_EMAIL/PASSWORD); adapter is a stub |
| Delhivery | Partner-pending | `partner-pending` | <https://www.delhivery.com/> | not re-fetched | App Link `com.delhiveryConsigneeApp` (assetlinks.json) | API token from a Delhivery One business account (DELHIVERY_TOKEN); adapter is a stub |

## Payments (server/payments/)

| Provider | Class | Status | Official link | Link checked | App deep link | Why |
|---|---|---|---|---|---|---|
| Razorpay | Functional | `live` | <https://razorpay.com/> | yes | None | Functional once RAZORPAY_KEY_ID/SECRET are set: server-created order + HMAC signature + webhook (tested in test mode with fixtures); UPI (incl. Google Pay) inside Checkout. No keys in this build → "Payments not configured" |
| Cashfree Payments | Prototype | `partner-pending` | <https://www.cashfree.com/> | yes | None | Adapter: server order (PG API 2023-08-01), status re-check, webhook HMAC (CASHFREE_APP_ID/SECRET); not exercised against a live sandbox |
| PhonePe Payment Gateway | Prototype | `partner-pending` | <https://www.phonepe.com/business-solutions/payment-gateway/> | yes | None | Adapter: PG v2 OAuth token + server pay request + order-status re-check + webhook auth hash (PHONEPE_CLIENT_ID/SECRET/VERSION); not exercised against a live sandbox |
| Paytm Payment Gateway (Paytm Payments Services) | Prototype | `partner-pending` | <https://www.paytmpayments.com/payment-gateway> | yes | None | Adapter: initiateTransaction + Paytm checksum + status API (PAYTM_MID/MERCHANT_KEY); not exercised against a live sandbox |
| UPI (via a gateway) | Partner-pending | `partner-pending` | — | — | None | Only inside a gateway checkout once that gateway's keys are configured (Google Pay, PhonePe, Paytm etc. appear as UPI apps there). No hand-built UPI pay links |
| Google Pay | Unavailable | `unavailable` | — | — | None | Not a direct integration: it appears as a UPI app inside the gateway checkout |

## App deep links (from the user-supplied APKs)

From `shared/services/deeplinks.js`; evidence in `docs/re/DEEPLINKS.md` and `data/deeplinks/apk-manifest-links.json` (AndroidManifest intent-filters + signer certificates only). **Documented** = public developer docs (may carry context) · **App Link** = https URL on an `autoVerify` host whose `assetlinks.json` lists the package + APK certificate, declared path only, no query parameters (opens the app, else the same page on the web) · **Declared · Unverified** = custom-scheme entry point seen only in the manifest, sent as an Android intent URL with `package=` and an official https `browser_fallback_url` (opens the app home) · **None** = no link built.

| Provider | App (package, version analysed) | Type | Bharat opens | Web fallback | Prefill |
|---|---|---|---|---|---|
| uber | Uber `com.ubercab` 4.652.10004 | Documented | <https://m.uber.com/ul/> + documented params | <https://m.uber.com/> | pickup lat/lng + nickname; drop lat/lng + nickname + address |
| swiggy | Swiggy `in.swiggy.android` 4.119.1 | App Link | <https://www.swiggy.com/> | <https://www.swiggy.com/> | nothing |
| instamart | Swiggy `in.swiggy.android` 4.119.1 | App Link | <https://www.swiggy.com/instamart> | <https://www.swiggy.com/instamart> | nothing |
| dineout | Swiggy `in.swiggy.android` 4.119.1 | App Link | <https://www.swiggy.com/dineout> | <https://www.swiggy.com/dineout> | nothing |
| zomato | Zomato `com.application.zomato` 19.9.6 | App Link | <https://www.zomato.com/> | <https://www.zomato.com/> | nothing |
| bookmyshow | BookMyShow `com.bt.bms` 18.2.8 | App Link | <https://in.bookmyshow.com/> | <https://in.bookmyshow.com/> | nothing |
| district | District `com.application.zomato.district` 2.75.0 | App Link | <https://www.district.in/movies/> | <https://www.district.in/movies/> | nothing |
| blinkit | Blinkit `com.grofers.customerapp` 18.39.0 | App Link | <https://blinkit.com/> | <https://blinkit.com/> | nothing |
| agoda | Agoda `com.agoda.mobile.consumer` 14.38.0 | App Link | <https://www.agoda.com/> | <https://www.agoda.com/> | nothing |
| makemytrip | MakeMyTrip `com.makemytrip` 11.9.1 | App Link | <https://www.makemytrip.com/hotels/> | <https://www.makemytrip.com/hotels/> | nothing |
| parkplus | Park+ `com.ovunque.parkwheels` 6.2.79 | App Link | <https://parkplus.io/parking> | <https://parkplus.io/parking> | nothing |
| apollo-247 | Apollo 24\|7 `com.apollo.patientapp` 9.9.1 | App Link | <https://www.apollo247.com/doctors> | <https://www.apollo247.com/doctors> | nothing |
| apollo-pharmacy | Apollo 24\|7 `com.apollo.patientapp` 9.9.1 | App Link | <https://www.apollopharmacy.in/search-medicines> | <https://www.apollopharmacy.in/search-medicines> | nothing |
| tata-1mg | Tata 1mg `com.aranoah.healthkart.plus` 20.7.0 | App Link | <https://www.1mg.com/search/all> | <https://www.1mg.com/search/all> | nothing |
| rapido | Rapido `com.rapido.passenger` 8.130.0 | Declared · Unverified | `intent://open#Intent;scheme=rapido;package=com.rapido.passenger;S.browser_fallback_url=https%3A%2F%2Fwww.rapido.bike%2F;end` | <https://www.rapido.bike/> | nothing |
| phonepe-pg | PhonePe `com.phonepe.app` 26.09.25.0 | None | — | — | Payments run only inside a gateway checkout (server/payments/). The app declares UPI and PhonePe payment schemes; Bharat Map never builds links to them |
| google-pay | Google Pay `com.google.android.apps.nbu.paisa.user` 352.1.1 | None | — | — | UPI-only app (UPI, gpay and tez schemes); appears as a UPI app inside the gateway checkout. No deep link is built |
| easypark | EasyPark `net.easypark.android` 26.40.1 | None (not in India) | — | — | Not an India service (not on the requested list); analysed only, never linked |

## App hand-offs without an APK (web-verified)

From `shared/services/deeplinks-web.js`; evidence in `docs/re/DEEPLINKS.md` ("Web-verified links") and `data/deeplinks/assetlinks-web.json` (`scripts/fetch-assetlinks.py`). **App Link** = the provider's own `/.well-known/assetlinks.json` lists the package with `handle_all_urls`; Bharat opens a plain https page the site serves, no parameters (the app's manifest was not available, so the path is not confirmed as claimed) · **Store** = package confirmed on the official site or its Google Play listing; Android opens `market://details?id=` (intent, package `com.android.vending`) with a play.google.com fallback, other devices open the official website · **Web-only** = official website, reason given · **None** = never linked. Ola uses its documented deep link only when an Ola affiliate token is configured.

| Provider | Type | Package (app) | Evidence | Android opens | Elsewhere |
|---|---|---|---|---|---|
| magicpin | App Link | `com.magicpin.local` (magicpin) | assetlinks.json on magicpin.in | <https://magicpin.in/> | <https://magicpin.in/> |
| eazydiner | App Link | `com.easydiner` (EazyDiner) | assetlinks.json on www.eazydiner.com | <https://www.eazydiner.com/> | <https://www.eazydiner.com/> |
| ondc-food | Web-only | — | ONDC is a network, not a consumer app: orders happen in ONDC buyer apps (Bharat's own buyer flow is a prototype) | — | — |
| restaurant-website | Web-only | — | Per-place website from OpenStreetMap tags; no app | — | — |
| pvr-inox | Store | `com.net.pvr` (PVR Cinemas) | Play listing | `market://details?id=com.net.pvr` (fallback <https://play.google.com/store/apps/details?id=com.net.pvr>) | <https://www.pvrcinemas.com/> |
| cinepolis | Store | `com.ia.cinepolis.india` (Cinépolis India) | official site https://cinepolisindia.com/vip-screen | `market://details?id=com.ia.cinepolis.india` (fallback <https://play.google.com/store/apps/details?id=com.ia.cinepolis.india>) | <https://www.cinepolisindia.com/> |
| ticketnew | None | — | Merged into District; never linked | — | — |
| paytm-insider | None | — | Merged into District; never linked | — | — |
| zepto | App Link | `com.zeptoconsumerapp` (Zepto) | assetlinks.json on www.zepto.com | <https://www.zepto.com/> | <https://www.zepto.com/> |
| flipkart-minutes | App Link | `com.flipkart.android` (Flipkart) | assetlinks.json on www.flipkart.com | <https://www.flipkart.com/> | <https://www.flipkart.com/> |
| bigbasket | App Link | `com.bigbasket.mobileapp` (bigbasket) | assetlinks.json on www.bigbasket.com | <https://www.bigbasket.com/> | <https://www.bigbasket.com/> |
| jiomart | App Link | `com.jpl.jiomart` (JioMart) | assetlinks.json on www.jiomart.com | <https://www.jiomart.com/> | <https://www.jiomart.com/> |
| dmart-ready | App Link | `in.dmart` (DMart Ready) | assetlinks.json on www.dmart.in | <https://www.dmart.in/> | <https://www.dmart.in/> |
| ondc-retail | Web-only | — | ONDC is a network, not a consumer app | — | — |
| demo-shop | None | — | Bharat's own fictional demo sellers | — | — |
| ola | App Link | `com.olacabs.customer` (Ola) | assetlinks.json on book.olacabs.com | <https://book.olacabs.com/> | <https://book.olacabs.com/> |
| namma-yatri | App Link | `in.juspay.nammayatri` (Namma Yatri) | assetlinks.json on nammayatri.in | <https://nammayatri.in/> | <https://nammayatri.in/> |
| bharat-taxi | App Link | `in.mobility.bharatTaxi` (Bharat Taxi) | assetlinks.json on www.bharattaxiapp.com | <https://www.bharattaxiapp.com/> | <https://www.bharattaxiapp.com/> |
| yatri-sathi | App Link | `in.juspay.jatrisaathi` (Yatri Sathi) | assetlinks.json on yatrisathi.in | <https://yatrisathi.in/> | <https://yatrisathi.in/> |
| ondc-mobility | Web-only | — | ONDC is a network, not a consumer app | — | — |
| blusmart | None | — | Shut down (Apr 2025); never linked | — | — |
| metro-hyderabad | Store | `com.minfy.tsavaari` (TSavaari (Hyderabad Metro)) | Play listing | `market://details?id=com.minfy.tsavaari` (fallback <https://play.google.com/store/apps/details?id=com.minfy.tsavaari>) | <https://ltmetro.com/> |
| metro-chennai | Store | `org.chennaimetrorail.appv1` (Chennai Metro Rail) | official site https://chennaimetrorail.org/mobile-applications | `market://details?id=org.chennaimetrorail.appv1` (fallback <https://play.google.com/store/apps/details?id=org.chennaimetrorail.appv1>) | <https://chennaimetrorail.org/> |
| metro-delhi | Store | `com.sraoss.dmrc` (Delhi Metro Sarthi) | official site https://delhimetrorail.com/pages/en/contact-us | `market://details?id=com.sraoss.dmrc` (fallback <https://play.google.com/store/apps/details?id=com.sraoss.dmrc>) | <https://www.delhimetrorail.com/> |
| metro-bengaluru | Store | `com.aum.nammametro` (Namma Metro (BMRCL)) | official site https://english.bmrc.co.in/ | `market://details?id=com.aum.nammametro` (fallback <https://play.google.com/store/apps/details?id=com.aum.nammametro>) | <https://english.bmrc.co.in/> |
| metro-mumbai | Store | `com.metroconnect3.app` (MetroConnect3 (Mumbai Metro Line 3)) | official site https://mmrcl.com/en | `market://details?id=com.metroconnect3.app` (fallback <https://play.google.com/store/apps/details?id=com.metroconnect3.app>) | <https://mmrcl.com/en/ticketing-and-access> |
| metro-kochi | Store | `com.transitfe` (Kochi1 (KMRL & Axis Bank)) | Play listing | `market://details?id=com.transitfe` (fallback <https://play.google.com/store/apps/details?id=com.transitfe>) | <https://kochimetro.org/> |
| metro-pune | Store | `org.mahametro.punemobileapp` (Pune Metro (Official)) | official site https://www.punemetrorail.org/ | `market://details?id=org.mahametro.punemobileapp` (fallback <https://play.google.com/store/apps/details?id=org.mahametro.punemobileapp>) | <https://www.punemetrorail.org/> |
| metro-nagpur | Store | `nagpur.scsoft.com.nagpurapp` (Nagpur Metro Rail) | Play listing | `market://details?id=nagpur.scsoft.com.nagpurapp` (fallback <https://play.google.com/store/apps/details?id=nagpur.scsoft.com.nagpurapp>) | <https://www.metrorailnagpur.com/> |
| metro-ahmedabad | Store | `com.gujaratmetrorail.gmrcamddigitalticketing` (Ahmedabad Metro (Official)) | official site https://www.gujaratmetrorail.com/ahmedabad | `market://details?id=com.gujaratmetrorail.gmrcamddigitalticketing` (fallback <https://play.google.com/store/apps/details?id=com.gujaratmetrorail.gmrcamddigitalticketing>) | <https://www.gujaratmetrorail.com/ahmedabad/> |
| metro-jaipur | Store | `com.jaipurmetro` (Jaipur Metro (Official)) | Play listing | `market://details?id=com.jaipurmetro` (fallback <https://play.google.com/store/apps/details?id=com.jaipurmetro>) | <https://transport.rajasthan.gov.in/jmrc> |
| metro-lucknow | Store | `com.prod.upmrc_lucknow` (Lucknow Metro (Official)) | Play listing | `market://details?id=com.prod.upmrc_lucknow` (fallback <https://play.google.com/store/apps/details?id=com.prod.upmrc_lucknow>) | <https://lucknow.upmetrorail.com/> |
| metro-kanpur | Store | `com.scsoft.kanpurmetro` (Kanpur Metro (Official)) | Play listing | `market://details?id=com.scsoft.kanpurmetro` (fallback <https://play.google.com/store/apps/details?id=com.scsoft.kanpurmetro>) | <https://upmetrorail.com/> |
| metro-noida | Store | `mobile.scsoft.com.noida` (NMRC Tickets) | official site https://www.nmrcnoida.com/ | `market://details?id=mobile.scsoft.com.noida` (fallback <https://play.google.com/store/apps/details?id=mobile.scsoft.com.noida>) | <https://www.nmrcnoida.com/> |
| metro-kolkata | Store | `org.cris.kmmts` (Aamar Kolkata Metro) | Play listing | `market://details?id=org.cris.kmmts` (fallback <https://play.google.com/store/apps/details?id=org.cris.kmmts>) | <https://mtp.indianrailways.gov.in/> |
| tgsrtc | Store | `com.app.tsrtc` (TGSRTC Official Online Booking) | official site https://www.tgsrtcbus.in/ | `market://details?id=com.app.tsrtc` (fallback <https://play.google.com/store/apps/details?id=com.app.tsrtc>) | <https://www.tgsrtc.telangana.gov.in/> |
| apsrtc | App Link | `com.apsrtc.online` (APSRTC) | assetlinks.json on www.apsrtconline.in | <https://www.apsrtconline.in/> | <https://www.apsrtconline.in/> |
| ksrtc | Store | `com.ksrtc.awatar.new` (KSRTC AWATAR) | official site https://ksrtc.in/ | `market://details?id=com.ksrtc.awatar.new` (fallback <https://play.google.com/store/apps/details?id=com.ksrtc.awatar.new>) | <https://ksrtc.in/> |
| ksrtc-kerala | Store | `com.maven.onlineksrtcswift` (Ente KSRTC Neo-oprs) | official site https://onlineksrtcswift.com/ | `market://details?id=com.maven.onlineksrtcswift` (fallback <https://play.google.com/store/apps/details?id=com.maven.onlineksrtcswift>) | <https://www.keralartc.com/> |
| bmtc | Store | `com.bmtc.bmtcavls` (Namma BMTC) | Play listing | `market://details?id=com.bmtc.bmtcavls` (fallback <https://play.google.com/store/apps/details?id=com.bmtc.bmtcavls>) | <https://mybmtc.karnataka.gov.in/> |
| tnstc | Store | `com.tnstc` (TNSTC Official App) | official site https://www.tnstc.in/OTRSOnline/ | `market://details?id=com.tnstc` (fallback <https://play.google.com/store/apps/details?id=com.tnstc>) | <https://www.tnstc.in/OTRSOnline/> |
| mtc-chennai | Store | `in.mobility.cumta` (Chennai One) | Play listing | `market://details?id=in.mobility.cumta` (fallback <https://play.google.com/store/apps/details?id=in.mobility.cumta>) | <https://mtcbus.tn.gov.in/> |
| dtc | Store | `com.delhitransport.onedelhi` (One Delhi) | Play listing | `market://details?id=com.delhitransport.onedelhi` (fallback <https://play.google.com/store/apps/details?id=com.delhitransport.onedelhi>) | <https://dtc.delhi.gov.in/> |
| best | Store | `com.dimts.best.bestapplication` (BEST Prawas) | Play listing | `market://details?id=com.dimts.best.bestapplication` (fallback <https://play.google.com/store/apps/details?id=com.dimts.best.bestapplication>) | <https://www.bestundertaking.com/> |
| pmpml | Store | `in.chartr.pmpml` (Apli PMPML) | Play listing | `market://details?id=in.chartr.pmpml` (fallback <https://play.google.com/store/apps/details?id=in.chartr.pmpml>) | <https://pmpml.org/> |
| chalo | Store | `app.zophop` (Chalo) | official site https://chalo.com/ | `market://details?id=app.zophop` (fallback <https://play.google.com/store/apps/details?id=app.zophop>) | <https://chalo.com/> |
| tummoc | Store | `org.transhelp.bykerr` (Tummoc) | Play listing | `market://details?id=org.transhelp.bykerr` (fallback <https://play.google.com/store/apps/details?id=org.transhelp.bykerr>) | <https://tummoc.com/> |
| ondc-metro | Web-only | — | ONDC is a network, not a consumer app | — | — |
| irctc | Store | `cris.org.in.prs.ima` (IRCTC Rail Connect) | Play listing | `market://details?id=cris.org.in.prs.ima` (fallback <https://play.google.com/store/apps/details?id=cris.org.in.prs.ima>) | <https://www.irctc.co.in/> |
| booking-com | App Link | `com.booking` (Booking.com) | assetlinks.json on www.booking.com | <https://www.booking.com/> | <https://www.booking.com/> |
| goibibo | App Link | `com.goibibo` (Goibibo) | assetlinks.json on www.goibibo.com | <https://www.goibibo.com/hotels/> | <https://www.goibibo.com/hotels/> |
| cleartrip | Store | `com.cleartrip.android` (Cleartrip) | Play listing | `market://details?id=com.cleartrip.android` (fallback <https://play.google.com/store/apps/details?id=com.cleartrip.android>) | <https://www.cleartrip.com/hotels> |
| easemytrip | App Link | `com.easemytrip.android` (EaseMyTrip) | assetlinks.json on www.easemytrip.com | <https://www.easemytrip.com/hotels/> | <https://www.easemytrip.com/hotels/> |
| incredible-india | Store | `org.incredibleindia` (Incredible India) | official site https://www.incredibleindia.gov.in/ | `market://details?id=org.incredibleindia` (fallback <https://play.google.com/store/apps/details?id=org.incredibleindia>) | <https://www.incredibleindia.gov.in/> |
| parkmate | Store | `io.pspot.user` (ParkMate) | official site https://parkmate.in/ | `market://details?id=io.pspot.user` (fallback <https://play.google.com/store/apps/details?id=io.pspot.user>) | <https://parkmate.in/> |
| nhai | Store | `com.nhai.rajmargyatra` (Rajmargyatra (NHAI)) | official site https://nhai.gov.in/nhai/sites/default/files/2023-08/Press_Release_Rajmaarg_Yatra_App.pdf | `market://details?id=com.nhai.rajmargyatra` (fallback <https://play.google.com/store/apps/details?id=com.nhai.rajmargyatra>) | <https://rajmargyatra.nhai.gov.in/> |
| highway-delite | Store | `com.highwaydelite.highwaydelite` (Highway Delite) | Play listing | `market://details?id=com.highwaydelite.highwaydelite` (fallback <https://play.google.com/store/apps/details?id=com.highwaydelite.highwaydelite>) | <https://www.highwaydelite.com/> |
| indianoil | Store | `cx.indianoil.in` (IndianOil ONE) | Play listing | `market://details?id=cx.indianoil.in` (fallback <https://play.google.com/store/apps/details?id=cx.indianoil.in>) | <https://iocl.com/> |
| hpcl | Store | `com.drivetrackplusrefuel` (HP PAY) | official site https://www.hindustanpetroleum.com/pages/mobile-app | `market://details?id=com.drivetrackplusrefuel` (fallback <https://play.google.com/store/apps/details?id=com.drivetrackplusrefuel>) | <https://www.hindustanpetroleum.com/> |
| jio-bp | Web-only | — | jiobp.com links com.namp.jiobppulse, which is no longer on Google Play (404); the live Jio-bp pulse app is for EV charging only, so fuel stations get the website | — | — |
| ocm | Web-only | — | Open Charge Map no longer publishes its Android app (community.openchargemap.org, Jun 2026); the web map is identical | — | — |
| chargezone | Store | `com.chargezone` (ChargeZone) | official site https://www.chargezone.co.in/ | `market://details?id=com.chargezone` (fallback <https://play.google.com/store/apps/details?id=com.chargezone>) | <https://www.chargezone.co.in/> |
| statiq | Store | `com.statiq` (Statiq) | official site https://www.statiq.in/ | `market://details?id=com.statiq` (fallback <https://play.google.com/store/apps/details?id=com.statiq>) | <https://www.statiq.in/> |
| tata-ez | Store | `com.tatapower.evapp` (Tata Power EZ Charge) | official site https://www.tatapower.com/ezcharge | `market://details?id=com.tatapower.evapp` (fallback <https://play.google.com/store/apps/details?id=com.tatapower.evapp>) | <https://www.tatapower.com/ezcharge> |
| netmeds | App Link | `com.NetmedsMarketplace.Netmeds` (Netmeds) | assetlinks.json on www.netmeds.com | <https://www.netmeds.com/> | <https://www.netmeds.com/> |
| practo | App Link | `com.practo.fabric` (Practo) | assetlinks.json on www.practo.com | <https://www.practo.com/> | <https://www.practo.com/> |
| esanjeevani | Web-only | — | The eSanjeevani Play app is for assisted doctor-to-doctor consults at Ayushman Arogya Mandirs, not for patients; patients use the website | — | — |
| 112-india | Store | `in.cdac.ners.psa.mobile.android.national` (112 India) | Play listing | `market://details?id=in.cdac.ners.psa.mobile.android.national` (fallback <https://play.google.com/store/apps/details?id=in.cdac.ners.psa.mobile.android.national>) | <https://112.gov.in/> |
| india-post | Store | `info.indiapost.daksewa` (Dak Sewa (India Post)) | official site https://www.indiapost.gov.in/ | `market://details?id=info.indiapost.daksewa` (fallback <https://play.google.com/store/apps/details?id=info.indiapost.daksewa>) | <https://www.indiapost.gov.in/> |
| shiprocket | Store | `com.shiprocket.shiprocket` (Shiprocket) | official site https://www.shiprocket.in/ | `market://details?id=com.shiprocket.shiprocket` (fallback <https://play.google.com/store/apps/details?id=com.shiprocket.shiprocket>) | <https://www.shiprocket.in/> |
| delhivery | App Link | `com.delhiveryConsigneeApp` (Delhivery) | assetlinks.json on www.delhivery.com | <https://www.delhivery.com/> | <https://www.delhivery.com/> |
| razorpay | None | — | Payment gateway: used only server-side inside checkout; no app hand-off | — | — |
| cashfree | None | — | Payment gateway: no app hand-off | — | — |
| paytm-pg | None | — | Payment gateway: no app hand-off | — | — |
| upi | None | — | UPI only inside a gateway checkout; never a hand-built UPI link | — | — |

## Maps, traffic and platform

| Capability | Class | Notes |
|---|---|---|
| OSM tiles / POIs / geocoding (OpenFreeMap, Overpass, Nominatim, Photon) | Functional | Open data with attribution; offline PMTiles + offline POI index for the pilot cities |
| Routing (Valhalla / OSRM) incl. **truck** costing | Functional | `GET /api/v1/route?mode=truck&truck_height=…` uses Valhalla truck costing; OSRM has no truck profile, so a truck request never falls back to a car route (straight-line Estimate instead) |
| Toll plazas on route | Functional | OSM `barrier=toll_booth`; **fee unknown** (no open fee data) |
| Live traffic (TomTom / HERE) | Unavailable unless `TRAFFIC_PROVIDER` + key | Server tile proxy `/api/v1/traffic/tiles/{z}/{x}/{y}.png` (≤ 2 min cache); otherwise the app says "Live traffic unavailable" |
| "Also here" (OSM containment) | Functional (online) | Overpass `is_in` → named POIs inside the same building/mall/station |
| Place photos (Wikidata / Commons) | Unavailable | No offline Commons fixtures in this build; no photos are shown rather than unlicensed ones |
| Reviews / ratings | Unavailable | No licensed source; never invented |
