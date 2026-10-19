// Link-out interstitial (spec §1 "Link-out"): before leaving Bharat Map, name the destination host, say that Bharat
// does not see prices/availability/results there, and flag links whose format is not verified. Only safe URLs
// (https/http) are ever opened; tel: actions never come here. Also hosts the ONDC prototype order sheet.
import { safeLinkout } from '../shared/services/linkouts.js';
import { esc } from './search.js';
import { openExternal } from '../native.js';

export function initLinkout(ctx) {
  const dlg = document.getElementById('linkoutDlg');
  let pending = null;
  function open(a) {
    if (!a?.url || !safeLinkout(a.url) || a.url.startsWith('tel:')) { ctx.toast('Link blocked'); return; }
    pending = a;
    const host = a.host || new URL(a.url).host;
    document.getElementById('loTitle').textContent = ctx.t('lo_title');
    document.getElementById('loBody').innerHTML = `<p>${esc(ctx.tf('lo_body', { host }))}</p>
      <p class="lo-host"><b>${esc(host)}</b> ${a.verified ? `<span class="hl hl-sched">${esc(ctx.t('lo_verified'))}</span>` : ''}</p>
      ${a.verified ? '' : `<p class="small warn" data-unverified>${esc(ctx.t('lo_unverified'))}</p>`}
      ${a.note ? `<p class="small muted"><b>${esc(ctx.t('lo_note'))}:</b> ${esc(a.note)}</p>` : ''}`;
    const go = document.getElementById('loGo');
    go.textContent = ctx.tf('lo_continue', { host });
    go.dataset.url = a.url;
    document.getElementById('loCancel').textContent = ctx.t('lo_cancel');
    ctx.emit('linkout-shown', { ...a, host });
    dlg.showModal();
  }
  document.getElementById('loGo').addEventListener('click', () => {
    const a = pending; dlg.close(); pending = null;
    if (!a) return;
    ctx.emit('linkout', a);
    if (window.__BM_LINKOUT_TEST__) { window.__BM_LINKOUT_TEST__.push(a.url); return; } // E2E: record instead of leaving the app
    openExternal(a.url);
  });
  document.getElementById('loCancel').addEventListener('click', () => { pending = null; dlg.close(); });
  return { open };
}
