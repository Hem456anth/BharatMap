// UI strings for 11 languages + multilingual query vocabulary.
// Translations are machine-assisted first drafts; native-speaker review is
// required before launch (tracked in docs/AUDIT.md).

export const LANGS = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'हिन्दी' }, { code: 'te', name: 'తెలుగు' },
  { code: 'ta', name: 'தமிழ்' }, { code: 'kn', name: 'ಕನ್ನಡ' }, { code: 'ml', name: 'മലയാളം' },
  { code: 'bn', name: 'বাংলা' }, { code: 'mr', name: 'मराठी' }, { code: 'gu', name: 'ગુજરાતી' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ' }, { code: 'or', name: 'ଓଡ଼ିଆ' },
];

const K = ['search', 'near_me', 'results', 'in_stock', 'out_of_stock', 'verified', 'add', 'cart', 'checkout', 'place_order', 'delivery', 'pickup', 'tracking', 'rider', 'eta', 'assistant', 'mobility', 'dashboard', 'login', 'logout', 'wholesale', 'total', 'delivered', 'directions'];

const T = {
  en: ['Search places, shops, products…', 'Near me', 'Results', 'In stock', 'Out of stock', 'Verified', 'Add', 'Cart', 'Checkout', 'Place order', 'Delivery', 'Pickup', 'Live tracking', 'Rider', 'ETA', 'Ask Bharat Map', 'Mobility', 'Seller dashboard', 'Sign in', 'Sign out', 'Wholesale', 'Total', 'Delivered', 'Directions'],
  hi: ['जगह, दुकानें, सामान खोजें…', 'मेरे पास', 'परिणाम', 'स्टॉक में', 'स्टॉक खत्म', 'सत्यापित', 'जोड़ें', 'कार्ट', 'चेकआउट', 'ऑर्डर करें', 'डिलीवरी', 'पिकअप', 'लाइव ट्रैकिंग', 'राइडर', 'पहुँचने का समय', 'Bharat Map से पूछें', 'यातायात', 'विक्रेता डैशबोर्ड', 'साइन इन', 'साइन आउट', 'थोक', 'कुल', 'डिलीवर हो गया', 'रास्ता'],
  te: ['ప్రదేశాలు, షాపులు, వస్తువులు వెతకండి…', 'నా దగ్గర', 'ఫలితాలు', 'స్టాక్‌లో ఉంది', 'స్టాక్ లేదు', 'ధృవీకరించబడింది', 'జోడించు', 'కార్ట్', 'చెకౌట్', 'ఆర్డర్ చేయండి', 'డెలివరీ', 'పికప్', 'లైవ్ ట్రాకింగ్', 'రైడర్', 'చేరే సమయం', 'Bharat Map ను అడగండి', 'రవాణా', 'విక్రేత డ్యాష్‌బోర్డ్', 'సైన్ ఇన్', 'సైన్ అవుట్', 'హోల్‌సేల్', 'మొత్తం', 'డెలివరీ అయింది', 'దారి'],
  ta: ['இடங்கள், கடைகள், பொருட்களைத் தேடுங்கள்…', 'என் அருகில்', 'முடிவுகள்', 'கையிருப்பில்', 'கையிருப்பு இல்லை', 'சரிபார்க்கப்பட்டது', 'சேர்', 'கார்ட்', 'செக்அவுட்', 'ஆர்டர் செய்', 'டெலிவரி', 'பிக்அப்', 'நேரடி கண்காணிப்பு', 'ரைடர்', 'வருகை நேரம்', 'Bharat Map-இடம் கேளுங்கள்', 'போக்குவரத்து', 'விற்பனையாளர் டாஷ்போர்டு', 'உள்நுழை', 'வெளியேறு', 'மொத்த விற்பனை', 'மொத்தம்', 'டெலிவரி ஆனது', 'வழி'],
  kn: ['ಸ್ಥಳಗಳು, ಅಂಗಡಿಗಳು, ವಸ್ತುಗಳನ್ನು ಹುಡುಕಿ…', 'ನನ್ನ ಹತ್ತಿರ', 'ಫಲಿತಾಂಶಗಳು', 'ಸ್ಟಾಕ್‌ನಲ್ಲಿದೆ', 'ಸ್ಟಾಕ್ ಇಲ್ಲ', 'ಪರಿಶೀಲಿತ', 'ಸೇರಿಸಿ', 'ಕಾರ್ಟ್', 'ಚೆಕ್‌ಔಟ್', 'ಆರ್ಡರ್ ಮಾಡಿ', 'ಡೆಲಿವರಿ', 'ಪಿಕಪ್', 'ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್', 'ರೈಡರ್', 'ತಲುಪುವ ಸಮಯ', 'Bharat Map ಕೇಳಿ', 'ಸಾರಿಗೆ', 'ಮಾರಾಟಗಾರರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', 'ಸೈನ್ ಇನ್', 'ಸೈನ್ ಔಟ್', 'ಸಗಟು', 'ಒಟ್ಟು', 'ತಲುಪಿಸಲಾಗಿದೆ', 'ದಾರಿ'],
  ml: ['സ്ഥലങ്ങൾ, കടകൾ, ഉൽപ്പന്നങ്ങൾ തിരയുക…', 'എന്റെ അടുത്ത്', 'ഫലങ്ങൾ', 'സ്റ്റോക്കുണ്ട്', 'സ്റ്റോക്കില്ല', 'സ്ഥിരീകരിച്ചത്', 'ചേർക്കുക', 'കാർട്ട്', 'ചെക്ക്ഔട്ട്', 'ഓർഡർ ചെയ്യുക', 'ഡെലിവറി', 'പിക്കപ്പ്', 'തത്സമയ ട്രാക്കിംഗ്', 'റൈഡർ', 'എത്തുന്ന സമയം', 'Bharat Map-നോട് ചോദിക്കൂ', 'ഗതാഗതം', 'വിൽപ്പനക്കാരന്റെ ഡാഷ്ബോർഡ്', 'സൈൻ ഇൻ', 'സൈൻ ഔട്ട്', 'മൊത്തവ്യാപാരം', 'ആകെ', 'ഡെലിവർ ചെയ്തു', 'വഴി'],
  bn: ['জায়গা, দোকান, পণ্য খুঁজুন…', 'আমার কাছে', 'ফলাফল', 'স্টকে আছে', 'স্টক নেই', 'যাচাইকৃত', 'যোগ করুন', 'কার্ট', 'চেকআউট', 'অর্ডার দিন', 'ডেলিভারি', 'পিকআপ', 'লাইভ ট্র্যাকিং', 'রাইডার', 'পৌঁছানোর সময়', 'Bharat Map-কে জিজ্ঞাসা করুন', 'যাতায়াত', 'বিক্রেতা ড্যাশবোর্ড', 'সাইন ইন', 'সাইন আউট', 'পাইকারি', 'মোট', 'ডেলিভারি হয়েছে', 'পথ'],
  mr: ['ठिकाणे, दुकाने, वस्तू शोधा…', 'माझ्या जवळ', 'निकाल', 'स्टॉकमध्ये', 'स्टॉक संपला', 'सत्यापित', 'जोडा', 'कार्ट', 'चेकआउट', 'ऑर्डर करा', 'डिलिव्हरी', 'पिकअप', 'लाइव्ह ट्रॅकिंग', 'रायडर', 'पोहोचण्याची वेळ', 'Bharat Map ला विचारा', 'वाहतूक', 'विक्रेता डॅशबोर्ड', 'साइन इन', 'साइन आउट', 'घाऊक', 'एकूण', 'डिलिव्हर झाले', 'मार्ग'],
  gu: ['સ્થળો, દુકાનો, વસ્તુઓ શોધો…', 'મારી નજીક', 'પરિણામો', 'સ્ટોકમાં', 'સ્ટોક નથી', 'ચકાસાયેલ', 'ઉમેરો', 'કાર્ટ', 'ચેકઆઉટ', 'ઓર્ડર કરો', 'ડિલિવરી', 'પિકઅપ', 'લાઇવ ટ્રેકિંગ', 'રાઇડર', 'પહોંચવાનો સમય', 'Bharat Map ને પૂછો', 'પરિવહન', 'વિક્રેતા ડેશબોર્ડ', 'સાઇન ઇન', 'સાઇન આઉટ', 'જથ્થાબંધ', 'કુલ', 'ડિલિવર થયું', 'માર્ગ'],
  pa: ['ਥਾਵਾਂ, ਦੁਕਾਨਾਂ, ਚੀਜ਼ਾਂ ਖੋਜੋ…', 'ਮੇਰੇ ਨੇੜੇ', 'ਨਤੀਜੇ', 'ਸਟਾਕ ਵਿੱਚ', 'ਸਟਾਕ ਖ਼ਤਮ', 'ਪ੍ਰਮਾਣਿਤ', 'ਜੋੜੋ', 'ਕਾਰਟ', 'ਚੈੱਕਆਊਟ', 'ਆਰਡਰ ਕਰੋ', 'ਡਿਲੀਵਰੀ', 'ਪਿਕਅੱਪ', 'ਲਾਈਵ ਟ੍ਰੈਕਿੰਗ', 'ਰਾਈਡਰ', 'ਪਹੁੰਚਣ ਦਾ ਸਮਾਂ', 'Bharat Map ਨੂੰ ਪੁੱਛੋ', 'ਆਵਾਜਾਈ', 'ਵਿਕਰੇਤਾ ਡੈਸ਼ਬੋਰਡ', 'ਸਾਈਨ ਇਨ', 'ਸਾਈਨ ਆਊਟ', 'ਥੋਕ', 'ਕੁੱਲ', 'ਡਿਲੀਵਰ ਹੋ ਗਿਆ', 'ਰਸਤਾ'],
  or: ['ସ୍ଥାନ, ଦୋକାନ, ଜିନିଷ ଖୋଜନ୍ତୁ…', 'ମୋ ପାଖରେ', 'ଫଳାଫଳ', 'ଷ୍ଟକରେ ଅଛି', 'ଷ୍ଟକ ନାହିଁ', 'ଯାଞ୍ଚିତ', 'ଯୋଡ଼ନ୍ତୁ', 'କାର୍ଟ', 'ଚେକଆଉଟ', 'ଅର୍ଡର କରନ୍ତୁ', 'ଡେଲିଭରି', 'ପିକଅପ', 'ଲାଇଭ ଟ୍ରାକିଂ', 'ରାଇଡର', 'ପହଞ୍ଚିବା ସମୟ', 'Bharat Map କୁ ପଚାରନ୍ତୁ', 'ପରିବହନ', 'ବିକ୍ରେତା ଡ୍ୟାସବୋର୍ଡ', 'ସାଇନ ଇନ', 'ସାଇନ ଆଉଟ', 'ପାଇକାରୀ', 'ମୋଟ', 'ଡେଲିଭର ହେଲା', 'ରାସ୍ତା'],
};

// ---- v0.3 map-app strings ----------------------------------------------------------------
// en / hi / te are complete. TODO(i18n): ta, kn, ml, bn, mr, gu, pa, or fall back to English
// for every v0.3 key below until native-speaker translations are added (tracked in docs/AUDIT.md).
// Templates use {placeholders}; fill them with tf().
const V3 = {
  en: {
    app_name: 'Bharat Map', search_map: 'Search places or DIGIPIN', back: 'Back', close: 'Close', done: 'Done', clear: 'Clear', loading: 'Loading…', retry: 'Retry', cancel: 'Cancel', menu: 'Menu and settings',
    sheet_label: 'Map panel', sheet_handle: 'Panel size: {state}. Activate to change; use arrow keys to resize.', detent_peek: 'collapsed', detent_half: 'half height', detent_full: 'expanded',
    locate: 'Show my location', locate_follow: 'Following your location. Activate again for heading mode.', locate_heading: 'Map follows your heading. Activate to stop.', compass: 'Reset map to north', layers: 'Map layers', view_3d: 'Switch to 3D view', view_2d: 'Switch to 2D view',
    cat_fuel: 'Petrol', cat_ev: 'EV charging', cat_atm: 'ATM', cat_metro: 'Metro', cat_bus: 'Bus stop', cat_rail: 'Railway', cat_hospital: 'Hospital', cat_pharmacy: 'Pharmacy', cat_restaurant: 'Restaurant', cat_grocery: 'Kirana & supermarket', cat_parking: 'Parking', cat_toilets: 'Toilets', cat_airport: 'Airport',
    nearby: 'Find nearby', recents: 'Recent', no_recents: 'Your recent searches appear here (stored only on this device).', saved: 'Saved places', home: 'Home', work: 'Work', favorites: 'Favourites', set_home: 'Set Home', set_work: 'Set Work', add_list: 'New list', list_name: 'List name', empty_list: 'Nothing saved yet', shop: 'Shop', shop_desc: 'Products, prices & delivery from local sellers', offline_maps: 'Offline maps', settings: 'Settings', places_n: '{n} places',
    res_none: 'No {cat} found in this area on OpenStreetMap. Try zooming out or moving the map.', search_area: 'Search this area', osm_credit: 'Data © OpenStreetMap contributors', unnamed: 'Unnamed {cat}', search_products: 'Search products for “{q}” in Shop', no_match: 'No match for “{q}”. Try a landmark, locality, pincode or DIGIPIN.',
    err_network: 'Could not reach {service}. Check your connection.', err_busy: '{service} is busy. Try again in a minute.', err_timeout: '{service} took too long to answer.',
    open_now: 'Open now', closes_at: 'Closes {t}', open_24: 'Open 24 hours', closed: 'Closed', opens_at: 'Opens {t}', opens_tomorrow: 'Opens tomorrow {t}', hours: 'Hours', hours_raw: 'Hours (as listed)', phone: 'Phone', website: 'Website', wheelchair: 'Wheelchair access', wc_yes: 'Accessible', wc_limited: 'Partly accessible', wc_no: 'Not accessible',
    save: 'Save', saved_ok: 'Saved to {list}', unsave: 'Remove from saved', share: 'Share', call: 'Call', shop_here: 'Shop here', away: '{d} away', from_centre: '{d} from map centre', dropped_pin: 'Dropped pin', address: 'Address', copied: 'Copied to clipboard', coords: 'Coordinates', digipin: 'DIGIPIN', set_as_home: 'Set as Home', set_as_work: 'Set as Work', looking_up: 'Looking up address…', demo_seller: 'Demo seller (fictional)',
    from: 'From', to: 'To', your_location: 'Your location', map_centre: 'Map centre', swap: 'Swap start and destination', use_location: 'Use my location',
    mode_drive: 'Drive', mode_two: 'Two-wheeler', mode_bike: 'Cycle', mode_walk: 'Walk', mode_transit: 'Transit', fastest: 'Fastest', via: 'via {road}', alt_n: 'Alternative {n}',
    est_two: 'Estimate: uses car routing (no open two-wheeler profile yet). No live traffic.', no_traffic: 'ETA without live traffic', fallback_route: 'Offline estimate: straight-line distance × 1.35, not a road route.', steps: 'Steps', start: 'Start', simulate: 'Simulate drive (demo)',
    transit_none: 'Live transit timetables aren’t available (no public GTFS feed connected). Nearest stops from OpenStreetMap:', near_start: 'Near start', near_dest: 'Near destination', no_stops: 'No stops found nearby.', arrive_at: 'Arrive {t}', min_short: 'min', hr_short: 'h',
    nav_then: 'Then', nav_mute: 'Mute voice guidance', nav_unmute: 'Turn on voice guidance', nav_end: 'End', nav_overview: 'Overview', nav_recenter: 'Re-centre', nav_arrival: 'arrival', nav_left: 'left', rerouting: 'Off route. Rerouting…', sim_badge: 'Simulation', sim_speed: 'Speed ×{n}', arrived: 'You have arrived', gps_wait: 'Waiting for GPS…', gps_denied: 'Location permission is needed for navigation. You can try “Simulate drive” instead.', voice_fallback: 'No {lang} voice on this device, using English voice.', nav_started: 'Navigation started', nav_live: 'Navigation instructions',
    dir_left: 'left', dir_right: 'right', dir_slight_left: 'slightly left', dir_slight_right: 'slightly right', dir_sharp_left: 'sharp left', dir_sharp_right: 'sharp right', side_left: 'left', side_right: 'right',
    m_turn: 'Turn {dir}', m_turn_onto: 'Turn {dir} onto {road}', m_uturn: 'Make a U-turn', m_continue: 'Continue straight', m_continue_on: 'Continue on {road}', m_depart: 'Head out on {road}', m_depart_plain: 'Head out on your route', m_arrive: 'You have arrived at your destination', m_arrive_ahead: 'Your destination is ahead',
    m_roundabout: 'At the roundabout, take exit {n}', m_roundabout_onto: 'At the roundabout, take exit {n} onto {road}', m_keep: 'Keep {side}', m_keep_onto: 'Keep {side} onto {road}', m_merge: 'Merge onto {road}', m_merge_plain: 'Merge with traffic', m_ramp: 'Take the ramp on the {side}', m_exit: 'Take the exit on the {side}', m_end_of_road: 'At the end of the road, turn {dir}',
    m_near: '{instr} near {landmark}', dist_in: 'In {d}, {instr}', dist_m_speech: '{n} metres', dist_km_speech: '{n} kilometres',
    map_style: 'Map style', style_auto: 'Automatic', style_standard: 'Standard', style_dark: 'Dark', buildings_3d: '3D buildings', buildings_note: 'Heights from OpenStreetMap where tagged; other buildings use a modest default height.', transit_lines: 'Rail & metro lines', overlays: 'Show on map', traffic: 'Live traffic', traffic_note: 'Needs a licensed data partner', offline_always: 'Always use the offline map', satellite_note: 'Satellite imagery is not included: no free imagery source is licensed for this use.',
    offline_desc: 'These regions are bundled inside the app and work with no internet.', bundled: 'Bundled · ready', view_region: 'View on map', auto_offline: 'Network map unavailable. Switched to the offline map.', offline_using: 'Offline map in use', online_back: 'Back online. Using the network map.', zoom_upto: 'Detail up to zoom {z}',
    appearance: 'Appearance', theme_auto: 'Match device', theme_light: 'Light', theme_dark: 'Dark', language: 'Language', city: 'City', voice: 'Voice guidance', clear_history: 'Clear search history', history_cleared: 'Search history cleared',
    privacy: 'Privacy', privacy_note: 'Your location is used only when you tap “Show my location”, ask for directions from your location, or navigate. Searches go to OpenStreetMap services (Photon, Nominatim, Overpass, OSRM routing) only when needed. Recents and saved places stay on this device unless you sign in.', account: 'Account', server: 'Backend server', notifications: 'Notifications', about: 'About', version: 'Version {v}',
  },
  hi: {
    app_name: 'Bharat Map', search_map: 'जगह या DIGIPIN खोजें', back: 'वापस', close: 'बंद करें', done: 'हो गया', clear: 'साफ़ करें', loading: 'लोड हो रहा है…', retry: 'फिर कोशिश करें', cancel: 'रद्द करें', menu: 'मेनू और सेटिंग्स',
    sheet_label: 'मैप पैनल', sheet_handle: 'पैनल का आकार: {state}। बदलने के लिए दबाएँ; ऐरो कुंजियों से आकार बदलें।', detent_peek: 'छोटा', detent_half: 'आधा', detent_full: 'पूरा',
    locate: 'मेरी जगह दिखाएँ', locate_follow: 'आपकी जगह का अनुसरण हो रहा है। दिशा मोड के लिए फिर दबाएँ।', locate_heading: 'मैप आपकी दिशा के साथ घूम रहा है। बंद करने के लिए दबाएँ।', compass: 'मैप को उत्तर की ओर करें', layers: 'मैप परतें', view_3d: '3D दृश्य', view_2d: '2D दृश्य',
    cat_fuel: 'पेट्रोल पंप', cat_ev: 'EV चार्जिंग', cat_atm: 'एटीएम', cat_metro: 'मेट्रो', cat_bus: 'बस स्टॉप', cat_rail: 'रेलवे स्टेशन', cat_hospital: 'अस्पताल', cat_pharmacy: 'दवा की दुकान', cat_restaurant: 'रेस्टोरेंट', cat_grocery: 'किराना और सुपरमार्केट', cat_parking: 'पार्किंग', cat_toilets: 'शौचालय', cat_airport: 'हवाई अड्डा',
    nearby: 'आस-पास खोजें', recents: 'हाल की खोजें', no_recents: 'आपकी हाल की खोजें यहाँ दिखेंगी (सिर्फ़ इसी डिवाइस पर सहेजी जाती हैं)।', saved: 'सहेजी गई जगहें', home: 'घर', work: 'ऑफ़िस', favorites: 'पसंदीदा', set_home: 'घर सेट करें', set_work: 'ऑफ़िस सेट करें', add_list: 'नई सूची', list_name: 'सूची का नाम', empty_list: 'अभी कुछ सहेजा नहीं गया', shop: 'शॉप', shop_desc: 'स्थानीय विक्रेताओं से सामान, दाम और डिलीवरी', offline_maps: 'ऑफ़लाइन मैप', settings: 'सेटिंग्स', places_n: '{n} जगहें',
    res_none: 'इस इलाके में OpenStreetMap पर कोई {cat} नहीं मिला। ज़ूम आउट करें या मैप खिसकाएँ।', search_area: 'इस इलाके में खोजें', osm_credit: 'डेटा © OpenStreetMap योगदानकर्ता', unnamed: 'बिना नाम का {cat}', search_products: 'शॉप में “{q}” के सामान खोजें', no_match: '“{q}” नहीं मिला। कोई लैंडमार्क, इलाका, पिनकोड या DIGIPIN आज़माएँ।',
    err_network: '{service} से जुड़ नहीं पाए। अपना इंटरनेट जाँचें।', err_busy: '{service} अभी व्यस्त है। एक मिनट बाद कोशिश करें।', err_timeout: '{service} ने जवाब देने में बहुत देर लगाई।',
    open_now: 'अभी खुला है', closes_at: '{t} बजे बंद होगा', open_24: '24 घंटे खुला', closed: 'बंद है', opens_at: '{t} बजे खुलेगा', opens_tomorrow: 'कल {t} बजे खुलेगा', hours: 'समय', hours_raw: 'समय (जैसा दर्ज है)', phone: 'फ़ोन', website: 'वेबसाइट', wheelchair: 'व्हीलचेयर पहुँच', wc_yes: 'सुलभ', wc_limited: 'आंशिक रूप से सुलभ', wc_no: 'सुलभ नहीं',
    save: 'सहेजें', saved_ok: '{list} में सहेजा गया', unsave: 'सहेजी गई सूची से हटाएँ', share: 'शेयर करें', call: 'कॉल करें', shop_here: 'यहाँ से ख़रीदें', away: '{d} दूर', from_centre: 'मैप के केंद्र से {d}', dropped_pin: 'लगाया गया पिन', address: 'पता', copied: 'क्लिपबोर्ड पर कॉपी हो गया', coords: 'निर्देशांक', digipin: 'DIGIPIN', set_as_home: 'घर के रूप में सेट करें', set_as_work: 'ऑफ़िस के रूप में सेट करें', looking_up: 'पता खोजा जा रहा है…', demo_seller: 'डेमो विक्रेता (काल्पनिक)',
    from: 'कहाँ से', to: 'कहाँ तक', your_location: 'आपकी जगह', map_centre: 'मैप का केंद्र', swap: 'शुरुआत और मंज़िल बदलें', use_location: 'मेरी जगह इस्तेमाल करें',
    mode_drive: 'कार', mode_two: 'दोपहिया', mode_bike: 'साइकिल', mode_walk: 'पैदल', mode_transit: 'सार्वजनिक परिवहन', fastest: 'सबसे तेज़', via: '{road} से होकर', alt_n: 'विकल्प {n}',
    est_two: 'अनुमान: कार के रास्ते पर आधारित (अभी कोई खुला दोपहिया प्रोफ़ाइल नहीं)। लाइव ट्रैफ़िक नहीं।', no_traffic: 'लाइव ट्रैफ़िक के बिना अनुमानित समय', fallback_route: 'ऑफ़लाइन अनुमान: सीधी दूरी × 1.35, असली सड़क मार्ग नहीं।', steps: 'चरण', start: 'शुरू करें', simulate: 'ड्राइव सिम्युलेट करें (डेमो)',
    transit_none: 'लाइव बस/मेट्रो समय-सारणी उपलब्ध नहीं है (कोई सार्वजनिक GTFS फ़ीड जुड़ी नहीं)। OpenStreetMap से नज़दीकी स्टॉप:', near_start: 'शुरुआत के पास', near_dest: 'मंज़िल के पास', no_stops: 'पास में कोई स्टॉप नहीं मिला।', arrive_at: '{t} तक पहुँचेंगे', min_short: 'मिनट', hr_short: 'घंटे',
    nav_then: 'फिर', nav_mute: 'आवाज़ बंद करें', nav_unmute: 'आवाज़ चालू करें', nav_end: 'समाप्त', nav_overview: 'पूरा रास्ता', nav_recenter: 'फिर से केंद्र में', nav_arrival: 'पहुँचने का समय', nav_left: 'बाकी', rerouting: 'रास्ते से हट गए। नया रास्ता खोजा जा रहा है…', sim_badge: 'सिम्युलेशन', sim_speed: 'गति ×{n}', arrived: 'आप पहुँच गए हैं', gps_wait: 'GPS का इंतज़ार…', gps_denied: 'नेविगेशन के लिए लोकेशन की अनुमति चाहिए। आप “ड्राइव सिम्युलेट करें” आज़मा सकते हैं।', voice_fallback: 'इस डिवाइस पर {lang} आवाज़ नहीं है, अंग्रेज़ी आवाज़ इस्तेमाल हो रही है।', nav_started: 'नेविगेशन शुरू हुआ', nav_live: 'नेविगेशन निर्देश',
    dir_left: 'बाएँ', dir_right: 'दाएँ', dir_slight_left: 'हल्का बाएँ', dir_slight_right: 'हल्का दाएँ', dir_sharp_left: 'तेज़ी से बाएँ', dir_sharp_right: 'तेज़ी से दाएँ', side_left: 'बाईं ओर', side_right: 'दाईं ओर',
    m_turn: '{dir} मुड़ें', m_turn_onto: '{road} पर {dir} मुड़ें', m_uturn: 'यू-टर्न लें', m_continue: 'सीधे चलते रहें', m_continue_on: '{road} पर चलते रहें', m_depart: '{road} पर आगे बढ़ें', m_depart_plain: 'अपने रास्ते पर आगे बढ़ें', m_arrive: 'आप अपनी मंज़िल पर पहुँच गए हैं', m_arrive_ahead: 'आपकी मंज़िल आगे है',
    m_roundabout: 'गोलचक्कर पर निकास {n} लें', m_roundabout_onto: 'गोलचक्कर पर निकास {n} लेकर {road} पर जाएँ', m_keep: '{side} रहें', m_keep_onto: '{side} रहकर {road} पर जाएँ', m_merge: '{road} में मिलें', m_merge_plain: 'मुख्य सड़क में मिलें', m_ramp: '{side} रैंप लें', m_exit: '{side} निकास लें', m_end_of_road: 'सड़क के अंत में {dir} मुड़ें',
    m_near: '{landmark} के पास {instr}', dist_in: '{d} बाद, {instr}', dist_m_speech: '{n} मीटर', dist_km_speech: '{n} किलोमीटर',
    map_style: 'मैप शैली', style_auto: 'स्वचालित', style_standard: 'सामान्य', style_dark: 'डार्क', buildings_3d: '3D इमारतें', buildings_note: 'जहाँ दर्ज है वहाँ OpenStreetMap की ऊँचाई; बाकी इमारतों की ऊँचाई एक सामान्य अनुमान है।', transit_lines: 'रेल और मेट्रो लाइनें', overlays: 'मैप पर दिखाएँ', traffic: 'लाइव ट्रैफ़िक', traffic_note: 'लाइसेंस वाले डेटा पार्टनर की ज़रूरत है', offline_always: 'हमेशा ऑफ़लाइन मैप इस्तेमाल करें', satellite_note: 'सैटेलाइट इमेजरी शामिल नहीं है: इस उपयोग के लिए कोई मुफ़्त लाइसेंस वाला स्रोत नहीं है।',
    offline_desc: 'ये इलाके ऐप के अंदर शामिल हैं और बिना इंटरनेट के चलते हैं।', bundled: 'शामिल · तैयार', view_region: 'मैप पर देखें', auto_offline: 'नेटवर्क मैप उपलब्ध नहीं। ऑफ़लाइन मैप पर स्विच किया गया।', offline_using: 'ऑफ़लाइन मैप चालू है', online_back: 'इंटरनेट वापस आ गया। नेटवर्क मैप इस्तेमाल हो रहा है।', zoom_upto: 'ज़ूम {z} तक विवरण',
    appearance: 'रूप-रंग', theme_auto: 'डिवाइस के अनुसार', theme_light: 'लाइट', theme_dark: 'डार्क', language: 'भाषा', city: 'शहर', voice: 'आवाज़ निर्देश', clear_history: 'खोज इतिहास साफ़ करें', history_cleared: 'खोज इतिहास साफ़ हो गया',
    privacy: 'गोपनीयता', privacy_note: 'आपकी लोकेशन सिर्फ़ तब इस्तेमाल होती है जब आप “मेरी जगह दिखाएँ” दबाते हैं, अपनी जगह से रास्ता माँगते हैं या नेविगेट करते हैं। खोजें ज़रूरत पड़ने पर ही OpenStreetMap सेवाओं (Photon, Nominatim, Overpass, OSRM) को भेजी जाती हैं। हाल की खोजें और सहेजी जगहें इसी डिवाइस पर रहती हैं, जब तक आप साइन इन न करें।', account: 'खाता', server: 'बैकएंड सर्वर', notifications: 'सूचनाएँ', about: 'जानकारी', version: 'संस्करण {v}',
  },
  te: {
    app_name: 'Bharat Map', search_map: 'ప్రదేశం లేదా DIGIPIN వెతకండి', back: 'వెనుకకు', close: 'మూసివేయండి', done: 'పూర్తయింది', clear: 'తొలగించండి', loading: 'లోడ్ అవుతోంది…', retry: 'మళ్ళీ ప్రయత్నించండి', cancel: 'రద్దు చేయండి', menu: 'మెనూ మరియు సెట్టింగ్‌లు',
    sheet_label: 'మ్యాప్ ప్యానెల్', sheet_handle: 'ప్యానెల్ పరిమాణం: {state}. మార్చడానికి నొక్కండి; బాణం కీలతో పరిమాణం మార్చండి.', detent_peek: 'చిన్నది', detent_half: 'సగం', detent_full: 'పూర్తి',
    locate: 'నా స్థానం చూపించు', locate_follow: 'మీ స్థానాన్ని అనుసరిస్తోంది. దిశ మోడ్ కోసం మళ్ళీ నొక్కండి.', locate_heading: 'మ్యాప్ మీ దిశతో తిరుగుతోంది. ఆపడానికి నొక్కండి.', compass: 'మ్యాప్‌ను ఉత్తర దిశకు మార్చండి', layers: 'మ్యాప్ లేయర్‌లు', view_3d: '3D వీక్షణ', view_2d: '2D వీక్షణ',
    cat_fuel: 'పెట్రోల్ బంక్', cat_ev: 'EV ఛార్జింగ్', cat_atm: 'ఏటీఎం', cat_metro: 'మెట్రో', cat_bus: 'బస్ స్టాప్', cat_rail: 'రైల్వే స్టేషన్', cat_hospital: 'ఆసుపత్రి', cat_pharmacy: 'మందుల షాపు', cat_restaurant: 'రెస్టారెంట్', cat_grocery: 'కిరాణా & సూపర్‌మార్కెట్', cat_parking: 'పార్కింగ్', cat_toilets: 'మరుగుదొడ్లు', cat_airport: 'విమానాశ్రయం',
    nearby: 'దగ్గరలో వెతకండి', recents: 'ఇటీవలివి', no_recents: 'మీ ఇటీవలి శోధనలు ఇక్కడ కనిపిస్తాయి (ఈ పరికరంలో మాత్రమే నిల్వ అవుతాయి).', saved: 'సేవ్ చేసిన ప్రదేశాలు', home: 'ఇల్లు', work: 'ఆఫీసు', favorites: 'ఇష్టమైనవి', set_home: 'ఇల్లు సెట్ చేయండి', set_work: 'ఆఫీసు సెట్ చేయండి', add_list: 'కొత్త జాబితా', list_name: 'జాబితా పేరు', empty_list: 'ఇంకా ఏదీ సేవ్ చేయలేదు', shop: 'షాప్', shop_desc: 'స్థానిక విక్రేతల నుండి వస్తువులు, ధరలు & డెలివరీ', offline_maps: 'ఆఫ్‌లైన్ మ్యాప్‌లు', settings: 'సెట్టింగ్‌లు', places_n: '{n} ప్రదేశాలు',
    res_none: 'ఈ ప్రాంతంలో OpenStreetMap లో {cat} కనపడలేదు. జూమ్ అవుట్ చేయండి లేదా మ్యాప్‌ను జరపండి.', search_area: 'ఈ ప్రాంతంలో వెతకండి', osm_credit: 'డేటా © OpenStreetMap సహకారులు', unnamed: 'పేరు లేని {cat}', search_products: 'షాప్‌లో “{q}” వస్తువులు వెతకండి', no_match: '“{q}” దొరకలేదు. ల్యాండ్‌మార్క్, ప్రాంతం, పిన్‌కోడ్ లేదా DIGIPIN ప్రయత్నించండి.',
    err_network: '{service} ని చేరుకోలేకపోయాం. మీ ఇంటర్నెట్ చూడండి.', err_busy: '{service} ప్రస్తుతం బిజీగా ఉంది. ఒక నిమిషం తర్వాత ప్రయత్నించండి.', err_timeout: '{service} జవాబు ఇవ్వడానికి చాలా సమయం తీసుకుంది.',
    open_now: 'ఇప్పుడు తెరిచి ఉంది', closes_at: '{t} కి మూసివేస్తారు', open_24: '24 గంటలు తెరిచి ఉంటుంది', closed: 'మూసి ఉంది', opens_at: '{t} కి తెరుస్తారు', opens_tomorrow: 'రేపు {t} కి తెరుస్తారు', hours: 'సమయాలు', hours_raw: 'సమయాలు (నమోదైనట్లు)', phone: 'ఫోన్', website: 'వెబ్‌సైట్', wheelchair: 'వీల్‌చైర్ సౌకర్యం', wc_yes: 'అందుబాటులో ఉంది', wc_limited: 'పాక్షికంగా అందుబాటులో ఉంది', wc_no: 'అందుబాటులో లేదు',
    save: 'సేవ్', saved_ok: '{list} లో సేవ్ అయింది', unsave: 'సేవ్ నుండి తీసివేయండి', share: 'షేర్', call: 'కాల్', shop_here: 'ఇక్కడ కొనండి', away: '{d} దూరంలో', from_centre: 'మ్యాప్ మధ్య నుండి {d}', dropped_pin: 'వేసిన పిన్', address: 'చిరునామా', copied: 'క్లిప్‌బోర్డ్‌కు కాపీ అయింది', coords: 'అక్షాంశ రేఖాంశాలు', digipin: 'DIGIPIN', set_as_home: 'ఇల్లుగా సెట్ చేయండి', set_as_work: 'ఆఫీసుగా సెట్ చేయండి', looking_up: 'చిరునామా వెతుకుతోంది…', demo_seller: 'డెమో విక్రేత (కల్పితం)',
    from: 'ఎక్కడ నుండి', to: 'ఎక్కడికి', your_location: 'మీ స్థానం', map_centre: 'మ్యాప్ మధ్యభాగం', swap: 'ప్రారంభం మరియు గమ్యం మార్చండి', use_location: 'నా స్థానం వాడండి',
    mode_drive: 'కారు', mode_two: 'ద్విచక్ర వాహనం', mode_bike: 'సైకిల్', mode_walk: 'నడక', mode_transit: 'ప్రజా రవాణా', fastest: 'అత్యంత వేగవంతమైనది', via: '{road} మీదుగా', alt_n: 'ప్రత్యామ్నాయం {n}',
    est_two: 'అంచనా: కారు మార్గం ఆధారంగా (ఇంకా ఓపెన్ ద్విచక్ర వాహన ప్రొఫైల్ లేదు). లైవ్ ట్రాఫిక్ లేదు.', no_traffic: 'లైవ్ ట్రాఫిక్ లేకుండా అంచనా సమయం', fallback_route: 'ఆఫ్‌లైన్ అంచనా: సరళ రేఖ దూరం × 1.35, నిజమైన రోడ్డు మార్గం కాదు.', steps: 'దశలు', start: 'ప్రారంభించండి', simulate: 'డ్రైవ్ సిమ్యులేట్ చేయండి (డెమో)',
    transit_none: 'లైవ్ బస్/మెట్రో టైమ్‌టేబుల్ అందుబాటులో లేదు (పబ్లిక్ GTFS ఫీడ్ కనెక్ట్ కాలేదు). OpenStreetMap నుండి దగ్గరి స్టాప్‌లు:', near_start: 'ప్రారంభం దగ్గర', near_dest: 'గమ్యం దగ్గర', no_stops: 'దగ్గరలో స్టాప్‌లు దొరకలేదు.', arrive_at: '{t} కి చేరుకుంటారు', min_short: 'ని', hr_short: 'గం',
    nav_then: 'తర్వాత', nav_mute: 'వాయిస్ ఆపండి', nav_unmute: 'వాయిస్ ఆన్ చేయండి', nav_end: 'ముగించు', nav_overview: 'మొత్తం మార్గం', nav_recenter: 'మళ్ళీ మధ్యకు', nav_arrival: 'చేరే సమయం', nav_left: 'మిగిలింది', rerouting: 'మార్గం తప్పారు. కొత్త మార్గం వెతుకుతోంది…', sim_badge: 'సిమ్యులేషన్', sim_speed: 'వేగం ×{n}', arrived: 'మీరు చేరుకున్నారు', gps_wait: 'GPS కోసం వేచి ఉంది…', gps_denied: 'నావిగేషన్‌కు లొకేషన్ అనుమతి కావాలి. “డ్రైవ్ సిమ్యులేట్ చేయండి” ప్రయత్నించవచ్చు.', voice_fallback: 'ఈ పరికరంలో {lang} వాయిస్ లేదు, ఇంగ్లీష్ వాయిస్ వాడుతున్నాం.', nav_started: 'నావిగేషన్ ప్రారంభమైంది', nav_live: 'నావిగేషన్ సూచనలు',
    dir_left: 'ఎడమకు', dir_right: 'కుడికి', dir_slight_left: 'కొద్దిగా ఎడమకు', dir_slight_right: 'కొద్దిగా కుడికి', dir_sharp_left: 'పూర్తిగా ఎడమకు', dir_sharp_right: 'పూర్తిగా కుడికి', side_left: 'ఎడమ వైపు', side_right: 'కుడి వైపు',
    m_turn: '{dir} తిరగండి', m_turn_onto: '{road} లోకి {dir} తిరగండి', m_uturn: 'యు-టర్న్ తీసుకోండి', m_continue: 'నేరుగా కొనసాగండి', m_continue_on: '{road} లో కొనసాగండి', m_depart: '{road} లో ముందుకు వెళ్ళండి', m_depart_plain: 'మీ మార్గంలో ముందుకు వెళ్ళండి', m_arrive: 'మీరు మీ గమ్యస్థానానికి చేరుకున్నారు', m_arrive_ahead: 'మీ గమ్యస్థానం ముందు ఉంది',
    m_roundabout: 'రౌండ్‌అబౌట్ వద్ద {n}వ ఎగ్జిట్ తీసుకోండి', m_roundabout_onto: 'రౌండ్‌అబౌట్ వద్ద {n}వ ఎగ్జిట్ తీసుకుని {road} లోకి వెళ్ళండి', m_keep: '{side} ఉండండి', m_keep_onto: '{side} ఉండి {road} లోకి వెళ్ళండి', m_merge: '{road} లో కలవండి', m_merge_plain: 'ప్రధాన రహదారిలో కలవండి', m_ramp: '{side} ర్యాంప్ తీసుకోండి', m_exit: '{side} ఎగ్జిట్ తీసుకోండి', m_end_of_road: 'రోడ్డు చివర {dir} తిరగండి',
    m_near: '{landmark} దగ్గర {instr}', dist_in: '{d} తర్వాత, {instr}', dist_m_speech: '{n} మీటర్ల', dist_km_speech: '{n} కిలోమీటర్ల',
    map_style: 'మ్యాప్ శైలి', style_auto: 'ఆటోమేటిక్', style_standard: 'సాధారణ', style_dark: 'డార్క్', buildings_3d: '3D భవనాలు', buildings_note: 'నమోదైన చోట OpenStreetMap ఎత్తులు; మిగతా భవనాలకు ఒక సాధారణ అంచనా ఎత్తు.', transit_lines: 'రైలు & మెట్రో లైన్లు', overlays: 'మ్యాప్‌పై చూపించు', traffic: 'లైవ్ ట్రాఫిక్', traffic_note: 'లైసెన్స్ ఉన్న డేటా భాగస్వామి అవసరం', offline_always: 'ఎప్పుడూ ఆఫ్‌లైన్ మ్యాప్ వాడండి', satellite_note: 'శాటిలైట్ చిత్రాలు చేర్చలేదు: ఈ వాడకానికి ఉచిత లైసెన్స్ ఉన్న మూలం లేదు.',
    offline_desc: 'ఈ ప్రాంతాలు యాప్‌లోనే ఉన్నాయి, ఇంటర్నెట్ లేకుండా పని చేస్తాయి.', bundled: 'యాప్‌లో ఉంది · సిద్ధం', view_region: 'మ్యాప్‌లో చూడండి', auto_offline: 'నెట్‌వర్క్ మ్యాప్ అందుబాటులో లేదు. ఆఫ్‌లైన్ మ్యాప్‌కు మారాం.', offline_using: 'ఆఫ్‌లైన్ మ్యాప్ వాడుతున్నాం', online_back: 'ఇంటర్నెట్ తిరిగి వచ్చింది. నెట్‌వర్క్ మ్యాప్ వాడుతున్నాం.', zoom_upto: 'జూమ్ {z} వరకు వివరాలు',
    appearance: 'రూపం', theme_auto: 'పరికరం ప్రకారం', theme_light: 'లైట్', theme_dark: 'డార్క్', language: 'భాష', city: 'నగరం', voice: 'వాయిస్ సూచనలు', clear_history: 'శోధన చరిత్ర తొలగించండి', history_cleared: 'శోధన చరిత్ర తొలగించబడింది',
    privacy: 'గోప్యత', privacy_note: 'మీరు “నా స్థానం చూపించు” నొక్కినప్పుడు, మీ స్థానం నుండి దారి అడిగినప్పుడు లేదా నావిగేట్ చేసినప్పుడు మాత్రమే మీ లొకేషన్ వాడబడుతుంది. శోధనలు అవసరమైనప్పుడు మాత్రమే OpenStreetMap సేవలకు (Photon, Nominatim, Overpass, OSRM) వెళ్తాయి. మీరు సైన్ ఇన్ చేయకపోతే ఇటీవలివి, సేవ్ చేసినవి ఈ పరికరంలోనే ఉంటాయి.', account: 'ఖాతా', server: 'బ్యాకెండ్ సర్వర్', notifications: 'నోటిఫికేషన్‌లు', about: 'గురించి', version: 'వెర్షన్ {v}',
  },
};
export const V3_KEYS = Object.keys(V3.en);
import { V4, V4_KEYS, V4_NEEDS_REVIEW } from './i18n-v04.js';
import { V5, V5_KEYS, V5_NEEDS_REVIEW } from './i18n-v05.js';

export const STRINGS = Object.fromEntries(
  Object.entries(T).map(([lang, arr]) => [lang, { ...V3.en, ...(V3[lang] || {}), ...V4.en, ...(V4[lang] || {}), ...V5.en, ...(V5[lang] || {}), ...Object.fromEntries(K.map((k, i) => [k, arr[i]])) }])
);
export { V4_KEYS, V4_NEEDS_REVIEW, V5_KEYS, V5_NEEDS_REVIEW };
/** Languages with complete (non-fallback) v0.3 strings. */
export const V3_COMPLETE = Object.keys(V3);

export function t(lang, key) {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
/** Template fill: tf('hi', 'dist_in', { d: '200 मीटर', instr: '...' }). */
export function tf(lang, key, vars = {}) {
  return t(lang, key).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}
// BCP-47 speech locale for voice guidance.
export const SPEECH_LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN', or: 'or-IN' };

// Native-script / transliterated words -> canonical English search tokens.
export const QUERY_VOCAB = {
  tv: ['टीवी', 'టీవీ', 'டிவி', 'ಟಿವಿ', 'ടിവി', 'টিভি', 'टीव्ही', 'ટીવી', 'ਟੀਵੀ', 'ଟିଭି', 'television', 'टेलीविजन'],
  'near me': ['मेरे पास', 'पास में', 'नजदीक', 'నా దగ్గర', 'దగ్గర', 'దగ్గరలో', 'அருகில்', 'ಹತ್ತಿರ', 'അടുത്ത്', 'কাছে', 'जवळ', 'નજીક', 'ਨੇੜੇ', 'ପାଖରେ', 'nearby', 'paas', 'daggara'],
  milk: ['दूध', 'పాలు', 'பால்', 'ಹಾಲು', 'പാൽ', 'দুধ', 'દૂધ', 'ਦੁੱਧ', 'କ୍ଷୀର', 'doodh', 'paalu'],
  biryani: ['बिरयानी', 'బిర్యానీ', 'பிரியாணி', 'ಬಿರಿಯಾನಿ', 'ബിരിയാണി', 'বিরিয়ানি', 'બિરયાની', 'ਬਿਰਯਾਨੀ', 'ବିରିୟାନି'],
  medicine: ['दवा', 'दवाई', 'మందులు', 'மருந்து', 'ಔಷಧ', 'മരുന്ന്', 'ওষুধ', 'औषध', 'દવા', 'ਦਵਾਈ', 'ଔଷଧ', 'pharmacy', 'chemist'],
  cheap: ['सस्ता', 'सस्ती', 'చౌక', 'తక్కువ ధర', 'மலிவான', 'ಅಗ್ಗದ', 'വിലകുറഞ്ഞ', 'সস্তা', 'स्वस्त', 'સસ્તું', 'ਸਸਤਾ', 'ଶସ୍ତା', 'cheapest', 'lowest price', 'budget'],
  wholesale: ['थोक', 'హోల్‌సేల్', 'టోకు', 'மொத்த', 'ಸಗಟು', 'മൊത്തം', 'পাইকারি', 'घाऊक', 'જથ્થાબંધ', 'ਥੋਕ', 'ପାଇକାରୀ', 'bulk', 'supplier', 'distributor'],
  rice: ['चावल', 'బియ్యం', 'அரிசி', 'ಅಕ್ಕಿ', 'അരി', 'চাল', 'तांदूळ', 'ચોખા', 'ਚੌਲ', 'ଚାଉଳ'],
  mobile: ['मोबाइल', 'ఫోన్', 'மொபைல்', 'ಮೊಬೈಲ್', 'മൊബൈൽ', 'মোবাইল', 'મોબાઇલ', 'ਮੋਬਾਈਲ', 'ମୋବାଇଲ', 'phone', 'smartphone'],
  paint: ['पेंट', 'రంగు', 'பெயிண்ட்', 'ಬಣ್ಣ', 'പെയിന്റ്', 'রং'],
  'ev charging': ['चार्जिंग', 'ఛార్జింగ్', 'சார்ஜிங்', 'charger', 'charging station'],
  parking: ['पार्किंग', 'పార్కింగ్', 'பார்க்கிங்', 'ಪಾರ್ಕಿಂಗ್'],
  metro: ['मेट्रो', 'మెట్రో', 'மெட்ரோ', 'ಮೆಟ್ರೋ'],
};

export function normalizeQuery(q) {
  let s = ` ${String(q || '').toLowerCase().normalize('NFC')} `;
  for (const [canon, words] of Object.entries(QUERY_VOCAB)) {
    for (const w of words) {
      if (s.includes(w.toLowerCase())) s = s.split(w.toLowerCase()).join(` ${canon} `);
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}
