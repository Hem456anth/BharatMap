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

export function initSaved(ctx) {
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
  }
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
  };
}
