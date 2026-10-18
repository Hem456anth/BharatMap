// Layers sheet (style, 3D buildings, transit lines, OSM POI overlays, disabled live-traffic row),
// Offline maps screen (bundled PMTiles regions) and Settings (theme, language, city, voice, privacy).
import { fetchPois } from '../services/overpass.js';
import { offlineRegions } from '../offline-map.js';
import { store } from '../shared/storage.js';
import { icon } from './icons.js';
import { esc, serviceError } from './search.js';

const OVERLAYS = [['ev', '#1E8E5A'], ['parking', '#2F3A8F'], ['fuel', '#C2410C']];

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
      ${sw('lyrOffline', 'offline_always', st.forceOffline, st.offline ? ctx.t('offline_using') : '')}`;
    $('layersBody').querySelectorAll('[name=mapstyle]').forEach((r) => { r.onchange = () => st.setPref(r.value); });
    $('lyr3d').onchange = (e) => st.set3D(e.target.checked);
    $('lyrTransit').onchange = (e) => st.setTransit(e.target.checked);
    $('lyrOffline').onchange = (e) => st.setForceOffline(e.target.checked);
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
        overlayData[key] = overlayData[key] || (await fetchPois(id, center, null, { limit: 80 })).items;
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
        <label class="switch"><input type="checkbox" id="offAlways" ${ctx.style.forceOffline ? 'checked' : ''}/><span><b>${esc(ctx.t('offline_always'))}</b><small>${esc(ctx.style.offline ? ctx.t('offline_using') : '')}</small></span></label>
        <p class="small muted">${esc(meta.source)} · ${esc(meta.attribution)}</p>`;
      $('offlineBody').querySelectorAll('[data-region]').forEach((b) => { b.onclick = () => { const r = meta.regions[b.dataset.region]; if (ctx.state.city !== b.dataset.region) { $('city').value = b.dataset.region; $('city').dispatchEvent(new Event('change')); } ctx.cam.fit([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]], { maxZoom: 13 }); }; });
      $('offAlways').onchange = (e) => { ctx.style.setForceOffline(e.target.checked); };
      $('offlineSummary').textContent = Object.values(meta.regions).map((r) => r.name).join(' · ');
    } catch (e) { $('offlineBody').textContent = e.message; }
  }

  // ---------- Settings ----------
  function renderSettings() {
    const pref = store.getItem('bm-theme') || 'auto';
    document.querySelectorAll('[name=theme]').forEach((r) => { r.checked = r.value === pref; });
    $('voiceDefault').checked = !ctx.nav.voice.muted;
    $('aboutLine').textContent = `Bharat Map · ${ctx.tf('version', { v: '0.3' })} · ${ctx.t('osm_credit')}`;
  }
  document.querySelectorAll('[name=theme]').forEach((r) => r.addEventListener('change', () => ctx.applyTheme(r.value)));
  $('voiceDefault').addEventListener('change', (e) => ctx.nav.voice.setMuted(!e.target.checked));
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
