// Place-card service panel UI (docs/re/UI_UX_SPEC_V2.md §2–§3). Renders the PanelModel from shared/services/build.js:
// label chips (glyph + word, never colour alone), loading skeleton after 300 ms (aria-busy), Ready / Partial /
// No integration / Offline / Error states, provenance footer, and actions (link-outs go through the interstitial).
// Labels come ONLY from row.label via displayRow() — components never hard-code a label.
import { buildServicePanel } from '../shared/services/build.js';
import { displayRow, LABEL_META } from '../shared/services/labels.js';
import { PROVIDERS } from '../services/providers/index.js';
import { openingStatus } from '../lib/opening-hours.js';
import { encodeDigipin } from '../shared/geo.js';
import { fallbackKeys } from '../shared/i18n.js';
import { store } from '../shared/storage.js';
import { icon } from './icons.js';
import { esc } from './search.js';

const loggedFallback = new Set();
export function labelChip(ctx, label, { stale = false } = {}) {
  if (!label) return '';
  const m = LABEL_META[label];
  return `<span class="hl ${m.cls}${stale ? ' stale' : ''}" data-label="${label}"><i aria-hidden="true">${m.glyph}</i>${esc(ctx.t(m.key))}</span>`;
}

export function initServicePanel(ctx) {
  let seq = 0, state = null;
  const cfg = () => ({ ...(window.__MAPOS_CONFIG__?.integrations || {}), ...(ctx.state.config?.integrations || {}) });
  const online = () => navigator.onLine !== false && !ctx.style?.forceOffline;

  function rowHtml(r0) {
    const r = displayRow(r0);
    const title = esc(ctx.t(r.k));
    const value = r.loading ? `<span class="skel" aria-hidden="true"></span>` : esc(r.vk ? ctx.tf(r.vk, r.vars || {}) : r.value ?? '');
    const pill = r.line ? `<span class="line-pill" style="${r.color ? `--lc:${esc(r.color)}` : ''}">${esc(r.line)}</span>` : '';
    const label = r.loading ? '' : labelChip(ctx, r.label, { stale: r.stale });
    const aria = `${r.label ? `${ctx.t(LABEL_META[r.label].key)}: ` : ''}${title}, ${r.line ? `${r.line}, ` : ''}${r.vk ? ctx.tf(r.vk, r.vars || {}) : r.value ?? ''}`;
    return `<li class="sv-row${r.fact ? ' fact' : ''}${r.provenance === 'demo' ? ' demo' : ''}" data-row="${esc(r.id)}" aria-label="${esc(aria)}"><div><small>${title}</small><div class="sv-val">${pill}${value}</div></div>${label}</li>`;
  }
  function actionHtml(a) {
    const text = a.text ? ctx.tf(a.k, { name: a.text }) : ctx.t(a.k);
    const dis = a.disabled ? ` disabled aria-disabled="true" title="${esc(ctx.t(a.disabledKey || 'sv_needs_internet'))}"` : '';
    const chip = a.kind === 'linkout' ? labelChip(ctx, 'linkout') : a.provenance === 'demo' ? `<span class="hl hl-demo">${esc(ctx.t('label_demo_short'))}</span>` : '';
    const host = a.kind === 'linkout' ? `<small class="host">${esc(a.host)}${a.verified ? '' : ' · ?'}</small>` : '';
    const ic = { linkout: 'globe', order: 'bag', ondc: 'bag', call: 'phone', emergency: 'phone', directions: 'directions', addstop: 'plus', remember: 'pin', liststore: 'bag' }[a.kind] || 'chev';
    return `<button class="sv-act${a.kind === 'emergency' ? ' danger' : ''}" data-sva="${esc(a.id)}"${dis}>${icon(ic, { size: 18 })}<span><b>${esc(text)}</b>${host}</span>${chip}</button>`;
  }

  function render(el, P, place) {
    if (!P) { el.innerHTML = ''; return; }
    const titleKey = P.type === 'fuel' && P.kind === 'ev' ? 'sv_title_ev' : P.type === 'parking' && place.tags?.barrier === 'toll_booth' ? 'sv_title_toll' : `sv_title_${P.type}`;
    const loading = [...P.sections.flatMap((s) => s.rows), ...(P.ride?.sections[0].rows || [])].some((r) => r.loading);
    const notices = P.notices.map((k) => `<p class="sv-notice" role="note">${esc(ctx.t(k))}${k === 'sv_partial' && P.failed?.length ? ` (${esc(P.failed.join(', '))})` : ''}</p>`).join('');
    const primaryActs = P.actions.filter((a) => !a.group || a.top);
    const groups = {};
    for (const a of P.actions.filter((x) => x.group && !x.top)) (groups[a.group] = groups[a.group] || []).push(a);
    const groupHtml = Object.entries(groups).map(([g, list]) => `<details class="sv-group" data-group="${esc(g)}"${list.length <= 3 ? ' open' : ''}><summary>${esc(ctx.t(`sv_group_${g}`))} (${list.length})</summary><div class="sv-acts">${list.map(actionHtml).join('')}</div></details>`).join('');
    const ride = P.type !== 'ride' && P.ride ? `<details class="sv-more" id="svRide"${state?.rideOpen ? ' open' : ''}><summary>${icon('car', { size: 18 })} ${esc(ctx.t('sv_more_services'))}: ${esc(ctx.t('sv_ride_title'))}</summary>
        <ul class="sv-rows">${P.ride.sections[0].rows.map(rowHtml).join('')}</ul><div class="sv-acts">${P.ride.actions.map(actionHtml).join('')}</div></details>` : '';
    el.innerHTML = `<section class="sv-panel" role="region" aria-labelledby="svTitle" aria-busy="${loading}" data-type="${esc(P.type)}" data-state="${esc(P.state)}" data-provenance="${esc(P.provenance || '')}">
      <h4 id="svTitle">${esc(ctx.t(titleKey))}${P.state === 'offline' ? ` <span class="hl hl-na">${esc(ctx.t('sv_state_offline'))}</span>` : ''}</h4>
      ${P.safety ? `<p class="sv-safety" role="alert">${icon('phone', { size: 16 })} ${esc(ctx.t(P.safety))}</p>` : ''}
      ${notices}
      ${P.sections.map((s) => `<div class="sv-sec" data-sec="${esc(s.id)}"><h5>${esc(ctx.t(s.k))}</h5><ul class="sv-rows">${s.rows.map(rowHtml).join('')}</ul></div>`).join('')}
      <div class="sv-acts">${primaryActs.map(actionHtml).join('')}</div>${groupHtml}
      ${ride}
      <footer class="sv-foot small muted">${P.footer.map((f) => `<span${f.provenance === 'demo' ? ' class="prov-demo" data-prov="demo"' : ''}>${esc(f.text || ctx.tf(f.k, f.vars || {}))}${f.text && f.k ? ` · ${esc(ctx.t(f.k))}` : ''}</span>`).join(' · ')}</footer>
      <p class="sr" aria-live="polite" id="svLive">${loading ? esc(ctx.t('sv_checking')) : ''}</p>
    </section>`;
    el.querySelector('#svRide')?.addEventListener('toggle', (e) => { if (state) state.rideOpen = e.target.open; });
  }

  async function onAction(a, place) {
    if (a.disabled) return;
    if (a.kind === 'linkout') return ctx.linkout.open(a);
    if (a.kind === 'call' || a.kind === 'emergency') { location.href = a.url; return; }
    if (a.kind === 'order') return ctx.openShop?.({ sellerId: a.sellerId, q: null, fromPlace: true });
    if (a.kind === 'ondc') return ctx.ondc?.open(place, a);
    if (a.kind === 'directions') return ctx.directions.open(place, a.mode ? { mode: a.mode } : undefined);
    if (a.kind === 'addstop') { if (ctx.directions.state?.to) ctx.directions.addStop({ lat: place.lat, lng: place.lng, name: place.name }); else ctx.directions.open(place); return; }
    if (a.kind === 'remember') { store.setItem('bm-parked', JSON.stringify({ lat: place.lat, lng: place.lng, name: place.name || '', at: Date.now() })); ctx.toast(ctx.t('sv_remembered')); return; }
    if (a.kind === 'liststore') return ctx.openShop?.({ sellerTab: true });
  }

  /** Mount the panel for a place: instant sync build, then async providers (each failure is named in Partial). */
  async function mount(el, place, { seller = null, origin = null } = {}) {
    const my = ++seq;
    const lang = ctx.lang();
    if (lang !== 'en' && !loggedFallback.has(lang)) { loggedFallback.add(lang); const n = fallbackKeys(lang).length; if (n) console.info(`[i18n] ${lang}: ${n} v0.7 strings fall back to English`); }
    const env = { origin, demo: ctx.state.demo, apiBase: ctx.apiBase };
    const base = { now: Date.now(), online: online(), seller, origin, config: cfg(), hours: place.tags?.opening_hours ? openingStatus(place.tags.opening_hours) : null, digipin: encodeDigipin(place.lat, place.lng) };
    const first = buildServicePanel(place, base);
    state = { place, ctx: base, P: first, rideOpen: state?.place?.id === place.id ? state.rideOpen : false };
    // Skeleton only after 300 ms (spec §3) — until then the instant panel (with "Checking…" rows) is shown without spinners.
    render(el, first, place);
    el.onclick = (e) => { const b = e.target.closest('[data-sva]'); if (!b) return; const a = [...state.P.actions, ...(state.P.ride?.actions || [])].find((x) => x.id === b.dataset.sva); if (a) onAction(a, place); };
    const extra = {}; const failed = [];
    const type = first.type;
    const jobs = PROVIDERS.filter((p) => p.applies(type, place, env) && (online() || p.id === 'transit' || p.id === 'nearby')).map(async (p) => {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
      try { Object.assign(extra, await Promise.race([p.load(place, env), timer])); } catch { failed.push(p.id); }
    });
    if (!online()) { extra.rideEstimate = { status: 'error' }; }
    await Promise.all(jobs);
    if (my !== seq) return;
    if (!extra.rideEstimate) extra.rideEstimate = { status: origin ? 'error' : 'error' };
    if (type === 'station' && !extra.departures) extra.departures = { status: 'no_feed' };
    const full = { ...base, ...extra, partialFailures: failed.filter((f) => f !== 'server' && f !== 'ride') };
    if (extra.forceType === undefined) delete full.forceType;
    state.P = buildServicePanel(place, full); state.ctx = full;
    render(el, state.P, place);
    ctx.emit('services', { place, panel: state.P });
  }
  return { mount, get current() { return state; }, render, labelChip: (l) => labelChip(ctx, l) };
}
