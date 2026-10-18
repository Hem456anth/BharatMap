// Voice search (v0.5): Android uses the speech-recognition plugin (@capacitor-community/speech-recognition, system
// recogniser, RECORD_AUDIO asked only on first tap after an in-app rationale); browsers use the Web Speech API
// (SpeechRecognition) where available. The microphone button is hidden when neither exists. Audio is handled by
// the platform recogniser; Bharat Map only receives the recognised text.
import { isNative } from '../native.js';
import { SPEECH_LANG } from '../shared/i18n.js';

const plugin = () => (isNative() ? window.Capacitor?.Plugins?.SpeechRecognition : null);
const WebRec = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

export function initVoiceSearch(ctx, { onText }) {
  const btn = document.getElementById('micBtn');
  let listening = false;
  const available = async () => {
    const P = plugin();
    if (P) { try { return (await P.available()).available; } catch { return false; } }
    return !!WebRec();
  };
  available().then((ok) => { btn.hidden = !ok; });
  function setListening(v) { listening = v; btn.classList.toggle('listening', v); btn.setAttribute('aria-pressed', String(v)); btn.setAttribute('aria-label', ctx.t(v ? 'voice_listening' : 'voice_search')); }

  async function listen() {
    if (listening) return;
    if (!(await ctx.perm.ensure('microphone'))) return;
    const lang = SPEECH_LANG[ctx.lang()] || 'en-IN';
    const P = plugin();
    setListening(true);
    try {
      if (P) {
        const st = await P.checkPermissions().catch(() => ({}));
        if (st.speechRecognition !== 'granted') {
          const r = await P.requestPermissions().catch(() => ({}));
          if (r.speechRecognition !== 'granted') { setListening(false); ctx.perm.denied('microphone'); return; }
        }
        const r = await P.start({ language: lang, maxResults: 3, partialResults: false, popup: true, prompt: ctx.t('voice_prompt') });
        const text = r?.matches?.[0];
        if (text) onText(text); else ctx.toast(ctx.t('voice_nothing'));
        return;
      }
      const Rec = WebRec();
      await new Promise((resolve) => {
        const rec = new Rec(); rec.lang = lang; rec.interimResults = false; rec.maxAlternatives = 3;
        rec.onresult = (e) => { const text = e.results?.[0]?.[0]?.transcript; if (text) onText(text); resolve(); };
        rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') ctx.perm.denied('microphone'); else ctx.toast(ctx.t('voice_nothing')); resolve(); };
        rec.onend = () => resolve();
        rec.start();
      });
    } catch (e) { ctx.toast(`${ctx.t('voice_nothing')} (${e.message || e})`); }
    finally { setListening(false); }
  }
  btn.addEventListener('click', listen);
  return { listen, available };
}
