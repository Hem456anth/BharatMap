// v0.8 "Suggest an edit" (CoMaps has a full OSM editor behind an OSM login; Bharat Map sends an anonymous, structured
// OpenStreetMap note instead — see shared/osm-edit.js). Fields are prefilled from the place's OSM tags; only changed
// values are sent, with the element link so a mapper can apply them.
import { EDIT_FIELDS, diffEdit, osmRef } from '../shared/osm-edit.js';
import { sendOsmEditSuggestion } from '../services/community.js';
import { esc } from './search.js';

export function initOsmEdit(ctx) {
  const $ = (id) => document.getElementById(id);
  const dlg = $('editDlg');
  let place = null;

  const inputId = (k) => `ef_${k.replace(':', '_')}`;
  function fields(tags) {
    return EDIT_FIELDS.map((f) => {
      const id = inputId(f.key), v = esc(tags[f.key] || '');
      const label = `<label for="${id}">${esc(ctx.t(`edit_field_${f.key}`))}</label>`;
      if (f.kind === 'enum') {
        return `${label}<select id="${id}" data-key="${f.key}"><option value="">${esc(ctx.t('edit_wc_unknown'))}</option>${f.values.map((x) => `<option value="${x}" ${tags[f.key] === x ? 'selected' : ''}>${esc(ctx.t(x === 'yes' ? 'wc_yes' : x === 'limited' ? 'wc_limited' : 'wc_no'))}</option>`).join('')}</select>`;
      }
      const type = f.kind === 'url' ? 'url' : f.kind === 'phone' ? 'tel' : 'text';
      const lang = f.key === 'name:te' ? ' lang="te"' : f.key === 'name:hi' ? ' lang="hi"' : '';
      return `${label}<input id="${id}" data-key="${f.key}" type="${type}" value="${v}" maxlength="${f.max || 255}" autocomplete="off"${lang} /><span class="err" id="${id}_err" hidden></span>`;
    }).join('');
  }
  const proposed = () => Object.fromEntries([...dlg.querySelectorAll('[data-key]')].map((el) => [el.dataset.key, el.value]));
  function preview() {
    const { changes, errors } = diffEdit(place.tags || {}, proposed());
    for (const f of EDIT_FIELDS) {
      const e = $(`${inputId(f.key)}_err`); if (!e) continue;
      e.hidden = !errors[f.key]; e.textContent = errors[f.key] ? ctx.t(`edit_err_${errors[f.key]}`) : '';
      $(inputId(f.key)).setAttribute('aria-invalid', String(!!errors[f.key]));
    }
    $('editPreview').textContent = changes.length ? `${ctx.t('edit_preview')}:\n${changes.map((c) => `• ${c.key}: ${c.from || '—'} → ${c.to || ctx.t('edit_remove')}`).join('\n')}` : '';
    return { changes, errors };
  }
  function open(p) {
    const ref = osmRef(p); if (!ref) return;
    place = { ...p, ...ref, tags: p.tags || {} };
    $('editPlace').textContent = `${p.name || ''} · openstreetmap.org/${ref.osm_type}/${ref.osm_id}`;
    $('editFields').innerHTML = fields(place.tags);
    $('editComment').value = ''; $('editStatus').textContent = ''; $('editSend').disabled = false;
    preview();
    dlg.showModal();
  }
  $('editFields').addEventListener('input', preview);
  $('editFields').addEventListener('change', preview);
  $('editCancel').addEventListener('click', () => dlg.close('cancel'));
  $('editSend').addEventListener('click', async () => {
    const { changes, errors } = preview();
    const st = $('editStatus');
    if (Object.keys(errors).length) { st.textContent = ctx.t(`edit_err_${Object.values(errors)[0]}`); return; }
    const comment = $('editComment').value;
    if (!changes.length && comment.trim().length < 5) { st.textContent = ctx.t('edit_no_changes'); return; }
    $('editSend').disabled = true;
    try {
      const r = await sendOsmEditSuggestion({ place: { osm_type: place.osm_type, osm_id: place.osm_id, name: place.name, lat: place.lat, lng: place.lng }, changes, comment });
      st.textContent = ctx.tf('edit_sent', { id: r.id ?? '' });
      ctx.toast(ctx.tf('edit_sent', { id: r.id ?? '' }));
      ctx.emit('osm-edit', { ...r, changes });
      setTimeout(() => dlg.close(), 1200);
    } catch (e) {
      const m = e.message;
      st.textContent = m === 'rate_limited' ? ctx.tf('report_wait', { m: Math.ceil((e.waitMs || 60000) / 60000) }) : m === 'no_changes' ? ctx.t('edit_no_changes') : `${ctx.t('report_failed')} (${m})`;
      $('editSend').disabled = false;
    }
  });
  return { open };
}
