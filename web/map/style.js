// Map style management: online (OpenFreeMap liberty/dark) or bundled offline PMTiles (Protomaps light/dark),
// plus Bharat Map overlay layers that survive style switches: routes, POI overlays, 3D buildings, transit lines.
// Auto-fallback: if the network map fails (style or repeated tile errors) the bundled offline map is used.
import { labelMinzoomShift } from '../lib/device-tier.js';
import { store } from '../shared/storage.js';
import { isNative } from '../native.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const PALETTE = {
  light: { route: '#2F3A8F', routeCasing: '#ffffff', alt: '#8C90A6', building: '#d9d3c7', transit: '#7a3fb0', poi: '#E07A10', poiStroke: '#ffffff' },
  dark: { route: '#8E9BFF', routeCasing: '#0F1117', alt: '#6B6F82', building: '#3a3f52', transit: '#c39bff', poi: '#FFA94D', poiStroke: '#0F1117' },
};

export function createMapStyle(ctx) {
  const { map } = ctx;
  const S = {
    offlineActive: false, auto: false, routes: EMPTY, pois: EMPTY, legs: EMPTY, tolls: EMPTY, errors: [], lowBw: false, tier: null, labelZoom: {}, labelShift: 0,
    pref: store.getItem('bm-map-style') || 'auto', // auto | standard | dark
    buildings3d: store.getItem('bm-3d') !== '0',
    transit: store.getItem('bm-transit') === '1',
    forceOffline: store.getItem('mapos-offline') === '1',
  };
  const mapTheme = () => (S.driving ? (S.driving === 'night' ? 'dark' : 'light') : S.pref === 'dark' ? 'dark' : S.pref === 'standard' ? 'light' : ctx.theme());
  const pal = () => PALETTE[mapTheme()];

  function onlineStyleUrl() {
    const name = mapTheme() === 'dark' ? 'dark' : 'liberty';
    const standalone = window.__MAPOS_DEMO__ || location.protocol === 'file:' || isNative() || ctx.apiBase();
    return standalone ? `https://tiles.openfreemap.org/styles/${name}` : `/map/style.json?style=${name}`;
  }

  async function apply({ reason } = {}) {
    const wantOffline = S.forceOffline || S.auto || navigator.onLine === false;
    let style = onlineStyleUrl(), offline = false;
    if (wantOffline) {
      try {
        const m = await import('../offline-map.js');
        const c = map.getCenter();
        style = await m.offlineStyle(ctx.maplibregl, ctx.state.city, ctx.lang(), mapTheme(), { center: { lat: c.lat, lng: c.lng }, regions: ctx.regions });
        offline = true;
      } catch (e) { ctx.toast(`Offline map unavailable: ${e.message}`); }
    }
    S.offlineActive = offline; S.errors = [];
    map.setStyle(style, { diff: false });
    ctx.emit('mapstyle', { offline, reason });
  }

  // Re-add our layers each time a style finishes loading.
  map.on('style.load', () => { addOverlays(); if (!S.offlineActive) setLabelLanguage(); tuneDarkLabels(); applyDrivingPaint(); });

  // The upstream dark style draws street/place labels in dim grey (~2:1 on the near-black base). Lift them to a
  // legible light grey with a dark halo so names stay readable (≥4.5:1) in dark mode.
  function tuneDarkLabels() {
    if (mapTheme() !== 'dark') return;
    for (const l of map.getStyle().layers) {
      if (l.type !== 'symbol' || l.id.startsWith('bm-') || !l.layout?.['text-field']) continue;
      try { map.setPaintProperty(l.id, 'text-color', '#B9BDCB'); map.setPaintProperty(l.id, 'text-halo-color', '#0F1117'); map.setPaintProperty(l.id, 'text-halo-width', 1.2); } catch { /* ignore */ }
    }
  }

  function schema() {
    const src = map.getStyle()?.sources || {};
    if (src.protomaps) return { source: 'protomaps', buildings: 'buildings', height: ['coalesce', ['get', 'height'], 8], base: ['coalesce', ['get', 'min_height'], 0], transitLayer: 'roads', transitFilter: ['==', ['get', 'kind'], 'rail'] };
    if (src.openmaptiles) return { source: 'openmaptiles', buildings: 'building', height: ['coalesce', ['get', 'render_height'], 8], base: ['coalesce', ['get', 'render_min_height'], 0], transitLayer: 'transportation', transitFilter: ['match', ['get', 'class'], ['rail', 'transit'], true, false] };
    return null;
  }
  function firstSymbolLayer() { return map.getStyle().layers.find((l) => l.type === 'symbol')?.id; }

  function addOverlays() {
    const sc = schema(); const p = pal(); const before = firstSymbolLayer();
    // Hide the style's own extrusions so ours (theme-coloured, labelled default height) is the only one.
    for (const l of map.getStyle().layers) if (l.type === 'fill-extrusion' && !l.id.startsWith('bm-')) map.setLayoutProperty(l.id, 'visibility', 'none');
    if (sc && !map.getLayer('bm-buildings-3d')) {
      map.addLayer({ id: 'bm-buildings-3d', type: 'fill-extrusion', source: sc.source, 'source-layer': sc.buildings, minzoom: 14,
        layout: { visibility: S.buildings3d && !S.lowBw && S.tier?.allow3D !== false ? 'visible' : 'none' },
        paint: { 'fill-extrusion-color': p.building, 'fill-extrusion-height': sc.height, 'fill-extrusion-base': sc.base, 'fill-extrusion-opacity': 0.82 } }, before);
    }
    if (sc && !map.getLayer('bm-transit')) {
      map.addLayer({ id: 'bm-transit', type: 'line', source: sc.source, 'source-layer': sc.transitLayer, filter: sc.transitFilter,
        layout: { visibility: S.transit ? 'visible' : 'none', 'line-cap': 'round' },
        paint: { 'line-color': p.transit, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 4], 'line-opacity': 0.9 } }, before);
    }
    if (!map.getSource('bm-routes')) map.addSource('bm-routes', { type: 'geojson', data: S.routes });
    const sel = ['==', ['get', 'selected'], true];
    if (!map.getLayer('bm-route-alt')) {
      map.addLayer({ id: 'bm-route-alt-casing', type: 'line', source: 'bm-routes', filter: ['!', sel], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.routeCasing, 'line-width': 9 } });
      map.addLayer({ id: 'bm-route-alt', type: 'line', source: 'bm-routes', filter: ['!', sel], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.alt, 'line-width': 6, 'line-opacity': 0.85 } });
      map.addLayer({ id: 'bm-route-casing', type: 'line', source: 'bm-routes', filter: sel, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.routeCasing, 'line-width': 11 } });
      map.addLayer({ id: 'bm-route', type: 'line', source: 'bm-routes', filter: sel, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.route, 'line-width': 7 } });
      applyDash();
    }
    // v0.4: transit itinerary legs (line colour from GTFS; walking dashed) and toll plazas on the route.
    if (!map.getSource('bm-legs')) map.addSource('bm-legs', { type: 'geojson', data: S.legs });
    if (!map.getLayer('bm-legs-ride')) {
      map.addLayer({ id: 'bm-legs-ride-casing', type: 'line', source: 'bm-legs', filter: ['==', ['get', 'kind'], 'ride'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.routeCasing, 'line-width': 10 } });
      map.addLayer({ id: 'bm-legs-ride', type: 'line', source: 'bm-legs', filter: ['==', ['get', 'kind'], 'ride'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['coalesce', ['get', 'color'], p.route], 'line-width': 6 } });
      map.addLayer({ id: 'bm-legs-walk', type: 'line', source: 'bm-legs', filter: ['!=', ['get', 'kind'], 'ride'], layout: { 'line-cap': 'round' }, paint: { 'line-color': p.alt, 'line-width': 4, 'line-dasharray': [0.5, 1.8] } });
    }
    if (!map.getSource('bm-tolls')) map.addSource('bm-tolls', { type: 'geojson', data: S.tolls });
    if (!map.getLayer('bm-tolls')) map.addLayer({ id: 'bm-tolls', type: 'circle', source: 'bm-tolls', paint: { 'circle-radius': 7, 'circle-color': '#B45309', 'circle-stroke-color': p.poiStroke, 'circle-stroke-width': 2.5 } });
    // v0.5 community incident reports (unverified): ring colour by type, opacity by confidence.
    if (!map.getSource('bm-incidents')) map.addSource('bm-incidents', { type: 'geojson', data: S.incidents || EMPTY });
    if (!map.getLayer('bm-incidents')) map.addLayer({ id: 'bm-incidents', type: 'circle', source: 'bm-incidents', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 6, 16, 11], 'circle-color': ['match', ['get', 'type'], 'pothole', '#B45309', 'waterlogging', '#0E7490', 'closure', '#B91C1C', 'police', '#1D4ED8', '#6B7280'], 'circle-opacity': ['match', ['get', 'confidence'], 'high', 0.95, 'medium', 0.8, 0.6], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 } });
    if (!map.getSource('bm-pois')) map.addSource('bm-pois', { type: 'geojson', data: S.pois });
    if (!map.getLayer('bm-pois')) map.addLayer({ id: 'bm-pois', type: 'circle', source: 'bm-pois', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 8], 'circle-color': ['coalesce', ['get', 'color'], p.poi], 'circle-stroke-color': p.poiStroke, 'circle-stroke-width': 2 } });
    ctx.emit('overlays');
  }

  // v0.5 dedicated driving style (high contrast): wider route with a strong casing, amber route at night,
  // POI icons/labels hidden so roads and the route dominate. Day/night is chosen by sunrise/sunset (shared/sun.js).
  const DRIVE = { day: { route: '#1F2A9E', casing: '#FFFFFF', width: 11, casingW: 16 }, night: { route: '#FFC233', casing: '#0B0D14', width: 11, casingW: 16 } };
  const isPoiLayer = (l) => l.type === 'symbol' && !l.id.startsWith('bm-') && /poi|pois|landuse|aerodrome_label|airport/i.test(`${l.id} ${l['source-layer'] || ''}`);
  function applyDrivingPaint() {
    if (!map.getLayer('bm-route')) return;
    const d = S.driving ? DRIVE[S.driving] : null; const p = pal();
    map.setPaintProperty('bm-route', 'line-color', d ? d.route : p.route);
    map.setPaintProperty('bm-route', 'line-width', d ? d.width : 7);
    map.setPaintProperty('bm-route-casing', 'line-color', d ? d.casing : p.routeCasing);
    map.setPaintProperty('bm-route-casing', 'line-width', d ? d.casingW : 11);
    for (const l of map.getStyle().layers) if (isPoiLayer(l)) { try { map.setLayoutProperty(l.id, 'visibility', d ? 'none' : 'visible'); } catch { /* ignore */ } }
  }
  function setDriving(v) {
    const before = mapTheme();
    S.driving = v || null;
    if (mapTheme() !== before) apply({ reason: 'driving' }); else applyDrivingPaint();
  }

  function applyDash() {
    if (!map.getLayer('bm-route')) return;
    const dashed = (S.routes.features || []).some((f) => f.properties?.fallback);
    map.setPaintProperty('bm-route', 'line-dasharray', dashed ? [1, 1.6] : undefined);
  }
  function setLabelLanguage() {
    const lang = ctx.lang();
    for (const l of map.getStyle().layers) {
      if (l.type === 'symbol' && l.layout?.['text-field'] && !l.id.startsWith('bm-')) {
        try { map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', `name:${lang}`], ['get', 'name:en'], ['get', 'name']]); } catch { /* layer uses another field */ }
      }
    }
  }

  // ---- auto offline fallback: style load failure or a burst of tile errors from the network source ----
  map.on('error', (e) => {
    if (S.offlineActive) return;
    const msg = String(e?.error?.message || e?.error || '');
    const tileOrStyle = e.sourceId || e.tile || /style|Failed to fetch|NetworkError|AJAXError|load/i.test(msg);
    if (!tileOrStyle) return;
    const now = Date.now();
    S.errors = [...S.errors.filter((x) => now - x < 15000), now];
    const styleFailed = !map.isStyleLoaded() && !map.getStyle()?.layers?.length;
    if (styleFailed || S.errors.length >= 6) goOffline('network');
  });
  async function goOffline(reason) {
    if (S.auto || S.offlineActive) return;
    S.auto = true;
    await apply({ reason });
    if (S.offlineActive) ctx.toast(ctx.t('auto_offline'));
  }
  window.addEventListener('offline', () => { if (!S.offlineActive) { S.auto = true; apply({ reason: 'offline-event' }); ctx.toast(ctx.t('auto_offline')); } });
  window.addEventListener('online', () => { if (S.auto && !S.forceOffline) { S.auto = false; apply({ reason: 'online' }); ctx.toast(ctx.t('online_back')); } });

  return {
    apply, setLabelLanguage, schema, setDriving,
    get driving() { return S.driving || null; },
    get offline() { return S.offlineActive; },
    get autoOffline() { return S.auto; },
    get pref() { return S.pref; },
    get routes() { return S.routes; },
    get pois() { return S.pois; },
    get buildings3d() { return S.buildings3d; },
    get transit() { return S.transit; },
    get forceOffline() { return S.forceOffline; },
    setPref(v) { S.pref = v; store.setItem('bm-map-style', v); apply({ reason: 'pref' }); },
    setForceOffline(v) { S.forceOffline = !!v; store.setItem('mapos-offline', v ? '1' : '0'); if (!v) S.auto = false; apply({ reason: 'force' }); },
    set3D(v) { S.buildings3d = !!v; store.setItem('bm-3d', v ? '1' : '0'); if (map.getLayer('bm-buildings-3d')) map.setLayoutProperty('bm-buildings-3d', 'visibility', v && !S.lowBw && S.tier?.allow3D !== false ? 'visible' : 'none'); },
    setTransit(v) { S.transit = !!v; store.setItem('bm-transit', v ? '1' : '0'); if (map.getLayer('bm-transit')) map.setLayoutProperty('bm-transit', 'visibility', v ? 'visible' : 'none'); },
    setRoutes(fc) { S.routes = fc || EMPTY; map.getSource('bm-routes')?.setData(S.routes); applyDash(); },
    setIncidents(fc) { S.incidents = fc || EMPTY; map.getSource('bm-incidents')?.setData(S.incidents); },
    get incidents() { return S.incidents || EMPTY; },
    setPois(fc) { S.pois = fc || EMPTY; map.getSource('bm-pois')?.setData(S.pois); },
    setLegs(fc) { S.legs = fc || EMPTY; map.getSource('bm-legs')?.setData(S.legs); },
    setTolls(fc) { S.tolls = fc || EMPTY; map.getSource('bm-tolls')?.setData(S.tolls); },
    get legs() { return S.legs; },
    get tolls() { return S.tolls; },
    get lowBandwidth() { return S.lowBw; },
    /** Apply the low-bandwidth policy (web/lib/bandwidth.js): zoom cap, no low-zoom prefetch, no 3D. */
    applyBandwidth(policy) {
      // The zoom cap and prefetch delta are map options and apply at any time, including while tiles are still
      // loading (MapLibre's isStyleLoaded()/loaded() are false then); only the layer change needs a loaded style.
      S.lowBw = !!policy.active;
      map.setMaxZoom(policy.maxZoom);
      if (typeof map.setPrefetchZoomDelta === 'function') map.setPrefetchZoomDelta(policy.prefetchZoomDelta);
      try { if (map.getLayer('bm-buildings-3d')) map.setLayoutProperty('bm-buildings-3d', 'visibility', policy.allow3D && S.buildings3d && S.tier?.allow3D !== false ? 'visible' : 'none'); } catch { /* style mid-swap: style.load re-applies */ }
      if (!policy.allow3D && map.getPitch() > 0) ctx.cam?.ease?.({ pitch: 0, duration: 300 });
    },
    /** v0.6 device tier (web/lib/device-tier.js): 3D/terrain allowed, label density (later minzoom), max pitch. */
    applyTier(policy) {
      S.tier = policy;
      if (!policy) return;
      map.setMaxPitch(policy.maxPitch ?? 70);
      try {
        if (!policy.allow3D && map.getLayer('bm-buildings-3d')) map.setLayoutProperty('bm-buildings-3d', 'visibility', 'none');
        else if (policy.allow3D && map.getLayer('bm-buildings-3d')) map.setLayoutProperty('bm-buildings-3d', 'visibility', S.buildings3d && !S.lowBw ? 'visible' : 'none');
        if (!policy.allowTerrain && map.getTerrain?.()) map.setTerrain(null);
      } catch { /* style mid-swap: style.load re-applies */ }
      const shift = labelMinzoomShift(policy.labelDensity);
      S.labelShift = shift;
      let layers = []; try { layers = map.getStyle()?.layers || []; } catch { /* style mid-swap */ }
      for (const l of layers) {
        if (l.type !== 'symbol' || l.id.startsWith('bm-')) continue;
        if (S.labelZoom[l.id] == null) S.labelZoom[l.id] = l.minzoom ?? 0;
        try { map.setLayerZoomRange(l.id, Math.min(22, S.labelZoom[l.id] + shift), l.maxzoom ?? 24); } catch { /* ignore */ }
      }
    },
    get tier() { return S.tier; },
    get labelShift() { return S.labelShift || 0; },
    themeChanged() { if (S.pref === 'auto') apply({ reason: 'theme' }); },
    mapTheme,
  };
}
