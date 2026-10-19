// Indic voice picker (pure helpers, unit-tested). Lists the on-device TTS voices for Indian languages — Web Speech
// API speechSynthesis.getVoices() in browsers, or the Capacitor community TextToSpeech plugin's getSupportedVoices()
// on Android (the WebView has no speechSynthesis) — filtered to te, hi, ta, kn, ml, mr, bn, gu, pa, or, plus English
// (India) as the fallback. The choice is stored per guidance language and used by nav/voice.js.
import { store } from '../shared/storage.js';

export const INDIC_LANGS = ['te', 'hi', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or'];
export const LANG_NAMES = { te: 'తెలుగు', hi: 'हिन्दी', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', mr: 'मराठी', bn: 'বাংলা', gu: 'ગુજરાતી', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ', en: 'English (India)' };
// Sample phrases (spoken by the "Play sample" button) — short navigation sentences in each language.
export const SAMPLE_PHRASES = {
  en: 'In 200 metres, take the flyover.', te: '200 మీటర్లలో, ఫ్లైఓవర్ ఎక్కండి.', hi: '200 मीटर में, फ्लाईओवर पर चढ़ें।', ta: '200 மீட்டரில், மேம்பாலத்தில் செல்லுங்கள்.',
  kn: '200 ಮೀಟರ್‌ನಲ್ಲಿ, ಫ್ಲೈಓವರ್ ಮೇಲೆ ಹೋಗಿ.', ml: '200 മീറ്ററിൽ, ഫ്ലൈഓവറിൽ കയറുക.', mr: '200 मीटरमध्ये, उड्डाणपुलावर जा.', bn: '200 মিটার পরে, ফ্লাইওভারে উঠুন।',
  gu: '200 મીટરમાં, ફ્લાયઓવર પર ચઢો.', pa: '200 ਮੀਟਰ ਵਿੱਚ, ਫਲਾਈਓਵਰ ਉੱਤੇ ਚੜ੍ਹੋ।', or: '200 ମିଟରରେ, ଫ୍ଲାଇଓଭର ଉପରକୁ ଯାଆନ୍ତୁ।',
};

/** Two-letter language of a BCP-47 tag ("te-IN" → "te", "hi_IN" → "hi", "fil" → "fil"). */
export const langOf = (tag) => String(tag || '').toLowerCase().split(/[-_]/)[0];

/**
 * Normalise voices from either source to { id, name, lang, code, local, index }.
 * Web voices: { voiceURI, name, lang, localService }. Native (Capacitor TTS): { voiceURI, name, lang, localService } with
 * the array index used by speak({ voice: index }).
 */
export function normaliseVoices(list = []) {
  return list.map((v, index) => ({ id: v.voiceURI || v.name || `${v.lang}#${index}`, name: v.name || v.voiceURI || v.lang, lang: v.lang || '', code: langOf(v.lang), local: v.localService !== false, index }));
}

/** Indic voices (and English-India fallbacks), grouped by language in INDIC_LANGS order. */
export function indicVoices(list = [], { includeEnglish = true } = {}) {
  const vs = normaliseVoices(list);
  const groups = [];
  for (const code of INDIC_LANGS) {
    const v = vs.filter((x) => x.code === code).sort((a, b) => (/-IN$|_IN$/i.test(b.lang) - /-IN$|_IN$/i.test(a.lang)) || (b.local - a.local) || a.name.localeCompare(b.name));
    if (v.length) groups.push({ code, label: LANG_NAMES[code], voices: v });
  }
  if (includeEnglish) {
    const en = vs.filter((x) => x.code === 'en').sort((a, b) => (/-IN$/i.test(b.lang) - /-IN$/i.test(a.lang)) || a.name.localeCompare(b.name));
    if (en.length) groups.push({ code: 'en', label: LANG_NAMES.en, voices: en.filter((x) => /-IN$|_IN$/i.test(x.lang)).length ? en.filter((x) => /-IN$|_IN$/i.test(x.lang)) : en.slice(0, 3) });
  }
  return groups;
}

// The choice is one voice (id + its language) for guidance: picking a Telugu voice makes guidance speak Telugu even
// when the app is in English; "Automatic" (null) follows the app language.
const KEY = 'bm-guidance-voice';
/** Stored choice { id, lang } or null (automatic). */
export function storedVoice(storage = store) { try { const v = JSON.parse(storage.getItem(KEY) || 'null'); return v && v.id ? v : null; } catch { return null; } }
export function setStoredVoice(v, storage = store) { if (v?.id) storage.setItem(KEY, JSON.stringify({ id: v.id, lang: langOf(v.lang || v.code), name: v.name || '' })); else storage.removeItem(KEY); }
/** Guidance language: the stored voice's language when set, else the app language. */
export function guidanceLang(appLang, stored = storedVoice()) { return stored?.lang && (INDIC_LANGS.includes(stored.lang) || stored.lang === 'en') ? stored.lang : appLang; }

/**
 * Choose the voice to speak `lang` with: the stored voice when it is still on the device and speaks `lang`, else the
 * first voice of the language (prefer -IN), else null (caller falls back to English text with an English voice).
 */
export function chooseVoice(list, lang, stored = null) {
  const vs = normaliseVoices(list);
  if (stored?.id) { const v = vs.find((x) => x.id === stored.id); if (v && v.code === lang) return v; }
  const same = vs.filter((x) => x.code === lang);
  return same.find((x) => /-IN$|_IN$/i.test(x.lang)) || same[0] || null;
}
