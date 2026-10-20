// v0.8 "My tracks" (CoMaps-inspired; original code): record a GPS track while the app is open, keep tracks on this
// device, draw one on the map, export GPX/KML, and import GPX/KML files (waypoints → a new saved list, tracks → here).
// Recording is foreground-only: it uses the same position watch as "show my location" and keeps the screen awake
// (Screen Wake Lock API where available). Screen-off recording is not offered yet (see docs/re/COMAPS_TEARDOWN.md).
import { store } from '../shared/storage.js';
import { watchPosition } from '../native.js';
import { createTrack, addFix, pauseTrack, resumeTrack, stopTrack, trackStats, trackToGeoJSON, trackToDoc, trackFromImport, normalizeTracks } from '../lib/track-model.js';
import { toGPX, toKML, parseGeoFile, docToListItems, safeFileName, GEO_MIME } from '../shared/geoformats.js';
import { exportTextFile, pickTextFile } from '../lib/file-io.js';
import { formatDistance } from '../nav/maneuver.js';
import { icon, hydrateIcons } from './icons.js';
import { esc } from './search.js';

const KEY = 'bm-tracks-v1', RKEY = 'bm-track-rec-v1';
const EMPTY = { type: 'FeatureCollection', features: [] };
const read = (k, d) => { try { return JSON.parse(store.getItem(k)) ?? d; } catch { return d; } };

export function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function initTracks(ctx) {
  const { map } = ctx;
  const $ = (id) => document.getElementById(id);
  let list = normalizeTracks(read(KEY, []));
  // A recording interrupted by an app restart comes back paused (the position watch did not survive).
  let rec = (() => { const r = read(RKEY, null); return r && !r.ended_ms && Array.isArray(r.segments) ? { ...r, paused: true } : null; })();
  let stopWatch = null, wake = null, tick = null, shown = null, lastSave = 0, gpsWaiting = false;

  const saveList = () => store.setItem(KEY, JSON.stringify(list));
  const saveRec = (force = false) => { if (!force && Date.now() - lastSave < 5000) return; lastSave = Date.now(); if (rec) store.setItem(RKEY, JSON.stringify(rec)); else store.removeItem(RKEY); };

  // ---- map layer (re-added after every style swap) ----
  function ensureLayer() {
    if (!map.getSource('bm-track')) map.addSource('bm-track', { type: 'geojson', data: EMPTY });
    if (!map.getLayer('bm-track')) {
      const before = map.getLayer('bm-pois') ? 'bm-pois' : undefined;
      map.addLayer({ id: 'bm-track-casing', type: 'line', source: 'bm-track', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.9 } }, before);
      map.addLayer({ id: 'bm-track', type: 'line', source: 'bm-track', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#C2410C', 'line-width': 4.5 } }, before);
    }
    draw();
  }
  function draw() {
    const t = rec || list.find((x) => x.id === shown);
    map.getSource('bm-track')?.setData(t ? trackToGeoJSON(t) : EMPTY);
  }
  ctx.on('overlays', () => { try { ensureLayer(); } catch { /* style mid-swap */ } });
  if (map.isStyleLoaded()) { try { ensureLayer(); } catch { /* later */ } }

  // ---- recorder ----
  function render() {
    const st = !rec ? 'idle' : rec.paused ? 'paused' : 'recording';
    const el = $('trackState'); el.dataset.state = st;
    el.textContent = st === 'recording' && gpsWaiting ? ctx.t('track_gps_wait') : ctx.t(`track_${st}`);
    const s = rec ? trackStats(rec) : null;
    $('trackStats').innerHTML = s ? `<dt>${esc(ctx.t('track_dist'))}</dt><dd data-stat="distance">${esc(formatDistance(s.distance_m))}</dd><dt>${esc(ctx.t('track_time'))}</dt><dd data-stat="time">${esc(fmtDuration(s.duration_ms))}</dd><dt>${esc(ctx.t('track_points'))}</dt><dd data-stat="points">${s.points}</dd><dt>${esc(ctx.t('track_avg'))}</dt><dd>${(s.avg_speed_mps * 3.6).toFixed(1)} km/h</dd>` : '';
    $('trackStart').hidden = !!rec;
    $('trackPause').hidden = $('trackStop').hidden = !rec;
    $('trackPause').innerHTML = rec ? `${icon(rec.paused ? 'record' : 'pause')} <span>${esc(ctx.t(rec.paused ? 'track_resume' : 'track_pause'))}</span>` : '';
    renderList();
  }
  function renderList() {
    $('trackList').innerHTML = list.length ? list.map((t) => {
      const s = trackStats(t);
      const when = new Date(t.started_ms).toLocaleString(ctx.lang?.() === 'en' ? 'en-IN' : ctx.lang?.(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
      return `<li class="row-split" data-track="${esc(t.id)}"><button class="row-btn" data-show="${esc(t.id)}" aria-pressed="${shown === t.id}">${icon('track', { size: 20 })}<span class="row-txt"><b>${esc(t.name || when)}</b><small>${esc([when, formatDistance(s.distance_m), fmtDuration(s.duration_ms)].join(' · '))}</small></span></button>`
        + `<span class="track-actions"><button class="btn sm ghost" data-gpx="${esc(t.id)}">GPX</button><button class="btn sm ghost" data-kml="${esc(t.id)}">KML</button><button class="icon-btn sm" data-tdel="${esc(t.id)}" aria-label="${esc(ctx.t('track_delete'))}: ${esc(t.name || when)}">${icon('trash', { size: 18 })}</button></span></li>`;
    }).join('') : `<li class="muted">${esc(ctx.t('track_none'))}</li>`;
  }

  async function startWatching() {
    if (stopWatch) return true;
    if (ctx.perm && !(await ctx.perm.ensure('location'))) { ctx.toast(ctx.t('track_denied')); return false; }
    gpsWaiting = true;
    stopWatch = await watchPosition((fix) => {
      ctx.myLoc = fix; ctx.emit('location', fix);
      if (!rec || rec.paused) return;
      const r = addFix(rec, fix);
      gpsWaiting = r.reason === 'inaccurate' && !rec.segments.some((s) => s.length);
      if (r.added) { rec = r.track; draw(); saveRec(); ctx.emit('track-point', { points: trackStats(rec).points }); }
      if (ctx.views.current === 'tracks') render();
    }, (e) => {
      if (e.code === 'denied') { ctx.perm?.denied?.('location'); ctx.toast(ctx.t('track_denied')); pause(); } else ctx.toast(ctx.t('gps_wait'));
    });
    try { wake = await navigator.wakeLock?.request('screen'); } catch { wake = null; }
    clearInterval(tick); tick = setInterval(() => { if (ctx.views.current === 'tracks') render(); }, 1000);
    return true;
  }
  function stopWatching() {
    stopWatch?.(); stopWatch = null; clearInterval(tick); tick = null; gpsWaiting = false;
    wake?.release?.().catch(() => {}); wake = null;
  }
  async function start() {
    if (rec) return;
    shown = null;
    rec = createTrack({ name: '' });
    saveRec(true); render(); draw();
    if (!(await startWatching())) { rec = null; saveRec(true); render(); draw(); return; }
    ctx.emit('track-start', { id: rec.id });
  }
  function pause() { if (!rec) return; rec = pauseTrack(rec); stopWatching(); saveRec(true); render(); }
  async function resume() { if (!rec) return; rec = resumeTrack(rec); saveRec(true); render(); await startWatching(); }
  function stop() {
    if (!rec) return;
    stopWatching();
    const t = stopTrack(rec); rec = null; saveRec(true);
    if (trackStats(t).points < 2) { ctx.toast(ctx.t('track_too_short')); render(); draw(); return null; }
    t.name = ctx.tf('track_default_name', { date: new Date(t.started_ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) });
    list = normalizeTracks([t, ...list]); saveList();
    shown = t.id; render(); draw();
    ctx.toast(ctx.tf('track_saved', { d: formatDistance(trackStats(t).distance_m) }));
    ctx.emit('track-saved', { id: t.id });
    return t;
  }
  $('trackStart').addEventListener('click', () => start());
  $('trackPause').addEventListener('click', () => (rec?.paused ? resume() : pause()));
  $('trackStop').addEventListener('click', () => stop());

  // ---- list actions ----
  function fit(t) {
    const pts = t.segments.flat(); if (!pts.length) return;
    let w = 180, s = 90, e = -180, n = -90;
    for (const p of pts) { w = Math.min(w, p.lng); e = Math.max(e, p.lng); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
    try { map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 17, duration: 600 }); } catch { /* ignore */ }
  }
  async function exportTrack(t, fmt) {
    const doc = trackToDoc(t); const file = safeFileName(t.name || 'track', fmt);
    const r = await exportTextFile(file, GEO_MIME[fmt], fmt === 'gpx' ? toGPX(doc) : toKML(doc), { title: t.name });
    ctx.emit('exported', { file, format: fmt, kind: 'track' });
    if (r === 'downloaded') ctx.toast(ctx.tf('exported', { file }));
  }
  $('trackList').addEventListener('click', (e) => {
    const find = (id) => list.find((x) => x.id === id);
    const sh = e.target.closest('[data-show]'); if (sh) { const t = find(sh.dataset.show); if (!t) return; shown = shown === t.id ? null : t.id; draw(); renderList(); if (shown) fit(t); return; }
    const g = e.target.closest('[data-gpx]'); if (g) { exportTrack(find(g.dataset.gpx), 'gpx').catch((x) => ctx.toast(x.message)); return; }
    const k = e.target.closest('[data-kml]'); if (k) { exportTrack(find(k.dataset.kml), 'kml').catch((x) => ctx.toast(x.message)); return; }
    const d = e.target.closest('[data-tdel]'); if (d) { list = list.filter((x) => x.id !== d.dataset.tdel); if (shown === d.dataset.tdel) shown = null; saveList(); draw(); renderList(); }
  });

  // ---- import (shared with the Saved section's "Import GPX / KML") ----
  /** Import parsed file text. Returns { places, tracks, listId, warnings }. Exposed for tests and the file picker. */
  function importText(text, filename) {
    let doc;
    try { doc = parseGeoFile(text, filename); } catch (e) { const err = new Error(e.message); err.code = e.message; throw err; }
    let listId = null;
    const items = docToListItems(doc);
    if (items.length) listId = ctx.saved.importList({ name: doc.name || filename.replace(/\.[^.]+$/, '') || 'Imported', items });
    const imported = doc.tracks.map((t) => ({ ...trackFromImport(t), name: (t.name || doc.name || filename.replace(/\.[^.]+$/, '')).slice(0, 80) }));
    if (imported.length) { list = normalizeTracks([...imported, ...list]); saveList(); shown = imported[0].id; draw(); }
    render();
    const res = { places: items.length, tracks: imported.length, listId, warnings: doc.warnings, name: doc.name };
    ctx.emit('imported', res);
    return res;
  }
  async function importFile() {
    let f;
    try { f = await pickTextFile(); } catch (e) { ctx.toast(ctx.t(`import_err_${e.message}`)); return null; }
    if (!f) return null;
    try {
      const r = importText(f.text, f.name);
      ctx.toast(ctx.tf('import_done', { places: r.places, tracks: r.tracks }) + (r.warnings.some((w) => /truncated/.test(w)) ? ` · ${ctx.t('import_warn_truncated')}` : ''));
      if (r.listId) ctx.saved.openList(r.listId);
      else if (r.tracks) { ctx.views.show('tracks', { detent: 'half' }); const t = list.find((x) => x.id === shown); if (t) fit(t); }
      return r;
    } catch (e) { ctx.toast(ctx.t(`import_err_${e.code || 'bad_xml'}`)); return null; }
  }
  $('trackImport').addEventListener('click', () => importFile());
  $('openTracks').addEventListener('click', () => { ctx.views.show('tracks', { detent: 'half' }); render(); });
  ctx.on('lang', () => { if (ctx.views.current === 'tracks') render(); });
  hydrateIcons($('trackRec'));
  render();

  return {
    start, pause, resume, stop, importFile, importText,
    get recording() { return rec; }, get tracks() { return list; },
    show(id) { shown = id; draw(); renderList(); const t = list.find((x) => x.id === id); if (t) fit(t); },
  };
}
