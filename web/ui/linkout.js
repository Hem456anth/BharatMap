// Link-out interstitial (spec §1 "Link-out"): before leaving Bharat Map, name the destination host, say that Bharat
// does not see prices/availability/results there, and flag links whose format is not verified. Only safe URLs
// (https/http) are ever opened; tel: actions never come here. Also hosts the ONDC prototype order sheet.
import { safeLinkout } from '../shared/services/linkouts.js';
import { openUrlFor, DL_LABEL } from '../shared/services/deeplinks.js';
import { esc } from './search.js';
import { openExternal, isAndroid } from '../native.js';

/**
 * Deep-link block: Documented / App Link / Declared · Unverified / Store / Web-only, the app + package, the fallback
 * and what is prefilled. `dest` is the URL that will actually open on this device (openUrlFor).
 */
function dlBlock(ctx, a, host, dest) {
  const d = a.deeplink;
  if (!d || !DL_LABEL[d.type]) return '';
  const cls = d.type === 'declared' ? 'hl-est' : d.type === 'web' ? 'hl-na' : 'hl-sched';
  const hostOf = (u) => { try { return new URL(u).host; } catch { return host; } };
  const label = `<p class="lo-dl" data-dl="${esc(d.type)}"${d.source ? ` data-dl-src="${esc(d.source)}"` : ''}><span class="hl ${cls}">${esc(ctx.t(DL_LABEL[d.type]))}</span></p>`;
  if (d.type === 'web') return `${label}<p class="small muted" data-dl-web>${esc(ctx.t('lo_dl_web_note'))}${d.reason ? ` ${esc(d.reason)}` : ''}</p>`;
  if (d.type === 'store') {
    const onDevice = dest && dest.startsWith('intent:');
    return `${label}<p class="small muted" data-dl-app>${esc(ctx.tf('lo_dl_store_app', { app: d.app, pkg: d.package, web: hostOf(d.webUrl) }))}</p>
    <p class="small muted" data-dl-store-dest>${esc(onDevice ? ctx.t('lo_dl_store_android') : ctx.tf('lo_dl_store_other', { web: hostOf(d.webUrl) }))}</p>`;
  }
  return `${label}
    <p class="small muted" data-dl-app>${esc(ctx.tf('lo_dl_app', { app: d.app, pkg: d.package, host: hostOf(d.fallbackUrl) }))}</p>
    ${d.source === 'assetlinks' ? `<p class="small muted" data-dl-assetlinks>${esc(ctx.t('lo_dl_applink_web_note'))}</p>` : ''}
    ${d.prefill?.length ? `<p class="small muted" data-dl-prefill>${esc(ctx.tf('lo_dl_prefill', { what: d.prefill.join(', ') }))}</p>` : ''}`;
}

export function initLinkout(ctx) {
  const dlg = document.getElementById('linkoutDlg');
  let pending = null;
  function open(a) {
    if (!a?.url || !safeLinkout(a.url) || a.url.startsWith('tel:')) { ctx.toast('Link blocked'); return; }
    pending = a;
    // Name the host that will really open on this device: an intent URL keeps the link's own host (the app / Play),
    // elsewhere the https page openUrlFor picks (Rapido's fallback site, a Store provider's official website).
    const dest = openUrlFor(a, { android: isAndroid() }) || a.url;
    const host = dest.startsWith('intent:') || dest.startsWith('tel:') ? (a.host || '') : new URL(dest).host;
    document.getElementById('loTitle').textContent = ctx.t('lo_title');
    document.getElementById('loBody').innerHTML = `<p>${esc(ctx.tf('lo_body', { host }))}</p>
      <p class="lo-host"><b>${esc(host)}</b> ${a.verified ? `<span class="hl hl-sched">${esc(ctx.t('lo_verified'))}</span>` : ''}</p>
      ${dlBlock(ctx, a, host, dest)}
      ${a.verified ? '' : `<p class="small warn" data-unverified>${esc(ctx.t(a.deeplink?.type === 'declared' ? 'lo_dl_declared_note' : 'lo_unverified'))}</p>`}
      ${a.note ? `<p class="small muted"><b>${esc(ctx.t('lo_note'))}:</b> ${esc(a.note)}</p>` : ''}`;
    const go = document.getElementById('loGo');
    go.textContent = ctx.tf('lo_continue', { host });
    go.dataset.url = dest;
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
