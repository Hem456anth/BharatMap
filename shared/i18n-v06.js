// v0.6 strings: device tiers, offline search v2, India road hints (flyover / service road / narrow road / time
// restrictions), Indic guidance-voice picker.
// en complete; hi and te written in-house (NEED NATIVE REVIEW before a public release); other languages fall back to
// English for these keys (listed in docs/AUDIT.md).
export const V6_NEEDS_REVIEW = ['hi', 'te'];
export const V6 = {
  en: {
    device_tier: 'Device performance', tier_auto: 'Automatic ({t})', tier_low: 'Lite (low-end phone)', tier_mid: 'Balanced', tier_high: 'Full (3D, all labels)',
    tier_note_low: 'Lite: no 3D, fewer labels, no tile prefetch, low-bandwidth mode on.', tier_note_mid: 'Balanced: 3D on request, slightly fewer labels.', tier_note_high: 'Full: 3D buildings, all labels, route prefetch on fast networks.',
    tier_detected: 'Detected: {why}',
    pincode: 'Pincode', search_offline_v2: 'On this device',
    hint_flyover: 'Take the flyover', hint_flyover_on: 'On the flyover', hint_service: 'Stay on the service road', hint_service_on: 'Stay on the service road', hint_narrow: 'Narrow road ahead', hint_narrow_on: 'Narrow road — drive slowly',
    restr_title: 'Time restriction', restr_no_entry: 'No entry', restr_access_destination: 'Access only', restr_one_way: 'One-way', restr_speed: 'Speed limit', restr_odd_even: 'Odd-even rule',
    restr_active: 'In force now', restr_inactive: 'Not in force now', restr_unknown: 'Check local signs',
    guidance_voice: 'Guidance voice', voice_auto: 'Automatic (app language)', voice_sample: 'Play sample', voice_none: 'No Indian-language voices on this device. Install them in Settings → Text-to-speech; guidance falls back to English.',
    voice_note: 'Picking a voice also sets the language of spoken directions.', voice_chosen: 'Guidance voice: {v}',
  },
  hi: {
    device_tier: 'डिवाइस प्रदर्शन', tier_auto: 'स्वचालित ({t})', tier_low: 'लाइट (कम क्षमता वाला फ़ोन)', tier_mid: 'संतुलित', tier_high: 'पूर्ण (3D, सभी लेबल)',
    tier_note_low: 'लाइट: 3D नहीं, कम लेबल, टाइल प्रीफ़ेच नहीं, कम-बैंडविड्थ मोड चालू।', tier_note_mid: 'संतुलित: माँगने पर 3D, थोड़े कम लेबल।', tier_note_high: 'पूर्ण: 3D इमारतें, सभी लेबल, तेज़ नेटवर्क पर रूट प्रीफ़ेच।',
    tier_detected: 'पहचाना गया: {why}',
    pincode: 'पिनकोड', search_offline_v2: 'इस डिवाइस पर',
    hint_flyover: 'फ्लाईओवर पर जाएँ', hint_flyover_on: 'फ्लाईओवर पर', hint_service: 'सर्विस रोड पर रहें', hint_service_on: 'सर्विस रोड पर रहें', hint_narrow: 'आगे सँकरी सड़क', hint_narrow_on: 'सँकरी सड़क — धीरे चलाएँ',
    restr_title: 'समय प्रतिबंध', restr_no_entry: 'प्रवेश निषेध', restr_access_destination: 'केवल गंतव्य हेतु', restr_one_way: 'एकतरफ़ा', restr_speed: 'गति सीमा', restr_odd_even: 'सम-विषम नियम',
    restr_active: 'अभी लागू', restr_inactive: 'अभी लागू नहीं', restr_unknown: 'स्थानीय संकेत देखें',
    guidance_voice: 'मार्गदर्शन आवाज़', voice_auto: 'स्वचालित (ऐप की भाषा)', voice_sample: 'नमूना सुनें', voice_none: 'इस डिवाइस पर भारतीय भाषाओं की आवाज़ें नहीं हैं। सेटिंग्स → टेक्स्ट-टू-स्पीच में इंस्टॉल करें; तब तक मार्गदर्शन अंग्रेज़ी में होगा।',
    voice_note: 'आवाज़ चुनने से बोले जाने वाले निर्देशों की भाषा भी बदलती है।', voice_chosen: 'मार्गदर्शन आवाज़: {v}',
  },
  te: {
    device_tier: 'పరికర పనితీరు', tier_auto: 'ఆటోమేటిక్ ({t})', tier_low: 'లైట్ (తక్కువ సామర్థ్యం గల ఫోన్)', tier_mid: 'సమతుల్యం', tier_high: 'పూర్తి (3D, అన్ని లేబుళ్లు)',
    tier_note_low: 'లైట్: 3D లేదు, తక్కువ లేబుళ్లు, టైల్ ప్రీఫెచ్ లేదు, తక్కువ-బ్యాండ్‌విడ్త్ మోడ్ ఆన్.', tier_note_mid: 'సమతుల్యం: అడిగితే 3D, కొంచెం తక్కువ లేబుళ్లు.', tier_note_high: 'పూర్తి: 3D భవనాలు, అన్ని లేబుళ్లు, వేగవంతమైన నెట్‌వర్క్‌లో రూట్ ప్రీఫెచ్.',
    tier_detected: 'గుర్తించింది: {why}',
    pincode: 'పిన్‌కోడ్', search_offline_v2: 'ఈ పరికరంలో',
    hint_flyover: 'ఫ్లైఓవర్ ఎక్కండి', hint_flyover_on: 'ఫ్లైఓవర్ మీద', hint_service: 'సర్వీస్ రోడ్డులోనే ఉండండి', hint_service_on: 'సర్వీస్ రోడ్డులోనే ఉండండి', hint_narrow: 'ముందు ఇరుకైన రోడ్డు', hint_narrow_on: 'ఇరుకైన రోడ్డు — నెమ్మదిగా నడపండి',
    restr_title: 'సమయ నిబంధన', restr_no_entry: 'ప్రవేశం లేదు', restr_access_destination: 'గమ్యం వారికి మాత్రమే', restr_one_way: 'వన్-వే', restr_speed: 'వేగ పరిమితి', restr_odd_even: 'సరి-బేసి నియమం',
    restr_active: 'ఇప్పుడు అమలులో ఉంది', restr_inactive: 'ఇప్పుడు అమలులో లేదు', restr_unknown: 'స్థానిక సూచికలు చూడండి',
    guidance_voice: 'మార్గదర్శక స్వరం', voice_auto: 'ఆటోమేటిక్ (యాప్ భాష)', voice_sample: 'నమూనా వినండి', voice_none: 'ఈ పరికరంలో భారతీయ భాషల స్వరాలు లేవు. సెట్టింగ్‌లు → టెక్స్ట్-టు-స్పీచ్‌లో ఇన్‌స్టాల్ చేయండి; అప్పటివరకు మార్గదర్శనం ఆంగ్లంలో.',
    voice_note: 'స్వరం ఎంచుకుంటే మాట్లాడే దిశల భాష కూడా మారుతుంది.', voice_chosen: 'మార్గదర్శక స్వరం: {v}',
  },
};
export const V6_KEYS = Object.keys(V6.en);
