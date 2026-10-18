// Saved places (Home, Work, Favourites, custom lists) and search recents. Stored on this device
// (localStorage); when signed in to a backend server, also synced via GET/PUT /api/me/places.
import { store } from '../shared/storage.js';
import { normalizeSaved, setShortcut as setSc, addToList, removeFromList, createList, isSaved as isIn, mergeSaved, pushRecent } from '../lib/saved-model.js';
import { formatDistance } from '../nav/maneuver.js';
import { haversineKm } from '../shared/geo.js';
import { icon } from './icons.js';
import { esc } from './search.js';

const KEY = 'bm-saved-v1', RKEY = 'bm-recents-v1';
const read = (k, d) => { try { return JSON.parse(store.getItem(k)) ?? d; } catch { return d; } };

// v0.5 commute card: typical drive time Home/Work from where you are (routing only, no live traffic — labelled).
const COMMUTE_TTL = 5 * 60_000;
export function initSaved(ctx) {
  const commute = { at: 0, key: '', res: {} };
  const $ = (id) => document.getElementById(id);
  let S = normalizeSaved(read(KEY, null));
  let R = read(RKEY, []);
  let syncT = null, openListId = null;

  const listName = (l) => (l.id === 'favorites' ? ctx.t('favorites') : l.name);
  function persist({ sync = true } = {}) {
    store.setItem(KEY, JSON.stringify(S));
    renderHome();
    if (openListId && ctx.views.current === 'list') openList(openListId, { push: false });
    if (sync) scheduleSync();
  }
  // ---- server sync (only signed-in + backend mode; simple last-writer-wins with list union) ----
  const canSync = () => !!ctx.state.user && !ctx.state.demo;
  function scheduleSync() { if (!canSync()) return; clearTimeout(syncT); syncT = setTimeout(push, 800); }
  async function push() { try { await ctx.api('PUT', '/api/me/places', S); } catch { /* offline: next change retries */ } }
  async function pull() {
    if (!canSync()) return;
    try { const r = await ctx.api('GET', '/api/me/places'); if (r?.data) { S = mergeSaved(S, r.data); persist({ sync: false }); } push(); } catch { /* ignore */ }
  }

  // ---- home sheet sections ----
  function renderHome() {
    const sc = (which, ic) => {
      const p = S[which];
      return `<button class="shortcut" data-sc="${which}">${`<span class="sc-ic">${icon(ic)}</span>`}<b>${esc(ctx.t(which))}</b><small>${p ? esc(eta(p)) : esc(ctx.t(which === 'home' ? 'set_home' : 'set_work'))}</small></button>`;
    };
    $('shortcuts').innerHTML = sc('home', 'home') + sc('work', 'work') + S.lists.map((l) => `<button class="shortcut" data-list="${esc(l.id)}"><span class="sc-ic">${icon(l.id === 'favorites' ? 'star' : 'list')}</span><b>${esc(listName(l))}</b><small>${esc(ctx.tf('places_n', { n: l.items.length }))}</small></button>`).join('')
      + `<button class="shortcut add" id="addListBtn"><span class="sc-ic">${icon('list')}</span><b>${esc(ctx.t('add_list'))}</b><small>&nbsp;</small></button>`;
    $('savedLists').innerHTML = '';
    $('recents').innerHTML = R.length ? R.slice(0, 8).map((r, i) => `<li><button class="row-btn" data-recent="${i}">${icon(r.cat ? 'search' : 'clock', { size: 20 })}<span class="row-txt"><b>${esc(r.label)}</b>${r.place?.address ? `<small>${esc(r.place.address)}</small>` : ''}</span></button></li>`).join('') : `<li class="muted small">${esc(ctx.t('no_recents'))}</li>`;
    $('clearRecents').hidden = !R.length;
    renderCommute();
  }
  function renderCommute() {
    const el = $('commute'); if (!el) return;
    const targets = ['home', 'work'].filter((w) => S[w]);
    el.hidden = !targets.length;
    if (!targets.length) return;
    const o = ctx.myLoc;
    const row = (w) => { const r = commute.res[w]; const val = r?.duration_s != null ? `${Math.max(1, Math.round(r.duration_s / 60))} ${ctx.t('min_short')}` : r?.error ? '—' : o ? '…' : '';
      return `<button class="commute-row" data-commute="${w}">${icon(w, { size: 20 })}<span class="row-txt"><b>${esc(ctx.t(w))}</b><small>${r?.distance_m ? esc(formatDistance(r.distance_m)) : esc(S[w].name || '')}</small></span><span class="commute-eta">${esc(val)}</span></button>`; };
    el.innerHTML = `<div class="section-h"><h3>${esc(ctx.t('commute'))}</h3>${o ? '' : `<button class="link" id="commuteLoc">${esc(ctx.t('commute_get'))}</button>`}</div>${targets.map(row).join('')}<p class="small muted">${esc(ctx.t('commute_note'))}</p>`;
    const b = $('commuteLoc'); if (b) b.onclick = async () => { await ctx.locateOnce?.(); renderCommute(); };
    if (o) computeCommute(targets);
  }
  async function computeCommute(targets) {
    const o = ctx.myLoc; const key = `${o.lat.toFixed(3)},${o.lng.toFixed(3)}|${targets.map((w) => `${S[w].lat},${S[w].lng}`).join('|')}`;
    if (commute.key === key && Date.now() - commute.at < COMMUTE_TTL) return;
    commute.key = key; commute.at = Date.now();
    const { getRoutes } = await import('../services/routing.js');
    for (const w of targets) {
      try { const r = await getRoutes('drive', { lat: o.lat, lng: o.lng }, S[w]); const best = r.routes?.[0]; commute.res[w] = r.fallback ? { error: true } : { duration_s: best?.duration_s, distance_m: best?.distance_m }; } catch { commute.res[w] = { error: true }; }
      if (commute.key !== key) return;
    }
    if (ctx.views.current === 'home') renderCommute();
    ctx.emit('commute', commute.res);
  }
  $('commute')?.addEventListener('click', (e) => { const b = e.target.closest('[data-commute]'); if (b) { const p = S[b.dataset.commute]; ctx.directions.open({ ...p, name: p.name || ctx.t(b.dataset.commute) }, { mode: 'drive' }); } });
  const eta = (p) => { const o = ctx.myLoc || ctx.origin(); return formatDistance(haversineKm(o, p) * 1000); };

  $('shortcuts').addEventListener('click', (e) => {
    const s = e.target.closest('[data-sc]');
    if (s) {
      const p = S[s.dataset.sc];
      if (p) ctx.directions.open({ ...p, name: p.name || ctx.t(s.dataset.sc) });
      else { ctx.toast(`${ctx.t(s.dataset.sc === 'home' ? 'set_home' : 'set_work')}: ${ctx.t('search_map')}`); document.getElementById('q').focus(); }
      return;
    }
    const l = e.target.closest('[data-list]'); if (l) { openList(l.dataset.list); return; }
    if (e.target.closest('#addListBtn')) { openSaveDialog(null); }
  });
  $('recents').addEventListener('click', (e) => {
    const b = e.target.closest('[data-recent]'); if (!b) return;
    const r = R[+b.dataset.recent];
    if (r.place) ctx.place.open(r.place); else if (r.cat) ctx.search.openCategory(r.cat); else ctx.search.submit(r.label);
  });
  $('clearRecents').addEventListener('click', () => clearRecents());

  function openList(id, { push = true } = {}) {
    const l = S.lists.find((x) => x.id === id); if (!l) return;
    openListId = id;
    if (push) ctx.views.show('list', { detent: 'half' });
    $('listTitle').textContent = listName(l);
    $('listShare').hidden = !l.items.length;
    $('listItems').innerHTML = l.items.length ? l.items.map((p) => `<li class="row-split"><button class="row-btn" data-open="${esc(p.id)}">${icon('pin', { size: 20 })}<span class="row-txt"><b>${esc(p.name || ctx.t('dropped_pin'))}</b><small>${esc([eta(p), p.address].filter(Boolean).join(' · '))}</small></span></button><button class="icon-btn sm" data-del="${esc(p.id)}" aria-label="${esc(ctx.t('unsave'))}: ${esc(p.name)}">${icon('close', { size: 18 })}</button></li>`).join('') : `<li class="muted">${esc(ctx.t('empty_list'))}</li>`;
  }
  $('listItems').addEventListener('click', (e) => {
    const l = S.lists.find((x) => x.id === openListId); if (!l) return;
    const o = e.target.closest('[data-open]'); if (o) { ctx.place.open(l.items.find((p) => p.id === o.dataset.open)); return; }
    const d = e.target.closest('[data-del]'); if (d) { S = removeFromList(S, openListId, d.dataset.del); persist(); }
  });

  // ---- save dialog: choose lists, create a new list ----
  let dlgPlace = null, dlgDone = null;
  function openSaveDialog(place, done) {
    dlgPlace = place; dlgDone = done;
    renderChoices();
    $('listDlgTitle').textContent = place ? `${ctx.t('save')}: ${place.name || ctx.t('dropped_pin')}` : ctx.t('add_list');
    $('listChoices').hidden = !place;
    $('listDlg').showModal();
    if (!place) $('newListName').focus();
  }
  function renderChoices() {
    $('listChoices').innerHTML = S.lists.map((l) => `<label class="check"><input type="checkbox" data-lc="${esc(l.id)}" ${dlgPlace && l.items.some((x) => x.id === dlgPlace.id) ? 'checked' : ''}/> ${esc(listName(l))}</label>`).join('');
  }
  $('listChoices').addEventListener('change', (e) => {
    const c = e.target.closest('[data-lc]'); if (!c || !dlgPlace) return;
    S = c.checked ? addToList(S, c.dataset.lc, dlgPlace) : removeFromList(S, c.dataset.lc, dlgPlace.id);
    persist();
    if (c.checked) ctx.toast(ctx.tf('saved_ok', { list: listName(S.lists.find((l) => l.id === c.dataset.lc)) }));
  });
  $('newListBtn').addEventListener('click', () => {
    const name = $('newListName').value.trim(); if (!name) return;
    S = createList(S, name); $('newListName').value = '';
    if (dlgPlace) S = addToList(S, S.lists[S.lists.length - 1].id, dlgPlace);
    persist(); renderChoices();
  });
  $('listForm').addEventListener('submit', (e) => e.preventDefault());
  $('listDlgClose').addEventListener('click', () => $('listDlg').close());
  $('listDlg').addEventListener('close', () => dlgDone?.());

  function clearRecents() { R = []; store.setItem(RKEY, '[]'); renderHome(); }
  ctx.on('lang', renderHome);
  ctx.on('location', () => { if (ctx.views.current === 'home') renderHome(); });
  renderHome();

  return {
    recents: () => R,
    addRecent(item) { R = pushRecent(R, item.place ? { ...item, place: { id: item.place.id, name: item.place.name, lat: item.place.lat, lng: item.place.lng, address: item.place.address || '', tags: item.place.tags, category: item.place.category, seller_id: item.place.seller_id, kind: item.place.kind } } : item); store.setItem(RKEY, JSON.stringify(R)); renderHome(); },
    clearRecents,
    isSaved: (id) => isIn(S, id),
    setShortcut(which, p) { S = setSc(S, which, p); persist(); },
    openSaveDialog, pull,
    get data() { return S; },
    /** v0.5: import a shared list (from a bharatmap://list link) as a new list. */
    importList({ name, items }) {
      S = createList(S, name); const id = S.lists[S.lists.length - 1].id;
      for (const it of [...items].reverse()) S = addToList(S, id, it);
      persist(); return id;
    },
    openList,
    get openListId() { return openListId; },
  };
}
