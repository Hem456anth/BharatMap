// Privacy dashboard model (v0.5, pure, unit-tested): what Bharat Map keeps on this device, grouped and described,
// plus export (JSON, secrets excluded) and delete. Nothing here leaves the device.
export const DATA_CATALOG = [
  { id: 'saved', keys: ['bm-saved-v1'], personal: true },
  { id: 'recents', keys: ['bm-recents-v1'], personal: true },
  { id: 'regions', keys: ['bm-regions-v1'], personal: false },
  { id: 'reports', keys: ['bm-notes-history', 'bm-incidents-local', 'bm-incident-votes'], personal: true },
  { id: 'live', keys: ['bm-live-share'], personal: true },
  { id: 'account', keys: ['mapos-token', 'mapos-user', 'mapos-last-notif'], personal: true, secret: ['mapos-token'] },
  { id: 'settings', prefix: ['bm-', 'mapos-'], personal: false },
];
const SECRET = new Set(['mapos-token']);

/** Group storage keys ({key: value}) by catalog entry → [{ id, keys:[{key, bytes}], bytes, personal }]. */
export function classifyStorage(entries) {
  const used = new Set(); const out = [];
  for (const c of DATA_CATALOG) {
    const keys = Object.keys(entries).filter((k) => !used.has(k) && ((c.keys || []).includes(k) || (c.prefix || []).some((p) => k.startsWith(p))));
    keys.forEach((k) => used.add(k));
    if (!keys.length) continue;
    const list = keys.sort().map((k) => ({ key: k, bytes: new Blob([entries[k] ?? '']).size }));
    out.push({ id: c.id, keys: list, bytes: list.reduce((a, x) => a + x.bytes, 0), personal: !!c.personal });
  }
  return out;
}
/** Export document (secrets such as the sign-in token are never exported). */
export function buildExport(entries, { now = new Date(), version = '0.5' } = {}) {
  const data = {};
  for (const [k, v] of Object.entries(entries)) {
    if (SECRET.has(k) || !(k.startsWith('bm-') || k.startsWith('mapos-'))) continue;
    try { data[k] = JSON.parse(v); } catch { data[k] = v; }
  }
  return { app: 'Bharat Map', version, exported_at: now.toISOString(), note: 'Data stored on this device by Bharat Map. Sign-in tokens are excluded.', data };
}
/** Keys to delete for "Delete all my data" (everything Bharat Map stored). */
export function keysToDelete(entries) { return Object.keys(entries).filter((k) => k.startsWith('bm-') || k.startsWith('mapos-')); }
export const fmtBytes = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
