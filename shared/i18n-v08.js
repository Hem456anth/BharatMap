// v0.8 strings (CoMaps-inspired items): list editor, GPX/KML import-export, track recording, "Suggest an edit" (OSM note).
// en complete; hi and te written in-house (NEED NATIVE REVIEW before a public release). The other 8 languages fall back
// to English for these keys (same policy as v0.7, listed in docs/AUDIT.md).
export const V8_NEEDS_REVIEW = ['hi', 'te'];

const en = {
  list_edit: 'Edit list', list_done: 'Done', list_rename: 'List name', list_delete: 'Delete list', list_delete_confirm: 'Delete “{name}” and its {n} places?',
  item_up: 'Move up', item_down: 'Move down', item_edit: 'Edit place', item_name: 'Name', item_note: 'Personal note', item_note_hint: 'Kept on this device (and in your account when signed in).', save_changes: 'Save',
  export_gpx: 'Export GPX', export_kml: 'Export KML', import_file: 'Import GPX / KML', exported: 'Exported {file}',
  import_done: 'Imported {places} places and {tracks} tracks', import_list_named: 'Places added to the new list “{name}”',
  import_err_kmz_not_supported: 'KMZ is not supported yet. Unzip it and import the .kml file inside.', import_err_unsupported_format: 'This is not a GPX or KML file.',
  import_err_empty: 'No places or tracks were found in this file.', import_err_too_large: 'The file is too large (limit 8 MB).', import_err_bad_xml: 'The file could not be read (invalid XML).',
  import_err_dtd_not_allowed: 'This file uses XML features that are blocked for safety.', import_warn_truncated: 'Some points were skipped because of file limits.',
  tracks: 'My tracks', tracks_desc: 'Record walks, rides and drives; export as GPX or KML', track_start: 'Start recording', track_pause: 'Pause', track_resume: 'Resume', track_stop: 'Stop and save',
  track_recording: 'Recording', track_paused: 'Paused', track_idle: 'Not recording',
  track_note: 'Recording runs while Bharat Map is open. Tracks stay on this device until you export them. Fixes less accurate than 35 m are skipped.',
  track_dist: 'Distance', track_time: 'Time', track_points: 'Points', track_avg: 'Avg speed', track_none: 'No tracks yet', track_show: 'Show on map', track_delete: 'Delete track',
  track_saved: 'Track saved · {d}', track_too_short: 'Track discarded: fewer than 2 points', track_default_name: 'Track {date}', track_gps_wait: 'Waiting for an accurate GPS fix…', track_denied: 'Location permission is needed to record a track.',
  edit_suggest: 'Suggest an edit', edit_title: 'Suggest an edit', edit_intro: 'Your changes go to OpenStreetMap as an anonymous note. Local mappers check them before the map changes.',
  edit_field_name: 'Name', 'edit_field_name:te': 'Name in Telugu', 'edit_field_name:hi': 'Name in Hindi', edit_field_opening_hours: 'Opening hours (e.g. Mo-Sa 09:00-21:00)', edit_field_phone: 'Phone', edit_field_website: 'Website', edit_field_wheelchair: 'Wheelchair access', edit_wc_unknown: 'Not known',
  edit_comment: 'Anything else? (optional)', edit_preview: 'Changes to send', edit_no_changes: 'Change at least one field or add a comment.', edit_send: 'Send suggestion', edit_remove: '(remove)', edit_sent: 'Thank you! Sent as OSM note #{id}',
  edit_err_invalid_url: 'Enter a valid website address', edit_err_invalid_phone: 'Enter a valid phone number', edit_err_invalid_hours: 'Use the OpenStreetMap opening-hours format', edit_err_too_long: 'Too long', edit_err_invalid_value: 'Invalid value',
};

const hi = {
  list_edit: 'सूची संपादित करें', list_done: 'हो गया', list_rename: 'सूची का नाम', list_delete: 'सूची हटाएँ', list_delete_confirm: '“{name}” और उसकी {n} जगहें हटाएँ?',
  item_up: 'ऊपर ले जाएँ', item_down: 'नीचे ले जाएँ', item_edit: 'जगह संपादित करें', item_name: 'नाम', item_note: 'निजी नोट', item_note_hint: 'इसी डिवाइस पर रहता है (साइन इन होने पर आपके खाते में भी)।', save_changes: 'सहेजें',
  export_gpx: 'GPX निर्यात करें', export_kml: 'KML निर्यात करें', import_file: 'GPX / KML आयात करें', exported: '{file} निर्यात हुआ',
  import_done: '{places} जगहें और {tracks} ट्रैक आयात हुए', import_list_named: 'जगहें नई सूची “{name}” में जोड़ी गईं',
  import_err_kmz_not_supported: 'KMZ अभी समर्थित नहीं है। इसे अनज़िप करके अंदर की .kml फ़ाइल आयात करें।', import_err_unsupported_format: 'यह GPX या KML फ़ाइल नहीं है।',
  import_err_empty: 'इस फ़ाइल में कोई जगह या ट्रैक नहीं मिला।', import_err_too_large: 'फ़ाइल बहुत बड़ी है (सीमा 8 MB)।', import_err_bad_xml: 'फ़ाइल पढ़ी नहीं जा सकी (अमान्य XML)।',
  import_err_dtd_not_allowed: 'यह फ़ाइल ऐसे XML फ़ीचर इस्तेमाल करती है जो सुरक्षा के लिए बंद हैं।', import_warn_truncated: 'फ़ाइल सीमाओं के कारण कुछ बिंदु छोड़ दिए गए।',
  tracks: 'मेरे ट्रैक', tracks_desc: 'पैदल, साइकिल और ड्राइव रिकॉर्ड करें; GPX या KML में निर्यात करें', track_start: 'रिकॉर्डिंग शुरू करें', track_pause: 'रोकें', track_resume: 'फिर शुरू करें', track_stop: 'रोकें और सहेजें',
  track_recording: 'रिकॉर्ड हो रहा है', track_paused: 'रुका हुआ', track_idle: 'रिकॉर्ड नहीं हो रहा',
  track_note: 'रिकॉर्डिंग तब तक चलती है जब तक Bharat Map खुला है। निर्यात करने तक ट्रैक इसी डिवाइस पर रहते हैं। 35 मीटर से कम सटीक लोकेशन छोड़ दी जाती है।',
  track_dist: 'दूरी', track_time: 'समय', track_points: 'बिंदु', track_avg: 'औसत गति', track_none: 'अभी कोई ट्रैक नहीं', track_show: 'मैप पर दिखाएँ', track_delete: 'ट्रैक हटाएँ',
  track_saved: 'ट्रैक सहेजा गया · {d}', track_too_short: 'ट्रैक हटाया गया: 2 से कम बिंदु', track_default_name: 'ट्रैक {date}', track_gps_wait: 'सटीक GPS लोकेशन का इंतज़ार…', track_denied: 'ट्रैक रिकॉर्ड करने के लिए लोकेशन अनुमति चाहिए।',
  edit_suggest: 'बदलाव सुझाएँ', edit_title: 'बदलाव सुझाएँ', edit_intro: 'आपके बदलाव OpenStreetMap पर एक गुमनाम नोट के रूप में जाते हैं। मैप बदलने से पहले स्थानीय मैपर उन्हें जाँचते हैं।',
  edit_field_name: 'नाम', 'edit_field_name:te': 'तेलुगु में नाम', 'edit_field_name:hi': 'हिंदी में नाम', edit_field_opening_hours: 'खुलने का समय (जैसे Mo-Sa 09:00-21:00)', edit_field_phone: 'फ़ोन', edit_field_website: 'वेबसाइट', edit_field_wheelchair: 'व्हीलचेयर पहुँच', edit_wc_unknown: 'पता नहीं',
  edit_comment: 'और कुछ? (वैकल्पिक)', edit_preview: 'भेजे जाने वाले बदलाव', edit_no_changes: 'कम से कम एक फ़ील्ड बदलें या टिप्पणी जोड़ें।', edit_send: 'सुझाव भेजें', edit_remove: '(हटाएँ)', edit_sent: 'धन्यवाद! OSM नोट #{id} के रूप में भेजा गया',
  edit_err_invalid_url: 'सही वेबसाइट पता डालें', edit_err_invalid_phone: 'सही फ़ोन नंबर डालें', edit_err_invalid_hours: 'OpenStreetMap का खुलने-के-समय वाला प्रारूप इस्तेमाल करें', edit_err_too_long: 'बहुत लंबा', edit_err_invalid_value: 'अमान्य मान',
};

const te = {
  list_edit: 'జాబితా సవరించండి', list_done: 'పూర్తయింది', list_rename: 'జాబితా పేరు', list_delete: 'జాబితా తొలగించండి', list_delete_confirm: '“{name}” మరియు దానిలోని {n} స్థలాలను తొలగించాలా?',
  item_up: 'పైకి జరపండి', item_down: 'కిందికి జరపండి', item_edit: 'స్థలం సవరించండి', item_name: 'పేరు', item_note: 'వ్యక్తిగత గమనిక', item_note_hint: 'ఈ పరికరంలోనే ఉంటుంది (సైన్ ఇన్ చేసి ఉంటే మీ ఖాతాలో కూడా).', save_changes: 'సేవ్ చేయండి',
  export_gpx: 'GPX ఎగుమతి', export_kml: 'KML ఎగుమతి', import_file: 'GPX / KML దిగుమతి', exported: '{file} ఎగుమతి అయింది',
  import_done: '{places} స్థలాలు, {tracks} ట్రాక్‌లు దిగుమతి అయ్యాయి', import_list_named: 'స్థలాలు కొత్త జాబితా “{name}” లో చేరాయి',
  import_err_kmz_not_supported: 'KMZ ఇంకా సపోర్ట్ కాదు. దాన్ని అన్‌జిప్ చేసి లోపలి .kml ఫైల్‌ను దిగుమతి చేయండి.', import_err_unsupported_format: 'ఇది GPX లేదా KML ఫైల్ కాదు.',
  import_err_empty: 'ఈ ఫైల్‌లో స్థలాలు లేదా ట్రాక్‌లు దొరకలేదు.', import_err_too_large: 'ఫైల్ చాలా పెద్దది (పరిమితి 8 MB).', import_err_bad_xml: 'ఫైల్ చదవలేకపోయాం (చెల్లని XML).',
  import_err_dtd_not_allowed: 'భద్రత కోసం నిలిపివేసిన XML ఫీచర్లను ఈ ఫైల్ వాడుతోంది.', import_warn_truncated: 'ఫైల్ పరిమితుల వల్ల కొన్ని పాయింట్లు వదిలేశాం.',
  tracks: 'నా ట్రాక్‌లు', tracks_desc: 'నడక, సైకిల్, డ్రైవ్‌లను రికార్డ్ చేయండి; GPX లేదా KML గా ఎగుమతి చేయండి', track_start: 'రికార్డింగ్ ప్రారంభించండి', track_pause: 'ఆపండి', track_resume: 'మళ్ళీ ప్రారంభించండి', track_stop: 'ఆపి సేవ్ చేయండి',
  track_recording: 'రికార్డ్ అవుతోంది', track_paused: 'ఆపబడింది', track_idle: 'రికార్డ్ కావడం లేదు',
  track_note: 'Bharat Map తెరిచి ఉన్నంతవరకు రికార్డింగ్ జరుగుతుంది. మీరు ఎగుమతి చేసే వరకు ట్రాక్‌లు ఈ పరికరంలోనే ఉంటాయి. 35 మీటర్ల కంటే తక్కువ ఖచ్చితత్వం ఉన్న లొకేషన్లు వదిలేస్తాం.',
  track_dist: 'దూరం', track_time: 'సమయం', track_points: 'పాయింట్లు', track_avg: 'సగటు వేగం', track_none: 'ఇంకా ట్రాక్‌లు లేవు', track_show: 'మ్యాప్‌లో చూపించు', track_delete: 'ట్రాక్ తొలగించండి',
  track_saved: 'ట్రాక్ సేవ్ అయింది · {d}', track_too_short: 'ట్రాక్ వదిలేశాం: 2 కంటే తక్కువ పాయింట్లు', track_default_name: 'ట్రాక్ {date}', track_gps_wait: 'ఖచ్చితమైన GPS కోసం వేచి ఉంది…', track_denied: 'ట్రాక్ రికార్డ్ చేయడానికి లొకేషన్ అనుమతి కావాలి.',
  edit_suggest: 'మార్పు సూచించండి', edit_title: 'మార్పు సూచించండి', edit_intro: 'మీ మార్పులు OpenStreetMap కు పేరు లేని గమనికగా వెళ్తాయి. మ్యాప్ మారే ముందు స్థానిక మ్యాపర్లు వాటిని తనిఖీ చేస్తారు.',
  edit_field_name: 'పేరు', 'edit_field_name:te': 'తెలుగులో పేరు', 'edit_field_name:hi': 'హిందీలో పేరు', edit_field_opening_hours: 'తెరిచే సమయాలు (ఉదా. Mo-Sa 09:00-21:00)', edit_field_phone: 'ఫోన్', edit_field_website: 'వెబ్‌సైట్', edit_field_wheelchair: 'వీల్‌చెయిర్ ప్రవేశం', edit_wc_unknown: 'తెలియదు',
  edit_comment: 'ఇంకేమైనా? (ఐచ్ఛికం)', edit_preview: 'పంపే మార్పులు', edit_no_changes: 'కనీసం ఒక ఫీల్డ్ మార్చండి లేదా వ్యాఖ్య జోడించండి.', edit_send: 'సూచన పంపండి', edit_remove: '(తొలగించు)', edit_sent: 'ధన్యవాదాలు! OSM గమనిక #{id} గా పంపాం',
  edit_err_invalid_url: 'సరైన వెబ్‌సైట్ చిరునామా ఇవ్వండి', edit_err_invalid_phone: 'సరైన ఫోన్ నంబర్ ఇవ్వండి', edit_err_invalid_hours: 'OpenStreetMap తెరిచే సమయాల ఫార్మాట్ వాడండి', edit_err_too_long: 'చాలా పొడవుగా ఉంది', edit_err_invalid_value: 'చెల్లని విలువ',
};

export const V8 = { en, hi, te };
export const V8_KEYS = Object.keys(en);
