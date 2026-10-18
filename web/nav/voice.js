// Voice guidance: Web Speech API (speechSynthesis) with the app language (en-IN / hi-IN / te-IN …).
// On Android the WebView has no speechSynthesis, so the native TextToSpeech plugin is used when present.
// If the device has no voice for the language, the English instruction is spoken instead (and the user told once).
import { SPEECH_LANG, t } from '../shared/i18n.js';
import { store } from '../shared/storage.js';
import { nativeTts } from '../native.js';

export function createVoice(ctx) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const native = nativeTts();
  let muted = store.getItem('bm-voice') === '0';
  let warned = new Set();
  const log = []; // last utterances (for tests / debugging)

  function pickVoice(lang) {
    const voices = synth?.getVoices?.() || [];
    const want = SPEECH_LANG[lang] || 'en-IN';
    return { voices, voice: voices.find((v) => v.lang === want) || voices.find((v) => v.lang?.toLowerCase().startsWith(want.slice(0, 2))) || null };
  }

  async function speak(text, { lang = ctx.lang(), fallbackText } = {}) {
    if (muted || !text) return false;
    let useLang = lang, useText = text;
    if (native) {
      const ok = lang === 'en' || (await native.supports(SPEECH_LANG[lang] || 'en-IN'));
      if (!ok && fallbackText) { useLang = 'en'; useText = fallbackText; warnOnce(lang); }
      log.push({ text: useText, lang: SPEECH_LANG[useLang] }); log.splice(0, log.length - 20);
      native.stop(); native.speak(useText, SPEECH_LANG[useLang] || 'en-IN').catch(() => {});
      return true;
    }
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
    const { voices, voice } = pickVoice(lang);
    let v = voice;
    if (!v && voices.length && lang !== 'en' && fallbackText) { useLang = 'en'; useText = fallbackText; v = pickVoice('en').voice; warnOnce(lang); }
    const u = new SpeechSynthesisUtterance(useText);
    u.lang = SPEECH_LANG[useLang] || 'en-IN';
    if (v) u.voice = v;
    u.rate = 1;
    synth.cancel();
    synth.speak(u);
    log.push({ text: useText, lang: u.lang }); log.splice(0, log.length - 20);
    return true;
  }
  function warnOnce(lang) {
    if (warned.has(lang)) return; warned.add(lang);
    const name = { hi: 'हिन्दी', te: 'తెలుగు' }[lang] || lang;
    ctx.toast(t(ctx.lang(), 'voice_fallback').replace('{lang}', name));
  }
  return {
    speak,
    get muted() { return muted; },
    setMuted(m) { muted = !!m; store.setItem('bm-voice', m ? '0' : '1'); if (m) { synth?.cancel?.(); native?.stop(); } },
    stop() { synth?.cancel?.(); native?.stop(); },
    log,
  };
}
