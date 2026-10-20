// App hand-offs for catalogue providers that did NOT come from a user-supplied APK (docs/re/DEEPLINKS.md
// "Web-verified links", 20 Oct 2026). Nothing here was decompiled or read from an APK; every package below is backed by
// one public, official source:
//   applink  the provider's own https://<host>/.well-known/assetlinks.json lists the package with
//            delegate_permission/common.handle_all_urls (data/deeplinks/assetlinks-web.json, scripts/fetch-assetlinks.py).
//            Bharat opens a plain https page that the site serves (checked: not a 404) — no query parameters.
//   store    the package is confirmed from the provider's official website (a Google Play link on its own page) or
//            from the Google Play listing itself (developer = the operator). Bharat opens the documented Play Store
//            link market://details?id=<pkg> (https://developer.android.com/distribute/marketing-tools/linking-to-google-play)
//            as an Android intent with a https://play.google.com/store/apps/details?id=<pkg> fallback; off Android
//            it opens the provider's official website instead.
//   web      no verifiable app hand-off: the official website only (reason recorded).
//   none     never linked (unavailable / payments / Bharat's own demo).
// Never: guessed query parameters, scraped or mirrored packages, upi://.

export const PLAY_PKG = 'com.android.vending';
export const PLAY_DOC = 'https://developer.android.com/distribute/marketing-tools/linking-to-google-play';
export const playUrl = (pkg) => `https://play.google.com/store/apps/details?id=${pkg}`;

/** Packages confirmed for this pass: app name + Google Play developer (as shown on the listing, 20 Oct 2026). */
export const WEB_APPS = {
  // --- App Links (assetlinks.json) ---
  'com.magicpin.local': { app: 'magicpin', developer: 'magicpin' },
  'com.easydiner': { app: 'EazyDiner', developer: 'EazyDiner' },
  'com.zeptoconsumerapp': { app: 'Zepto', developer: 'Zepto Marketplace Private Limited' },
  'com.flipkart.android': { app: 'Flipkart', developer: 'Flipkart' },
  'com.bigbasket.mobileapp': { app: 'bigbasket', developer: 'Bigbasket.com' },
  'com.jpl.jiomart': { app: 'JioMart', developer: 'Jio Platforms Limited' },
  'in.dmart': { app: 'DMart Ready', developer: 'Avenue E-Commerce Ltd.' },
  'com.olacabs.customer': { app: 'Ola', developer: 'Ola (ANI TECHNOLOGIES PRIVATE LIMITED)' },
  'in.juspay.nammayatri': { app: 'Namma Yatri', developer: 'Moving Tech' },
  'in.mobility.bharatTaxi': { app: 'Bharat Taxi', developer: 'SAHAKAR TAXI COOPERATIVE LIMITED' },
  'in.juspay.jatrisaathi': { app: 'Yatri Sathi', developer: 'Dept of IT&E, Govt of WB' },
  'com.apsrtc.online': { app: 'APSRTC', developer: 'Andhra Pradesh State Road Transport Corporation' },
  'com.booking': { app: 'Booking.com', developer: 'Booking.com Hotels & Vacation Rentals' },
  'com.goibibo': { app: 'Goibibo', developer: 'Goibibo' },
  'com.easemytrip.android': { app: 'EaseMyTrip', developer: 'EaseMyTrip' },
  'com.NetmedsMarketplace.Netmeds': { app: 'Netmeds', developer: 'Netmeds Marketplace Limited' },
  'com.practo.fabric': { app: 'Practo', developer: 'Practo' },
  'com.delhiveryConsigneeApp': { app: 'Delhivery', developer: 'Delhivery Limited' },
  // --- Store links (package confirmed on the official site or the Play listing) ---
  'com.net.pvr': { app: 'PVR Cinemas', developer: 'PVR INOX LIMITED' },
  'com.ia.cinepolis.india': { app: 'Cinépolis India', developer: 'Cinepolis Android' },
  'com.minfy.tsavaari': { app: 'TSavaari (Hyderabad Metro)', developer: 'L&T Metro Rail (Hyderabad) Limited' },
  'org.chennaimetrorail.appv1': { app: 'Chennai Metro Rail', developer: 'Chennai Metro Rail Limited' },
  'com.sraoss.dmrc': { app: 'Delhi Metro Sarthi', developer: 'Delhi Metro Rail Corporation' },
  'com.aum.nammametro': { app: 'Namma Metro (BMRCL)', developer: 'BMRCL' },
  'com.metroconnect3.app': { app: 'MetroConnect3 (Mumbai Metro Line 3)', developer: 'MUMBAI METRO RAIL CORPORATION LIMITED' },
  'com.transitfe': { app: 'Kochi1 (KMRL & Axis Bank)', developer: 'Axis Bank Ltd.' },
  'org.mahametro.punemobileapp': { app: 'Pune Metro (Official)', developer: 'Mahametro' },
  'nagpur.scsoft.com.nagpurapp': { app: 'Nagpur Metro Rail', developer: 'Maha Metro Rail Corporation Ltd' },
  'com.gujaratmetrorail.gmrcamddigitalticketing': { app: 'Ahmedabad Metro (Official)', developer: 'GMRCL' },
  'com.jaipurmetro': { app: 'Jaipur Metro (Official)', developer: 'Jaipur Metro Rail Corporation Limited' },
  'com.prod.upmrc_lucknow': { app: 'Lucknow Metro (Official)', developer: 'UP Metro Rail' },
  'com.scsoft.kanpurmetro': { app: 'Kanpur Metro (Official)', developer: 'UP Metro Rail' },
  'mobile.scsoft.com.noida': { app: 'NMRC Tickets', developer: 'NMRC' },
  'org.cris.kmmts': { app: 'Aamar Kolkata Metro', developer: 'Centre for Railway Information Systems' },
  'com.app.tsrtc': { app: 'TGSRTC Official Online Booking', developer: 'Telangana State Road Transport Corporation' },
  'com.ksrtc.awatar.new': { app: 'KSRTC AWATAR', developer: 'Karnataka State Road Transport Corporation' },
  'com.maven.onlineksrtcswift': { app: 'Ente KSRTC Neo-oprs', developer: 'Maventech Labs Private Limited' },
  'com.bmtc.bmtcavls': { app: 'Namma BMTC', developer: 'Bengaluru Metropolitan Transport Corporation' },
  'com.tnstc': { app: 'TNSTC Official App', developer: 'TNSTC' },
  'in.mobility.cumta': { app: 'Chennai One', developer: 'CUMTA' },
  'com.delhitransport.onedelhi': { app: 'One Delhi', developer: 'Delhi Transport Corporation' },
  'com.dimts.best.bestapplication': { app: 'BEST Prawas', developer: 'BEST Undertaking' },
  'in.chartr.pmpml': { app: 'Apli PMPML', developer: 'Chartr Mobility' },
  'app.zophop': { app: 'Chalo', developer: 'Chalo Mobility Private Limited' },
  'org.transhelp.bykerr': { app: 'Tummoc', developer: 'Transhelp Technologies Pvt Ltd' },
  'cris.org.in.prs.ima': { app: 'IRCTC Rail Connect', developer: 'IRCTC Official' },
  'com.cleartrip.android': { app: 'Cleartrip', developer: 'Cleartrip' },
  'org.incredibleindia': { app: 'Incredible India', developer: 'Ministry of Tourism' },
  'io.pspot.user': { app: 'ParkMate', developer: 'ParkMate' },
  'com.nhai.rajmargyatra': { app: 'Rajmargyatra (NHAI)', developer: 'Rajmargyatra (NHAI & IHMCL)' },
  'com.highwaydelite.highwaydelite': { app: 'Highway Delite', developer: 'highway delite' },
  'cx.indianoil.in': { app: 'IndianOil ONE', developer: 'Indian Oil Corporation Ltd' },
  'com.drivetrackplusrefuel': { app: 'HP PAY', developer: 'Hindustan Petroleum Corporation Ltd.' },
  'com.chargezone': { app: 'ChargeZone', developer: 'TECSO CHARGE ZONE LIMITED' },
  'com.statiq': { app: 'Statiq', developer: 'Statiq' },
  'com.tatapower.evapp': { app: 'Tata Power EZ Charge', developer: 'TATA Power' },
  'in.cdac.ners.psa.mobile.android.national': { app: '112 India', developer: 'MHA, Govt of India' },
  'info.indiapost.daksewa': { app: 'Dak Sewa (India Post)', developer: 'Centre for Excellence in Postal Technology' },
  'com.shiprocket.shiprocket': { app: 'Shiprocket', developer: 'Shiprocket' },
};

const AL = (pkg, url, host = new URL(url).host) => ({ pkg, type: 'applink', source: 'assetlinks', url, prefill: [], assetHost: host,
  evidence: `https://${host}/.well-known/assetlinks.json lists ${pkg} with handle_all_urls (20 Oct 2026); page checked (not a 404). App manifest not available, so the path is not confirmed as claimed by the app` });
const PLAY = 'Google Play listing (developer shown on the listing, 20 Oct 2026)';
const ST = (pkg, web, confirm, confirmUrl) => ({ pkg, type: 'store', source: confirm === 'site' ? 'official-site' : 'play-listing', web, prefill: [], confirmUrl,
  evidence: confirm === 'site' ? `Package linked from the official site ${confirmUrl}; Play listing developer: ${WEB_APPS[pkg].developer}` : `${PLAY}: ${WEB_APPS[pkg].developer}${confirmUrl ? `; ${confirmUrl}` : ''}` });
const WEB = (reason) => ({ type: 'web', source: 'none', reason });
const NONE = (reason) => ({ type: 'none', source: 'none', reason });

export const WEB_DEEPLINKS = {
  // ---------------- Food / movies ----------------
  magicpin: AL('com.magicpin.local', 'https://magicpin.in/'),
  eazydiner: AL('com.easydiner', 'https://www.eazydiner.com/'),
  'ondc-food': WEB('ONDC is a network, not a consumer app: orders happen in ONDC buyer apps (Bharat\'s own buyer flow is a prototype)'),
  'restaurant-website': WEB('Per-place website from OpenStreetMap tags; no app'),
  'pvr-inox': ST('com.net.pvr', 'https://www.pvrcinemas.com/', 'play', 'pvrcinemas.com blocks automated requests (403); INOX also has its own app, com.bt.inx'),
  cinepolis: ST('com.ia.cinepolis.india', 'https://www.cinepolisindia.com/', 'site', 'https://cinepolisindia.com/vip-screen'),
  ticketnew: NONE('Merged into District; never linked'),
  'paytm-insider': NONE('Merged into District; never linked'),
  // ---------------- Grocery ----------------
  zepto: AL('com.zeptoconsumerapp', 'https://www.zepto.com/'),
  'flipkart-minutes': AL('com.flipkart.android', 'https://www.flipkart.com/'),
  bigbasket: AL('com.bigbasket.mobileapp', 'https://www.bigbasket.com/'),
  jiomart: AL('com.jpl.jiomart', 'https://www.jiomart.com/'),
  'dmart-ready': AL('in.dmart', 'https://www.dmart.in/'),
  'ondc-retail': WEB('ONDC is a network, not a consumer app'),
  'demo-shop': NONE('Bharat\'s own fictional demo sellers'),
  // ---------------- Rides ----------------
  ola: { ...AL('com.olacabs.customer', 'https://book.olacabs.com/'), doc: 'https://developers.olacabs.com/docs/deep-linking',
    docNote: 'Pickup/drop parameters are documented only together with an Ola-issued affiliate token (utm_source, mandatory); used only when OLA_XAPP_TOKEN is configured' },
  'namma-yatri': AL('in.juspay.nammayatri', 'https://nammayatri.in/'),
  'bharat-taxi': AL('in.mobility.bharatTaxi', 'https://www.bharattaxiapp.com/'),
  'yatri-sathi': AL('in.juspay.jatrisaathi', 'https://yatrisathi.in/'),
  'ondc-mobility': WEB('ONDC is a network, not a consumer app'),
  blusmart: NONE('Shut down (Apr 2025); never linked'),
  // ---------------- Transit: metros ----------------
  'metro-hyderabad': ST('com.minfy.tsavaari', 'https://ltmetro.com/', 'play', 'listing support/developer e-mail on ltmetro.com'),
  'metro-chennai': ST('org.chennaimetrorail.appv1', 'https://chennaimetrorail.org/', 'site', 'https://chennaimetrorail.org/mobile-applications'),
  'metro-delhi': ST('com.sraoss.dmrc', 'https://www.delhimetrorail.com/', 'site', 'https://delhimetrorail.com/pages/en/contact-us'),
  'metro-bengaluru': ST('com.aum.nammametro', 'https://english.bmrc.co.in/', 'site', 'https://english.bmrc.co.in/'),
  'metro-mumbai': ST('com.metroconnect3.app', 'https://mmrcl.com/en/ticketing-and-access', 'site', 'https://mmrcl.com/en'),
  'metro-kochi': ST('com.transitfe', 'https://kochimetro.org/', 'play', 'listing title "Kochi1 App by KMRL & Axis Bank" (published by Axis Bank for KMRL)'),
  'metro-pune': ST('org.mahametro.punemobileapp', 'https://www.punemetrorail.org/', 'site', 'https://www.punemetrorail.org/'),
  'metro-nagpur': ST('nagpur.scsoft.com.nagpurapp', 'https://www.metrorailnagpur.com/', 'play', ''),
  'metro-ahmedabad': ST('com.gujaratmetrorail.gmrcamddigitalticketing', 'https://www.gujaratmetrorail.com/ahmedabad/', 'site', 'https://www.gujaratmetrorail.com/ahmedabad'),
  'metro-jaipur': ST('com.jaipurmetro', 'https://transport.rajasthan.gov.in/jmrc', 'play', ''),
  'metro-lucknow': ST('com.prod.upmrc_lucknow', 'https://lucknow.upmetrorail.com/', 'play', ''),
  'metro-kanpur': ST('com.scsoft.kanpurmetro', 'https://upmetrorail.com/', 'play', ''),
  'metro-noida': ST('mobile.scsoft.com.noida', 'https://www.nmrcnoida.com/', 'site', 'https://www.nmrcnoida.com/'),
  'metro-kolkata': ST('org.cris.kmmts', 'https://mtp.indianrailways.gov.in/', 'play', ''),
  // ---------------- Transit: buses & apps ----------------
  tgsrtc: ST('com.app.tsrtc', 'https://www.tgsrtc.telangana.gov.in/', 'site', 'https://www.tgsrtcbus.in/'),
  apsrtc: AL('com.apsrtc.online', 'https://www.apsrtconline.in/'),
  ksrtc: ST('com.ksrtc.awatar.new', 'https://ksrtc.in/', 'site', 'https://ksrtc.in/'),
  'ksrtc-kerala': ST('com.maven.onlineksrtcswift', 'https://www.keralartc.com/', 'site', 'https://onlineksrtcswift.com/'),
  bmtc: ST('com.bmtc.bmtcavls', 'https://mybmtc.karnataka.gov.in/', 'play', ''),
  tnstc: ST('com.tnstc', 'https://www.tnstc.in/OTRSOnline/', 'site', 'https://www.tnstc.in/OTRSOnline/'),
  'mtc-chennai': ST('in.mobility.cumta', 'https://mtcbus.tn.gov.in/', 'play', 'Chennai One covers MTC buses'),
  dtc: ST('com.delhitransport.onedelhi', 'https://dtc.delhi.gov.in/', 'play', 'DTC lists the One Delhi app on https://dtc.delhi.gov.in/our-services'),
  best: ST('com.dimts.best.bestapplication', 'https://www.bestundertaking.com/', 'play', ''),
  pmpml: ST('in.chartr.pmpml', 'https://pmpml.org/', 'play', 'listing: "the official app of PMPML", website pmpml.org (published by Chartr Mobility)'),
  chalo: ST('app.zophop', 'https://chalo.com/', 'site', 'https://chalo.com/'),
  tummoc: ST('org.transhelp.bykerr', 'https://tummoc.com/', 'play', 'listing website tummoc.com'),
  'ondc-metro': WEB('ONDC is a network, not a consumer app'),
  irctc: ST('cris.org.in.prs.ima', 'https://www.irctc.co.in/', 'play', 'irctc.co.in blocks automated requests (403)'),
  // ---------------- Hotels ----------------
  'booking-com': { ...AL('com.booking', 'https://www.booking.com/'), docNote: 'Booking.com affiliate deep links need an affiliate id (aid) we do not have, so no parameters are passed' },
  goibibo: AL('com.goibibo', 'https://www.goibibo.com/hotels/', 'www.goibibo.com'),
  cleartrip: ST('com.cleartrip.android', 'https://www.cleartrip.com/hotels', 'play', 'cleartrip.com blocks automated requests (403), so its assetlinks.json could not be read'),
  easemytrip: AL('com.easemytrip.android', 'https://www.easemytrip.com/hotels/', 'www.easemytrip.com'),
  'incredible-india': ST('org.incredibleindia', 'https://www.incredibleindia.gov.in/', 'site', 'https://www.incredibleindia.gov.in/'),
  // ---------------- Parking / tolls ----------------
  parkmate: ST('io.pspot.user', 'https://parkmate.in/', 'site', 'https://parkmate.in/'),
  nhai: ST('com.nhai.rajmargyatra', 'https://rajmargyatra.nhai.gov.in/', 'site', 'https://nhai.gov.in/nhai/sites/default/files/2023-08/Press_Release_Rajmaarg_Yatra_App.pdf'),
  'highway-delite': ST('com.highwaydelite.highwaydelite', 'https://www.highwaydelite.com/', 'play', 'listing website highwaydelite.com'),
  // ---------------- Fuel / EV ----------------
  indianoil: ST('cx.indianoil.in', 'https://iocl.com/', 'play', ''),
  hpcl: ST('com.drivetrackplusrefuel', 'https://www.hindustanpetroleum.com/', 'site', 'https://www.hindustanpetroleum.com/pages/mobile-app'),
  'jio-bp': WEB('jiobp.com links com.namp.jiobppulse, which is no longer on Google Play (404); the live Jio-bp pulse app is for EV charging only, so fuel stations get the website'),
  ocm: WEB('Open Charge Map no longer publishes its Android app (community.openchargemap.org, Jun 2026); the web map is identical'),
  chargezone: ST('com.chargezone', 'https://www.chargezone.co.in/', 'site', 'https://www.chargezone.co.in/'),
  statiq: ST('com.statiq', 'https://www.statiq.in/', 'site', 'https://www.statiq.in/'),
  'tata-ez': ST('com.tatapower.evapp', 'https://www.tatapower.com/ezcharge', 'site', 'https://www.tatapower.com/ezcharge'),
  // ---------------- Health ----------------
  netmeds: AL('com.NetmedsMarketplace.Netmeds', 'https://www.netmeds.com/'),
  practo: AL('com.practo.fabric', 'https://www.practo.com/'),
  esanjeevani: WEB('The eSanjeevani Play app is for assisted doctor-to-doctor consults at Ayushman Arogya Mandirs, not for patients; patients use the website'),
  '112-india': ST('in.cdac.ners.psa.mobile.android.national', 'https://112.gov.in/', 'play', 'also linked from the state ERSS download page https://rj.erss.in/download.html'),
  // ---------------- Courier ----------------
  'india-post': ST('info.indiapost.daksewa', 'https://www.indiapost.gov.in/', 'site', 'https://www.indiapost.gov.in/'),
  shiprocket: ST('com.shiprocket.shiprocket', 'https://www.shiprocket.in/', 'site', 'https://www.shiprocket.in/'),
  delhivery: AL('com.delhiveryConsigneeApp', 'https://www.delhivery.com/'),
  // ---------------- Payments ----------------
  razorpay: NONE('Payment gateway: used only server-side inside checkout; no app hand-off'),
  cashfree: NONE('Payment gateway: no app hand-off'),
  'paytm-pg': NONE('Payment gateway: no app hand-off'),
  upi: NONE('UPI only inside a gateway checkout; never a hand-built UPI link'),
};
