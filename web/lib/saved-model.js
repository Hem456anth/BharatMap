// Saved places & recents data model. Pure (unit-tested); persistence lives in web/ui/saved.js.
// Shape: { v:1, home: Place|null, work: Place|null, lists:[{id,name,items:[Place]}], updated_ms }
// Place: { id, name, lat, lng, address?, category?, seller_id? } — only what is needed to show and route.

const MAX_ITEMS = 200, MAX_LISTS = 20, MAX_RECENTS = 12;
const okNum = (x) => Number.isFinite(x);

export function cleanPlace(p) {
  if (!p || !okNum(p.lat) || !okNum(p.lng)) return null;
  const out = { id: String(p.id || `pin:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).slice(0, 80), name: String(p.name || '').slice(0, 120), lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) };
  if (p.address) out.address = String(p.address).slice(0, 240);
  if (p.category) out.category = String(p.category).slice(0, 30);
  if (p.seller_id) out.seller_id = String(p.seller_id).slice(0, 20);
  return out;
}

export function normalizeSaved(s) {
  const base = { v: 1, home: null, work: null, lists: [], updated_ms: 0 };
  if (!s || typeof s !== 'object') s = {};
  base.home = cleanPlace(s.home); base.work = cleanPlace(s.work);
  base.updated_ms = okNum(s.updated_ms) ? s.updated_ms : 0;
  const lists = Array.isArray(s.lists) ? s.lists.slice(0, MAX_LISTS) : [];
  for (const l of lists) {
    if (!l || !l.id) continue;
    base.lists.push({ id: String(l.id).slice(0, 40), name: String(l.name || '').slice(0, 60), items: (Array.isArray(l.items) ? l.items : []).map(cleanPlace).filter(Boolean).slice(0, MAX_ITEMS) });
  }
  if (!base.lists.some((l) => l.id === 'favorites')) base.lists.unshift({ id: 'favorites', name: '', items: [] });
  return base;
}
const touch = (s) => ({ ...s, updated_ms: Date.now() });

export function setShortcut(s, which, place) {
  if (!['home', 'work'].includes(which)) throw new Error('bad_shortcut');
  return touch({ ...s, [which]: place ? cleanPlace(place) : null });
}
export function addToList(s, listId, place) {
  const p = cleanPlace(place); if (!p) return s;
  return touch({ ...s, lists: s.lists.map((l) => (l.id !== listId || l.items.some((x) => x.id === p.id) ? l : { ...l, items: [p, ...l.items].slice(0, MAX_ITEMS) })) });
}
export function removeFromList(s, listId, placeId) {
  return touch({ ...s, lists: s.lists.map((l) => (l.id === listId ? { ...l, items: l.items.filter((x) => x.id !== placeId) } : l)) });
}
export function createList(s, name) {
  const id = `l_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  if (s.lists.length >= MAX_LISTS) return s;
  return touch({ ...s, lists: [...s.lists, { id, name: String(name).trim().slice(0, 60) || 'List', items: [] }] });
}
export function deleteList(s, listId) {
  if (listId === 'favorites') return s;
  return touch({ ...s, lists: s.lists.filter((l) => l.id !== listId) });
}
export function isSaved(s, placeId) { return s.lists.some((l) => l.items.some((x) => x.id === placeId)); }

/** Merge local and server copies. Newer document wins per field; lists are unioned by item id. */
export function mergeSaved(local, remote) {
  const a = normalizeSaved(local), b = normalizeSaved(remote);
  const newer = b.updated_ms > a.updated_ms ? b : a, older = newer === a ? b : a;
  const lists = new Map();
  for (const l of [...older.lists, ...newer.lists]) {
    const cur = lists.get(l.id);
    if (!cur) { lists.set(l.id, { ...l, items: [...l.items] }); continue; }
    const ids = new Set(l.items.map((x) => x.id));
    cur.name = l.name || cur.name;
    cur.items = [...l.items, ...cur.items.filter((x) => !ids.has(x.id))];
  }
  return { v: 1, home: newer.home || older.home, work: newer.work || older.work, lists: [...lists.values()], updated_ms: Math.max(a.updated_ms, b.updated_ms) };
}

/** Recents: newest first, de-duplicated by label (and place id), capped. */
export function pushRecent(list, item) {
  const key = (x) => x.place?.id || `q:${String(x.label).toLowerCase()}`;
  const k = key(item);
  return [{ ...item, at: Date.now() }, ...(list || []).filter((x) => key(x) !== k)].slice(0, MAX_RECENTS);
}
