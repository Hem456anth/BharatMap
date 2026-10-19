// Voice guidance: Web Speech API (speechSynthesis) or, on Android (the WebView has no speechSynthesis), the native
// TextToSpeech plugin. v0.6: the guidance voice can be picked in Settings (web/nav/voices.js) from the device's Indic
// voices (te, hi, ta, kn, ml, mr, bn, gu, pa, or) — picking one also sets the guidance language. If the device has no
// voice for the language, the English instruction is spoken instead (and the user told once).
import { SPEECH_LANG, t } from '../shared/i18n.js';
import { store } from '../shared/storage.js';
import { nativeTts } from '../native.js';
import { chooseVoice, storedVoice, setStoredVoice, guidanceLang, normaliseVoices, SAMPLE_PHRASES, langOf } from './voices.js';

export function createVoice(ctx) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const native = nativeTts();
  let muted = store.getItem('bm-voice') === '0';
  const warned = new Set();
  const log = []; // last utterances (for tests / debugging)
  let nativeVoices = null;

  /** All on-device voices (raw list from the source in use). */
  async function listVoices() {
    if (native) { if (!nativeVoices) nativeVoices = await native.voices().catch(() => []); return nativeVoices; }
    const v = synth?.getVoices?.() || [];
    if (v.length || !synth?.addEventListener) return v;
    // Chrome loads voices asynchronously the first time.
    return new Promise((res) => { const done = () => res(synth.getVoices?.() || []); synth.addEventListener('voiceschanged', done, { once: true }); setTimeout(done, 1200); });
  }
  const webVoices = () => synth?.getVoices?.() || [];

  async function speak(text, { lang = guidanceLang(ctx.lang()), fallbackText, voiceId = null } = {}) {
    if (!text) return false;
    if (muted && !voiceId) return false;
    const stored = voiceId ? { id: voiceId } : storedVoice();
    let useLang = lang, useText = text;
    if (native) {
      const list = await listVoices();
      let v = chooseVoice(list, lang, stored);
      const ok = !!v || lang === 'en' || (await native.supports(SPEECH_LANG[lang] || 'en-IN'));
      if (!ok && fallbackText) { useLang = 'en'; useText = fallbackText; v = chooseVoice(list, 'en', stored); warnOnce(lang); }
      log.push({ text: useText, lang: SPEECH_LANG[useLang] || 'en-IN', voice: v?.name || null }); log.splice(0, log.length - 20);
      native.stop(); native.speak(useText, v?.lang || SPEECH_LANG[useLang] || 'en-IN', v ? v.index : undefined).catch(() => {});
      return true;
    }
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
    const voices = webVoices();
    let v = chooseVoice(voices, lang, stored);
    if (!v && voices.length && lang !== 'en' && fallbackText) { useLang = 'en'; useText = fallbackText; v = chooseVoice(voices, 'en', stored); warnOnce(lang); }
    const u = new SpeechSynthesisUtterance(useText);
    u.lang = v?.lang || SPEECH_LANG[useLang] || 'en-IN';
    const raw = v ? voices[v.index] : null;
    if (raw) u.voice = raw;
    u.rate = 1;
    synth.cancel();
    synth.speak(u);
    log.push({ text: useText, lang: u.lang, voice: v?.name || null }); log.splice(0, log.length - 20);
    return true;
  }
  function warnOnce(lang) {
    if (warned.has(lang)) return; warned.add(lang);
    const name = { hi: 'हिन्दी', te: 'తెలుగు', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', mr: 'मराठी', bn: 'বাংলা', gu: 'ગુજરાતી', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ' }[lang] || lang;
    ctx.toast(t(ctx.lang(), 'voice_fallback').replace('{lang}', name));
  }
  /** Speak the sample phrase with a given voice (Settings → Guidance voice → Play sample). Works when muted. */
  async function sample(voice) {
    const code = voice ? langOf(voice.lang || voice.code) : guidanceLang(ctx.lang());
    const text = SAMPLE_PHRASES[code] || SAMPLE_PHRASES.en;
    return speak(text, { lang: SAMPLE_PHRASES[code] ? code : 'en', fallbackText: SAMPLE_PHRASES.en, voiceId: voice?.id || '__auto__' });
  }
  return {
    speak, sample, listVoices,
    normalise: normaliseVoices,
    get chosen() { return storedVoice(); },
    choose(v) { setStoredVoice(v); ctx.emit('guidance-voice', storedVoice()); },
    get guidanceLang() { return guidanceLang(ctx.lang()); },
    get muted() { return muted; },
    setMuted(m) { muted = !!m; store.setItem('bm-voice', m ? '0' : '1'); if (m) { synth?.cancel?.(); native?.stop(); } },
    stop() { synth?.cancel?.(); native?.stop(); },
    log,
  };
}
