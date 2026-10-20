// Bharat Map v0.3 shell: wires the map-first UI (sheet, search, place cards, directions, navigation,
// saved places, layers, offline, settings) around the shared map. Commerce stays in app.js under "Shop".
import { t as tr, tf as trf } from './shared/i18n.js';
import { store } from './shared/storage.js';
import { hydrateIcons } from './ui/icons.js';
import { createSheet, createViews } from './ui/sheet.js';
import { createCamera } from './map/camera.js';
import { createMapStyle } from './map/style.js';
import { initControls } from './ui/controls.js';
import { initSearch } from './ui/search.js';
import { initPlace } from './ui/place.js';
import { initDirections } from './ui/directions.js';
import { initSaved } from './ui/saved.js';
import { initPanels } from './ui/panels.js';
import { initNavigation } from './nav/navigation.js';
import { onBackButton } from './native.js';
import { readConnection, bandwidthPolicy } from './lib/bandwidth.js';
import { readDeviceSignals, resolveTier, bandwidthManualFor } from './lib/device-tier.js';
import { createRegionManager } from './lib/region-manager.js';
import { createBackgroundNav } from './nav/background.js';
import { serverBase } from './services/server.js';
import { initPermissions } from './ui/permissions.js';
import { initPrivacy } from './ui/privacy.js';
import { initReport } from './ui/report.js';
import { initLinks } from './ui/links.js';
import { initVoiceSearch } from './ui/voice-search.js';
import { currentPosition, setRationaleGate } from './native.js';

import { initLinkout } from './ui/linkout.js';
import { initServicePanel } from './ui/service-panel.js';
import { initPayment } from './ui/payment.js';
import { initOndc } from './ui/ondc.js';
import { initTraffic } from './ui/traffic.js';
import { initTracks } from './ui/tracks.js';
import { initOsmEdit } from './ui/osm-edit.js';
import { initMapHealth } from './ui/map-health.js';
export function createShell({ map, maplibregl, state, api, apiBase, toast, onShop }) {
  const listeners = new Map();
  const ctx = {
    map, maplibregl, state, api, apiBase, toast,
    lang: () => state.lang,
    t: (k) => tr(state.lang, k),
    tf: (k, v) => trf(state.lang, k, v),
    theme: () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); },
    emit(ev, data) { for (const fn of listeners.get(ev) || []) { try { fn(data); } catch (e) { console.error(ev, e); } } },
    myLoc: null, // last real GPS fix (only after the user asked for location)
    origin() { if (ctx.myLoc) return { lat: ctx.myLoc.lat, lng: ctx.myLoc.lng, label: ctx.t('your_location'), real: true }; const c = map.getCenter(); return { lat: c.lat, lng: c.lng, label: ctx.t('map_centre'), real: false }; },
    openShop: onShop,
  };
  hydrateIcons();
  // v0.4 low-bandwidth mode: auto from navigator.connection (Save-Data / 2G / 3G) or manual (Settings, Layers).
  // v0.6 device tier (low/mid/high from deviceMemory, CPU cores, connection; manual override in Settings).
  const tierState = { manual: store.getItem('bm-tier') || 'auto' };
  tierState.policy = resolveTier(readDeviceSignals(), tierState.manual);
  const bw = { manual: store.getItem('bm-lowbw') || 'auto' };
  const bwEffective = () => { const m = bandwidthManualFor(tierState.policy, bw.manual); return m === 'on' && bw.manual !== 'on' ? 'tier' : m; };
  bw.policy = bandwidthPolicy(readConnection(), bwEffective());
  ctx.bw = {
    get policy() { return bw.policy; }, get manual() { return bw.manual; },
    set(manual) { bw.manual = manual; store.setItem('bm-lowbw', manual); this.refresh(); },
    refresh() {
      const prev = bw.policy.active; bw.policy = bandwidthPolicy(readConnection(), bwEffective());
      // Apply even while tiles are loading: map.loaded()/isStyleLoaded() are false then, and skipping left the
      // zoom cap stuck at 16 after turning low-bandwidth off (CI run 11, 'low-bandwidth toggle … restored').
      ctx.style?.applyBandwidth(bw.policy);
      document.documentElement.classList.toggle('low-bw', bw.policy.active);
      if (bw.policy.active !== prev) { ctx.emit('bandwidth', bw.policy); if (bw.policy.active && bw.policy.reason !== 'manual') ctx.toast(ctx.t('low_bw_auto')); }
    },
  };
  ctx.tier = {
    get policy() { return tierState.policy; }, get manual() { return tierState.manual; },
    set(manual) {
      tierState.manual = manual; store.setItem('bm-tier', manual);
      tierState.policy = resolveTier(readDeviceSignals(), manual);
      ctx.style?.applyTier(tierState.policy);
      document.documentElement.dataset.tier = tierState.policy.tier;
      ctx.bw.refresh(); ctx.emit('tier', tierState.policy);
    },
  };
  document.documentElement.dataset.tier = tierState.policy.tier;
  navigator.connection?.addEventListener?.('change', () => ctx.bw.refresh());
  // v0.4 downloadable offline regions (Cache Storage) and background navigation (Android foreground service).
  const regionsBase = () => (window.__MAPOS_CONFIG__?.regionsBase || serverBase() || '').replace(/\/$/, '');
  ctx.regions = createRegionManager({ storage: store, base: '' });
  ctx.regionsBase = regionsBase;
  ctx.bg = createBackgroundNav(ctx);
  ctx.perm = initPermissions(ctx);
  setRationaleGate((kind) => ctx.perm.ensure(kind));
  ctx.locateOnce = async () => {
    if (!(await ctx.perm.ensure('location'))) return null;
    try { const p = await currentPosition(); ctx.myLoc = { ...p, ts: Date.now() }; ctx.controls.showPuck(ctx.myLoc); ctx.emit('location', ctx.myLoc); return ctx.myLoc; }
    catch (e) { if (e.code === 'denied') ctx.perm.denied('location'); else ctx.toast(ctx.t('gps_wait')); return null; }
  };
  ctx.sheet = createSheet(ctx);
  ctx.views = createViews(ctx);
  ctx.cam = createCamera(ctx);
  ctx.style = createMapStyle(ctx);
  ctx.controls = initControls(ctx);
  ctx.saved = initSaved(ctx);
  ctx.place = initPlace(ctx);
  ctx.search = initSearch(ctx);
  ctx.directions = initDirections(ctx);
  ctx.nav = initNavigation(ctx);
  ctx.panels = initPanels(ctx);
  ctx.report = initReport(ctx);
  ctx.privacy = initPrivacy(ctx);
  ctx.links = initLinks(ctx);
  ctx.linkout = initLinkout(ctx);
  ctx.services = initServicePanel(ctx);
  ctx.payment = initPayment(ctx, { onTrack: (id) => ctx.emit('track-order', id), onCancelled: (id) => ctx.emit('order-cancelled', id) });
  ctx.ondc = initOndc(ctx);
  ctx.traffic = initTraffic(ctx);
  ctx.tracks = initTracks(ctx);
  ctx.osmEdit = initOsmEdit(ctx);
  ctx.mapHealth = initMapHealth(ctx, { webgl: window.__BM_WEBGL__ !== false });
  ctx.voiceSearch = initVoiceSearch(ctx, { onText: (text) => { document.getElementById('q').value = text; ctx.search.submit(text); } });
  // Navigation map style preference (auto by sunrise/sunset, or forced day/night).
  document.querySelectorAll('[name=navstyle]').forEach((r) => {
    r.checked = r.value === (store.getItem('bm-nav-style') || 'auto');
    r.addEventListener('change', () => { store.setItem('bm-nav-style', r.value); if (ctx.nav.active) ctx.nav.applyNavTheme(); });
  });
  map.on('style.load', () => { ctx.style.applyTier(ctx.tier.policy); ctx.style.applyBandwidth(ctx.bw.policy); });
  if (map.isStyleLoaded()) ctx.style.applyTier(ctx.tier.policy);
  document.documentElement.classList.toggle('low-bw', ctx.bw.policy.active);

  // Theme: auto via prefers-color-scheme, or manual (Settings). boot-theme.js applied it before paint.
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  ctx.applyTheme = (pref = store.getItem('bm-theme') || 'auto') => {
    store.setItem('bm-theme', pref);
    const dark = pref === 'dark' || (pref === 'auto' && mq?.matches);
    const before = ctx.theme();
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0F1117' : '#2F3A8F');
    if (before !== ctx.theme()) { ctx.emit('theme', ctx.theme()); ctx.style.themeChanged(); }
  };
  mq?.addEventListener?.('change', () => ctx.applyTheme());

  // Android back: close nav overlays → previous sheet view → collapse sheet → exit.
  onBackButton(() => {
    if (ctx.nav.active) { ctx.nav.end(); return true; }
    if (document.querySelector('dialog[open]')) { document.querySelector('dialog[open]').close(); return true; }
    if (ctx.views.back()) return true;
    if (ctx.sheet.detent !== 'peek') { ctx.sheet.set('peek'); return true; }
    return false;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]') && !ctx.nav.active && document.activeElement?.id !== 'q') ctx.views.back();
  });

  ctx.applyI18n = () => {
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = ctx.t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', ctx.t(el.dataset.i18nAria));
    for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = ctx.t(el.dataset.i18nPh);
    ctx.emit('lang', state.lang);
  };
  // Test/debug hook (no secrets; used by E2E to observe navigation state).
  window.__bm = { ctx };
  return ctx;
}
