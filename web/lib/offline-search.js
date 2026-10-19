// Offline search v2 loader (browser / Android WebView). One prebuilt token index for all bundled regions
// (web/offline/search/index.json, built by scripts/build-search-index.mjs) — no network, no SQLite in the WebView.
// Loaded lazily on the first search and kept in memory.
import { searchOffline, lookupPincode, lookupDigipin, displayName } from '../shared/search-index.js';

let pending = null;
export function loadSearchIndex(fetchImpl = (...a) => fetch(...a)) {
  if (!pending) pending = fetchImpl('offline/search/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => { if (!j) pending = null; return j; });
  return pending;
}
/** Search the bundled index; [] when it is unavailable. */
export async function offlineSearch(query, opts = {}) {
  const ix = await loadSearchIndex(opts.fetchImpl);
  return ix ? searchOffline(ix, query, opts) : [];
}
export { lookupPincode, lookupDigipin, displayName };
