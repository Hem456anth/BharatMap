# Bharat Map: Integration Matrix (Indian commerce and mobility providers)

**Date:** October 2026 (research pass 20 Oct 2026 IST)
**Status:** §1–17 are the research pass (docs only). §18 lists the provider links and payment adapters that shipped in v0.7 (`shared/services/catalog.js`, `server/payments/index.js`).
**Companion docs:** `docs/RESEARCH.md` (open data, ONDC onboarding, Mappls/Google terms), `docs/ARCHITECTURE.md`.

## How to read this

**Evidence tags** (every row carries one or more):

| Tag | Meaning |
| --- | --- |
| **[F]** | Fetched: the official developer, partner or policy page was opened in this pass and says this. |
| **[S]** | Search-verified: the claim comes from an official or reputable page found by search, but its excerpt was the only part read. Re-check before relying on it in a contract or code. |
| **[R]** | Carried over from `docs/RESEARCH.md`, whose sources were fetched earlier in October 2026. |
| **[I]** | Our inference or recommendation, not a claim made by the provider. |
| **unverified** | A deep-link or URL format that is *not* officially documented. Only use it as a best-effort link-out with a web fallback. |

**Column meanings**

- **Public API:** `yes` = self-serve, anyone can sign up. `partner-only` = it exists, but needs approval, an invite or a contract. `none` = no third-party API found.
- **Auth:** OAuth, API key, partner contract, or merchant onboarding.
- **Fallback:** what Bharat Map does when we cannot integrate. The fallback ladder is: **(a)** transact in-app → **(b)** pre-filled deep link into the provider's app → **(c)** open the provider's web page → **(d)** show our own open data (OSM, GTFS), with "call" and "directions" buttons.

**Ground rules that apply to every row [I]:**

1. **No scraping, and no use of undocumented private APIs.** Several providers' private endpoints are visibly in use by hobby projects. Examples are `api3.pvrcinemas.com` and the Blinkit, Rapido and BookMyShow mobile APIs. Using them breaches the providers' terms and the IT Act's unauthorised-access provisions, and it can break at any time. We list them only so the team knows to avoid them.
2. **Never persist third-party content** (menus, prices, availability) beyond what the provider's terms allow. Cache only our own data and open data.
3. **Deep links are display-only.** We build them from our own POI data and never claim the provider endorses us.

---

## 1. Food

| Provider | Public API | Supported operations | Auth | Cost | Terms constraints | Deep link / universal link | Bharat Map fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Swiggy (Food, Instamart, Dineout, Scenes)** | **partner-only.** The Swiggy Builders Club MCP platform launched Apr 2026. It is "invite-based in v1". [F] | Restaurant discovery, menus with variants/add-ons, cart, coupons, order placement and tracking. Instamart: search, cart, checkout, tracking. Dineout: slot availability and table booking. Scenes: event tickets. Docs list 65–66 tools across 4 servers. [F][S] | **OAuth 2.1 + PKCE**, acting as the *end user's* Swiggy account. No static API key. Dynamic Client Registration is used. Production redirect URIs need allowlisting. [F] | No published fee. Enterprise and platform deals carry per-partner commercial terms, typically 4+ weeks to negotiate. [F] | You must apply with a use case and a demo video. Staging first, then production after ≥48 h green. Credentials can be revoked for "scraping, token abuse, bulk catalogue export". No PII storage beyond need. v1 limits: **Food is cash-on-delivery only, and the Food cart is capped at ₹1000 for Builders Club orders.** [F] | No documented app deep-link scheme. Restaurant pages on `https://www.swiggy.com/...` usually open the app via Android App Links. **unverified** | **Tier 2** (apply). Until approved: show the OSM restaurant and link out to swiggy.com search. **unverified** URL. |
| **Zomato** | **none for third-party apps.** An official MCP server exists (`https://mcp-server.zomato.com/mcp`), but its README says: *"We are not allowing any third party apps to be built on top of Zomato MCP right now"*. Developer access is "for personal use only". [F] | Discovery, menu, cart, ordering, tracking, QR payment. These work only inside whitelisted clients (Claude, ChatGPT, VS Code, Postman). [F] | OAuth, with a fixed redirect-URI allowlist. [F] | n/a | Testing only. Zomato disclaims liability. Integration discussions are by contact. [F] | No documented scheme. Web URLs on zomato.com. **unverified** | **Tier 3: link-out only.** |
| **ONDC F&B (buyer apps such as magicpin, Paytm, Pincode, Tata Neu)** | **yes, via the open network.** You build your own Buyer App (BAP) on Beckn/ONDC specs, after registry onboarding. [R] | Beckn `search / select / init / confirm / status / track / cancel / update / rating / support`. Each call gets an `on_*` callback. [R] | ONDC registry subscription with signed requests: domain-verification file, plus an `/on_subscribe` challenge. Pre-prod first, then production. [R] | No API fee to ONDC was found in this pass. Buyer-app commission is set by each app. Paytm, for example, reportedly charged 3% in 2023. [S] | ONDC participant agreement and network policies (grievance, settlement, refunds) apply. As a BAP you are the customer-facing party for complaints. [R][I] | n/a (we *are* the app) | **Tier 1** (after onboarding). magicpin is the largest F&B seller app on the network: about 1.5 lakh daily orders, fulfilling about 90% of food orders from Paytm, Tata Neu and Ola as of Oct 2024. [S] |
| **Restaurant websites** | none (per restaurant) | n/a | n/a | n/a | Respect each site's terms. Do not scrape menus. [I] | Link to the `website=*` / `website:menu=*` OSM tag. | **Tier 3.** Show the website, phone and directions. |
| **OSM `opening_hours` / menu tags** | **yes** (open data, ODbL) | Parse `opening_hours` (approved key, formal grammar, `PH`/`SH` holidays). Libraries: opening_hours.js, opening-hours-rs, the Kotlin osm-opening-hours. [F] | none | free | ODbL attribution and share-alike apply to derived databases. [R] | n/a | Use it for the "Open now / closes at" chip. Add India public-holiday definitions ourselves. [I] |
| **Google Places opening hours** | yes (paid) | Place details, including hours. | API key | Paid per call. | Google Maps Platform terms forbid caching and derived content, and forbid use with a non-Google map (we use MapLibre). [R] | Google Maps URLs (`https://www.google.com/maps/search/?api=1&query=…`) are documented and need no key. [F] | **Do not integrate the API.** A "View on Google Maps" link-out is allowed. [I] |

## 2. Movies and events

| Provider | Public API | Supported operations | Auth | Cost | Terms constraints | Deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **BookMyShow** | **none.** `partner.bookmyshow.com` is "only for registered partners of BookMyShow", meaning cinemas and organisers. [S] | Listings and booking exist only on BMS's own surfaces. | n/a | Affiliate programmes run through networks (INRDeals, Admitad, EarnKaro), paying about ₹7–10 per sale. Their claims about deep-linking support conflict. [S] | No public API. Third-party "BMS APIs" are scrapers and must not be used. [S][I] | `https://in.bookmyshow.com/<city>/movies` style pages. **unverified** | **Tier 3.** Link out per cinema POI. An affiliate wrapper is optional, through a network. |
| **District (Zomato/Eternal), incl. ex-Paytm Insider and TicketNew** | **none.** | Zomato bought Paytm's movie and event ticketing (Orbgen and Wasteland, including Insider and TicketNew) in Aug 2024 and is consolidating it into the District app. [S] | n/a | n/a | No developer programme found. | `https://www.district.in/movies/...` pages exist per cinema. **unverified** as a scheme. | **Tier 3.** |
| **PVR INOX** | **none (public).** | — | — | Affiliate through networks (INRDeals lists about 4.9% CPS). [S] | Hobby projects call `api3.pvrcinemas.com` with an empty bearer token. This is an undocumented private API, so **do not use it.** [S][I] | pvrcinemas.com cinema pages. **unverified** | **Tier 3.** |
| **Cinepolis India** | **none (public).** | — | — | Affiliate through networks (INRDeals lists up to 7% CPS). [S] | — | cinepolisindia.com. **unverified** | **Tier 3.** |
| **Paytm (movies/events)** | Moved to District (see above). Paytm's own announcement page confirms the transfer to Zomato. [S] | — | — | — | — | — | Treat as District. |
| **Swiggy Scenes (events)** | **partner-only** via the Swiggy MCP `scenes` server (event discovery and ticket booking). [S] | See the Swiggy row. | OAuth 2.1 | — | Same Builders Club terms. | — | **Tier 2.** |

## 3. Public transit

| Provider | Public data / API | Operations | Auth | Cost | Terms constraints | Ticket deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Hyderabad Metro (HMRL / L&T Metro)** | **yes: static GTFS** (already bundled in v0.4). [R] | Scheduled journey planning. | Download via Google Form. [R] | free | Commercial use allowed. Attribution: "Contains data provided by Hyderabad Metro Rail Ltd." [R] | **No public ticketing API.** QR tickets are sold through the TSavaari app, WhatsApp (send "Hi" to +91 83411 46468), PhonePe, Paytm, Rapido, Google Wallet/RCS and Mee Ticket. [S] Hyderabad is **not** in ONDC's live metro list (Jun 2026). Navi said Hyderabad is "next". [S] A common "MeeTicket" for TGSRTC + Metro launched Oct 2026. [S] | Show the GTFS timetable plus a "Buy QR ticket" link-out to TSavaari or the WhatsApp number (`https://wa.me/918341146468?text=Hi`; this is the standard WhatsApp click-to-chat format; the number is HMRL's published one). [I] |
| **Delhi Metro (DMRC)** | **yes: static GTFS** on OTD Delhi. It is **stale** (last updated 2023-08-10). [R] | Planning (validate against the current network). | OTD purpose form. [R] | free | OTD terms. [R] | **Ticketing via ONDC** is live. DMRC is a listed ONDC participant ("enabled by SequelString AI"). [S] Delhi Metro Sarthi / Momentum are the official apps. | ONDC metro ticket (Tier 1) after onboarding. Until then, link out. |
| **Delhi buses (DTC/DIMTS) – OTD** | **yes: static GTFS + GTFS-RT VehiclePositions.** [F] | Live bus positions at `/api/realtime/VehiclePositions.pb?key=…`. [F] A newer `delhi.transportstack.in` endpoint with an `x-api-key` header appears in a third-party copy of the access instructions. **unverified** [S] | **Private API key**, requested by form (commercial or non-commercial). The key is shown once at signup. [F][S] | free | OTD terms. [R] Note: `stop_times.txt` times are rough estimates assuming constant speed. [F] | DTC bus tickets are also on ONDC (DTC listed as live). [S] | **Tier 1** for data. |
| **Namma Metro (BMRCL), Bengaluru** | GTFS shared with platforms under an open-data framework. **No public download URL was verified.** [R][S] | — | partner | — | — | **On ONDC** (Jul 2025): Namma Yatri, Rapido, redBus, Tummoc, Paytm and others. [S] Google Maps metro tickets use Namma Yatri as the ONDC buyer app (Bengaluru, Chennai, Delhi, Kochi). [S] | ONDC metro ticket (Tier 1). Static data via partnership or community GTFS (mark as unofficial). |
| **Chennai Metro (CMRL)** | **No official open GTFS.** A community `ungalsoththu/ChennaiGTFS` feed exists. Mobility Database points its license to IIIT-D's terms, so treat it as unverified. [S] | — | — | — | — | **First metro on ONDC** (Feb 2024). Also inside the Uber app via ONDC (Aug 2025). [S] Chennai One (CUMTA) app for MTC, CMRL and suburban. [S] | ONDC ticket. Community GTFS only with a visible "unofficial" label. |
| **Mumbai Metro (MMRCL Line 3, MMOPL Line 1, MMMOCL 2A/7)** | No public GTFS verified. | — | — | — | — | **All three Mumbai Metro lines are on ONDC** (Jun 2026). [S] MMRCL's ticketing page lists ONDC apps, including Uber, Paytm, Rapido, Navi and ixigo. [S] | ONDC ticket. |
| **Kochi Metro (KMRL)** | **yes: static GTFS (Open Transit Data).** [R] | Planning. | none | free | Commercial use allowed. Attribution: "Contains data provided by Kochi Metro Rail Limited". No implied endorsement. [R] | On ONDC. [S] | Tier 1 (data + ONDC ticket). |
| **TGSRTC (Telangana buses)** | **yes: static GTFS.** [F] | Schedules, fares, routes, stops. | Google Form download. [F] | free | Free, non-exclusive, worldwide, **commercial use allowed**. Attribution: "Contains data provided by TGSRTC". No implied endorsement. No warranty. Access can be withdrawn without notice. [F] | Gamyam app does live tracking; there is **no public RT API**. [S] Mobile ticketing launched Oct 2026, inside the app only. [S] | Tier 1 for static data. Link out to Gamyam for live tracking. |
| **APSRTC (Andhra Pradesh)** | **No official GTFS found.** A community feed (`Neo2308/apsrtc-gtfs`) is listed but **expired** (service window Aug 30 – Sep 30, 2026). [S] | — | — | — | — | APSRTC Live Track app and apsrtconline.in reservations. [S] | Tier 3 (link-out). Community GTFS only if it is refreshed, with an "unofficial" label. |
| **BMTC (Bengaluru buses)** | Static GTFS shared with platforms (Jul 2025). Real-time sharing is *planned*, initially with Namma Yatri, BIAL and Tummoc (Oct 2026). [R][S] | — | partner | — | — | BMTC tickets on ONDC (Bengaluru bus + metro, Jul 2025). [S] | Apply as a data partner. ONDC ticket. |
| **MTC (Chennai buses)** | No official open GTFS. [S] | — | — | — | — | Chennai One app. [S] | Tier 3. |
| **BEST (Mumbai buses) / Chalo** | No public GTFS or API verified. | — | — | — | — | BEST bus ticketing is **live on ONDC** (Jun 2026). [S] Chalo (BEST's ticketing app) is itself an ONDC participant. [F] | ONDC bus ticket (Tier 1). Link out to Chalo. |
| **Indian Railways (IRCTC / NTES)** | **none public.** Booking goes only through IRCTC-registered **B2C Principal Service Providers**. That needs an integration fee, AMC and a rolling deposit under IRCTC's PSP policy. Listed PSPs include MakeMyTrip, Google and Amazon Pay. [S] Train-info data goes through IRCTC's separate **TIES** policy (Google is listed). [S] NTES offers a mobile app only; its API spec is internal (railnet). [S] | — | Contract with IRCTC (PSP or TIES). | Fee-based (policy PDFs). [S] | No public API. "Indian Rail API" services are unofficial resellers or scrapers. [S][I] | No deep-link spec. Link to `https://www.irctc.co.in/` and the NTES app. | **Tier 3.** Show station POIs from OSM. |
| **ONDC mobility (metro, bus, ride-hailing)** | **yes via a BAP**: one integration reaches 9 metros, 10K+ buses in 20+ cities and 30+ buyer apps (ONDC figures). [F] | Search fares, book and issue QR tickets, ride-hailing search/confirm/track (Beckn TRV domain). [F][R] | ONDC registry onboarding plus Beckn signing. [R] | No ONDC fee found. | ONDC network policies. [R] | We become the app. | **Tier 1: the single biggest unlock.** |

## 4. Groceries / quick commerce

| Provider | Public API | Operations | Auth | Cost | Terms | Deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Blinkit** | **none.** No official endpoint verified. Community MCPs reverse-engineer its mobile API and bypass Cloudflare TLS fingerprinting, so **do not use them.** [S] | — | — | — | — | blinkit.com. **unverified** | Tier 3. |
| **Zepto** | **Official MCP** at `https://mcp.zepto.co.in/mcp`, documented as a **consumer-facing** integration for end users in MCP clients. [F] | Product search, cart add/update/remove, order placement (real orders), order history. Payment by COD, UPI link, cards, Zepto Cash, or UPI Reserve Pay. [F] | OAuth (mobile number + OTP). Redirect allowlist; extra URIs on request via GitHub issue. [F] | none stated | "Not a sandbox". Every order is real. Embedding in a third-party *app* is not addressed, so ask Zepto first. [F][I] | — | **Tier 2** (ask before shipping). |
| **Swiggy Instamart** | **partner-only** (Swiggy MCP `/im`). [F] | Search, cart, checkout, tracking. [F] | OAuth 2.1 | — | Builders Club terms (see Food). | — | Tier 2. |
| **Flipkart Minutes** | **none** found. [S] | — | — | — | — | — | Tier 3. |
| **BigBasket (Tata)** | **none** found. [S] | — | — | — | — | — | Tier 3. |
| **JioMart** | **none** found. Not established in this pass whether JioMart inventory is reachable via ONDC. | — | — | — | — | — | Tier 3 / ONDC if present. |
| **ONDC retail (grocery)** | **yes via a BAP.** [R] | Beckn retail flows. | ONDC onboarding. | — | Buyer-app grievance duties. | — | **Tier 1.** This is how we sell groceries without a private marketplace. |

## 5. Rides

| Provider | Public API | Operations | Auth | Cost | Terms | Deep link (documented?) | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Uber** | Deep links: **yes** (documented). Ride Request API: **partner-only**. *"Access to this API endpoint requires approval from Uber… contact your Uber Business Development representative."* The `request` scope is privileged: only you and up to 5 registered developers can use it until Uber grants "Full Access". [F][S] | Deep link: set pickup, drop (multi-stop `drop[n]`), product, payment method. API (if approved): products, price/time estimates, ride requests, status, webhooks. [F] | Deep link: `client_id` only. API: OAuth 2.0 user token. Server tokens are deprecated. [F][S] | Deep links free. | Uber Developer terms. [S] | **Documented [F]:** `https://m.uber.com/looking?client_id=<ID>&pickup={"latitude":..,"longitude":..,"addressLine1":".."}&drop[0]={...}&product_id=<id>` (JSON URL-encoded). Native: `uber://?action=setPickup&pickup=my_location&dropoff[latitude]=..&dropoff[longitude]=..&dropoff[formatted_address]=..`. Universal links fall back to the Play Store/App Store or mobile web. | **Tier 1 (deep link).** |
| **Ola** | **partner-only.** *"Effective November 2017, we have moved on to a Invite-Only platform"*. Write to affiliates@olacabs.com. [S] | Full API: availability/estimate, booking, tracking, cancellation, SOS, rentals, outstation, ride later. [S] | X-APP token (partner) plus user OAuth. [S] | — | Partner agreement. [S] | **Documented [F]:** web `https://book.olacabs.com/?lat=&lng=&drop_lat=&drop_lng=&category=compact&utm_source=<XAPP_TOKEN>&dsw=yes`; app `olacabs://app/launch?...&landing_page=bk`; universal `https://olawebcdn.com/assets/ola-universal-link.html?...`. **`utm_source` (Ola-issued XAPP token) is marked mandatory**, so even deep links effectively need affiliate approval. | Tier 2 (apply for an affiliate token). Until then, link out to the Ola home page. |
| **Rapido** | **none for ride booking.** Rapido's documented "Partner API" (`rapido-labs/ota-docs`) runs the *other way*: it lets partner PWAs run inside Rapido's app (token validation, events). [F] Third-party "Rapido APIs" are reverse-engineered from its PWA. [S] | — | Partner key (for the inbound PWA programme). [F] | — | — | No documented deep link. **unverified** | Tier 3, or use Rapido's supply via ONDC if it exposes rides there (not verified). Rapido is an ONDC *buyer* app for metro tickets. [S] |
| **Namma Yatri (Moving Tech / Juspay)** | **yes via ONDC.** Namma Yatri is an ONDC BNP + SNP for cabs and autos. [S] Its code is open source under **AGPL-3.0** (`nammayatri/nammayatri`, `beckn-gateway`). [S] An official `ny-connectors` repo (MCP, CLI, skill) uses the user's own app token against `api.moving.tech`. Treat that as a personal-use tool, not a partner API. [S][I] | ONDC mobility: search → select → init → confirm → track → cancel. [R] | ONDC onboarding. | Zero-commission model for drivers. [S] | AGPL-3.0: if we *modify and host* NY code, we must publish our changes. Talking to it over ONDC is fine. [I] | No documented consumer deep link. **unverified** | **Tier 1 via ONDC BAP.** |
| **BluSmart** | **defunct.** Services were suspended 16–17 Apr 2025. The app stopped working. NCLT admitted an insolvency plea in Oct 2025. CBI booked the founders in Aug 2026. [S] | — | — | — | — | — | Remove from the UI. Treat any POI as `disused:`. |

## 6. Hotels

| Provider | Public API | Operations | Auth | Cost | Terms | Deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Booking.com** | Demand API: **partner-only**. You must be a **Managed Affiliate Partner**; Partner Centre access comes from your account manager "after signing the agreed contract". [S] A basic affiliate programme (links, banners) is open via the CJ network. [S] | Demand API v3.1/3.2: accommodation search and availability, details, orders (book/manage), cars, attractions, reporting. [S] | API key token + `X-Affiliate-Id`. [S] | Commission-based (you earn). | Affiliate terms. | Affiliate links (tracked) through CJ. [S] | Tier 2 (Demand API). Tier 3 (affiliate links) is available now. |
| **Airbnb** | **none open.** The Associates programme closed 31 Mar 2021. Today: "open to select publishing partners, influencers and bloggers across select markets". The publisher programme is **not accepting applications**. [S] | — | — | — | — | airbnb.co.in listing URLs. **unverified** | Tier 3. |
| **MakeMyTrip / Goibibo** | **No public API.** B2B surfaces are for travel agents (myPartner) and for hotels (Connect/InGo-MMT extranet). [S] Partner/XML APIs exist only under commercial agreements. [S] | — | partner contract | — | — | Web URLs. **unverified** | Tier 3. Tier 2 if a commercial deal is pursued. |
| **OYO** | **Not established.** No public distribution API was found in this pass. | — | — | — | — | — | Tier 3 link-out. |

## 7. Fuel and EV

| Provider | Public API | Operations | Auth | Cost | Terms | Deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Open Charge Map** | **yes.** [F] | Charger locations, comments, check-ins, photos. Submitting comments and check-ins. Iframe embed. [F] | API key (`X-API-Key` header or `key=`). Set a custom User-Agent. [S] | Free, no SLA, fair use. [S] | User-contributed data is CC BY 4.0. Imported data keeps its provider's licence. **Data-provider attribution must be visible to the end user.** [F] | `https://map.openchargemap.io/?mode=embedded&latitude=..&longitude=..` [F] | **Tier 1** (already planned; the OCM key is still pending per project notes). |
| **Tata Power EZ Charge** | **none public.** It has a consumer app with live availability, RFID and a self-care portal. [S] | — | — | — | — | App only. **unverified** | Show the OCM/OSM POI, plus "Open in EZ Charge" (Play Store link). |
| **Statiq** | **partner-only.** It supports OCPP/OCPI, and **EVlinq** is its OCPI roaming hub for CPOs, eMSPs, OEMs and fleets. [S] | OCPI locations, tariffs, sessions (if onboarded as an eMSP). [I] | OCPI token exchange (contract). [I] | — | — | — | Tier 2 (become an eMSP via EVlinq or a similar hub). Tier 3 meanwhile. |
| **ChargeZone** | **none public** found. [S] | — | — | — | — | — | Tier 3. |
| **Fuel prices (IOCL)** | **none.** IOCL publishes prices on a web page (changes take effect daily at 06:00) and by SMS (`RSP <dealer code>` to 92249 92249). Its site says pages may not be loaded into frames. [S] PPAC publishes the daily Delhi RSP. [S] | — | — | — | Framing is disallowed. Scraping terms were not verified, so assume "do not scrape". [S][I] | `https://www.iocl.com/petrol-diesel-price` | **Tier 3.** Show "price at pump may vary" plus a link-out. Optionally show a manually curated, dated metro price with the source (PPAC). [I] |

## 8. Parking and tolls

| Provider | Public API | Operations | Auth | Cost | Terms | Deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **NHAI / IHMCL toll plazas** | **public data (PDF)**: national highway fee-plaza list (NETC plaza code, name, state, NH). TIS portal for fee rules. [R] | Plaza POIs, fee lookup (manual). | none | free | No explicit licence on the PDF. [R] | `http://tis.nhai.gov.in/` | Already used in v0.4 (toll plazas on route, no fees). Keep that. [R] |
| **FASTag (NETC / NPCI)** | **none for consumer apps.** NETC is a bank ↔ NPCI ↔ plaza system defined by the IHMCL ICD. [S] Issuance and recharge APIs are offered commercially by aggregators (for example Setu) under agreements. [S] | Recharge, balance, issuance (via an aggregator). | Aggregator contract + KYC. | Commercial. | IHMCL parking policy v3 (Jul 2025) restricts API data access to acquirers and SIs. [S] | NPCI public status check page. [S] | Tier 2 (aggregator) if we ever sell recharges. Otherwise link to the user's bank app. |
| **Park+** | **none public.** It has B2B products (FASTag parking, society access) only. [S] | — | — | — | — | parkplus.io. **unverified** | Tier 3. Use OSM `amenity=parking` (with `fee`, `capacity`, `opening_hours`). |

## 9. Health and emergency

| Provider | Public API | Operations | Auth | Cost | Terms | Deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **112 India (ERSS)** | **none for third parties.** ERSS takes voice, SMS, SOS, email, web, chatbot, WhatsApp, IoT and "External Signals" into state PSAPs. External-signal integration is a state/MHA arrangement, not a public API. [S] | — | — | — | — | `tel:112`. The 112 India app is on Play/App Store. [S] | **Always available:** an SOS button that dials `tel:112` and shares live location via the user's own share sheet. [I] |
| **108 (state EMRI ambulance)** | **none.** It is run per state. [I] | — | — | — | — | `tel:108` | Same as 112. |
| **eSanjeevani** | **none public.** C-DAC runs it for MoHFW. It is integrated with ERSS-112. [S] | — | — | — | — | Link to the official site and app. | Tier 3. |
| **ABDM Health Facility Registry (HFR)** | **partner-only (registration required).** The facility *search* API exists (`v1.5` fuzzy search by name, LGD codes, ownership). It needs an ABDM **sandbox client ID/secret**, granted after a request form, then production approval. [S] | Search facilities, get master data. | ABDM gateway session token (client credentials). [S] | free (government) | ABDM policies, including the Health Data Management Policy. [S] | — | Tier 2. Meanwhile use OSM `amenity=hospital/clinic/pharmacy`. |
| **ABDM UHI (Beckn-based health network)** | **partner-only.** The ABDM developer portal lists UHI services: Jan Aushadhi Kendra and medicine discovery, private-ambulance discovery and quote, blood-bank discovery, PM-JAY hospital discovery. You join as an **EUA** (end-user app) through the UHI Gateway (`/api/v1/uhi/search` → `on_search`). [S] (The detailed pages returned 404 on fetch in this pass, so re-check the URLs.) | Discovery (plus an ambulance quote). | UHI registry + signing (Beckn-style). [S] | free | ABDM terms. | — | **Tier 2.** It is architecturally identical to our ONDC BAP work, so we can reuse the Beckn signer. [I] |
| **Jan Aushadhi Kendra locator (PMBI)** | **No REST API.** It has a web locator (state, district, pincode) and the Jan Aushadhi Sugam app. A 2023 state-wise list is on data.gov.in. [S] Programmatic discovery is via UHI (above). [S] | — | — | — | — | `https://janaushadhi.gov.in/locate-kendra` | Tier 3 link-out, or Tier 2 via UHI. |

## 10. Courier and logistics

| Provider | Public API | Operations | Auth | Cost | Terms | Deep link | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Porter** | **partner-only.** You need a Porter Enterprise account. The API key comes from your Porter relationship manager; there is a request form on the API Integrations page. Two-wheelers only via API. [S] | Quote, create order, cancel, track (poll + webhooks). [S] | API key (enterprise). | Per-trip commercial. | Enterprise agreement. | — | Tier 2 for "send a parcel" from a map pin. |
| **Dunzo** | **defunct.** The app and site went offline in Jan 2025. It was admitted to insolvency (CIRP) in Aug 2025. [S] | — | — | — | — | — | Remove. |
| **Shiprocket** | **yes (self-serve once you have a Shiprocket seller account).** [S] | Create/update orders, assign courier (AWB), schedule pickup, labels, track by AWB/order, returns, NDR, webhooks. [S] | Email + password of a panel-created **API user** → JWT valid 240 h (10 days). [S] | Pay-per-shipment rate card (account). | Account T&Cs. KYC for sellers. | — | Tier 1 *if* Bharat Map or its sellers ship B2C parcels. Not needed for the core map. |
| **Delhivery** | **yes (self-serve via a Delhivery One business account).** [S] | Pincode serviceability, expected TAT, waybill, shipment create/update/cancel, tracking (≤50 waybills/request), labels, pickups, webhooks, NDR, B2B LTL APIs. [S] | Static API token from Settings → API Setup. [S] | Rate card. | Account T&Cs. | — | Same as Shiprocket. |
| **India Post: pincode** | **yes (open data).** The All-India Pincode Directory is on data.gov.in (monthly, GODL), with an API key. [R] The popular `api.postalpincode.in` is a **third-party, unofficial** mirror, so do not depend on it. [I] | Pincode → office, district, state (lat/long variant). | data.gov.in API key. | free | GODL attribution. The clause text was not verified. [R] | — | **Tier 1** (already used for search). |
| **India Post: tracking** | **partner-only.** DoP's "Integration with Bulk Customers" SOP covers booking data, event (tracking) data, tariff and pincode APIs **for registered contractual/bulk customers**. [S] Public tracking is a captcha web form or the Dak Sewa app. [S] | Bulk tracking (≤500 articles/request in the 2026 approach doc). [S] | Customer ID from a DoP business agreement. | — | — | `https://www.indiapost.gov.in/` tracking page | Tier 3 link-out. |
| **DIGIPIN (India Post)** | **yes (open source).** Official repo `INDIAPOST-gov/digipin` under **Apache-2.0**, with encode/decode logic plus a reference Node REST server. "Know Your DIGIPIN" web app. [S][R] | Encode lat/lng ↔ 10-character grid code, offline. [S] | none | free | Apache-2.0. [S] | — | **Tier 1** (already in Bharat Map search). |

## 11. Payments

| Provider | Public API | Operations | Auth | Cost | Terms | Link format | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Razorpay** | **yes** (merchant onboarding with KYC). [S] | Checkout (cards, UPI intent/QR, netbanking, wallets), orders, refunds, webhooks, Route/marketplace products. [S][I] | Key ID + secret. Merchant KYC (one-time KYC fee ₹199 + tax mentioned for a 2026 offer). [S] | **2% platform fee + 18% GST** on domestic instruments, including UPI (UPI MDR is 0%, so the 2% is Razorpay's fee). 3% for Amex/Diners/international/EMI/corporate cards. No setup fee or AMC. Custom pricing above about ₹5L/month. [S] | Razorpay T&Cs. RBI PA rules (see legal). | Hosted checkout. Test-mode `success@razorpay`. [S] | Already used in test mode (v0.2). **Tier 1.** |
| **UPI intent (`upi://pay`)** | **spec is public; acceptance needs a merchant VPA from a PSP/PA.** [F][S] | Launch any UPI app with payee + amount. | none for the link. The **payee VPA must be a merchant VPA** onboarded by a Payee PSP. | free to build (fees sit with the PSP/PA). | **NPCI UPI Consolidated Circular (18 Sep 2026) [F]:** (7.6) app and mobile-web merchants *must* enable intent; (7.9) **intent is not allowed for offline non-verified merchants, and P2P intent is not allowed**; (2.8) apps must follow the UPI Deep Linking spec and must not alter mandatory fields; (2.5) apps respond to intent only for registered users; (7.5) no surcharge on UPI. | Spec v1.6 parameters: `upi://pay?pa=<merchant VPA>&pn=<name>&mc=<MCC>&tr=<txn ref>&tn=<note>&am=<amount>&cu=INR` (`pa` and `pn` mandatory; `tr` mandatory for dynamic URLs). [S] (NPCI's own spec PDF URL returned 404; the parameter table comes from a mirrored copy, so treat field rules as per your PSP's docs.) | **Tier 1, but only via Razorpay (or another PA) generating the intent for a registered merchant.** Never hand-build `upi://pay` to an individual's VPA (that would be P2P intent, which is disallowed). [I] |

## 12. Maps, geocoding and addressing

| Provider | Public API | Operations | Auth | Cost | Terms | Notes | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Mappls / MapmyIndia** | **yes** (self-serve console, with a free quota). [R][S] | Search/geocode (300+ POI categories, pincode-scoped autosuggest), routing, Mappls Pin, SDKs. [R] | API key / OAuth client. [S] | The free quota is in the console. Paid pricing is **not public** (contact sales). [S] | No caching to avoid fees ("whatever is not permitted is prohibited"). **Perpetual royalty-free licence over user content you upload.** The MapmyIndia logo must stay. Free plan ends after 3 months of inactivity. [R][S] | — | Use only as a live pass-through (for example, traffic pilot). Never persist results, and never upload user data. [R] |
| **DIGIPIN** | see Courier (§10) | | | | | | Tier 1 |
| **Google Maps URLs** | **yes, documented, no API key.** [F] | Search, directions (`travelmode=driving|walking|bicycling|two-wheeler|transit`, `dir_action=navigate`, waypoints, `avoid=tolls|highways|ferries`), map, Street View. [F] | none | free | Use as a *link-out* only. It does not breach the "Google API near a non-Google map" rule, because it calls no API. [I] | `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=two-wheeler` | "Open in Google Maps" share target. |

---

## 13. Tiered recommendation

### Tier 1: integrable now without a commercial partnership

| # | Integration | Why it is Tier 1 | Prerequisite |
| --- | --- | --- | --- |
| 1 | **ONDC buyer app (BAP) on Beckn**: retail/grocery, F&B, mobility (Namma Yatri and other ride supply), **metro and bus QR tickets** (9 metros incl. Delhi, Bengaluru, Chennai, Kochi, Pune, Nagpur, Mumbai ×3; DTC, BEST, BMTC buses) | One standards-based integration reaches food, groceries, rides and transit tickets. No per-provider contract. [F][R][S] | ONDC registry onboarding: pre-prod subscribe, domain verification, `/on_subscribe` challenge, then the production participant agreement. [R] We act as a BAP with grievance and refund duties. |
| 2 | **GTFS feeds**: HMRL, TGSRTC, Kochi Metro (static); Delhi OTD (static + **GTFS-RT** with key) | Open licences permit commercial use with attribution. [F][R] | Attribution strings in the UI. OTD real-time key. |
| 3 | **Open Charge Map** | Free API, CC BY 4.0 user data. [F] | API key. Per-provider attribution visible. |
| 4 | **India Post pincode (data.gov.in) + DIGIPIN (Apache-2.0)** | Open government data and open-source code. [R][S] | data.gov.in key. GODL attribution. |
| 5 | **Uber deep links** | Documented, needs only a `client_id`. [F] | Register an app on developer.uber.com. |
| 6 | **UPI intent via Razorpay** | The PA issues a merchant intent and handles compliance. [F][S] | Razorpay live KYC (currently test mode). |
| 7 | **OSM `opening_hours`**, **Google Maps URLs**, `tel:112` / `tel:108` | Open data or documented URL schemes. [F] | — |
| 8 | **Shiprocket / Delhivery** *(only if we ship parcels)* | Self-serve with a business account. [S] | Seller account + KYC. |

### Tier 2: needs a partner contract, approval or invite

Swiggy Builders Club MCP (Food, Instamart, Dineout, Scenes) · Zepto MCP (confirm third-party-app use) · Uber Ride Request API · Ola affiliate (needed even for deep links) · Booking.com Demand API · Porter Enterprise API · India Post bulk-customer tracking · ABDM HFR + **UHI EUA** (Jan Aushadhi, ambulance, blood bank) · Statiq EVlinq / OCPI eMSP roaming · FASTag via an aggregator · BMRCL/BMTC data partnership · IRCTC (B2C PSP or TIES) · MakeMyTrip/Goibibo commercial API.

### Tier 3: link-out only (no API for us)

Zomato · BookMyShow · District (ex-Paytm Insider/TicketNew) · PVR INOX · Cinepolis · Blinkit · Flipkart Minutes · BigBasket · JioMart · Rapido · Airbnb · OYO · Tata Power EZ Charge · ChargeZone · Park+ · IOCL fuel prices · eSanjeevani · NTES · APSRTC/MTC · restaurant websites.
**Remove:** BluSmart (defunct Apr 2025), Dunzo (offline Jan 2025, in insolvency).

## 14. Which can do legitimate end-to-end in-app transactions

| Flow | End-to-end in Bharat Map? | How |
| --- | --- | --- |
| Groceries, food, retail from ONDC sellers | **Yes** | We are the BAP. Payment is collected per ONDC settlement rules, through our PA. [R][I] |
| Metro and bus QR tickets (ONDC cities) | **Yes** | ONDC public-transport domain. QR ticket issued in-app. [F] |
| Auto/cab rides from ONDC supply (Namma Yatri and others) | **Yes** | ONDC mobility. [S] |
| Swiggy food / Instamart / Dineout / Scenes | **Yes, after approval**, *acting as the user's own Swiggy account* (OAuth). v1 Food: COD only, ₹1000 cart cap. [F] | Swiggy MCP. |
| Zepto groceries | **Technically yes** (real orders via OAuth). **Not cleared for third-party apps.** Get written confirmation first. [F][I] | Zepto MCP. |
| Uber rides | **No** without Ride Request approval. Deep link hands off to the Uber app. [F] | — |
| Hotel booking (Booking.com) | **Yes, after a Managed Affiliate contract.** [S] | Demand API. |
| Parcel pickup (Porter) | **Yes, after an enterprise API key.** [S] | Porter API. |
| Payments for our own merchant flows | **Yes** | Razorpay checkout / UPI intent. [S] |
| Everything in Tier 3 | **No** | Link-out. |

## 15. Security and legal notes

**DPDP Act 2023 + DPDP Rules 2025** (notified 13/14 Nov 2025). [S]
- **Phasing:**
  - Board provisions apply immediately.
  - Consent Manager registration applies from about **13 Nov 2026**.
  - Core Data Fiduciary obligations apply from about **13 May 2027**: standalone notice, purpose-specific consent, security safeguards, breach intimation, erasure, rights handling.
- **Design now [I]:**
  - A **standalone, plain-language consent notice** per purpose (location, contacts for sharing, order history).
  - Data minimisation. Retention limits with deletion jobs. A breach runbook. A grievance contact.
  - Child-data handling if minors use the app.
- The v0.5 privacy dashboard is the right base. [I]
- **When we act as an ONDC BAP or a Swiggy/Zepto OAuth client, we are a Data Fiduciary for the user's order data** (addresses, phone). Only store what each provider's terms allow. Swiggy explicitly bars PII storage "beyond what you need". [F]
- UPI rules [F]:
  - Location capture needs revocable consent.
  - UPI must not be disabled when consent is refused.
  - Account and balance data must not be stored by apps.

**Payment aggregator rules (RBI Master Direction on Regulation of Payment Aggregators, 15 Sep 2025).** [S]
- A non-bank entity collecting and settling funds for merchants needs **RBI PA authorisation**.
- PA business and marketplace business are separated.
- A marketplace onboarded by a PA may accept payments only for sellers onboarded on that marketplace.
- **Implication [I]:**
  - Bharat Map must **not** pool customer money and pay sellers itself.
  - Use an authorised PA (Razorpay) with its marketplace/split-settlement product.
  - For ONDC orders, follow the ONDC settlement framework.
  - Never route funds through our own account.
- UPI: no surcharge, and intent only for verified or online merchants. [F]

**Provider terms and IP.** [R][F][S][I]
- **No scraping and no private-API use**:
  - BookMyShow, PVR INOX, Blinkit and Rapido private endpoints.
  - Zomato MCP outside its allowlisted clients.
  - Mappls output caching.
  - Google API data behind MapLibre.
- **Swiggy** revokes credentials for "scraping, token abuse, bulk catalogue export". [F]
- Keep **attribution** strings for TGSRTC, HMRL, KMRL, OCM providers and ODbL. Never imply endorsement (TGSRTC and KMRL terms). [F][R]
- **AGPL-3.0 (Namma Yatri):** using it over the ONDC network creates no obligation. Forking or hosting modified NY services would require publishing the source. [I]
- Map display must follow the **Survey of India boundary** requirement (see RESEARCH.md). [R]

**Security baseline for partner integrations.** [F][I]
- Exact-match HTTPS OAuth redirect URIs (Swiggy requirement).
- PKCE everywhere.
- Store tokens server-side, encrypted.
- Honour `429` + `Retry-After`.
- Sign Beckn/ONDC and UHI requests with keys held in a KMS.
- Rotate the Uber `client_id` and the OTD key out of the APK, and proxy them through our backend.
- Treat any `upi://` link received from a third party as untrusted (QR/intent phishing).

---

## 16. Gaps and things to re-check

- These were not fetched in this pass, so treat them as **[S]** until fetched:
  - Ola invite-only status.
  - BMS partner portal scope.
  - Booking.com prerequisites.
  - Porter API access.
  - Shiprocket/Delhivery auth details.
  - RBI PA Master Direction text.
  - DPDP Rules timeline.
  - IRCTC PSP/TIES policies.
- ABDM **UHI** service pages (`docs.abdm.gov.in/docs/uhi/v1/services/...`) returned **404** on fetch. Confirm the current URL before applying.
- NPCI's own UPI Linking Spec PDF URL returned 404. The parameter list comes from a mirror. Use your PSP's (Razorpay's) intent docs as the source of truth.
- **Not established:**
  - An official BMRCL/BMTC public GTFS URL.
  - JioMart and Rapido ride presence on ONDC.
  - OYO API.
  - OCM's exact rate limits.
  - Mappls paid pricing.
  - The GODL clause text.

## 17. Sources (opened or found in this pass, Oct 2026)

**Fetched [F]:**
- Uber deep links: https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
- Swiggy MCP access: https://mcp.swiggy.com/builders/docs/operate/access.md
- Swiggy MCP changelog: https://mcp.swiggy.com/builders/docs/operate/changelog.md
- Zomato MCP: https://raw.githubusercontent.com/Zomato/mcp-server-manifest/master/README.md
- Zepto MCP: https://github.com/zeptonow/mcp
- ONDC public transport: https://www.ondc.org/pages/public-transport.html
- Open Charge Map: https://openchargemap.org/develop
- Ola deep links: https://developers.olacabs.com/docs/deep-linking
- TGSRTC open data: https://www.tgsrtc.telangana.gov.in/open-data
- NPCI UPI Consolidated Circular: https://www.npci.org.in/uploads/UPI_Consolidated_Circular_f9c023a0ef.pdf
- OSM opening_hours: https://wiki.openstreetmap.org/wiki/Key:opening_hours
- Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started
- Rapido partner API: https://github.com/rapido-labs/ota-docs/blob/main/docs/api/overview.md

**Search-verified [S]:**
- Uber riders: https://developer.uber.com/docs/riders/introduction ; https://developer.uber.com/docs/riders/references/api/v1.2/requests-post
- Swiggy Builders Club: https://mcp.swiggy.com/builders/docs/ ; Swiggy press releases (27 Jan 2026, 23 Apr 2026) on swiggy.com/corporate
- Ola: https://developers.olacabs.com/docs/overview
- BookMyShow partner portal: https://partner.bookmyshow.com/
- District acquisition: https://www.eternal.com/our-businesses/district/ ; https://paytm.com/movies/announcement
- ONDC metro ticketing: https://www.business-standard.com/industry/news/ondc-enables-three-lakh-daily-bus-and-metro-ticket-bookings-126060101212_1.html ; https://www.ondc.org/pages/network-participants.html ; https://mmrcl.com/en/ticketing-and-access ; https://support.google.com/maps/answer/15179212
- CMRL press releases: https://chennaimetrorail.org/wp-content/uploads/2024/03/Press-Release-02.02.2024-English.pdf ; https://chennaimetrorail.org/wp-content/uploads/2025/08/Press-Release-07.08.2025-English.pdf
- Delhi OTD: https://otd.delhi.gov.in/documentation/ ; https://otd.delhi.gov.in/data/realtime/
- HMRL ticketing: https://ltmetro.com/faqs/
- TOI on MeeTicket (2 Oct 2026): https://timesofindia.indiatimes.com/city/hyderabad/common-meeticket-for-rtc-buses-metro-from-today/articleshow/134645432.cms
- Bengaluru transit: https://www.thehindu.com/news/national/karnataka/bmrcl-bmtc-open-transport-data-allow-namma-yatri-tummoc-users-to-coordinate-first-last-mile-connectivity/article69797299.ece ; https://www.thehindu.com/news/cities/bangalore/bmtc-to-share-real-time-bus-data-with-mobility-platforms-in-bengaluru/article71568994.ece
- Community GTFS: https://mobilitydatabase.org/feeds/gtfs/mdb-3050 (APSRTC) ; https://github.com/ungalsoththu/ChennaiGTFS
- IRCTC: https://contents.irctc.co.in/en/B2C_PSP_Policy_other_than_Startup_MSME.pdf ; https://contents.irctc.co.in/en/TIES_Policy.pdf ; https://contents.irctc.co.in/en/IRCTC%20Authorised%20Principal%20Service%20Providers.pdf
- Namma Yatri: https://github.com/nammayatri/nammayatri ; https://github.com/nammayatri/ny-connectors
- BluSmart: https://www.reuters.com/business/autos-transportation/indias-blusmart-rival-uber-suspends-operations-after-co-founder-probed-2025-04-17/ ; https://www.medianama.com/2025/10/223-nclt-admits-insolvency-plea-against-blusmart-mobility/
- Dunzo: https://inc42.com/buzz/exclusive-reliance-backed-dunzo-admitted-into-insolvency/
- Booking.com Demand API: https://developers.booking.com/demand/docs/getting-started/prerequisites
- Airbnb affiliates: https://www.airbnb.com/help/article/4236
- MakeMyTrip myPartner: https://mypartner.makemytrip.com/
- Fuel prices: https://www.iocl.com/petrol-diesel-price ; https://ppac.gov.in/archives/impnews
- Statiq: https://www.statiq.in/about-us
- Tata Power EZ Charge: https://www.tatapower.com/ezcharge
- FASTag/NETC: https://ihmcl.co.in/wp-content/uploads/2025/07/Updated-Parking-Policy.pdf ; https://setu.co/payments/fastag/
- Park+: https://parkplus.io/
- 112 India: https://112.gov.in/about ; https://www.mha.gov.in/en/commoncontent/emergency-response-support-system-erss
- ABDM: https://docs.abdm.gov.in/docs/hiecm/v3/api/m4/endpoints/m4-search/02-m4-post-facilitymanagement-v1-5-facility-search ; https://docs.abdm.gov.in/docs/hiecm/v3/getting-started/sandbox
- Jan Aushadhi: https://janaushadhi.gov.in/locate-kendra
- Porter: https://porter.in/api-integrations ; https://docs.clickpost.ai/docs/porter-hld
- Shiprocket: https://apidocs.shiprocket.in/ ; https://apidocs-test.shiprocket.in/guides/authentication
- Delhivery: https://one.delhivery.com/developer-portal/documents ; https://help.delhivery.com/docs/api-token-generation
- India Post integration SOP: https://utilities.cept.gov.in/dop/pdfbind.ashx?id=5778
- DIGIPIN: https://github.com/INDIAPOST-gov/digipin ; https://www.indiapost.gov.in/digipin
- Razorpay pricing: https://razorpay.com/pricing ; https://razorpay.com/docs/payments/payments/faqs
- UPI deep-link parameter mirror: https://www.labnol.org/files/linking.pdf
- RBI Payment Aggregator directions: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896
- DPDP Rules: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014 ; https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- Mappls terms: https://about.mappls.com/api/terms-&-conditions
- magicpin on ONDC: https://www.newindianexpress.com/business/2024/Oct/09/magicpin-largest-food-delivery-app-on-ondc

**Carried from RESEARCH.md [R]:** ONDC/Beckn specs and registry onboarding, HMRL/Kochi/OTD/DMRC GTFS terms, India Post pincode directory, NHAI toll list, Google and Mappls terms, Survey of India boundary.

---

## 18. v0.7 provider links and payment adapters (shipped)

These are the providers added to the place-card service panels in v0.7. The source of truth is `shared/services/catalog.js`
(92 providers); `docs/INTEGRATION_MATRIX.md` is generated from it and `npm test` fails if the two drift.

**Evidence.** **[C]** = the official URL was recorded in the catalogue from the 20 Oct 2026 web check. **HTTP** = reachability
from the build sandbox on 20 Oct 2026 (~03:30 IST, `curl -L`, desktop user agent). 403 means the site blocked the automated
request, not that the link is wrong; `000` means no response within 12 s. None of these providers gives Bharat Map an API:
every row below is a **link-out** through the in-app interstitial, which names the destination host and flags any
unverified link. Nothing here is shown as Live, and no price, fare, ETA, slot or showtime is displayed for any of them.

| Provider | Panel / where it appears | Class | Official link | Why link-out only | Evidence |
| --- | --- | --- | --- | --- | --- |
| **Bharat Taxi** (Sahakar Taxi Cooperative) | Ride panel, Delhi-NCR / Mumbai / Pune regions | Link-out | https://www.bharattaxiapp.com/ | Cooperative ride app (launched Feb 2026); rides are on ONDC mobility, which needs Bharat to be an onboarded buyer app. No consumer deep link. | [C], HTTP 200 |
| **Yatri Sathi** (Govt. of West Bengal) | Ride panel, Kolkata region | Link-out | https://yatrisathi.in/ | Live on ONDC mobility; no consumer deep link. | [C], HTTP 200 |
| **Dineout → Swiggy** | Restaurant panel ("Reserve a table") | Link-out | https://www.swiggy.com/dineout | Dineout was acquired by Swiggy (May 2022); table booking is inside Swiggy, and Swiggy's Builders Club Dineout tools are invite-only (§1). | [C], HTTP 403 (bot block) |
| **ParkMate** | Parking panel | Link-out | https://parkmate.in/ | Valet/parking app in select cities; no public API. | [C], HTTP 200 |
| **Highway Delite** | Parking / highway amenities, toll context | Link-out | https://www.highwaydelite.com/ | Highway amenities and FASTag app; no public API. Toll fees stay "fee unknown". | [C], HTTP 200 |
| **ChargeZone** | EV charging panel | Link-out | https://www.chargezone.co.in/ | No public API; app link-out. Charger availability is never shown as live. | [C], HTTP 200 |
| **KSRTC (Karnataka)** | Bus station panel, Bengaluru | Link-out (website ticketing) | https://ksrtc.in/ | Official reservations on ksrtc.in, the AWATAR app and WhatsApp (intercity). | [C], HTTP 200 |
| **KSRTC (Kerala)** | Bus station panel, Kochi | Link-out (website ticketing) | https://www.keralartc.com/ | Official online reservations. | [C], HTTP 000 (no response from sandbox) |
| **TNSTC / SETC** | Bus station panel, Chennai | Link-out (website ticketing) | https://www.tnstc.in/OTRSOnline/ | Official online reservation (OTRS) and WhatsApp (intercity). | [C], HTTP 200 |
| **Noida Metro (NMRC Aqua Line)** | Metro station panel, Noida | Link-out (official app ticketing) | https://www.nmrcnoida.com/ | QR tickets in the official "NMRC Tickets" app. No timetable feed bundled → no departures shown. | [C], HTTP 200 |
| **Ahmedabad Metro (GMRC)** | Metro station panel, Ahmedabad | Link-out (official app ticketing) | https://www.gujaratmetrorail.com/ahmedabad/ | QR tickets in the official app; ONDC planned, not live. | [C], HTTP 500 at check time |
| **Lucknow Metro (UPMRC)** | Metro station panel, Lucknow | Link-out (official app ticketing) | https://lucknow.upmetrorail.com/ | QR tickets in the official "Lucknow Metro Official" app. | [C], HTTP 200 |
| **Kanpur Metro (UPMRC)** | Metro station panel, Kanpur | Link-out (info only) | https://upmetrorail.com/ | Official mobile e-ticketing not verified → information link only, no ticket button. | [C], HTTP 200 |
| **Kolkata Metro (Metro Railway)** | Metro station panel, Kolkata | Link-out (official app ticketing) | https://mtp.indianrailways.gov.in/ | QR tickets in the official "Aamar Kolkata Metro" app (CRIS). | [C], HTTP 000 (no response from sandbox) |
| **DMart Ready** | Grocery panel | Link-out | https://www.dmart.in/ | Delivery and pick-up points in select cities; no API. | [C], HTTP 403 (bot block) |
| **JioMart** | Grocery panel | Link-out | https://www.jiomart.com/ | No public API found. | [C], HTTP 200 |

Hyderabad Metro remains the only metro with **Scheduled** departures (bundled HMRL GTFS, §3); live arrivals are shown as
Unavailable everywhere.

### Payment gateways (server adapters, `server/payments/index.js`)

Each adapter is **enabled only by its own environment keys** (see `docs/CONFIGURATION.md`); keys never leave the server.
With no keys the payment screen (`#/pay/<orderId>`) says **"Payments not configured"**, the order stays `pending_payment`
and nothing is marked paid. The amount always comes from our database, the client never sends it. UPI apps (including
Google Pay) appear **inside the gateway's checkout**; Bharat Map never builds a `upi://pay` intent (§11, NPCI rules).

| Gateway | Class | Flow implemented | Env keys | Verified how | Evidence |
| --- | --- | --- | --- | --- | --- |
| **Razorpay** | Functional (when keys are set) | Server order → Checkout → HMAC signature verify → `payment.captured` webhook backstop | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | v0.2 test-mode flow + API tests with fixtures. No keys in this build. | https://razorpay.com/ HTTP 200 |
| **Cashfree Payments** | Prototype | PG API (2023-08-01) server order → status re-check → webhook HMAC | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, `CASHFREE_API_BASE` | API test with a locally signed webhook (bad signature rejected, SUCCESS marks paid once). **Not run against a live sandbox.** | https://www.cashfree.com/ HTTP 200 |
| **PhonePe Payment Gateway** | Prototype | PG v2 OAuth token → server pay request → order-status re-check → webhook auth hash | `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`, `PHONEPE_ENV`, `PHONEPE_AUTH_BASE`, `PHONEPE_PG_BASE`, `PHONEPE_WEBHOOK_USER`, `PHONEPE_WEBHOOK_PASSWORD` | Unit-tested with locally computed hashes. **Not run against a live sandbox.** | https://www.phonepe.com/business-solutions/payment-gateway/ HTTP 200 |
| **Paytm Payment Gateway** (Paytm Payments Services) | Prototype | `initiateTransaction` + Paytm checksum → status API | `PAYTM_MID`, `PAYTM_MERCHANT_KEY`, `PAYTM_WEBSITE`, `PAYTM_ENV`, `PAYTM_API_BASE` | Unit-tested with a locally computed checksum. **Not run against a live sandbox.** | https://www.paytmpayments.com/payment-gateway HTTP 200 |

### Admin-managed links

Admins can attach extra links to a place (`POST /api/admin/provider-links`, Admin → Listings). A new link is stored
**unverified** and is not shown on the public place panel until an admin verifies it (`PATCH …/:id {verified:true}`).
Only `http(s)` URLs are accepted (no `tel:`, no `upi://`), providers classed Unavailable are refused, and every change is
written to the audit log.
