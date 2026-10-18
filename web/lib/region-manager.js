// Offline region download manager: catalogue, download with progress, cancel, delete, list, and reading a
// downloaded PMTiles archive back for the offline map. Files live in Cache Storage (works in the browser and in
// the Android WebView; survives restarts) and the index in localStorage. Dependencies are injectable for tests.
export const CACHE_NAME = 'bm-regions-v1';
const KEY = 'bm-regions-v1';

export function createRegionManager({ caches = globalThis.caches, fetchImpl = (...a) => globalThis.fetch(...a), storage, base = '' } = {}) {
  const active = new Map(); // id -> AbortController
  const read = () => { try { return JSON.parse(storage.getItem(KEY) || '{}'); } catch { return {}; } };
  const write = (v) => storage.setItem(KEY, JSON.stringify(v));
  const urlOf = (r) => (r.url ? (/^https?:/.test(r.url) ? r.url : `${base}${r.url}`) : base ? `${base}/regions/${r.id}.pmtiles` : null);

  return {
    urlOf,
    list: () => Object.values(read()),
    isDownloaded: (id) => !!read()[id],
    isDownloading: (id) => active.has(id),
    /** Download a region; onProgress({ received, total, fraction }). Resolves to the stored entry. */
    async download(region, { onProgress } = {}) {
      const url = urlOf(region);
      if (!url) throw new Error('no_region_host');
      if (active.has(region.id)) throw new Error('already_downloading');
      const ctl = new AbortController(); active.set(region.id, ctl);
      try {
        const r = await fetchImpl(url, { signal: ctl.signal });
        if (!r.ok) throw new Error(r.status === 404 ? 'region_not_hosted' : `http_${r.status}`);
        const total = Number(r.headers.get('content-length')) || region.size_bytes || 0;
        const chunks = []; let received = 0;
        if (r.body?.getReader) {
          const rd = r.body.getReader();
          for (;;) {
            const { done, value } = await rd.read();
            if (ctl.signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
            if (done) break;
            chunks.push(value); received += value.byteLength;
            onProgress?.({ received, total, fraction: total ? Math.min(1, received / total) : null });
          }
        } else { const buf = new Uint8Array(await r.arrayBuffer()); chunks.push(buf); received = buf.byteLength; onProgress?.({ received, total: received, fraction: 1 }); }
        if (ctl.signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
        const head = chunks[0] ? new TextDecoder().decode(chunks[0].slice(0, 7)) : '';
        if (head !== 'PMTiles') throw new Error('not_a_pmtiles_file');
        const blob = new Blob(chunks, { type: 'application/octet-stream' });
        const cache = await caches.open(CACHE_NAME);
        await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) } }));
        const entry = { id: region.id, name: region.name, bbox: region.bbox, maxzoom: region.maxzoom, bytes: blob.size, url, ts: Date.now() };
        const all = read(); all[region.id] = entry; write(all);
        return entry;
      } catch (e) {
        if (e.name === 'AbortError') throw new Error('cancelled');
        throw e;
      } finally { active.delete(region.id); }
    },
    cancel(id) { const c = active.get(id); if (c) { c.abort(); return true; } return false; },
    async remove(id) {
      const all = read(); const e = all[id]; if (!e) return false;
      const cache = await caches.open(CACHE_NAME); await cache.delete(e.url);
      delete all[id]; write(all); return true;
    },
    /** The stored archive as a Blob (for PMTiles FileSource), or null. */
    async blob(id) {
      const e = read()[id]; if (!e) return null;
      const cache = await caches.open(CACHE_NAME); const r = await cache.match(e.url);
      return r ? r.blob() : null;
    },
    /** Downloaded region whose bbox contains the point (smallest first). */
    covering(p) {
      return Object.values(read()).filter((e) => p.lng >= e.bbox[0] && p.lat >= e.bbox[1] && p.lng <= e.bbox[2] && p.lat <= e.bbox[3])
        .sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]))[0] || null;
    },
    totalBytes: () => Object.values(read()).reduce((s, e) => s + (e.bytes || 0), 0),
  };
}
