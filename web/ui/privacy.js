// Privacy dashboard (v0.5): what is stored on this device (grouped, with sizes), downloaded map regions and cached
// tiles, which permissions are granted, export as JSON, and delete everything. DPDP Act 2023: notice, access,
// erasure. Server-side data (signed-in saved places, orders) is listed with a note on how to erase it.
import { store } from '../shared/storage.js';
import { classifyStorage, buildExport, keysToDelete, fmtBytes } from '../lib/privacy-model.js';
import { permissionState } from './permissions.js';
import { esc } from './search.js';
import { icon } from './icons.js';

function snapshot() {
  const out = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out[k] = localStorage.getItem(k); } } catch { /* memory store */ }
  return out;
}
async function cacheSizes() {
  const res = [];
  try {
    for (const name of await caches.keys()) {
      const c = await caches.open(name); const keys = await c.keys();
      res.push({ name, entries: keys.length });
    }
  } catch { /* no Cache Storage */ }
  return res;
}

export function initPrivacy(ctx) {
  const $ = (id) => document.getElementById(id);
  async function render() {
    const snap = snapshot();
    const groups = classifyStorage(snap);
    const caches_ = await cacheSizes();
    const perms = {};
    for (const k of ['location', 'notifications', 'microphone']) perms[k] = await permissionState(k).catch(() => 'prompt');
    $('privacyBody').innerHTML = `
      <p class="small muted">${esc(ctx.t('privacy_dash_intro'))}</p>
      <h4>${esc(ctx.t('privacy_on_device'))}</h4>
      <ul class="rows priv-list">${groups.length ? groups.map((g) => `<li class="row-split"><span class="row-txt"><b>${esc(ctx.t(`privacy_g_${g.id}`))}</b><small>${esc(ctx.t(`privacy_g_${g.id}_d`))} · ${fmtBytes(g.bytes)}</small></span>${g.personal ? `<span class="tag">${esc(ctx.t('privacy_personal'))}</span>` : ''}</li>`).join('') : `<li class="muted">${esc(ctx.t('privacy_nothing'))}</li>`}
      ${caches_.map((c) => `<li class="row-split"><span class="row-txt"><b>${esc(/region/.test(c.name) ? ctx.t('privacy_g_regions') : ctx.t('privacy_cache'))}</b><small>${esc(c.name)} · ${c.entries} ${esc(ctx.t('privacy_items'))}</small></span></li>`).join('')}</ul>
      <h4>${esc(ctx.t('privacy_perms'))}</h4>
      <ul class="rows priv-list">${Object.entries(perms).map(([k, v]) => `<li class="row-split"><span class="row-txt"><b>${esc(ctx.t(`perm_${k}_what`))}</b><small>${esc(ctx.t(`perm_state_${v}`))}</small></span></li>`).join('')}</ul>
      <h4>${esc(ctx.t('privacy_shared'))}</h4>
      <p class="small muted">${esc(ctx.t('privacy_shared_d'))}</p>
      <div class="row wrap">
        <button class="btn" id="privExport" type="button">${icon('download', { size: 18 })} ${esc(ctx.t('privacy_export'))}</button>
        <button class="btn danger" id="privDelete" type="button">${esc(ctx.t('privacy_delete'))}</button>
      </div>
      <p class="small" id="privStatus" role="status"></p>`;
    $('privExport').onclick = () => {
      const doc = buildExport(snapshot());
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bharat-map-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      $('privStatus').textContent = ctx.tf('privacy_exported', { n: Object.keys(doc.data).length });
      ctx.emit('privacy-export', doc);
    };
    $('privDelete').onclick = async () => {
      if (!confirm(ctx.t('privacy_delete_confirm'))) return;
      for (const k of keysToDelete(snapshot())) store.removeItem(k);
      try { for (const n of await caches.keys()) await caches.delete(n); } catch { /* ignore */ }
      $('privStatus').textContent = ctx.t('privacy_deleted');
      ctx.emit('privacy-deleted', {});
      setTimeout(render, 50);
    };
  }
  $('openPrivacy').addEventListener('click', () => ctx.views.show('privacy', { detent: 'full' }));
  ctx.on('view', ({ name }) => { if (name === 'privacy') render(); });
  ctx.on('lang', () => { if (ctx.views.current === 'privacy') render(); });
  return { render };
}
