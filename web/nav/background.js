// Background navigation (Android): while turn-by-turn navigation runs, a foreground service (custom Capacitor
// plugin "BackgroundNav", android/app/src/main/java/com/indiamapos/app/BackgroundNavPlugin.java) keeps receiving GPS
// fixes with the screen off and shows a persistent notification. Before the first use, an in-app rationale explains
// why (Google Play policy for location in a foreground service). ACCESS_BACKGROUND_LOCATION ("Allow all the time")
// is requested only if the user taps that optional button in Settings.
import { store } from '../shared/storage.js';
import { isNative } from '../native.js';

const plug = () => (isNative() ? window.Capacitor?.Plugins?.BackgroundNav : null) || window.__BM_BG_PLUGIN__ || null;

export function createBackgroundNav(ctx) {
  let handle = null;
  const api = {
    supported: () => !!plug(),
    enabled: () => store.getItem('bm-bg-nav') !== '0',
    setEnabled(v) { store.setItem('bm-bg-nav', v ? '1' : '0'); },
    accepted: () => store.getItem('bm-bg-rationale') === 'yes',
    /** Show the rationale once; resolves true when navigation may use the foreground service. */
    ensureRationale() {
      if (!api.supported() || !api.enabled()) return Promise.resolve(false);
      if (api.accepted()) return Promise.resolve(true);
      const dlg = document.getElementById('bgDlg');
      return new Promise((resolve) => {
        const done = () => { dlg.removeEventListener('close', done); const ok = dlg.returnValue === 'yes'; if (ok) store.setItem('bm-bg-rationale', 'yes'); else api.setEnabled(false); ctx.emit('bg-rationale', { ok }); resolve(ok); };
        dlg.addEventListener('close', done);
        dlg.returnValue = ''; dlg.showModal(); document.getElementById('bgYes').focus();
      });
    },
    /** Start the foreground service and forward its fixes; returns a stop() function or null. */
    async start({ dest, onFix }) {
      const P = plug(); if (!P) return null;
      const sub = await P.addListener('location', (l) => onFix({ lat: l.latitude, lng: l.longitude, accuracy: l.accuracy, heading: Number.isFinite(l.bearing) ? l.bearing : null, speed: l.speed ?? null, ts: l.time || Date.now() }));
      try {
        await P.start({ title: 'Bharat Map', text: ctx.tf('bg_notif', { dest: dest || '' }), intervalMs: 1000 });
      } catch (e) { sub?.remove?.(); throw e; }
      handle = { sub, P };
      return () => api.stop();
    },
    async stop() { if (!handle) return; const { sub, P } = handle; handle = null; try { sub?.remove?.(); await P.stop(); } catch { /* ignore */ } },
    get running() { return !!handle; },
    async requestAlways() { const P = plug(); if (!P?.requestBackgroundPermission) return 'unsupported'; const r = await P.requestBackgroundPermission(); return r?.background || 'unknown'; },
  };
  return api;
}
