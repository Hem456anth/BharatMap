// Permission explainers (v0.5): an in-app rationale screen before each OS permission prompt — precise/approximate
// location, background location, notifications, microphone — and denial handling with a deep link to the app's
// system settings. The rationale is shown only when the OS would actually prompt (state "prompt"); nothing is asked
// up front at launch. Aligned with the DPDP Act 2023 notice principle: say what, why and for how long, before asking.
import { isNative } from '../native.js';
import { store } from '../shared/storage.js';
import { icon } from './icons.js';
import { esc } from './search.js';

const ICON = { location: 'locate', background: 'route', notifications: 'bell', microphone: 'mic' };
const plug = (n) => (isNative() ? window.Capacitor?.Plugins?.[n] : null);

/** Current OS state for a permission: 'granted' | 'denied' | 'prompt' | 'unsupported'. */
export async function permissionState(kind) {
  try {
    if (kind === 'location') {
      const G = plug('Geolocation');
      if (G) { const p = await G.checkPermissions(); return p.location === 'granted' || p.coarseLocation === 'granted' ? 'granted' : p.location === 'denied' ? 'denied' : 'prompt'; }
      if (!navigator.geolocation) return 'unsupported';
      const q = await navigator.permissions?.query({ name: 'geolocation' }); return q?.state || 'prompt';
    }
    if (kind === 'notifications') {
      const L = plug('LocalNotifications');
      if (L) { const p = await L.checkPermissions(); return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt'; }
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission === 'default' ? 'prompt' : Notification.permission;
    }
    if (kind === 'microphone') {
      const S = plug('SpeechRecognition');
      if (S) { const p = await S.checkPermissions(); return p.speechRecognition === 'granted' ? 'granted' : p.speechRecognition === 'denied' ? 'denied' : 'prompt'; }
      const q = await navigator.permissions?.query({ name: 'microphone' }); return q?.state || 'prompt';
    }
    if (kind === 'background') {
      const B = plug('BackgroundNav') || window.__BM_BG_PLUGIN__;
      if (!B) return 'unsupported';
      if (B.checkBackgroundPermission) { const r = await B.checkBackgroundPermission(); return r?.background === 'granted' ? 'granted' : 'prompt'; }
      return 'prompt';
    }
  } catch { /* fall through */ }
  return 'prompt';
}

/** Open the app's page in system settings (Android), or explain where to find it (web). */
export async function openAppSettings() {
  const B = plug('BackgroundNav');
  if (B?.openAppSettings) { await B.openAppSettings(); return 'opened'; }
  return 'web';
}

export function initPermissions(ctx) {
  const dlg = document.getElementById('permDlg');
  const $ = (id) => document.getElementById(id);
  const log = []; // rationale screens shown (tests)

  function show(kind, mode) {
    const k = (s) => ctx.t(`perm_${kind}_${s}`);
    $('permIcon').innerHTML = icon(ICON[kind] || 'shield', { size: 30 });
    $('permTitle').textContent = mode === 'denied' ? ctx.t('perm_denied_title') : k('title');
    $('permBody').textContent = mode === 'denied' ? ctx.tf('perm_denied_body', { what: k('what') }) : k('body');
    $('permPoints').innerHTML = mode === 'denied' ? '' : [k('p1'), k('p2'), k('p3')].filter((x) => x && !/^perm_/.test(x)).map((x) => `<li>${esc(x)}</li>`).join('');
    $('permFoot').textContent = mode === 'denied' ? (isNative() ? ctx.t('perm_settings_hint') : ctx.t('perm_settings_hint_web')) : ctx.t('perm_dpdp');
    $('permYes').textContent = mode === 'denied' ? ctx.t('ok') : ctx.t('perm_continue');
    $('permNo').textContent = mode === 'denied' ? ctx.t('cancel') : ctx.t('bg_not_now');
    $('permNo').hidden = mode === 'denied' && !isNative();
    $('permSettings').hidden = mode !== 'denied' || !isNative();
    $('permSettings').textContent = ctx.t('perm_open_settings');
    dlg.dataset.kind = kind; dlg.dataset.mode = mode;
    log.push(`${mode}:${kind}`);
    return new Promise((resolve) => {
      const done = () => { dlg.removeEventListener('close', done); resolve(dlg.returnValue); };
      dlg.addEventListener('close', done);
      dlg.returnValue = ''; dlg.showModal(); $('permYes').focus();
    });
  }

  const api = {
    log,
    state: permissionState,
    /** Resolve true when the caller may trigger the OS prompt (or already has the permission). */
    async ensure(kind) {
      const st = await permissionState(kind);
      if (st === 'granted' || st === 'unsupported') return true;
      if (st === 'denied') { await api.denied(kind); return false; }
      const v = await show(kind, 'rationale');
      if (v === 'yes') { store.setItem(`bm-perm-${kind}`, 'explained'); return true; }
      return false;
    },
    /** After an OS denial: explain what stops working and offer the settings page. */
    async denied(kind) {
      const v = await show(kind, 'denied');
      if (v === 'settings') await openAppSettings();
    },
  };
  return api;
}
