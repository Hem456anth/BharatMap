# Integration matrix (generated)

Generated from `shared/services/catalog.js` by `node scripts/gen-integration-matrix.mjs`. Do not edit by hand: `npm test` checks this file is current.

Classes: **Functional** works end to end in Bharat Map · **Deep link** documented URL format hands off with context · **Prototype** adapter exists behind config, not connected to the real network / not verified live · **Partner-pending** API exists but needs a contract or approval we do not have · **Link-out** official site/app only · **Unavailable** not usable (reason shown, no link) · **Demo** Bharat's fictional data.

Adapter status (`GET /api/v1/integrations`): Functional/Demo → `live`, Deep link/Link-out → `link-out`, Prototype/Partner-pending → `partner-pending`, Unavailable → `unavailable`. Env-configurable upgrades (e.g. `ONDC_PROTOTYPE=1`, `OLA_XAPP_TOKEN`, payment keys, `TRAFFIC_PROVIDER`) are applied at runtime by `server/integrations/index.js`.

Totals: Functional 6 · Deep link 1 · Prototype 6 · Partner-pending 10 · Link-out 64 · Unavailable 4 · Demo 1 · **92 providers**.

"Link checked" = official URL confirmed from an official/primary source (docs/INTEGRATIONS.md sources or the 20 Oct 2026 check); "not re-fetched" = official domain from general knowledge, flagged as unverified in the link-out interstitial.

## Food

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| Swiggy | Partner-pending | `partner-pending` | <https://www.swiggy.com/> | yes | Swiggy Builders Club MCP is invite-only; until approved Bharat opens a Swiggy search for the restaurant name + city (format undocumented) |
| Zomato | Link-out | `link-out` | <https://www.zomato.com/> | yes | Zomato MCP forbids third-party apps; link-out search only (format undocumented) |
| magicpin | Link-out | `link-out` | <https://magicpin.in/> | not re-fetched | Largest F&B seller app on ONDC; reachable in-app only through an ONDC buyer integration (prototype); otherwise link-out |
| ONDC (food & beverage) | Prototype | `partner-pending` | <https://ondc.org/> | yes | Beckn buyer flow implemented against Bharat's demo network only (ONDC_PROTOTYPE=1); real network needs registry onboarding + signing |
| EazyDiner | Link-out | `link-out` | <https://www.eazydiner.com/> | not re-fetched | Table reservations in the EazyDiner app/site; no public API found |
| Swiggy Dineout | Link-out | `link-out` | <https://www.swiggy.com/dineout> | yes | Dineout was acquired by Swiggy (May 2022) and lives inside Swiggy; table booking via Swiggy (Builders Club Dineout tools are invite-only) |
| Restaurant websites | Link-out | `link-out` | — | — | From OSM website / website:menu / reservation:url tags when mapped; never scraped |

## Movies & events

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| BookMyShow | Link-out | `link-out` | <https://in.bookmyshow.com/> | yes | No public API (partner portal is for cinemas/organisers); city page link-out, no showtimes |
| District (Zomato/Eternal) | Link-out | `link-out` | <https://www.district.in/> | yes | No developer programme; link-out. Paytm Insider and TicketNew were folded into District |
| PVR INOX | Link-out | `link-out` | <https://www.pvrcinemas.com/> | yes | No public API (private endpoints must not be used); link-out on PVR/INOX cinemas |
| Cinépolis India | Link-out | `link-out` | <https://www.cinepolisindia.com/> | yes | No public API; link-out on Cinépolis cinemas |
| TicketNew | Unavailable | `unavailable` | — | — | Acquired by Zomato (Aug 2024) and consolidated into District; use District |
| Paytm Insider | Unavailable | `unavailable` | — | — | Acquired by Zomato (Aug 2024) and consolidated into District; use District |

## Grocery & quick commerce

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| Blinkit | Link-out | `link-out` | <https://blinkit.com/> | yes | No official API; home page link-out |
| Zepto | Partner-pending | `partner-pending` | <https://www.zeptonow.com/> | not re-fetched | Official consumer MCP exists; third-party app use not cleared — link-out until Zepto confirms |
| Swiggy Instamart | Partner-pending | `partner-pending` | <https://www.swiggy.com/instamart> | yes | Swiggy Builders Club (invite-only); link-out |
| Flipkart Minutes | Link-out | `link-out` | <https://www.flipkart.com/> | not re-fetched | No API; Minutes is chosen inside Flipkart |
| BigBasket | Link-out | `link-out` | <https://www.bigbasket.com/> | not re-fetched | No API found; link-out |
| JioMart | Link-out | `link-out` | <https://www.jiomart.com/> | yes | No public API found; link-out |
| DMart Ready | Link-out | `link-out` | <https://www.dmart.in/> | yes | DMart's online service (delivery + pick-up points in select cities); no API; link-out |
| ONDC (retail / grocery) | Prototype | `partner-pending` | <https://ondc.org/> | yes | Beckn buyer flow against Bharat's demo network (ONDC_PROTOTYPE=1) |
| Bharat Shop (demo sellers) | Demo | `live` | — | — | Fictional sellers, prices and stock; full order → payment → tracking flow |

## Rides

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| Uber | Deep link | `link-out` | <https://m.uber.com/> | yes | Documented universal link with pickup/drop (client_id from server config); Ride Request API is partner-only; no fares in Bharat |
| Ola | Partner-pending | `partner-pending` | <https://book.olacabs.com/> | yes | Documented deep link needs an Ola affiliate token (OLA_XAPP_TOKEN); without it opens Ola without pickup/drop |
| Rapido | Link-out | `link-out` | <https://www.rapido.bike/> | yes | No documented deep link or ride API (unverified link-out) |
| Namma Yatri | Link-out | `link-out` | <https://nammayatri.in/> | not re-fetched | Rides via ONDC mobility once Bharat is an onboarded buyer app; no documented consumer deep link |
| Bharat Taxi | Link-out | `link-out` | <https://www.bharattaxiapp.com/> | yes | Cooperative ride app (Sahakar Taxi Cooperative, launched Feb 2026; Delhi-NCR, Gujarat, Maharashtra, Rajasthan); live on ONDC mobility — no consumer deep link |
| Yatri Sathi | Link-out | `link-out` | <https://yatrisathi.in/> | yes | Government of West Bengal ride app (Kolkata, Siliguri, Durgapur, Asansol); live on ONDC mobility — no consumer deep link |
| BluSmart | Unavailable | `unavailable` | — | — | Shut down: services suspended 16–17 Apr 2025; insolvency plea admitted Oct 2025 |
| ONDC mobility (rides) | Partner-pending | `partner-pending` | <https://ondc.org/> | yes | Beckn TRV search/confirm/track needs ONDC onboarding; no fares shown until a provider quotes |

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

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| MakeMyTrip | Link-out | `link-out` | <https://www.makemytrip.com/hotels/> | yes | No public API (B2B under contract); link-out, no rates in Bharat |
| Booking.com | Partner-pending | `partner-pending` | <https://www.booking.com/> | yes | Demand API needs a Managed Affiliate contract; link-out until then |
| Agoda | Link-out | `link-out` | <https://www.agoda.com/en-in/> | yes | Affiliate/partner programme only; no public API used; link-out |
| Goibibo | Link-out | `link-out` | <https://www.goibibo.com/hotels/> | yes | MakeMyTrip group; no public API; link-out |
| Cleartrip | Link-out | `link-out` | <https://www.cleartrip.com/hotels> | yes | No public API used; link-out |
| EaseMyTrip | Link-out | `link-out` | <https://www.easemytrip.com/hotels/> | yes | No public API used; link-out |
| Incredible India | Link-out | `link-out` | <https://www.incredibleindia.gov.in/> | not re-fetched | Government tourism INFORMATION portal — not a booking site |

## Parking & tolls

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| Park+ | Link-out | `link-out` | <https://parkplus.io/> | yes | B2B only; no public API; link-out |
| ParkMate | Link-out | `link-out` | <https://parkmate.in/> | yes | Valet/parking app (select cities); no public API; link-out |
| NHAI (TIS toll info) | Functional | `live` | <http://tis.nhai.gov.in/> | yes | Toll plazas on route from OSM (functional); fees are NOT available as open data — "fee unknown" + TIS link-out |
| Highway Delite | Link-out | `link-out` | <https://www.highwaydelite.com/> | yes | Highway amenities / FASTag app; no public API; link-out |

## Fuel

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| IndianOil (IOCL) | Link-out | `link-out` | <https://iocl.com/petrol-diesel-price> | yes | Prices published on its web page (no feed, framing disallowed); link-out — Bharat shows no fuel price |
| HPCL | Link-out | `link-out` | <https://www.hindustanpetroleum.com/> | not re-fetched | No public price/stock API; link-out on HP stations |
| Jio-bp | Link-out | `link-out` | <https://www.jiobp.com/> | not re-fetched | No public API; link-out on Jio-bp stations |

## EV charging

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| Open Charge Map | Functional | `live` | <https://openchargemap.org/> | yes | Free API (key on server, OCM_API_KEY) — charger locations and status when the key is set; OSM fallback otherwise |
| ChargeZone | Link-out | `link-out` | <https://www.chargezone.co.in/> | yes | No public API; app link-out |
| Statiq | Partner-pending | `partner-pending` | <https://www.statiq.in/> | yes | OCPI roaming via EVlinq needs an eMSP contract; link-out |
| Tata Power EZ Charge | Link-out | `link-out` | <https://www.tatapower.com/ezcharge> | yes | No public API; app link-out |

## Health & emergency

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| Apollo Pharmacy | Link-out | `link-out` | <https://www.apollopharmacy.in/> | yes | No public API; link-out — Bharat never shows medicine stock |
| Tata 1mg | Link-out | `link-out` | <https://www.1mg.com/> | yes | No public API; link-out |
| Netmeds | Link-out | `link-out` | <https://www.netmeds.com/> | yes | No public API; link-out |
| Practo | Link-out | `link-out` | <https://www.practo.com/> | yes | No public booking API used; link-out |
| Apollo 24\|7 | Link-out | `link-out` | <https://www.apollo247.com/> | yes | No public API; link-out |
| eSanjeevani | Link-out | `link-out` | <https://esanjeevani.mohfw.gov.in/> | not re-fetched | Government telemedicine (C-DAC/MoHFW); no public API; link-out |
| 112 India (ERSS) | Functional | `live` | <https://112.gov.in/> | yes | tel:112 and tel:108 dialer actions always work (offline too); no third-party API |

## Courier & post

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| India Post | Functional | `live` | <https://www.indiapost.gov.in/> | yes | Pincode + DIGIPIN offline (functional); parcel tracking is a captcha web form — link-out |
| Shiprocket | Partner-pending | `partner-pending` | <https://www.shiprocket.in/> | not re-fetched | Self-serve API needs a seller account (SHIPROCKET_EMAIL/PASSWORD); adapter is a stub |
| Delhivery | Partner-pending | `partner-pending` | <https://www.delhivery.com/> | not re-fetched | API token from a Delhivery One business account (DELHIVERY_TOKEN); adapter is a stub |

## Payments (server/payments/)

| Provider | Class | Status | Official link | Link checked | Why |
|---|---|---|---|---|---|
| Razorpay | Functional | `live` | <https://razorpay.com/> | yes | Functional once RAZORPAY_KEY_ID/SECRET are set: server-created order + HMAC signature + webhook (tested in test mode with fixtures); UPI (incl. Google Pay) inside Checkout. No keys in this build → "Payments not configured" |
| Cashfree Payments | Prototype | `partner-pending` | <https://www.cashfree.com/> | yes | Adapter: server order (PG API 2023-08-01), status re-check, webhook HMAC (CASHFREE_APP_ID/SECRET); not exercised against a live sandbox |
| PhonePe Payment Gateway | Prototype | `partner-pending` | <https://www.phonepe.com/business-solutions/payment-gateway/> | yes | Adapter: PG v2 OAuth token + server pay request + order-status re-check + webhook auth hash (PHONEPE_CLIENT_ID/SECRET/VERSION); not exercised against a live sandbox |
| Paytm Payment Gateway (Paytm Payments Services) | Prototype | `partner-pending` | <https://www.paytmpayments.com/payment-gateway> | yes | Adapter: initiateTransaction + Paytm checksum + status API (PAYTM_MID/MERCHANT_KEY); not exercised against a live sandbox |
| UPI (via a gateway) | Partner-pending | `partner-pending` | — | — | Only inside a gateway checkout once that gateway's keys are configured (Google Pay, PhonePe, Paytm etc. appear as UPI apps there). No hand-built upi://pay intents |
| Google Pay | Unavailable | `unavailable` | — | — | Not a direct integration: it appears as a UPI app inside the gateway checkout |

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
