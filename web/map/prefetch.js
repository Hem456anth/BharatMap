// Prefetch vector tiles along a route corridor (z12–14) into the tile cache the service worker serves from, so
// the route keeps rendering if the network drops. Only on unmetered connections (wifi/ethernet, or 4G without
// Save-Data) and never in low-bandwidth mode — see web/lib/bandwidth.js.
import { corridorTiles } from '../lib/bandwidth.js';

export const TILE_CACHE = 'mapos-tiles-v1';
export function tileTemplates(map) {
  const st = map.getStyle?.(); if (!st) return [];
  return Object.keys(st.sources || {}).map((id) => map.getSource(id)).filter((s) => s?.type === 'vector' && Array.isArray(s.tiles) && /^https?:/.test(s.tiles[0] || '')).map((s) => ({ url: s.tiles[0], maxzoom: s.maxzoom ?? 14 }));
}
export async function prefetchCorridor(map, coords, { caches = globalThis.caches, fetchImpl = (...a) => fetch(...a), max = 300, concurrency = 4, signal } = {}) {
  if (!caches || !coords?.length) return 0;
  const tpl = tileTemplates(map); if (!tpl.length) return 0;
  const cache = await caches.open(TILE_CACHE);
  const jobs = [];
  for (const t of tpl) for (const [z, x, y] of corridorTiles(coords, { zooms: [12, 13, 14].filter((z) => z <= t.maxzoom), max })) jobs.push(t.url.replace('{z}', z).replace('{x}', x).replace('{y}', y));
  let done = 0, i = 0;
  const worker = async () => {
    while (i < jobs.length && !signal?.aborted) {
      const url = jobs[i++];
      try { if (await cache.match(url)) { done++; continue; } const r = await fetchImpl(url, { signal }); if (r.ok) { await cache.put(url, r); done++; } } catch { /* skip */ }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return done;
}
