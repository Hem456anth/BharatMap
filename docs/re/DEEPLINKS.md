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
