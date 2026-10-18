// Layers sheet (style, 3D buildings, transit lines, OSM POI overlays, disabled live-traffic row),
// Offline maps screen (bundled PMTiles regions) and Settings (theme, language, city, voice, privacy).
import { fetchPois } from '../services/overpass.js';
import { offlineRegions } from '../offline-map.js';
import { store } from '../shared/storage.js';
import { icon } from './icons.js';
import { esc, serviceError } from './search.js';
import { fetchJSON } from '../services/net.js';

const OVERLAYS = [['ev', '#1E8E5A'], ['parking', '#2F3A8F'], ['fuel', '#C2410C'], ['rail', '#7A3FB0'], ['airport', '#0E7490']];

export function initPanels(ctx) {
  const { map } = ctx;
  const $ = (id) => document.getElementById(id);
  const on = new Set((store.getItem('bm-overlays') || '').split(',').filter(Boolean));
  let overlayData = {};

  // ---------- Layers ----------
  function renderLayers() {
    const st = ctx.style;
    const radio = (v, k) => `<label><input type="radio" name="mapstyle" value="${v}" ${st.pref === v ? 'checked' : ''}/><span>${esc(ctx.t(k))}</span></label>`;
    const sw = (id, k, checked, note = '', disabled = false) => `<label class="switch${disabled ? ' disabled' : ''}"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled aria-disabled="true"' : ''}/><span><b>${esc(ctx.t(k))}</b>${note ? `<small>${esc(note)}</small>` : ''}</span></label>`;
    $('layersBody').innerHTML = `
      <fieldset class="seg-field"><legend>${esc(ctx.t('map_style'))}</legend><div class="seg" role="radiogroup">${radio('auto', 'style_auto')}${radio('standard', 'style_standard')}${radio('dark', 'style_dark')}</div></fieldset>
      <p class="small muted">${esc(ctx.t('satellite_note'))}</p>
      ${sw('lyr3d', 'buildings_3d', st.buildings3d, ctx.t('buildings_note'))}
      ${sw('lyrTransit', 'transit_lines', st.transit, 'OpenStreetMap railway=rail/subway')}
      <h4>${esc(ctx.t('overlays'))}</h4>
      ${OVERLAYS.map(([id, color]) => `<label class="switch"><input type="checkbox" data-ov="${id}" ${on.has(id) ? 'checked' : ''}/><span><b><i class="swatch" style="background:${color}"></i>${esc(ctx.t(`cat_${id}`))}</b><small>Overpass · OpenStreetMap</small></span></label>`).join('')}
      <p id="ovStatus" class="small muted" role="status"></p>
      ${sw('lyrTraffic', 'traffic', false, ctx.t('traffic_note'), true)}
      ${sw('lyrLowBw', 'low_bw', ctx.bw.policy.active, ctx.bw.policy.active && ctx.bw.policy.reason !== 'manual' ? ctx.t('low_bw_auto') : ctx.t('low_bw_note'))}
      ${sw('lyrOffline', 'offline_always', st.forceOffline, st.offline ? ctx.t('offline_using') : '')}`;
    $('layersBody').querySelectorAll('[name=mapstyle]').forEach((r) => { r.onchange = () => st.setPref(r.value); });
    $('lyr3d').onchange = (e) => st.set3D(e.target.checked);
    $('lyrTransit').onchange = (e) => st.setTransit(e.target.checked);
    $('lyrOffline').onchange = (e) => st.setForceOffline(e.target.checked);
    $('lyrLowBw').onchange = (e) => { ctx.bw.set(e.target.checked ? 'on' : 'off'); renderLayers(); };
    if (ctx.bw.policy.active) { const b = $('lyr3d'); b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    $('layersBody').querySelectorAll('[data-ov]').forEach((c) => { c.onchange = () => { if (c.checked) on.add(c.dataset.ov); else on.delete(c.dataset.ov); store.setItem('bm-overlays', [...on].join(',')); refreshOverlays(); }; });
  }
  async function refreshOverlays() {
    const c = map.getCenter(); const center = { lat: c.lat, lng: c.lng };
    const status = $('ovStatus');
    const feats = [];
    for (const [id, color] of OVERLAYS) {
      if (!on.has(id)) continue;
      try {
        const key = `${id}:${center.lat.toFixed(2)},${center.lng.toFixed(2)}`;
        overlayData[key] = overlayData[key] || (await fetchPois(id, center, null, { limit: ctx.bw.policy.active ? 30 : 80, maxKm: ctx.bw.policy.overpassMaxKm })).items;
        for (const p of overlayData[key]) feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { color, id: p.id, cat: id, name: p.name } });
      } catch (e) { if (status) status.textContent = serviceError(ctx, e, 'Overpass'); }
    }
    ctx.style.setPois({ type: 'FeatureCollection', features: feats });
    if (status && feats.length) status.textContent = ctx.tf('places_n', { n: feats.length });
  }
  map.on('click', 'bm-pois', (e) => {
    const f = e.features?.[0]; if (!f?.properties?.id) return;
    for (const list of Object.values(overlayData)) { const p = list.find((x) => x.id === f.properties.id); if (p) { ctx.place.open({ ...p, category: f.properties.cat }); return; } }
  });
  map.on('mouseenter', 'bm-pois', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'bm-pois', () => { map.getCanvas().style.cursor = ''; });
  let ovT; map.on('moveend', () => { if (!on.size) return; clearTimeout(ovT); ovT = setTimeout(refreshOverlays, 900); });
  if (on.size) map.once('load', refreshOverlays);

  // ---------- Offline maps ----------
  async function renderOffline() {
    try {
      const meta = await offlineRegions();
      const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
      $('offlineBody').innerHTML = `<p class="muted">${esc(ctx.t('offline_desc'))}</p>
        <ul class="rows">${Object.entries(meta.regions).map(([id, r]) => `<li class="row-split"><span class="row-btn static">${icon('download', { size: 20 })}<span class="row-txt"><b>${esc(r.name)}</b><small>${esc(ctx.t('bundled'))} · ${mb(r.size_bytes || 0)} · ${esc(ctx.tf('zoom_upto', { z: r.maxzoom }))}</small></span></span><button class="btn" data-region="${id}">${esc(ctx.t('view_region'))}</button></li>`).join('')}</ul>
        <h4>${esc(ctx.t('dl_regions'))}</h4><ul class="rows" id="dlList"><li class="muted">${esc(ctx.t('loading'))}</li></ul>
        <label class="switch"><input type="checkbox" id="offAlways" ${ctx.style.forceOffline ? 'checked' : ''}/><span><b>${esc(ctx.t('offline_always'))}</b><small>${esc(ctx.style.offline ? ctx.t('offline_using') : '')}</small></span></label>
        <p class="small muted">${esc(meta.source)} · ${esc(meta.attribution)}</p>`;
      $('offlineBody').querySelectorAll('[data-region]').forEach((b) => { b.onclick = () => { const r = meta.regions[b.dataset.region]; if (ctx.state.city !== b.dataset.region) { $('city').value = b.dataset.region; $('city').dispatchEvent(new Event('change')); } ctx.cam.fit([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]], { maxZoom: 13 }); }; });
      $('offAlways').onchange = (e) => { ctx.style.setForceOffline(e.target.checked); };
      renderDownloads();
      $('offlineSummary').textContent = Object.values(meta.regions).map((r) => r.name).join(' · ');
    } catch (e) { $('offlineBody').textContent = e.message; }
  }

  // ---------- Downloadable regions (v0.4) ----------
  const progress = new Map(); // id -> fraction
  let catalog = null;
  async function loadCatalog() {
    const api = ctx.apiBase ? ctx.apiBase() : '';
    if (!ctx.state.demo) {
      try { const c = await fetchJSON(`${api}/api/v1/regions`, { ttl: 0, timeout: 8000 }); return { ...c, hosted: true, base: api }; } catch { /* fall through */ }
    }
    const c = await fetchJSON('offline/catalog.json', { ttl: 0 });
    const base = ctx.regionsBase();
    return { ...c, hosted: !!base, base, regions: c.regions.map((r) => ({ ...r, available: !!base, url: base ? `/regions/${r.id}.pmtiles` : null })) };
  }
  async function renderDownloads() {
    const ul = $('dlList'); if (!ul) return;
    try { catalog = await loadCatalog(); } catch (e) { ul.innerHTML = `<li class="muted">${esc(e.message)}</li>`; return; }
    const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
    ul.innerHTML = catalog.regions.map((r) => {
      const done = ctx.regions.isDownloaded(r.id); const p = progress.get(r.id);
      const sub = done ? `${ctx.t('dl_downloaded')} · ${mb(ctx.regions.list().find((x) => x.id === r.id)?.bytes || 0)}`
        : p != null ? ctx.tf('dl_progress', { p: Math.round(p * 100) })
          : r.available ? (r.size_bytes ? mb(r.size_bytes) : ctx.tf('dl_size_est', { mb: r.est_mb })) : `${ctx.tf('dl_size_est', { mb: r.est_mb })} · ${catalog.hosted ? ctx.t('dl_not_hosted') : ctx.t('dl_needs_server')}`;
      const btn = done ? `<button class="btn" data-dl-del="${r.id}">${esc(ctx.t('dl_delete'))}</button>`
        : p != null ? `<button class="btn" data-dl-cancel="${r.id}">${esc(ctx.t('dl_cancel'))}</button>`
          : `<button class="btn primary" data-dl="${r.id}" ${r.available ? '' : 'disabled aria-disabled="true"'}>${esc(ctx.t('dl_download'))}</button>`;
      return `<li class="row-split" data-region-row="${r.id}"><span class="row-btn static">${icon('download', { size: 20 })}<span class="row-txt"><b>${esc(r.name)}</b><small>${esc(r.state || '')} · <span class="dl-sub">${esc(sub)}</span></small>${p != null ? `<progress max="1" value="${p || 0}" aria-label="${esc(r.name)}"></progress>` : ''}</span></span>${btn}</li>`;
    }).join('');
    ul.onclick = async (e) => {
      const d = e.target.closest('[data-dl]'), c = e.target.closest('[data-dl-cancel]'), x = e.target.closest('[data-dl-del]');
      if (c) { ctx.regions.cancel(c.dataset.dlCancel); return; }
      if (x) { await ctx.regions.remove(x.dataset.dlDel); ctx.toast(ctx.t('dl_deleted')); renderDownloads(); return; }
      if (!d) return;
      const r = catalog.regions.find((y) => y.id === d.dataset.dl);
      const reg = { ...r, url: r.url && !/^https?:/.test(r.url) ? `${catalog.base || ''}${r.url}` : r.url };
      progress.set(r.id, 0); renderDownloads();
      let last = 0;
      try {
        await ctx.regions.download(reg, { onProgress: ({ fraction }) => { progress.set(r.id, fraction ?? 0); const now = performance.now(); if (now - last > 150) { last = now; const row = document.querySelector(`[data-region-row="${r.id}"]`); if (row) { row.querySelector('progress')?.setAttribute('value', String(fraction ?? 0)); row.querySelector('.dl-sub').textContent = ctx.tf('dl_progress', { p: Math.round((fraction ?? 0) * 100) }); } } } });
        progress.delete(r.id); ctx.toast(`${r.name}: ${ctx.t('dl_downloaded')}`);
      } catch (err) { progress.delete(r.id); ctx.toast(err.message === 'cancelled' ? ctx.t('dl_cancelled') : `${ctx.t('dl_failed')}: ${err.message}`); }
      renderDownloads();
    };
  }

  // ---------- Settings ----------
  function renderSettings() {
    const pref = store.getItem('bm-theme') || 'auto';
    document.querySelectorAll('[name=theme]').forEach((r) => { r.checked = r.value === pref; });
    $('voiceDefault').checked = !ctx.nav.voice.muted;
    $('lowBwSet').checked = ctx.bw.policy.active;
    $('lowBwNote').textContent = ctx.bw.policy.active && ctx.bw.policy.reason !== 'manual' ? ctx.t('low_bw_auto') : ctx.t('low_bw_note');
    $('bgNavSet').checked = ctx.bg.enabled();
    $('bgNavSet').closest('label').hidden = !ctx.bg.supported();
    $('bgAlways').hidden = $('bgAlwaysNote').hidden = !ctx.bg.supported();
    $('aboutLine').textContent = `Bharat Map · ${ctx.tf('version', { v: '0.5' })} · ${ctx.t('osm_credit')} · Contains data provided by Hyderabad Metro Rail Ltd.`;
  }
  document.querySelectorAll('[name=theme]').forEach((r) => r.addEventListener('change', () => ctx.applyTheme(r.value)));
  $('voiceDefault').addEventListener('change', (e) => ctx.nav.voice.setMuted(!e.target.checked));
  $('lowBwSet').addEventListener('change', (e) => { ctx.bw.set(e.target.checked ? 'on' : 'off'); renderSettings(); });
  $('bgNavSet').addEventListener('change', (e) => { ctx.bg.setEnabled(e.target.checked); if (!e.target.checked) ctx.bg.stop(); });
  $('bgAlways').addEventListener('click', async () => { if (!(await ctx.perm.ensure('background'))) return; const r = await ctx.bg.requestAlways().catch((err) => err.message); ctx.toast(`${ctx.t('bg_allow_always')}: ${r}`); });
  ctx.on('bandwidth', () => { if (ctx.views.current === 'layers') renderLayers(); if (ctx.views.current === 'settings') renderSettings(); overlayData = {}; });
  $('clearHistory').addEventListener('click', () => { ctx.saved.clearRecents(); ctx.toast(ctx.t('history_cleared')); });
  $('openSettings').addEventListener('click', () => ctx.views.show('settings', { detent: 'full' }));
  $('menuBtn').addEventListener('click', () => ctx.views.show('settings', { detent: 'full' }));
  $('openOffline').addEventListener('click', () => ctx.views.show('offline', { detent: 'half' }));

  ctx.on('view', ({ name }) => { if (name === 'layers') renderLayers(); if (name === 'offline') renderOffline(); if (name === 'settings') renderSettings(); });
  ctx.on('mapstyle', ({ offline }) => {
    const chip = $('offlineChip'); chip.hidden = !offline; chip.textContent = offline ? ctx.t('offline_using') : '';
    if (ctx.views.current === 'layers') renderLayers();
    if (ctx.views.current === 'offline') renderOffline();
  });
  ctx.on('lang', () => { if (ctx.views.current === 'layers') renderLayers(); if (ctx.views.current === 'offline') renderOffline(); if (ctx.views.current === 'settings') renderSettings(); });
  renderOffline();
  return { refreshOverlays, renderSettings };
}
