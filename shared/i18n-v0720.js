// v0.7.20 strings (competitor gaps G1, G6–G10). en complete; hi and te written in-house (NEED NATIVE REVIEW before a
// public release). The other 8 languages fall back to English for these keys (same policy as v0.7/v0.8/v0.7.18).
export const V720_NEEDS_REVIEW = ['hi', 'te'];

const en = {
  mr_toggle: 'Prefer main roads', mr_hint: 'Avoid narrow service lanes, colony streets and kaccha tracks where a main road is close.',
  mr_applied: 'Prefer main roads: narrow service lanes, colony streets and tracks are avoided where possible.',
  mr_not_applied: 'Prefer main roads isn’t applied to this route: it came from OSRM, which has no road-type costs.',
  fr_auto: 'Switch to faster routes automatically', fr_offer: 'Faster route · saves {n} min', fr_switch: 'Switch', fr_keep: 'Keep my route',
  fr_switched: 'Switched to a faster route · saves {n} min', fr_kept: 'Keeping your route', fr_spoken: 'A faster route is available. It saves {n} minutes.',
  rr_new: 'New route from here · {t}', voice_missing: 'Your chosen voice isn’t on this device right now; using {v}. Your choice is kept.',
  al_dest: 'Alarm before arrival', al_stop: 'Alert me before {stop}', al_on: 'Alarm on · {d} before {name}', al_off: 'Alarm cancelled',
  al_fire_t: 'Get ready', al_fire_dest: 'You’re {d} from {name}', al_fire_stop: '{name} is next — get ready to get off', al_dismiss: 'Dismiss',
  al_foreground: 'Works while Bharat Map is open or navigating.', al_cancel: 'Cancel alarm',
  ri_ahead: '{type} reported {d} ahead · not verified', ri_spoken: '{type} reported {d} ahead. Not verified.', ri_still: '{type} — still there?', ri_yes: 'Yes', ri_no: 'No, gone', ri_thanks: 'Thanks — report updated',
  ho_copy: 'Copy pickup for driver', ho_copied: 'Pickup copied — paste it in {app}', ho_copied_plain: 'Pickup details copied',
  ho_in_link: 'Your exact pin and DIGIPIN go in the link.', ho_will_copy: 'This app has no documented pickup link: your exact pin, DIGIPIN and landmark will be copied so you can paste them.',
  mp_tab: 'Missing place', mp_name: 'Name of the place', mp_kind: 'What is it?', mp_phone: 'Phone (optional)', mp_hours: 'Opening hours (optional, e.g. Mo-Sa 09:00-21:00)',
  mp_website: 'Website (optional)', mp_note: 'Anything else (optional)', mp_pin: 'At the pin: {d}', mp_sent: 'Thanks! Sent to OpenStreetMap as note #{id}',
  mp_name_required: 'Add the name of the place', mp_invalid: 'Check this field: {f}',
  mpk_shop: 'Shop', mpk_kirana: 'Kirana / general store', mpk_restaurant: 'Restaurant', mpk_cafe: 'Café / tea stall', mpk_hospital: 'Hospital', mpk_clinic: 'Clinic',
  mpk_pharmacy: 'Pharmacy', mpk_school: 'School', mpk_atm: 'ATM', mpk_bank: 'Bank', mpk_fuel: 'Petrol pump', mpk_temple: 'Temple', mpk_mosque: 'Mosque', mpk_church: 'Church',
  mpk_bus_stop: 'Bus stop', mpk_office: 'Office', mpk_toilets: 'Toilets', mpk_hotel: 'Hotel', mpk_other: 'Something else',
};

const hi = {
  mr_toggle: 'मुख्य सड़कें पसंद करें', mr_hint: 'पास में मुख्य सड़क हो तो तंग सर्विस गलियों, कॉलोनी की गलियों और कच्चे रास्तों से बचें।',
  mr_applied: 'मुख्य सड़कें पसंद: जहाँ संभव हो, तंग सर्विस गलियों, कॉलोनी की गलियों और कच्चे रास्तों से बचा गया है।',
  mr_not_applied: 'इस रास्ते पर "मुख्य सड़कें पसंद" लागू नहीं है: यह OSRM से आया है, जिसमें सड़क-प्रकार की लागत नहीं होती।',
  fr_auto: 'तेज़ रास्ते पर अपने-आप बदलें', fr_offer: 'तेज़ रास्ता · {n} मिनट बचेंगे', fr_switch: 'बदलें', fr_keep: 'मेरा रास्ता रखें',
  fr_switched: 'तेज़ रास्ते पर बदला · {n} मिनट बचेंगे', fr_kept: 'आपका रास्ता रखा गया', fr_spoken: 'एक तेज़ रास्ता उपलब्ध है। इससे {n} मिनट बचेंगे।',
  rr_new: 'यहाँ से नया रास्ता · {t}', voice_missing: 'आपकी चुनी आवाज़ अभी इस डिवाइस पर नहीं है; {v} इस्तेमाल हो रही है। आपकी पसंद सहेजी हुई है।',
  al_dest: 'पहुँचने से पहले अलार्म', al_stop: '{stop} से पहले बताएँ', al_on: 'अलार्म चालू · {name} से {d} पहले', al_off: 'अलार्म रद्द',
  al_fire_t: 'तैयार हो जाएँ', al_fire_dest: 'आप {name} से {d} दूर हैं', al_fire_stop: 'अगला {name} है — उतरने के लिए तैयार हो जाएँ', al_dismiss: 'बंद करें',
  al_foreground: 'भारत मैप खुला हो या नेविगेशन चल रहा हो, तब काम करता है।', al_cancel: 'अलार्म रद्द करें',
  ri_ahead: '{d} आगे {type} की सूचना · पुष्टि नहीं', ri_spoken: '{d} आगे {type} की सूचना है। पुष्टि नहीं हुई है।', ri_still: '{type} — क्या अब भी है?', ri_yes: 'हाँ', ri_no: 'नहीं, हट गया', ri_thanks: 'धन्यवाद — सूचना अपडेट हुई',
  ho_copy: 'ड्राइवर के लिए पिकअप कॉपी करें', ho_copied: 'पिकअप कॉपी हुआ — {app} में पेस्ट करें', ho_copied_plain: 'पिकअप विवरण कॉपी हुआ',
  ho_in_link: 'आपका सटीक पिन और DIGIPIN लिंक में जाते हैं।', ho_will_copy: 'इस ऐप का कोई दस्तावेज़ी पिकअप लिंक नहीं है: आपका सटीक पिन, DIGIPIN और लैंडमार्क कॉपी होंगे ताकि आप पेस्ट कर सकें।',
  mp_tab: 'छूटी हुई जगह', mp_name: 'जगह का नाम', mp_kind: 'यह क्या है?', mp_phone: 'फ़ोन (वैकल्पिक)', mp_hours: 'खुलने का समय (वैकल्पिक, जैसे Mo-Sa 09:00-21:00)',
  mp_website: 'वेबसाइट (वैकल्पिक)', mp_note: 'और कुछ (वैकल्पिक)', mp_pin: 'पिन पर: {d}', mp_sent: 'धन्यवाद! OpenStreetMap को नोट #{id} के रूप में भेजा गया',
  mp_name_required: 'जगह का नाम लिखें', mp_invalid: 'यह फ़ील्ड जाँचें: {f}',
  mpk_shop: 'दुकान', mpk_kirana: 'किराना / जनरल स्टोर', mpk_restaurant: 'रेस्तराँ', mpk_cafe: 'कैफ़े / चाय की दुकान', mpk_hospital: 'अस्पताल', mpk_clinic: 'क्लिनिक',
  mpk_pharmacy: 'दवा की दुकान', mpk_school: 'स्कूल', mpk_atm: 'एटीएम', mpk_bank: 'बैंक', mpk_fuel: 'पेट्रोल पंप', mpk_temple: 'मंदिर', mpk_mosque: 'मस्जिद', mpk_church: 'चर्च',
  mpk_bus_stop: 'बस स्टॉप', mpk_office: 'दफ़्तर', mpk_toilets: 'शौचालय', mpk_hotel: 'होटल', mpk_other: 'कुछ और',
};

const te = {
  mr_toggle: 'ప్రధాన రోడ్లకు ప్రాధాన్యం', mr_hint: 'దగ్గరలో ప్రధాన రోడ్డు ఉంటే ఇరుకైన సర్వీస్ సందులు, కాలనీ వీధులు, మట్టి దారులు తప్పించండి.',
  mr_applied: 'ప్రధాన రోడ్లకు ప్రాధాన్యం: వీలైనచోట ఇరుకైన సర్వీస్ సందులు, కాలనీ వీధులు, మట్టి దారులు తప్పించాం.',
  mr_not_applied: 'ఈ మార్గానికి "ప్రధాన రోడ్లకు ప్రాధాన్యం" వర్తించలేదు: ఇది OSRM నుండి వచ్చింది, దానిలో రోడ్డు రకం ఖర్చులు ఉండవు.',
  fr_auto: 'వేగవంతమైన మార్గానికి ఆటోమేటిక్‌గా మారండి', fr_offer: 'వేగవంతమైన మార్గం · {n} ని ఆదా', fr_switch: 'మారండి', fr_keep: 'నా మార్గమే ఉంచండి',
  fr_switched: 'వేగవంతమైన మార్గానికి మారాం · {n} ని ఆదా', fr_kept: 'మీ మార్గమే ఉంచాం', fr_spoken: 'వేగవంతమైన మార్గం ఉంది. దీని వల్ల {n} నిమిషాలు ఆదా అవుతాయి.',
  rr_new: 'ఇక్కడి నుండి కొత్త మార్గం · {t}', voice_missing: 'మీరు ఎంచుకున్న వాయిస్ ఇప్పుడు ఈ పరికరంలో లేదు; {v} వాడుతున్నాం. మీ ఎంపిక అలాగే ఉంది.',
  al_dest: 'చేరుకునే ముందు అలారం', al_stop: '{stop} ముందు తెలియజేయండి', al_on: 'అలారం ఆన్ · {name} కి {d} ముందు', al_off: 'అలారం రద్దు',
  al_fire_t: 'సిద్ధంగా ఉండండి', al_fire_dest: 'మీరు {name} కి {d} దూరంలో ఉన్నారు', al_fire_stop: 'తర్వాత {name} — దిగడానికి సిద్ధంగా ఉండండి', al_dismiss: 'మూసివేయండి',
  al_foreground: 'భారత్ మ్యాప్ తెరిచి ఉన్నప్పుడు లేదా నావిగేషన్‌లో పని చేస్తుంది.', al_cancel: 'అలారం రద్దు చేయండి',
  ri_ahead: '{d} ముందు {type} నివేదిక · ధృవీకరించలేదు', ri_spoken: '{d} ముందు {type} నివేదిక ఉంది. ధృవీకరించలేదు.', ri_still: '{type} — ఇంకా ఉందా?', ri_yes: 'అవును', ri_no: 'లేదు, పోయింది', ri_thanks: 'ధన్యవాదాలు — నివేదిక నవీకరించాం',
  ho_copy: 'డ్రైవర్ కోసం పికప్ కాపీ చేయండి', ho_copied: 'పికప్ కాపీ అయింది — {app} లో పేస్ట్ చేయండి', ho_copied_plain: 'పికప్ వివరాలు కాపీ అయ్యాయి',
  ho_in_link: 'మీ ఖచ్చితమైన పిన్, DIGIPIN లింక్‌లోనే వెళ్తాయి.', ho_will_copy: 'ఈ యాప్‌కు డాక్యుమెంట్ చేసిన పికప్ లింక్ లేదు: మీ ఖచ్చితమైన పిన్, DIGIPIN, ల్యాండ్‌మార్క్ కాపీ అవుతాయి, మీరు పేస్ట్ చేయవచ్చు.',
  mp_tab: 'లేని స్థలం', mp_name: 'స్థలం పేరు', mp_kind: 'ఇది ఏమిటి?', mp_phone: 'ఫోన్ (ఐచ్ఛికం)', mp_hours: 'తెరిచే సమయాలు (ఐచ్ఛికం, ఉదా. Mo-Sa 09:00-21:00)',
  mp_website: 'వెబ్‌సైట్ (ఐచ్ఛికం)', mp_note: 'ఇంకేమైనా (ఐచ్ఛికం)', mp_pin: 'పిన్ వద్ద: {d}', mp_sent: 'ధన్యవాదాలు! OpenStreetMap కు గమనిక #{id} గా పంపాం',
  mp_name_required: 'స్థలం పేరు రాయండి', mp_invalid: 'ఈ ఫీల్డ్ చూడండి: {f}',
  mpk_shop: 'దుకాణం', mpk_kirana: 'కిరాణా / జనరల్ స్టోర్', mpk_restaurant: 'రెస్టారెంట్', mpk_cafe: 'కేఫ్ / టీ కొట్టు', mpk_hospital: 'ఆసుపత్రి', mpk_clinic: 'క్లినిక్',
  mpk_pharmacy: 'మందుల దుకాణం', mpk_school: 'పాఠశాల', mpk_atm: 'ఏటీఎం', mpk_bank: 'బ్యాంకు', mpk_fuel: 'పెట్రోల్ బంక్', mpk_temple: 'గుడి', mpk_mosque: 'మసీదు', mpk_church: 'చర్చి',
  mpk_bus_stop: 'బస్ స్టాప్', mpk_office: 'కార్యాలయం', mpk_toilets: 'మరుగుదొడ్లు', mpk_hotel: 'హోటల్', mpk_other: 'ఇంకేదైనా',
};

export const V720 = { en, hi, te };
export const V720_KEYS = Object.keys(en);
