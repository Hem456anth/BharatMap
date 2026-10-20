# App deep links from user-supplied APKs (20 Oct 2026)

**Scope: interoperability only.** For each APK the user uploaded, `scripts/extract-deeplinks.py` (androguard 4.1.4) read
**only** the binary `AndroidManifest.xml` and the APK signing block: package, versionName/versionCode, signer certificate
SHA-256 (v1/v2/v3), and every `<intent-filter>` on an activity/activity-alias with action `VIEW` + category `BROWSABLE`
(schemes, hosts, `path`/`pathPrefix`/`pathPattern`, `android:autoVerify`). `@string` references used inside `<data>`
attributes were resolved through `resources.arsc` (scheme/host values only). **No `classes*.dex` was opened, nothing was
decompiled, no assets/resources/native libraries were read, no keys, secrets or endpoints were extracted.** SDK login
schemes that embed an id (Facebook `fb<digits>`, Kakao `kakao<hex>`, LINE `line.<digits>`) are redacted in the output.

Output: `data/deeplinks/apk-manifest-links.json` (per app: package, version, APK SHA-256, signer cert, every browsable
filter, summary). Wired in `shared/services/deeplinks.js` → `shared/services/linkouts.js`, `catalog.js`, `build.js`,
interstitial `web/ui/linkout.js`, native opener `ExternalAppPlugin.java`. Checked by `tests/deeplinks.test.js`.

For https App Links we additionally fetched each site's public `/.well-known/assetlinks.json` and confirmed it lists the
package **with the same certificate** as the APK we were given (Android verifies App Links the same way).

## Link types

| Type | Meaning | Interstitial label | What Bharat opens |
|---|---|---|---|
| **Documented** | The provider publishes developer docs for the format | "Documented deep link" + "Prefilled: …" | The documented https link with documented parameters (opens the app if installed, else mobile web) |
| **App Link** | https URL on a host the app declares with `autoVerify`, the site's `assetlinks.json` names the package + APK cert, and the **path is declared** in the manifest | "App Link (verified domain)" | That https URL — **no query parameters** (none are documented). App if installed, the same page on the web otherwise |
| **Declared · Unverified** | Custom-scheme entry point seen **only** in the manifest; parameters unknown | "Declared · Unverified" + warning | `intent://HOST#Intent;scheme=…;package=…;S.browser_fallback_url=<official https>;end` on Android (opens the app home); the https fallback everywhere else |
| **None** | No link is built | — | Nothing (payments go through gateways; not-in-India apps are skipped) |

Payment schemes are never built and are refused by `intentUrl()`, `safeIntent()`, `safeLinkout()` and the native plugin:
`upi`, `upiGlobal`, `ppe`, `phonepe`, `paytmmp`, `tez`, `gpay`, `bbps`, `bharatconnect`, `upimeta`.

## Per-app result

Signer certificates: all 15 APKs are v2+v3 signed with a single certificate (SHA-256 below, first 16 hex). `base(14).apk`
is a byte-identical copy of `base(11).apk` (Uber) and was not analysed separately.

| App | Package | Version | Cert SHA-256 | Browsable filters | Useful entry points (from the manifest) | Bharat uses | Type | Prefills |
|---|---|---|---|---|---|---|---|---|
| Uber | `com.ubercab` | 4.652.10004 | `4003231ab42feb8d…` | 55 | `https://m.uber.com/ul/…` (pathPrefix `/ul/`, autoVerify) — [Uber docs](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction); also `uber://`, `geo:` | `https://m.uber.com/ul/?action=setPickup&pickup[latitude]…&dropoff[latitude]…` | **Documented** (+ App Link, assetlinks ✓) | pickup lat/lng + nickname (or `my_location`), drop lat/lng + nickname + address; `client_id` from server config |
| Swiggy | `in.swiggy.android` | 4.119.1 | `402d9c9c97a0a8a5…` | 17 | www.swiggy.com (autoVerify) patterns `/`, `/search.*`, `/restaurants/.*`, `/instamart`, `/dineout`, `/city/…`; `swiggy://` (declared) | `https://www.swiggy.com/` · Instamart `…/instamart` · Dineout `…/dineout` | **App Link** (assetlinks ✓) | nothing — the `/search?query=` format is not documented, so the restaurant-name search was **dropped** |
| Zomato | `com.application.zomato` | 19.9.6 | `37722d88cc9f04f8…` | 9 | www.zomato.com (any path, autoVerify), zoma.to / z.tt short links; `zomato://`, `geo:` | `https://www.zomato.com/` | **App Link** (assetlinks ✓) | nothing (search/city formats undocumented) |
| District | `com.application.zomato.district` | 2.75.0 | `a81d49ec84db1b0a…` | 7 | www.district.in, *.district.in (any path, autoVerify); `district://` | `https://www.district.in/movies/` | **App Link** (assetlinks ✓) | nothing |
| BookMyShow | `com.bt.bms` | 18.2.8 | `d016b5d6df662c7a…` | 12 | in.bookmyshow.com (any path, autoVerify; assetlinks excludes `/etickets/*`, payment paths); `bms://` | `https://in.bookmyshow.com/` | **App Link** (assetlinks ✓) | nothing (the city slug page is not documented, so it was dropped) |
| Blinkit | `com.grofers.customerapp` | 18.39.0 | `b4d580bd0ce35d98…` | 6 | blinkit.com paths `/`, `/s`, prefixes `/s/`, `/cn/`, `/prn/`, `/store/` (autoVerify); `blinkit://` | `https://blinkit.com/` | **App Link** (assetlinks ✓) | nothing |
| Rapido | `com.rapido.passenger` | 8.130.0 | `433534d070c7bda7…` | 12 | `rapido://open`, `rapido://searchscreen`, `rapido://home_bike_taxi` … (no autoVerify); `http://www.rapido.bike/home` (http only, not an App Link); `geo:` | `intent://open#Intent;scheme=rapido;package=com.rapido.passenger;S.browser_fallback_url=https%3A%2F%2Fwww.rapido.bike%2F;end` | **Declared · Unverified** | nothing — no public Rapido developer docs exist (checked), so no pickup/drop |
| Agoda | `com.agoda.mobile.consumer` | 14.38.0 | `957755b4adada734…` | 15 | www.agoda.com patterns `/`, `/city/..*`, `…DestinationSearchResult….aspx` (autoVerify); `agoda://` | `https://www.agoda.com/` | **App Link** (assetlinks ✓) | nothing. The catalogue's `/en-in/` page is **not** a declared path (would open the browser even with the app installed), so the root is used |
| MakeMyTrip | `com.makemytrip` | 11.9.1 | `178563ed8eca0f4f…` | 34 | www.makemytrip.com prefixes `/hotels`, `/flights`, `/cabs`, `/bus-tickets`, `/rails` (autoVerify); `mmyt://` | `https://www.makemytrip.com/hotels/` | **App Link** (assetlinks ✓) | nothing |
| Park+ | `com.ovunque.parkwheels` | 6.2.79 | `8f21157e14aa3d32…` | 12 | parkplus.io `/home`, `/parking`, `/fastag`, `/app/parking` (autoVerify); `parkplusio://open` | `https://parkplus.io/parking` | **App Link** (assetlinks ✓) | nothing (`/home` is declared but 404s on the web, so `/parking` is used) |
| Apollo 24\|7 | `com.apollo.patientapp` | 9.9.1 | `201b1de1a515f917…` | 13 | www.apollo247.com prefixes `/doctors`, `/specialties`, `/lab-tests` …; www.apollopharmacy.in `/search-medicines`, `/medicine` … (autoVerify); `apollopatients://` | Apollo 24\|7 → `https://www.apollo247.com/doctors`; Apollo Pharmacy → `https://www.apollopharmacy.in/search-medicines` | **App Link** (assetlinks ✓ on both hosts) | nothing (root `/` is not declared on either host) |
| Tata 1mg | `com.aranoah.healthkart.plus` | 20.7.0 | `2e4e0fcbf92adab3…` | 256 | *.1mg.com: `/search/all`, `/drugs/.*`, `/otc/.*`, `/labs`, `/home` …; `onemg://`, `1mg://` | `https://www.1mg.com/search/all` | **App Link** (assetlinks ✓ on 1mg.com + www.1mg.com) | nothing |
| PhonePe | `com.phonepe.app` | 26.09.25.0 | `5335bc4961580b2e…` | 9 | `upi://pay`, `ppe://pay`, `phonepe://`, www.phonepe.com `/applink` | — | **None** | Payments only inside a gateway checkout (PhonePe PG prototype adapter on the server). No `upi://` is ever built |
| Google Pay | `com.google.android.apps.nbu.paisa.user` | 352.1.1 | `c17b8e3e427bfcd9…` | 12 | `upi://pay`, `gpay://upi`, `tez://upi`, pay.google.com `/app` | — | **None** | UPI-only; appears as a UPI app inside the gateway checkout |
| EasyPark | `net.easypark.android` | 26.40.1 | `0639fa559a0571df…` | 9 | invite.easypark.com, easypark.onelink.me; `easypark://` | — | **None (not in India)** | Not an India service and not on the requested list: catalogued as Unavailable (`notInIndia`), never linked |
| CoMaps | `app.comaps.google` | 2026.09.23-2-Google | `8c3dde72d3b1d598…` | 8 | comaps.at (autoVerify via `@bool`), ge0.me, openstreetmap.org; `geo:` `ge0:` `cm:` `comaps:` `mapsme:`; KML/KMZ/GPX/KMB files | — | **None (reference app)** | Open-source teardown reference (`COMAPS_TEARDOWN.md`), not a hand-off provider. Bharat's shared `geo:` links already open it |

assetlinks.json evidence (fetched 20 Oct 2026; `CERT-MATCH` = package listed with the APK's certificate): m.uber.com,
www.swiggy.com, www.zomato.com, www.district.in, in.bookmyshow.com, blinkit.com, www.agoda.com, www.makemytrip.com,
parkplus.io, www.apollo247.com, www.apollopharmacy.in, 1mg.com, www.1mg.com — all CERT-MATCH. (www.rapido.bike also lists
the package, but the app declares only an `http` filter without `autoVerify`, so it is not an App Link.)

## How a link opens

* **App Links / documented links** are plain https URLs. In the Android app the local `ExternalApp` plugin fires
  `ACTION_VIEW` + `CATEGORY_BROWSABLE`, so Android opens the verified app when installed and the browser otherwise; on the
  web the browser does the same.
* **Declared intent URLs** (Rapido) open only where Android can resolve them: in the app the plugin parses the URL with
  `Intent.URI_INTENT_SCHEME`, clears component/selector, adds `BROWSABLE`, enforces the package allow-list and an https
  fallback, and opens the fallback on `ActivityNotFoundException`; Android Chrome handles `intent://` natively. On desktop
  and iOS the interstitial opens the https fallback directly (`openUrlFor`).
* Every link still goes through the interstitial (host, app + package, fallback host, type label, Unverified warning).

## Not done / limits

* No parameters are passed to any app except Uber (documented). Restaurant-name search (Swiggy/Zomato) and city pages
  (BookMyShow) from v0.7 were removed because their formats are undocumented.
* Declared-only entry points other than Rapido's (e.g. `rapido://searchscreen`, `zomato://`, `bms://`) are recorded in the
  JSON but not used: an App Link exists for those apps, and the declared ones' parameters are unknown.
* App Link behaviour depends on Android having verified the domain on the user's device; if verification failed there,
  the same https page opens in the browser (still a valid fallback). Not tested on a real device.
* The analysis reflects the versions above; providers can change their manifests or assetlinks at any time. Re-run
  `python3 scripts/extract-deeplinks.py` with new APKs and `npm test` (the inventory test checks package, version and cert).

## Web-verified links (0.7.16) — providers without a user APK

Every catalogue provider that did not come from a user-supplied APK now has exactly one label. Nothing was decompiled,
no APK was downloaded, no scraper / mirror site was used, and no `upi://` (or other payment scheme) is built.
Code: `shared/services/deeplinks-web.js` (merged into `DEEPLINKS` with `source` ≠ `apk`); evidence:
`data/deeplinks/assetlinks-web.json` (`python3 scripts/fetch-assetlinks.py`, 125 official hosts, 20 Oct 2026).

| Label | Rule | Count |
|---|---|---|
| **App Link** | The provider's own `https://<host>/.well-known/assetlinks.json` lists the package with `delegate_permission/common.handle_all_urls` and SHA-256 cert fingerprints (recorded verbatim). Bharat opens a plain https page that host serves (checked: not a 404; 202/403 bot challenges noted below), **no query parameters**. The app's manifest was not available, so the path is not confirmed as claimed by the app; if the app does not claim it, the same page opens in the browser (interstitial says so). | 18 |
| **Documented** | Public developer docs only. Ola's deep link (<https://developers.olacabs.com/docs/deep-linking>: `lat`, `lng`, `drop_lat`, `drop_lng`, `category`, `utm_source` = Ola-issued token, mandatory) is used only when `OLA_XAPP_TOKEN` is configured; otherwise Ola is its App Link. Booking.com affiliate deep links need an affiliate id (`aid`) we do not have → App Link without parameters. Namma Yatri's open-source repo has no public consumer deep-link format → App Link. | (Ola, with a token) |
| **Store** | Package confirmed on the provider's **official website** (a Google Play link on its own page; 22) or on the **Google Play listing** itself (developer = the operator; 19). Android opens the documented Play link `market://details?id=<pkg>` (<https://developer.android.com/distribute/marketing-tools/linking-to-google-play>) as `intent://details?id=<pkg>#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=https://play.google.com/store/apps/details?id=<pkg>;end`; other devices open the official website. `safeIntent` and the native `ExternalAppPlugin` accept a Play intent only for a Store-classified package, host `details`, scheme `market`, and exactly that play.google.com fallback. | 41 |
| **Web-only** | No verifiable app hand-off: the official website (reason in the table). | 8 |
| **None** | Never linked (unavailable/merged providers, payment gateways, Bharat's demo sellers). | 8 |

Panels: IndianOil keeps its price page (Web-only) and adds "Open IndianOil ONE" (Store); NHAI keeps TIS (Web-only) and adds
"Open Rajmargyatra (NHAI)" (Store). The Hyderabad Metro "TSavaari" action is now the Store link to `com.minfy.tsavaari`
instead of a Play Store search. Zepto's catalogue URL moved to `https://www.zepto.com/` (zeptonow.com redirects there; both
hosts list the package).

| Provider | Label | Package — app | Evidence | Bharat opens |
|---|---|---|---|---|
| magicpin (`magicpin`) | **App Link** | `com.magicpin.local` — magicpin | <https://magicpin.in/.well-known/assetlinks.json> | <https://magicpin.in/> |
| EazyDiner (`eazydiner`) | **App Link** | `com.easydiner` — EazyDiner | <https://www.eazydiner.com/.well-known/assetlinks.json> | <https://www.eazydiner.com/> |
| ONDC (food & beverage) (`ondc-food`) | **Web-only** | — | ONDC is a network, not a consumer app: orders happen in ONDC buyer apps (Bharat's own buyer flow is a prototype) | <https://ondc.org/> |
| Restaurant websites (`restaurant-website`) | **Web-only** | — | Per-place website from OpenStreetMap tags; no app | <null> |
| PVR INOX (`pvr-inox`) | **Store** | `com.net.pvr` — PVR Cinemas | Play listing <https://play.google.com/store/apps/details?id=com.net.pvr> (developer: PVR INOX LIMITED); pvrcinemas.com blocks automated requests (403); INOX also has its own app, com.bt.inx | Android: `market://details?id=com.net.pvr` → <https://play.google.com/store/apps/details?id=com.net.pvr>; else <https://www.pvrcinemas.com/> |
| Cinépolis India (`cinepolis`) | **Store** | `com.ia.cinepolis.india` — Cinépolis India | Official site <https://cinepolisindia.com/vip-screen> + Play listing (Cinepolis Android) | Android: `market://details?id=com.ia.cinepolis.india` → <https://play.google.com/store/apps/details?id=com.ia.cinepolis.india>; else <https://www.cinepolisindia.com/> |
| TicketNew (`ticketnew`) | **None** | — | Merged into District; never linked | — |
| Paytm Insider (`paytm-insider`) | **None** | — | Merged into District; never linked | — |
| Zepto (`zepto`) | **App Link** | `com.zeptoconsumerapp` — Zepto | <https://www.zepto.com/.well-known/assetlinks.json> | <https://www.zepto.com/> |
| Flipkart Minutes (`flipkart-minutes`) | **App Link** | `com.flipkart.android` — Flipkart | <https://www.flipkart.com/.well-known/assetlinks.json> | <https://www.flipkart.com/> |
| BigBasket (`bigbasket`) | **App Link** | `com.bigbasket.mobileapp` — bigbasket | <https://www.bigbasket.com/.well-known/assetlinks.json> | <https://www.bigbasket.com/> |
| JioMart (`jiomart`) | **App Link** | `com.jpl.jiomart` — JioMart | <https://www.jiomart.com/.well-known/assetlinks.json> | <https://www.jiomart.com/> |
| DMart Ready (`dmart-ready`) | **App Link** | `in.dmart` — DMart Ready | <https://www.dmart.in/.well-known/assetlinks.json> | <https://www.dmart.in/> |
| ONDC (retail / grocery) (`ondc-retail`) | **Web-only** | — | ONDC is a network, not a consumer app | <https://ondc.org/> |
| Bharat Shop (demo sellers) (`demo-shop`) | **None** | — | Bharat's own fictional demo sellers | — |
| Ola (`ola`) | **App Link** | `com.olacabs.customer` — Ola | <https://book.olacabs.com/.well-known/assetlinks.json>; docs <https://developers.olacabs.com/docs/deep-linking> (Pickup/drop parameters are documented only together with an Ola-issued affiliate token (utm_source, mandatory); used only when OLA_XAPP_TOKEN is configured) | <https://book.olacabs.com/> |
| Namma Yatri (`namma-yatri`) | **App Link** | `in.juspay.nammayatri` — Namma Yatri | <https://nammayatri.in/.well-known/assetlinks.json> | <https://nammayatri.in/> |
| Bharat Taxi (`bharat-taxi`) | **App Link** | `in.mobility.bharatTaxi` — Bharat Taxi | <https://www.bharattaxiapp.com/.well-known/assetlinks.json> | <https://www.bharattaxiapp.com/> |
| Yatri Sathi (`yatri-sathi`) | **App Link** | `in.juspay.jatrisaathi` — Yatri Sathi | <https://yatrisathi.in/.well-known/assetlinks.json> | <https://yatrisathi.in/> |
| ONDC mobility (rides) (`ondc-mobility`) | **Web-only** | — | ONDC is a network, not a consumer app | <https://ondc.org/> |
| BluSmart (`blusmart`) | **None** | — | Shut down (Apr 2025); never linked | — |
| Hyderabad Metro (HMRL / L&T) (`metro-hyderabad`) | **Store** | `com.minfy.tsavaari` — TSavaari (Hyderabad Metro) | Play listing <https://play.google.com/store/apps/details?id=com.minfy.tsavaari> (developer: L&T Metro Rail (Hyderabad) Limited); listing support/developer e-mail on ltmetro.com | Android: `market://details?id=com.minfy.tsavaari` → <https://play.google.com/store/apps/details?id=com.minfy.tsavaari>; else <https://ltmetro.com/> |
| Chennai Metro (CMRL) (`metro-chennai`) | **Store** | `org.chennaimetrorail.appv1` — Chennai Metro Rail | Official site <https://chennaimetrorail.org/mobile-applications> + Play listing (Chennai Metro Rail Limited) | Android: `market://details?id=org.chennaimetrorail.appv1` → <https://play.google.com/store/apps/details?id=org.chennaimetrorail.appv1>; else <https://chennaimetrorail.org/> |
| Delhi Metro (DMRC) (`metro-delhi`) | **Store** | `com.sraoss.dmrc` — Delhi Metro Sarthi | Official site <https://delhimetrorail.com/pages/en/contact-us> + Play listing (Delhi Metro Rail Corporation) | Android: `market://details?id=com.sraoss.dmrc` → <https://play.google.com/store/apps/details?id=com.sraoss.dmrc>; else <https://www.delhimetrorail.com/> |
| Namma Metro (BMRCL) (`metro-bengaluru`) | **Store** | `com.aum.nammametro` — Namma Metro (BMRCL) | Official site <https://english.bmrc.co.in/> + Play listing (BMRCL) | Android: `market://details?id=com.aum.nammametro` → <https://play.google.com/store/apps/details?id=com.aum.nammametro>; else <https://english.bmrc.co.in/> |
| Mumbai Metro (MMRCL L3, MMOPL L1, MMMOCL 2A/7) (`metro-mumbai`) | **Store** | `com.metroconnect3.app` — MetroConnect3 (Mumbai Metro Line 3) | Official site <https://mmrcl.com/en> + Play listing (MUMBAI METRO RAIL CORPORATION LIMITED) | Android: `market://details?id=com.metroconnect3.app` → <https://play.google.com/store/apps/details?id=com.metroconnect3.app>; else <https://mmrcl.com/en/ticketing-and-access> |
| Kochi Metro (KMRL) (`metro-kochi`) | **Store** | `com.transitfe` — Kochi1 (KMRL & Axis Bank) | Play listing <https://play.google.com/store/apps/details?id=com.transitfe> (developer: Axis Bank Ltd.); listing title "Kochi1 App by KMRL & Axis Bank" (published by Axis Bank for KMRL) | Android: `market://details?id=com.transitfe` → <https://play.google.com/store/apps/details?id=com.transitfe>; else <https://kochimetro.org/> |
| Pune Metro (Maha Metro) (`metro-pune`) | **Store** | `org.mahametro.punemobileapp` — Pune Metro (Official) | Official site <https://www.punemetrorail.org/> + Play listing (Mahametro) | Android: `market://details?id=org.mahametro.punemobileapp` → <https://play.google.com/store/apps/details?id=org.mahametro.punemobileapp>; else <https://www.punemetrorail.org/> |
| Nagpur Metro (Maha Metro) (`metro-nagpur`) | **Store** | `nagpur.scsoft.com.nagpurapp` — Nagpur Metro Rail | Play listing <https://play.google.com/store/apps/details?id=nagpur.scsoft.com.nagpurapp> (developer: Maha Metro Rail Corporation Ltd) | Android: `market://details?id=nagpur.scsoft.com.nagpurapp` → <https://play.google.com/store/apps/details?id=nagpur.scsoft.com.nagpurapp>; else <https://www.metrorailnagpur.com/> |
| Ahmedabad Metro (GMRC) (`metro-ahmedabad`) | **Store** | `com.gujaratmetrorail.gmrcamddigitalticketing` — Ahmedabad Metro (Official) | Official site <https://www.gujaratmetrorail.com/ahmedabad> + Play listing (GMRCL) | Android: `market://details?id=com.gujaratmetrorail.gmrcamddigitalticketing` → <https://play.google.com/store/apps/details?id=com.gujaratmetrorail.gmrcamddigitalticketing>; else <https://www.gujaratmetrorail.com/ahmedabad/> |
| Jaipur Metro (JMRC) (`metro-jaipur`) | **Store** | `com.jaipurmetro` — Jaipur Metro (Official) | Play listing <https://play.google.com/store/apps/details?id=com.jaipurmetro> (developer: Jaipur Metro Rail Corporation Limited) | Android: `market://details?id=com.jaipurmetro` → <https://play.google.com/store/apps/details?id=com.jaipurmetro>; else <https://transport.rajasthan.gov.in/jmrc> |
| Lucknow Metro (UPMRC) (`metro-lucknow`) | **Store** | `com.prod.upmrc_lucknow` — Lucknow Metro (Official) | Play listing <https://play.google.com/store/apps/details?id=com.prod.upmrc_lucknow> (developer: UP Metro Rail) | Android: `market://details?id=com.prod.upmrc_lucknow` → <https://play.google.com/store/apps/details?id=com.prod.upmrc_lucknow>; else <https://lucknow.upmetrorail.com/> |
| Kanpur Metro (UPMRC) (`metro-kanpur`) | **Store** | `com.scsoft.kanpurmetro` — Kanpur Metro (Official) | Play listing <https://play.google.com/store/apps/details?id=com.scsoft.kanpurmetro> (developer: UP Metro Rail) | Android: `market://details?id=com.scsoft.kanpurmetro` → <https://play.google.com/store/apps/details?id=com.scsoft.kanpurmetro>; else <https://upmetrorail.com/> |
| Noida Metro (NMRC Aqua Line) (`metro-noida`) | **Store** | `mobile.scsoft.com.noida` — NMRC Tickets | Official site <https://www.nmrcnoida.com/> + Play listing (NMRC) | Android: `market://details?id=mobile.scsoft.com.noida` → <https://play.google.com/store/apps/details?id=mobile.scsoft.com.noida>; else <https://www.nmrcnoida.com/> |
| Kolkata Metro (Metro Railway) (`metro-kolkata`) | **Store** | `org.cris.kmmts` — Aamar Kolkata Metro | Play listing <https://play.google.com/store/apps/details?id=org.cris.kmmts> (developer: Centre for Railway Information Systems) | Android: `market://details?id=org.cris.kmmts` → <https://play.google.com/store/apps/details?id=org.cris.kmmts>; else <https://mtp.indianrailways.gov.in/> |
| TGSRTC (formerly TSRTC) (`tgsrtc`) | **Store** | `com.app.tsrtc` — TGSRTC Official Online Booking | Official site <https://www.tgsrtcbus.in/> + Play listing (Telangana State Road Transport Corporation) | Android: `market://details?id=com.app.tsrtc` → <https://play.google.com/store/apps/details?id=com.app.tsrtc>; else <https://www.tgsrtc.telangana.gov.in/> |
| APSRTC (`apsrtc`) | **App Link** | `com.apsrtc.online` — APSRTC | <https://www.apsrtconline.in/.well-known/assetlinks.json> | <https://www.apsrtconline.in/> |
| KSRTC (Karnataka) (`ksrtc`) | **Store** | `com.ksrtc.awatar.new` — KSRTC AWATAR | Official site <https://ksrtc.in/> + Play listing (Karnataka State Road Transport Corporation) | Android: `market://details?id=com.ksrtc.awatar.new` → <https://play.google.com/store/apps/details?id=com.ksrtc.awatar.new>; else <https://ksrtc.in/> |
| KSRTC (Kerala) (`ksrtc-kerala`) | **Store** | `com.maven.onlineksrtcswift` — Ente KSRTC Neo-oprs | Official site <https://onlineksrtcswift.com/> + Play listing (Maventech Labs Private Limited) | Android: `market://details?id=com.maven.onlineksrtcswift` → <https://play.google.com/store/apps/details?id=com.maven.onlineksrtcswift>; else <https://www.keralartc.com/> |
| BMTC (`bmtc`) | **Store** | `com.bmtc.bmtcavls` — Namma BMTC | Play listing <https://play.google.com/store/apps/details?id=com.bmtc.bmtcavls> (developer: Bengaluru Metropolitan Transport Corporation) | Android: `market://details?id=com.bmtc.bmtcavls` → <https://play.google.com/store/apps/details?id=com.bmtc.bmtcavls>; else <https://mybmtc.karnataka.gov.in/> |
| TNSTC / SETC (`tnstc`) | **Store** | `com.tnstc` — TNSTC Official App | Official site <https://www.tnstc.in/OTRSOnline/> + Play listing (TNSTC) | Android: `market://details?id=com.tnstc` → <https://play.google.com/store/apps/details?id=com.tnstc>; else <https://www.tnstc.in/OTRSOnline/> |
| MTC Chennai (`mtc-chennai`) | **Store** | `in.mobility.cumta` — Chennai One | Play listing <https://play.google.com/store/apps/details?id=in.mobility.cumta> (developer: CUMTA); Chennai One covers MTC buses | Android: `market://details?id=in.mobility.cumta` → <https://play.google.com/store/apps/details?id=in.mobility.cumta>; else <https://mtcbus.tn.gov.in/> |
| DTC (Delhi buses) (`dtc`) | **Store** | `com.delhitransport.onedelhi` — One Delhi | Play listing <https://play.google.com/store/apps/details?id=com.delhitransport.onedelhi> (developer: Delhi Transport Corporation); DTC lists the One Delhi app on https://dtc.delhi.gov.in/our-services | Android: `market://details?id=com.delhitransport.onedelhi` → <https://play.google.com/store/apps/details?id=com.delhitransport.onedelhi>; else <https://dtc.delhi.gov.in/> |
| BEST (Mumbai buses) (`best`) | **Store** | `com.dimts.best.bestapplication` — BEST Prawas | Play listing <https://play.google.com/store/apps/details?id=com.dimts.best.bestapplication> (developer: BEST Undertaking) | Android: `market://details?id=com.dimts.best.bestapplication` → <https://play.google.com/store/apps/details?id=com.dimts.best.bestapplication>; else <https://www.bestundertaking.com/> |
| PMPML (Pune buses) (`pmpml`) | **Store** | `in.chartr.pmpml` — Apli PMPML | Play listing <https://play.google.com/store/apps/details?id=in.chartr.pmpml> (developer: Chartr Mobility); listing: "the official app of PMPML", website pmpml.org (published by Chartr Mobility) | Android: `market://details?id=in.chartr.pmpml` → <https://play.google.com/store/apps/details?id=in.chartr.pmpml>; else <https://pmpml.org/> |
| Chalo (`chalo`) | **Store** | `app.zophop` — Chalo | Official site <https://chalo.com/> + Play listing (Chalo Mobility Private Limited) | Android: `market://details?id=app.zophop` → <https://play.google.com/store/apps/details?id=app.zophop>; else <https://chalo.com/> |
| Tummoc (`tummoc`) | **Store** | `org.transhelp.bykerr` — Tummoc | Play listing <https://play.google.com/store/apps/details?id=org.transhelp.bykerr> (developer: Transhelp Technologies Pvt Ltd); listing website tummoc.com | Android: `market://details?id=org.transhelp.bykerr` → <https://play.google.com/store/apps/details?id=org.transhelp.bykerr>; else <https://tummoc.com/> |
| ONDC public transport (metro/bus QR) (`ondc-metro`) | **Web-only** | — | ONDC is a network, not a consumer app | <https://ondc.org/> |
| Indian Railways (IRCTC) (`irctc`) | **Store** | `cris.org.in.prs.ima` — IRCTC Rail Connect | Play listing <https://play.google.com/store/apps/details?id=cris.org.in.prs.ima> (developer: IRCTC Official); irctc.co.in blocks automated requests (403) | Android: `market://details?id=cris.org.in.prs.ima` → <https://play.google.com/store/apps/details?id=cris.org.in.prs.ima>; else <https://www.irctc.co.in/> |
| Booking.com (`booking-com`) | **App Link** | `com.booking` — Booking.com | <https://www.booking.com/.well-known/assetlinks.json>; Booking.com affiliate deep links need an affiliate id (aid) we do not have, so no parameters are passed | <https://www.booking.com/> |
| Goibibo (`goibibo`) | **App Link** | `com.goibibo` — Goibibo | <https://www.goibibo.com/.well-known/assetlinks.json> | <https://www.goibibo.com/hotels/> |
| Cleartrip (`cleartrip`) | **Store** | `com.cleartrip.android` — Cleartrip | Play listing <https://play.google.com/store/apps/details?id=com.cleartrip.android> (developer: Cleartrip); cleartrip.com blocks automated requests (403), so its assetlinks.json could not be read | Android: `market://details?id=com.cleartrip.android` → <https://play.google.com/store/apps/details?id=com.cleartrip.android>; else <https://www.cleartrip.com/hotels> |
| EaseMyTrip (`easemytrip`) | **App Link** | `com.easemytrip.android` — EaseMyTrip | <https://www.easemytrip.com/.well-known/assetlinks.json> | <https://www.easemytrip.com/hotels/> |
| Incredible India (`incredible-india`) | **Store** | `org.incredibleindia` — Incredible India | Official site <https://www.incredibleindia.gov.in/> + Play listing (Ministry of Tourism) | Android: `market://details?id=org.incredibleindia` → <https://play.google.com/store/apps/details?id=org.incredibleindia>; else <https://www.incredibleindia.gov.in/> |
| ParkMate (`parkmate`) | **Store** | `io.pspot.user` — ParkMate | Official site <https://parkmate.in/> + Play listing (ParkMate) | Android: `market://details?id=io.pspot.user` → <https://play.google.com/store/apps/details?id=io.pspot.user>; else <https://parkmate.in/> |
| NHAI (TIS toll info) (`nhai`) | **Store** | `com.nhai.rajmargyatra` — Rajmargyatra (NHAI) | Official site <https://nhai.gov.in/nhai/sites/default/files/2023-08/Press_Release_Rajmaarg_Yatra_App.pdf> + Play listing (Rajmargyatra (NHAI & IHMCL)) | Android: `market://details?id=com.nhai.rajmargyatra` → <https://play.google.com/store/apps/details?id=com.nhai.rajmargyatra>; else <https://rajmargyatra.nhai.gov.in/> |
| Highway Delite (`highway-delite`) | **Store** | `com.highwaydelite.highwaydelite` — Highway Delite | Play listing <https://play.google.com/store/apps/details?id=com.highwaydelite.highwaydelite> (developer: highway delite); listing website highwaydelite.com | Android: `market://details?id=com.highwaydelite.highwaydelite` → <https://play.google.com/store/apps/details?id=com.highwaydelite.highwaydelite>; else <https://www.highwaydelite.com/> |
| IndianOil (IOCL) (`indianoil`) | **Store** | `cx.indianoil.in` — IndianOil ONE | Play listing <https://play.google.com/store/apps/details?id=cx.indianoil.in> (developer: Indian Oil Corporation Ltd) | Android: `market://details?id=cx.indianoil.in` → <https://play.google.com/store/apps/details?id=cx.indianoil.in>; else <https://iocl.com/> |
| HPCL (`hpcl`) | **Store** | `com.drivetrackplusrefuel` — HP PAY | Official site <https://www.hindustanpetroleum.com/pages/mobile-app> + Play listing (Hindustan Petroleum Corporation Ltd.) | Android: `market://details?id=com.drivetrackplusrefuel` → <https://play.google.com/store/apps/details?id=com.drivetrackplusrefuel>; else <https://www.hindustanpetroleum.com/> |
| Jio-bp (`jio-bp`) | **Web-only** | — | jiobp.com links com.namp.jiobppulse, which is no longer on Google Play (404); the live Jio-bp pulse app is for EV charging only, so fuel stations get the website | <https://www.jiobp.com/> |
| Open Charge Map (`ocm`) | **Web-only** | — | Open Charge Map no longer publishes its Android app (community.openchargemap.org, Jun 2026); the web map is identical | <https://openchargemap.org/> |
| ChargeZone (`chargezone`) | **Store** | `com.chargezone` — ChargeZone | Official site <https://www.chargezone.co.in/> + Play listing (TECSO CHARGE ZONE LIMITED) | Android: `market://details?id=com.chargezone` → <https://play.google.com/store/apps/details?id=com.chargezone>; else <https://www.chargezone.co.in/> |
| Statiq (`statiq`) | **Store** | `com.statiq` — Statiq | Official site <https://www.statiq.in/> + Play listing (Statiq) | Android: `market://details?id=com.statiq` → <https://play.google.com/store/apps/details?id=com.statiq>; else <https://www.statiq.in/> |
| Tata Power EZ Charge (`tata-ez`) | **Store** | `com.tatapower.evapp` — Tata Power EZ Charge | Official site <https://www.tatapower.com/ezcharge> + Play listing (TATA Power) | Android: `market://details?id=com.tatapower.evapp` → <https://play.google.com/store/apps/details?id=com.tatapower.evapp>; else <https://www.tatapower.com/ezcharge> |
| Netmeds (`netmeds`) | **App Link** | `com.NetmedsMarketplace.Netmeds` — Netmeds | <https://www.netmeds.com/.well-known/assetlinks.json> | <https://www.netmeds.com/> |
| Practo (`practo`) | **App Link** | `com.practo.fabric` — Practo | <https://www.practo.com/.well-known/assetlinks.json> | <https://www.practo.com/> |
| eSanjeevani (`esanjeevani`) | **Web-only** | — | The eSanjeevani Play app is for assisted doctor-to-doctor consults at Ayushman Arogya Mandirs, not for patients; patients use the website | <https://esanjeevani.mohfw.gov.in/> |
| 112 India (ERSS) (`112-india`) | **Store** | `in.cdac.ners.psa.mobile.android.national` — 112 India | Play listing <https://play.google.com/store/apps/details?id=in.cdac.ners.psa.mobile.android.national> (developer: MHA, Govt of India); also linked from the state ERSS download page https://rj.erss.in/download.html | Android: `market://details?id=in.cdac.ners.psa.mobile.android.national` → <https://play.google.com/store/apps/details?id=in.cdac.ners.psa.mobile.android.national>; else <https://112.gov.in/> |
| India Post (`india-post`) | **Store** | `info.indiapost.daksewa` — Dak Sewa (India Post) | Official site <https://www.indiapost.gov.in/> + Play listing (Centre for Excellence in Postal Technology) | Android: `market://details?id=info.indiapost.daksewa` → <https://play.google.com/store/apps/details?id=info.indiapost.daksewa>; else <https://www.indiapost.gov.in/> |
| Shiprocket (`shiprocket`) | **Store** | `com.shiprocket.shiprocket` — Shiprocket | Official site <https://www.shiprocket.in/> + Play listing (Shiprocket) | Android: `market://details?id=com.shiprocket.shiprocket` → <https://play.google.com/store/apps/details?id=com.shiprocket.shiprocket>; else <https://www.shiprocket.in/> |
| Delhivery (`delhivery`) | **App Link** | `com.delhiveryConsigneeApp` — Delhivery | <https://www.delhivery.com/.well-known/assetlinks.json> | <https://www.delhivery.com/> |
| Razorpay (`razorpay`) | **None** | — | Payment gateway: used only server-side inside checkout; no app hand-off | — |
| Cashfree Payments (`cashfree`) | **None** | — | Payment gateway: no app hand-off | — |
| Paytm Payment Gateway (Paytm Payments Services) (`paytm-pg`) | **None** | — | Payment gateway: no app hand-off | — |
| UPI (via a gateway) (`upi`) | **None** | — | UPI only inside a gateway checkout; never a hand-built UPI link | — |


Fetch notes (assetlinks-web.json): pvrcinemas.com, inoxmovies.com, cleartrip.com, irctc.co.in, olacabs.com and
esanjeevani.mohfw.gov.in answer 403 to automated requests; 112.gov.in, ltmetro.com, keralartc.com, pmpml.org,
mybmtc.karnataka.gov.in, dtc.delhi.gov.in, mtcbus.tn.gov.in, mtp.indianrailways.gov.in and tis.nhai.gov.in were unreachable
from the build machine (outside India). Those providers therefore cannot be App Links here; their packages come from the
official site or the Play listing. www.zepto.com and www.booking.com answer the home page with a 202 bot challenge and www.bigbasket.com / www.dmart.in with 403 to curl (all serve the page to a normal fetch; none is a 404).
magicpin's assetlinks.json carries one malformed fingerprint (`SHA256: C5:…`), recorded verbatim; the other is well-formed.

### Limits of the web-verified pass
* App Link paths are not confirmed against the apps' manifests (no APKs); Store links open the Play page, not the app's
  screen, and carry nothing. No real-device test.
* 19 Store packages rest on the Play listing alone (developer name/e-mail = the operator). Two are published by a partner on
  the operator's behalf: Kochi1 (Axis Bank for KMRL) and Apli PMPML (Chartr Mobility; the listing calls itself PMPML's
  official app). PVR INOX has two apps; PVR's (`com.net.pvr`) is used, INOX's is `com.bt.inx`.
* Re-run `python3 scripts/fetch-assetlinks.py` and `npm test` (`tests/deeplinks-web.test.js` checks every App Link against
  the recorded file, every Store link's format/fallback/domain and that no query parameter is guessed).
