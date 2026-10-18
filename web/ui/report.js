// Report (v0.5): (1) "Report a map problem" → an anonymous OpenStreetMap note (wrong road, missing place, closed road,
// wrong name) that local mappers can fix, rate-limited on the device; (2) community road incidents (pothole,
// waterlogging, closure, police check) that expire after 2 hours, shown on the map as unverified community reports.
import { NOTE_CATEGORIES, INCIDENT_TYPES } from '../shared/community.js';
import { sendOsmNote, listIncidents, reportIncident, voteIncident, incidentsMode } from '../services/community.js';
import { esc } from './search.js';
import { icon } from './icons.js';

const INC_ICON = { pothole: 'alert', waterlogging: 'alert', closure: 'close', police: 'shield' };

export function initReport(ctx) {
  const { map, maplibregl } = ctx;
  const $ = (id) => document.getElementById(id);
  const dlg = $('reportDlg');
  let at = null, tab = 'osm', incType = null, popup = null;

  function render() {
    $('reportCats').innerHTML = `<legend>${esc(ctx.t('report_category'))}</legend>` + Object.keys(NOTE_CATEGORIES).map((c, i) => `<label class="radio"><input type="radio" name="rcat" value="${c}" ${i === 0 ? 'checked' : ''}/><span>${esc(ctx.t(`report_cat_${c}`))}</span></label>`).join('');
    $('incTypes').innerHTML = INCIDENT_TYPES.map((x) => `<button type="button" class="inc-type${incType === x ? ' on' : ''}" data-inc="${x}" aria-pressed="${incType === x}">${icon(INC_ICON[x], { size: 22 })}<span>${esc(ctx.t(`inc_${x}`))}</span></button>`).join('');
    $('incNote').textContent = ctx.t(incidentsMode() === 'server' ? 'inc_note_server' : 'inc_note_device');
    $('reportOsm').hidden = tab !== 'osm'; $('reportInc').hidden = tab !== 'incident';
    $('reportTabs').querySelectorAll('[data-rtab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rtab === tab)));
  }
  function open(point, { mode = 'osm' } = {}) {
    at = point; tab = mode; incType = null;
    $('reportText').value = ''; $('reportStatus').textContent = ''; $('reportSend').disabled = false;
    render(); dlg.showModal();
  }
  $('reportTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-rtab]'); if (b) { tab = b.dataset.rtab; render(); } });
  $('incTypes').addEventListener('click', (e) => { const b = e.target.closest('[data-inc]'); if (b) { incType = b.dataset.inc; render(); } });
  $('reportSend').addEventListener('click', async () => {
    const st = $('reportStatus');
    $('reportSend').disabled = true;
    try {
      if (tab === 'osm') {
        const category = dlg.querySelector('[name=rcat]:checked')?.value;
        const r = await sendOsmNote({ lat: at.lat, lng: at.lng, category, text: $('reportText').value });
        st.textContent = ctx.tf('report_sent', { id: r.id ?? '' });
        ctx.emit('osm-note', r);
        ctx.toast(ctx.tf('report_sent', { id: r.id ?? '' }));
        setTimeout(() => dlg.close(), 1200);
      } else {
        if (!incType) { st.textContent = ctx.t('inc_pick'); $('reportSend').disabled = false; return; }
        const r = await reportIncident({ type: incType, lat: at.lat, lng: at.lng });
        ctx.toast(ctx.t('inc_sent')); ctx.emit('incident', r);
        dlg.close(); refresh();
      }
    } catch (e) {
      const m = e.message;
      st.textContent = m === 'rate_limited' ? ctx.tf('report_wait', { m: Math.ceil((e.waitMs || 60000) / 60000) }) : m === 'text_too_short' ? ctx.t('report_too_short') : `${ctx.t('report_failed')} (${m})`;
      $('reportSend').disabled = false;
    }
  });

  // ---- incidents on the map ----
  let cur = [];
  async function refresh() {
    if (map.getZoom() < 11) { ctx.style.setIncidents(null); return; }
    const b = map.getBounds();
    try {
      cur = await listIncidents({ w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() });
      ctx.style.setIncidents({ type: 'FeatureCollection', features: cur.map((i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { id: i.id, type: i.type, confidence: i.confidence } })) });
    } catch { /* server unreachable: keep what we have */ }
  }
  let t; map.on('moveend', () => { clearTimeout(t); t = setTimeout(refresh, 700); });
  map.on('style.load', () => setTimeout(refresh, 300));
  setInterval(refresh, 60_000); // expire reports without user action
  map.on('click', 'bm-incidents', (e) => {
    const f = e.features?.[0]; const i = cur.find((x) => x.id === f?.properties?.id); if (!i) return;
    popup?.remove();
    const el = document.createElement('div'); el.className = 'inc-pop';
    el.innerHTML = `<b>${esc(ctx.t(`inc_${i.type}`))}</b><small>${esc(ctx.t('inc_label'))}</small><small>${esc(ctx.tf('inc_meta', { c: ctx.t(`conf_${i.confidence}`), m: i.minutes_left }))}${i.device_only ? ` · ${esc(ctx.t('inc_device_only'))}` : ''}</small>`
      + (i.device_only ? '' : `<div class="row"><button class="btn sm" data-vote="up">${esc(ctx.t('inc_still'))}</button><button class="btn sm ghost" data-vote="down">${esc(ctx.t('inc_gone'))}</button></div>`);
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-vote]'); if (!b) return;
      try { await voteIncident(i.id, b.dataset.vote); ctx.toast(ctx.t('inc_thanks')); } catch (err) { ctx.toast(/409/.test(err.message) ? ctx.t('inc_voted') : err.message); }
      popup?.remove(); refresh();
    });
    popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' }).setLngLat([i.lng, i.lat]).setDOMContent(el).addTo(map);
  });
  map.on('mouseenter', 'bm-incidents', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'bm-incidents', () => { map.getCanvas().style.cursor = ''; });
  return { open, refresh, get incidents() { return cur; } };
}
