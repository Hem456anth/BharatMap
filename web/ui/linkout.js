// Link-out interstitial (spec §1 "Link-out"): before leaving Bharat Map, name the destination host, say that Bharat
// does not see prices/availability/results there, and flag links whose format is not verified. Only safe URLs
// (https/http) are ever opened; tel: actions never come here. Also hosts the ONDC prototype order sheet.
import { safeLinkout } from '../shared/services/linkouts.js';
import { openUrlFor, DL_LABEL } from '../shared/services/deeplinks.js';
import { esc } from './search.js';
import { openExternal, isAndroid } from '../native.js';

/** Deep-link block: Documented / App Link / Declared · Unverified, the app + package, the web fallback and what is prefilled. */
function dlBlock(ctx, a, host) {
  const d = a.deeplink;
  if (!d || !DL_LABEL[d.type]) return '';
  const cls = d.type === 'declared' ? 'hl-est' : 'hl-sched';
  const fb = (() => { try { return new URL(d.fallbackUrl).host; } catch { return host; } })();
  return `<p class="lo-dl" data-dl="${esc(d.type)}"><span class="hl ${cls}">${esc(ctx.t(DL_LABEL[d.type]))}</span></p>
    <p class="small muted" data-dl-app>${esc(ctx.tf('lo_dl_app', { app: d.app, pkg: d.package, host: fb }))}</p>
    ${d.prefill?.length ? `<p class="small muted" data-dl-prefill>${esc(ctx.tf('lo_dl_prefill', { what: d.prefill.join(', ') }))}</p>` : ''}`;
}

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
      ${dlBlock(ctx, a, host)}
      ${a.verified ? '' : `<p class="small warn" data-unverified>${esc(ctx.t(a.deeplink?.type === 'declared' ? 'lo_dl_declared_note' : 'lo_unverified'))}</p>`}
      ${a.note ? `<p class="small muted"><b>${esc(ctx.t('lo_note'))}:</b> ${esc(a.note)}</p>` : ''}`;
    const go = document.getElementById('loGo');
    go.textContent = ctx.tf('lo_continue', { host });
    go.dataset.url = openUrlFor(a, { android: isAndroid() }) || a.url;
    document.getElementById('loCancel').textContent = ctx.t('lo_cancel');
    ctx.emit('linkout-shown', { ...a, host });
    dlg.showModal();
  }
  document.getElementById('loGo').addEventListener('click', () => {
    const a = pending; dlg.close(); pending = null;
    if (!a) return;
    ctx.emit('linkout', a);
    // Intent URLs (declared app entry points) only where Android can resolve them; elsewhere their https fallback.
    const url = openUrlFor(a, { android: isAndroid() });
    if (!url) return;
    if (window.__BM_LINKOUT_TEST__) { window.__BM_LINKOUT_TEST__.push(url); return; } // E2E: record instead of leaving the app
    openExternal(url);
  });
  document.getElementById('loCancel').addEventListener('click', () => { pending = null; dlg.close(); });
  return { open };
}
