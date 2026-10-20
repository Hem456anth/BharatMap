// v0.7.18 strings (UI/UX pass A1–A7, A15): category grid, place-card blocks, route cards, empty states, map-failure
// banner, autocomplete. en complete; hi and te written in-house (NEED NATIVE REVIEW before a public release). The other
// 8 languages fall back to English for these keys (same policy as v0.7/v0.8, listed in docs/AUDIT.md).
export const V718_NEEDS_REVIEW = ['hi', 'te'];

const en = {
  all_categories: 'All categories', allcats_title: 'All categories', find_nearby: 'Find nearby', cg_travel: 'Getting around', cg_health: 'Health', cg_daily: 'Daily needs',
  rib_hours: 'Hours', rib_pay: 'Pay', rib_dist: 'Distance', pay_upi: 'UPI', pay_cash: 'Cash', pay_cards: 'Cards',
  hs_open: 'Open', hs_closed: 'Closed', hs_opening_soon: 'Opening soon', hs_closing_soon: 'Closing soon', hs_unknown: 'See hours',
  hs_closes_in: 'Closes in {n} min', hs_opens_in: 'Opens in {n} min',
  about_title: 'About', gtk_title: 'Good to know', details_title: 'Details', near_landmark: 'Near {name}', coords: 'Coordinates',
  gtk_wheelchair: 'Wheelchair accessible', 'gtk_toilets:wheelchair': 'Accessible toilet', gtk_toilets: 'Toilets', 'gtk_diet:vegetarian': 'Vegetarian options', 'gtk_diet:vegan': 'Vegan options', gtk_veg_only: 'Pure vegetarian',
  gtk_air_conditioning: 'Air-conditioned', gtk_internet_access: 'Wi-Fi', gtk_drive_through: 'Drive-through', gtk_delivery: 'Delivery', gtk_takeaway: 'Takeaway',
  gtk_outdoor_seating: 'Outdoor seating', gtk_parking: 'Parking', gtk_changing_table: 'Baby changing', gtk_drinking_water: 'Drinking water', gtk_limited: 'limited', gtk_only: 'only',
  help_complete_t: 'Help complete this place', help_complete_b: 'Hours, phone or a website are missing. Add what you know; it goes to OpenStreetMap as a note.', help_complete_btn: 'Add details',
  rd_fastest: 'Fastest', rd_shortest: 'Shortest', rd_alternative: 'Alternative', rd_estimate: 'Estimate',
  rb_straight: 'Straight-line estimate', rb_no_tolls: 'Avoids tolls', rb_no_highways: 'Avoids highways', rb_two_est: '2-wheeler estimate', rb_tolls: '{n} toll plazas', rb_slower: '+{n} min',
  dir_selected: 'Selected route', dir_arrive: 'Arrive {t}', route_details: 'Route details',
  st_no_match_t: 'No places match “{q}”', st_no_match_b: 'Try a landmark, locality, pincode or DIGIPIN.', st_search_area: 'Search the map area', st_report_missing: 'Report a missing place',
  st_cat_none_t: 'No {cat} found here', st_cat_none_b: 'OpenStreetMap has none in this part of the map.', st_zoom_out: 'Zoom out and search again',
  st_error_t: 'Couldn’t load results', st_retry: 'Retry', st_offline_search: 'Search on this device',
  st_transit_t: 'No scheduled transit for this trip', st_try_two: 'Try 2-wheeler', st_try_drive: 'Drive instead', st_try_walk: 'Walk instead',
  st_route_est_t: 'Showing a straight-line estimate', st_route_est_b: 'The routing service didn’t answer, so time and distance are rough.',
  st_list_empty_t: 'Nothing saved here yet', st_list_empty_b: 'Search for a place and tap Save to add it.', st_find_places: 'Find a place',
  mf_tiles: 'Map didn’t load', mf_timeout: 'Map is taking too long to load', mf_webgl: 'This device couldn’t draw the map',
  mf_body: 'Search, saved places and directions still work.', mf_body_webgl: 'WebGL is turned off or not supported in this browser.',
  mf_retry: 'Retry', mf_lowbw: 'Low-bandwidth mode', mf_offline: 'Use offline map', mf_dismiss: 'Dismiss',
  sug_from_centre: 'from map centre', sug_in_script: 'Name in {script}', sug_area: 'Search “{q}” around the map',
};

const hi = {
  all_categories: 'सभी श्रेणियाँ', allcats_title: 'सभी श्रेणियाँ', find_nearby: 'आस-पास खोजें', cg_travel: 'आना-जाना', cg_health: 'स्वास्थ्य', cg_daily: 'रोज़मर्रा',
  rib_hours: 'समय', rib_pay: 'भुगतान', rib_dist: 'दूरी', pay_upi: 'UPI', pay_cash: 'नकद', pay_cards: 'कार्ड',
  hs_open: 'खुला', hs_closed: 'बंद', hs_opening_soon: 'जल्द खुलेगा', hs_closing_soon: 'जल्द बंद होगा', hs_unknown: 'समय देखें',
  hs_closes_in: '{n} मिनट में बंद', hs_opens_in: '{n} मिनट में खुलेगा',
  about_title: 'परिचय', gtk_title: 'जानने योग्य', details_title: 'विवरण', near_landmark: '{name} के पास', coords: 'निर्देशांक',
  gtk_wheelchair: 'व्हीलचेयर से पहुँच', 'gtk_toilets:wheelchair': 'सुलभ शौचालय', gtk_toilets: 'शौचालय', 'gtk_diet:vegetarian': 'शाकाहारी विकल्प', 'gtk_diet:vegan': 'वीगन विकल्प', gtk_veg_only: 'शुद्ध शाकाहारी',
  gtk_air_conditioning: 'वातानुकूलित', gtk_internet_access: 'वाई-फ़ाई', gtk_drive_through: 'ड्राइव-थ्रू', gtk_delivery: 'डिलीवरी', gtk_takeaway: 'टेकअवे',
  gtk_outdoor_seating: 'बाहर बैठने की जगह', gtk_parking: 'पार्किंग', gtk_changing_table: 'बेबी चेंजिंग', gtk_drinking_water: 'पीने का पानी', gtk_limited: 'सीमित', gtk_only: 'केवल',
  help_complete_t: 'इस जगह की जानकारी पूरी करें', help_complete_b: 'समय, फ़ोन या वेबसाइट नहीं है। जो पता हो जोड़ें; यह OpenStreetMap पर नोट बनकर जाता है।', help_complete_btn: 'जानकारी जोड़ें',
  rd_fastest: 'सबसे तेज़', rd_shortest: 'सबसे छोटा', rd_alternative: 'दूसरा रास्ता', rd_estimate: 'अनुमान',
  rb_straight: 'सीधी-रेखा अनुमान', rb_no_tolls: 'टोल से बचता है', rb_no_highways: 'हाईवे से बचता है', rb_two_est: 'दोपहिया अनुमान', rb_tolls: '{n} टोल प्लाज़ा', rb_slower: '+{n} मिनट',
  dir_selected: 'चुना गया रास्ता', dir_arrive: '{t} पहुँचेंगे', route_details: 'रास्ते का विवरण',
  st_no_match_t: '“{q}” से कोई जगह नहीं मिली', st_no_match_b: 'कोई लैंडमार्क, इलाका, पिनकोड या DIGIPIN आज़माएँ।', st_search_area: 'मैप के इलाके में खोजें', st_report_missing: 'छूटी हुई जगह बताएँ',
  st_cat_none_t: 'यहाँ कोई {cat} नहीं मिला', st_cat_none_b: 'मैप के इस हिस्से में OpenStreetMap पर कुछ नहीं है।', st_zoom_out: 'ज़ूम आउट करके फिर खोजें',
  st_error_t: 'नतीजे लोड नहीं हुए', st_retry: 'फिर कोशिश करें', st_offline_search: 'इसी डिवाइस पर खोजें',
  st_transit_t: 'इस यात्रा के लिए कोई निर्धारित ट्रांज़िट नहीं', st_try_two: 'दोपहिया आज़माएँ', st_try_drive: 'गाड़ी से जाएँ', st_try_walk: 'पैदल जाएँ',
  st_route_est_t: 'सीधी-रेखा अनुमान दिखाया जा रहा है', st_route_est_b: 'रूटिंग सेवा ने जवाब नहीं दिया, इसलिए समय और दूरी मोटे अनुमान हैं।',
  st_list_empty_t: 'यहाँ अभी कुछ सहेजा नहीं गया', st_list_empty_b: 'कोई जगह खोजें और सहेजें दबाएँ।', st_find_places: 'जगह खोजें',
  mf_tiles: 'मैप लोड नहीं हुआ', mf_timeout: 'मैप लोड होने में बहुत समय लग रहा है', mf_webgl: 'यह डिवाइस मैप नहीं बना सका',
  mf_body: 'खोज, सहेजी जगहें और दिशाएँ अब भी काम करती हैं।', mf_body_webgl: 'इस ब्राउज़र में WebGL बंद है या समर्थित नहीं है।',
  mf_retry: 'फिर कोशिश करें', mf_lowbw: 'कम-बैंडविड्थ मोड', mf_offline: 'ऑफ़लाइन मैप इस्तेमाल करें', mf_dismiss: 'बंद करें',
  sug_from_centre: 'मैप के केंद्र से', sug_in_script: '{script} में नाम', sug_area: 'मैप के आस-पास “{q}” खोजें',
};

const te = {
  all_categories: 'అన్ని వర్గాలు', allcats_title: 'అన్ని వర్గాలు', find_nearby: 'దగ్గరలో వెతకండి', cg_travel: 'ప్రయాణం', cg_health: 'ఆరోగ్యం', cg_daily: 'రోజువారీ అవసరాలు',
  rib_hours: 'సమయాలు', rib_pay: 'చెల్లింపు', rib_dist: 'దూరం', pay_upi: 'UPI', pay_cash: 'నగదు', pay_cards: 'కార్డులు',
  hs_open: 'తెరిచి ఉంది', hs_closed: 'మూసి ఉంది', hs_opening_soon: 'త్వరలో తెరుస్తారు', hs_closing_soon: 'త్వరలో మూస్తారు', hs_unknown: 'సమయాలు చూడండి',
  hs_closes_in: '{n} నిమిషాల్లో మూస్తారు', hs_opens_in: '{n} నిమిషాల్లో తెరుస్తారు',
  about_title: 'గురించి', gtk_title: 'తెలుసుకోవలసినవి', details_title: 'వివరాలు', near_landmark: '{name} దగ్గర', coords: 'అక్షాంశ రేఖాంశాలు',
  gtk_wheelchair: 'వీల్‌చైర్‌తో వెళ్లవచ్చు', 'gtk_toilets:wheelchair': 'అందుబాటు మరుగుదొడ్డి', gtk_toilets: 'మరుగుదొడ్లు', 'gtk_diet:vegetarian': 'శాకాహార ఎంపికలు', 'gtk_diet:vegan': 'వీగన్ ఎంపికలు', gtk_veg_only: 'పూర్తి శాకాహారం',
  gtk_air_conditioning: 'ఏసీ ఉంది', gtk_internet_access: 'వై-ఫై', gtk_drive_through: 'డ్రైవ్-థ్రూ', gtk_delivery: 'డెలివరీ', gtk_takeaway: 'టేక్‌అవే',
  gtk_outdoor_seating: 'బయట కూర్చునే చోటు', gtk_parking: 'పార్కింగ్', gtk_changing_table: 'బేబీ చేంజింగ్', gtk_drinking_water: 'తాగునీరు', gtk_limited: 'పరిమితం', gtk_only: 'మాత్రమే',
  help_complete_t: 'ఈ స్థలం వివరాలు పూర్తి చేయండి', help_complete_b: 'సమయాలు, ఫోన్ లేదా వెబ్‌సైట్ లేవు. మీకు తెలిసింది జోడించండి; ఇది OpenStreetMap కు గమనికగా వెళ్తుంది.', help_complete_btn: 'వివరాలు జోడించండి',
  rd_fastest: 'వేగవంతమైనది', rd_shortest: 'అతి చిన్నది', rd_alternative: 'మరో మార్గం', rd_estimate: 'అంచనా',
  rb_straight: 'సరళ రేఖ అంచనా', rb_no_tolls: 'టోల్‌లు లేకుండా', rb_no_highways: 'హైవేలు లేకుండా', rb_two_est: 'ద్విచక్ర అంచనా', rb_tolls: '{n} టోల్ ప్లాజాలు', rb_slower: '+{n} ని',
  dir_selected: 'ఎంచుకున్న మార్గం', dir_arrive: '{t} కి చేరుకుంటారు', route_details: 'మార్గ వివరాలు',
  st_no_match_t: '“{q}” కు సరిపోయే స్థలాలు లేవు', st_no_match_b: 'ల్యాండ్‌మార్క్, ప్రాంతం, పిన్‌కోడ్ లేదా DIGIPIN ప్రయత్నించండి.', st_search_area: 'మ్యాప్ ప్రాంతంలో వెతకండి', st_report_missing: 'లేని స్థలాన్ని తెలియజేయండి',
  st_cat_none_t: 'ఇక్కడ {cat} దొరకలేదు', st_cat_none_b: 'మ్యాప్‌లోని ఈ భాగంలో OpenStreetMap లో ఏవీ లేవు.', st_zoom_out: 'జూమ్ అవుట్ చేసి మళ్లీ వెతకండి',
  st_error_t: 'ఫలితాలు లోడ్ కాలేదు', st_retry: 'మళ్లీ ప్రయత్నించండి', st_offline_search: 'ఈ పరికరంలో వెతకండి',
  st_transit_t: 'ఈ ప్రయాణానికి షెడ్యూల్ ట్రాన్సిట్ లేదు', st_try_two: 'ద్విచక్ర వాహనం ప్రయత్నించండి', st_try_drive: 'కారులో వెళ్లండి', st_try_walk: 'నడిచి వెళ్లండి',
  st_route_est_t: 'సరళ రేఖ అంచనా చూపిస్తున్నాం', st_route_est_b: 'రూటింగ్ సేవ స్పందించలేదు, కాబట్టి సమయం మరియు దూరం సుమారుగా ఉన్నాయి.',
  st_list_empty_t: 'ఇక్కడ ఇంకా ఏమీ సేవ్ చేయలేదు', st_list_empty_b: 'ఒక స్థలాన్ని వెతికి సేవ్ నొక్కండి.', st_find_places: 'స్థలం వెతకండి',
  mf_tiles: 'మ్యాప్ లోడ్ కాలేదు', mf_timeout: 'మ్యాప్ లోడ్ కావడానికి చాలా సమయం పడుతోంది', mf_webgl: 'ఈ పరికరం మ్యాప్‌ను చూపలేకపోయింది',
  mf_body: 'వెతకడం, సేవ్ చేసిన స్థలాలు, దిశలు ఇంకా పని చేస్తాయి.', mf_body_webgl: 'ఈ బ్రౌజర్‌లో WebGL ఆఫ్‌లో ఉంది లేదా సపోర్ట్ కాదు.',
  mf_retry: 'మళ్లీ ప్రయత్నించండి', mf_lowbw: 'తక్కువ బ్యాండ్‌విడ్త్ మోడ్', mf_offline: 'ఆఫ్‌లైన్ మ్యాప్ వాడండి', mf_dismiss: 'మూసివేయండి',
  sug_from_centre: 'మ్యాప్ మధ్య నుండి', sug_in_script: '{script} లో పేరు', sug_area: 'మ్యాప్ చుట్టూ “{q}” వెతకండి',
};

export const V718 = { en, hi, te };
export const V718_KEYS = Object.keys(en);
