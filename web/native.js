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
