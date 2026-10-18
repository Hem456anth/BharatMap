// Thin wrappers over Capacitor plugins when running as the Android app, with web fallbacks.
// Plugins are registered natively; the JS bridge exposes them on window.Capacitor.Plugins.
const cap = () => window.Capacitor;
export const isNative = () => !!cap()?.isNativePlatform?.();
const plugin = (n) => (isNative() ? cap().Plugins?.[n] : null);

export async function currentPosition() {
  const G = plugin('Geolocation');
  if (G) {
    const perm = await G.checkPermissions().catch(() => ({}));
    if (perm.location !== 'granted') {
      const req = await G.requestPermissions({ permissions: ['location', 'coarseLocation'] }).catch(() => ({}));
      if (req.location !== 'granted' && req.coarseLocation !== 'granted') throw Object.assign(new Error('location_denied'), { code: 'denied' });
    }
    const p = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
  }
  if (!navigator.geolocation) throw Object.assign(new Error('geolocation_unavailable'), { code: 'unavailable' });
  return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
    (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    (e) => rej(Object.assign(new Error(e.code === 1 ? 'location_denied' : 'location_unavailable'), { code: e.code === 1 ? 'denied' : 'unavailable' })),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }));
}

let notifyAllowed = null, nid = Math.floor(Date.now() / 1000) % 100000;
export async function ensureNotifyPermission() {
  if (notifyAllowed !== null) return notifyAllowed;
  const L = plugin('LocalNotifications');
  if (L) {
    let p = await L.checkPermissions().catch(() => ({}));
    if (p.display !== 'granted') p = await L.requestPermissions().catch(() => ({}));
    notifyAllowed = p.display === 'granted';
    if (notifyAllowed) await L.createChannel?.({ id: 'orders', name: 'Orders & delivery', importance: 4, visibility: 1 }).catch(() => {});
  } else if ('Notification' in window) {
    notifyAllowed = Notification.permission === 'granted' || (Notification.permission === 'default' && (await Notification.requestPermission()) === 'granted');
  } else notifyAllowed = false;
  return notifyAllowed;
}
export async function deviceNotify(title, body) {
  if (!(await ensureNotifyPermission())) return false;
  const L = plugin('LocalNotifications');
  if (L) { await L.schedule({ notifications: [{ id: ++nid, title, body, channelId: 'orders' }] }); return true; }
  try { new Notification(title, { body, icon: 'icon.svg' }); return true; } catch { return false; }
}
export function openExternal(url) {
  const B = plugin('Browser');
  if (B) return B.open({ url });
  window.open(url, '_blank', 'noopener');
}

// ---- v0.3: continuous location (navigation / follow mode), share, native TTS, Android back button ----
/** Watch position. Returns a stop() function. Only started on user action (locate follow) or navigation. */
export async function watchPosition(onFix, onError) {
  const G = plugin('Geolocation');
  const toFix = (c, ts) => ({ lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, heading: Number.isFinite(c.heading) ? c.heading : null, speed: Number.isFinite(c.speed) ? c.speed : null, ts: ts || Date.now() });
  if (G) {
    const perm = await G.checkPermissions().catch(() => ({}));
    if (perm.location !== 'granted') {
      const req = await G.requestPermissions({ permissions: ['location', 'coarseLocation'] }).catch(() => ({}));
      if (req.location !== 'granted' && req.coarseLocation !== 'granted') { onError?.(Object.assign(new Error('location_denied'), { code: 'denied' })); return () => {}; }
    }
    const id = await G.watchPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }, (p, err) => {
      if (err) onError?.(Object.assign(new Error(err.message || 'location_unavailable'), { code: /denied|permission/i.test(err.message || '') ? 'denied' : 'unavailable' }));
      else if (p) onFix(toFix(p.coords, p.timestamp));
    });
    return () => { G.clearWatch({ id }).catch(() => {}); };
  }
  if (!navigator.geolocation) { onError?.(Object.assign(new Error('geolocation_unavailable'), { code: 'unavailable' })); return () => {}; }
  const id = navigator.geolocation.watchPosition((p) => onFix(toFix(p.coords, p.timestamp)),
    (e) => onError?.(Object.assign(new Error(e.code === 1 ? 'location_denied' : 'location_unavailable'), { code: e.code === 1 ? 'denied' : 'unavailable' })),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 });
  return () => navigator.geolocation.clearWatch(id);
}

/** Share text+url: Capacitor Share (Android) → Web Share API → clipboard. Returns 'shared' | 'copied' | 'failed'. */
export async function shareLink({ title, text, url }) {
  const S = plugin('Share');
  try {
    if (S) { await S.share({ title, text, url, dialogTitle: title }); return 'shared'; }
    if (navigator.share) { await navigator.share({ title, text, url }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return 'cancelled'; }
  try { await navigator.clipboard.writeText(`${text ? `${text}\n` : ''}${url}`); return 'copied'; } catch { /* no clipboard */ }
  return 'failed';
}

/** Native text-to-speech (Android) when the plugin is present; null otherwise. */
export function nativeTts() {
  const T = plugin('TextToSpeech');
  if (!T) return null;
  return {
    speak: (text, lang) => T.speak({ text, lang, rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' }),
    stop: () => T.stop().catch(() => {}),
    supports: async (lang) => { try { const r = await T.getSupportedLanguages(); return (r.languages || []).some((l) => l.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())); } catch { return false; } },
  };
}

/** Android hardware back button. handler() returns true when it consumed the press. */
export function onBackButton(handler) {
  const A = plugin('App');
  if (!A) return;
  A.addListener('backButton', () => { if (!handler()) A.exitApp(); });
}
