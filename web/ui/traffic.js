// Traffic honesty (v0.7): a congestion layer exists ONLY when the server has a TRAFFIC_PROVIDER key (TomTom / HERE),
// served through Bharat's tile proxy so the key never reaches the device. Otherwise the Layers panel says
// "Live traffic unavailable" and drive times stay free-flow estimates. Live tiles are cached ≤ 2 min (freshness rule).
import { useServer, v1, serverBase } from '../services/server.js';

export function initTraffic(ctx) {
  const st = { available: false, provider: null, name: '', attribution: '', on: false, checked: false };
  async function check() {
    st.checked = true;
    if (!useServer()) return st;
    try { const r = await v1('/traffic/status', { timeout: 6000, ttl: 5 * 60_000 }); Object.assign(st, { available: !!r.available, provider: r.provider || null, name: r.name || '', attribution: r.attribution || '' }); } catch { st.available = false; }
    return st;
  }
  function set(on) {
    const map = ctx.map;
    st.on = !!on && st.available;
    if (st.on && !map.getSource('bm-traffic')) {
      map.addSource('bm-traffic', { type: 'raster', tiles: [`${serverBase() || location.origin}/api/v1/traffic/tiles/{z}/{x}/{y}.png`], tileSize: 256, minzoom: 3, maxzoom: 18, attribution: st.attribution });
      map.addLayer({ id: 'bm-traffic', type: 'raster', source: 'bm-traffic', paint: { 'raster-opacity': 0.85 } });
    } else if (!st.on && map.getLayer('bm-traffic')) { map.removeLayer('bm-traffic'); map.removeSource('bm-traffic'); }
    ctx.emit('traffic', { ...st });
  }
  ctx.on?.('style', () => { if (st.on) { st.on = false; set(true); } });
  return { check, set, get state() { return { ...st }; } };
}
