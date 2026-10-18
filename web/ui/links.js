// Deep links, list sharing and live location sharing (v0.5).
//  - Incoming: geo: URIs, bharatmap://place|directions|search|list|live and the web app's ?lat=&lon=, ?list=, ?live=
//    query (Android: intent filters + Capacitor App plugin getLaunchUrl / appUrlOpen).
//  - Share a favourites list as a link (the list travels inside the link; no server).
//  - Live location sharing through the Bharat Map server (/api/v1/live): time-limited, secret-protected updates,
//    viewers poll. Only available when a backend is configured; stops when the time runs out or the user stops it.
import { parseDeepLink, buildListLink } from '../shared/deeplink.js';
import { isNative, shareLink, watchPosition } from '../native.js';
import { serverBase, useServer, v1 } from '../services/server.js';
import { store } from '../shared/storage.js';

export function initLinks(ctx) {
  const { map, maplibregl } = ctx;
  const $ = (id) => document.getElementById(id);
  const handled = [];

  async function handle(url) {
    const d = parseDeepLink(url);
    handled.push({ url, kind: d?.kind || null }); ctx.emit('deeplink', { url, link: d });
    if (!d) return false;
    if ((d.kind === 'place' || d.kind === 'directions') && d.inIndia === false) ctx.toast(ctx.t('link_outside_india'));
    if (d.kind === 'place') { ctx.place.open({ id: `pin:${d.lat.toFixed(5)},${d.lng.toFixed(5)}`, name: d.name || '', lat: d.lat, lng: d.lng }); ctx.cam?.fly?.({ center: [d.lng, d.lat], zoom: d.zoom }); }
    else if (d.kind === 'directions') ctx.directions.open({ lat: d.to.lat, lng: d.to.lng, name: d.to.name }, { mode: d.mode });
    else if (d.kind === 'search') { $('q').value = d.query; ctx.search.submit(d.query); }
    else if (d.kind === 'list') {
      if (confirm(ctx.tf('list_import_q', { name: d.name, n: d.items.length }))) { const id = ctx.saved.importList(d); ctx.saved.openList(id); ctx.toast(ctx.tf('list_imported', { name: d.name })); }
    } else if (d.kind === 'live') watchLive(d.id);
    return true;
  }

  // Web: query string on load. Android: launch URL + appUrlOpen while running.
  const qs = location.search;
  if (/[?&](lat|list|live)=/.test(qs)) setTimeout(() => handle(location.href), 0);
  if (isNative()) {
    const A = window.Capacitor?.Plugins?.App;
    A?.getLaunchUrl?.().then((r) => { if (r?.url) handle(r.url); }).catch(() => {});
    A?.addListener?.('appUrlOpen', (e) => { if (e?.url) handle(e.url); });
  }

  // ---- share the open favourites list ----
  $('listShare').addEventListener('click', async () => {
    const l = ctx.saved.data.lists.find((x) => x.id === ctx.saved.openListId); if (!l) return;
    const name = l.id === 'favorites' ? ctx.t('favorites') : l.name;
    const links = buildListLink({ name, items: l.items }, { webBase: serverBase() || (location.protocol === 'https:' ? location.origin : '') });
    ctx.emit('list-share', links);
    const r = await shareLink({ title: name, text: `${name} · Bharat Map\n${links.app}`, url: links.web || links.app });
    if (r === 'copied') ctx.toast(ctx.t('copied'));
  });

  // ---- live location sharing (sender) ----
  const L = { share: null, stop: null, last: 0, timer: null };
  async function startLive() {
    if (!useServer()) { ctx.toast(ctx.t('live_needs_server')); return; }
    if (!(await ctx.perm.ensure('location'))) return;
    let share;
    try { share = await v1('/live', { method: 'POST', body: { name: ctx.state.user?.name || '', ttl_min: 60 }, ttl: 0 }); } catch (e) { ctx.toast(`${ctx.t('live_failed')} (${e.message})`); return; }
    L.share = share; store.setItem('bm-live-share', JSON.stringify({ id: share.id, expires_ms: share.expires_ms }));
    L.stop = await watchPosition((fix) => {
      if (Date.now() - L.last < 10_000) return; L.last = Date.now();
      v1(`/live/${share.id}`, { method: 'PUT', body: { secret: share.secret, lat: fix.lat, lng: fix.lng, heading: fix.heading }, ttl: 0 }).catch(() => {});
    }, (e) => { if (e.code === 'denied') ctx.perm.denied('location'); });
    L.timer = setTimeout(stopLive, Math.max(0, share.expires_ms - Date.now()));
    const base = serverBase();
    const link = /^https:/.test(base) ? `${base}/?live=${share.id}` : `bharatmap://live?id=${share.id}`;
    renderLiveBtn();
    ctx.emit('live', { id: share.id, link });
    await shareLink({ title: ctx.t('live_share'), text: ctx.tf('live_share_text', { t: new Date(share.expires_ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }), url: link });
  }
  async function stopLive() {
    clearTimeout(L.timer); L.stop?.(); L.stop = null;
    if (L.share) { v1(`/live/${L.share.id}`, { method: 'DELETE', body: { secret: L.share.secret }, ttl: 0 }).catch(() => {}); }
    L.share = null; store.removeItem('bm-live-share'); renderLiveBtn();
  }
  function renderLiveBtn() {
    const b = $('openLive'); if (!b) return;
    b.querySelector('[data-i18n]').textContent = L.share ? ctx.tf('live_stop', { t: new Date(L.share.expires_ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }) : ctx.t('live_share');
    b.classList.toggle('danger', !!L.share);
  }
  $('openLive').addEventListener('click', () => (L.share ? stopLive() : startLive()));

  // ---- live location (viewer) ----
  let viewer = null;
  function watchLive(id) {
    if (!useServer()) { ctx.toast(ctx.t('live_needs_server')); return; }
    viewer?.stop();
    let marker = null, first = true, t = null, stopped = false;
    const tick = async () => {
      try {
        const s = await v1(`/live/${encodeURIComponent(id)}`, { ttl: 0, timeout: 8000 });
        if (s.active) {
          const el = marker?.getElement() || Object.assign(document.createElement('div'), { className: 'live-mk' });
          el.textContent = s.name ? s.name.slice(0, 1).toUpperCase() : '•';
          el.title = `${s.name || ctx.t('live_someone')} · ${ctx.tf('live_updated', { s: Math.round((Date.now() - s.updated_ms) / 1000) })}`;
          if (!marker) marker = new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map); else marker.setLngLat([s.lng, s.lat]);
          if (first) { first = false; ctx.cam?.fly?.({ center: [s.lng, s.lat], zoom: 15 }); ctx.toast(ctx.tf('live_viewing', { name: s.name || ctx.t('live_someone') })); }
        }
        ctx.emit('live-view', s);
      } catch { if (!stopped) { ctx.toast(ctx.t('live_ended')); viewer?.stop(); return; } }
      if (!stopped) t = setTimeout(tick, 10_000);
    };
    viewer = { stop() { stopped = true; clearTimeout(t); marker?.remove(); } };
    tick();
  }
  return { handle, handled, startLive, stopLive, watchLive, get live() { return L.share; } };
}
