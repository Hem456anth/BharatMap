// v0.7.18 (A5): a visible banner when the map cannot draw — WebGL unavailable, the style never loads, or tiles keep
// failing with no working offline fallback. Never a silent blank map; always Retry, plus low-bandwidth / offline map
// when they can help. The decision is the pure mapHealth() in lib/ux.js (unit-tested).
import { mapHealth } from '../lib/ux.js';

export function initMapHealth(ctx, { webgl = true, timeoutMs = 15000 } = {}) {
  const { map } = ctx;
  const $ = (id) => document.getElementById(id);
  const el = $('mapFail');
  const S = { appliedAt: Date.now(), styleLoaded: false, errors: [], dismissed: null, current: null, timer: null };

  function observe() {
    const now = Date.now();
    S.errors = S.errors.filter((t) => now - t < 15000);
    const st = ctx.style;
    return {
      webgl, styleLoaded: S.styleLoaded, sinceApplyMs: now - S.appliedAt, timeoutMs, errors: S.errors.length,
      offlineActive: !!st?.offline, offlineAvailable: !(st?.autoOffline && !st?.offline) && !st?.forceOffline,
      lowBw: !!ctx.bw?.policy.active, online: navigator.onLine !== false,
    };
  }
  function render(h) {
    S.current = h;
    if (!h || S.dismissed === h.reason) { el.hidden = true; document.documentElement.classList.remove('map-failed'); return; }
    $('mapFailTitle').textContent = ctx.t(h.reason === 'webgl' ? 'mf_webgl' : h.reason === 'timeout' ? 'mf_timeout' : 'mf_tiles');
    $('mapFailBody').textContent = h.reason === 'webgl' ? `${ctx.t('mf_body_webgl')} ${ctx.t('mf_body')}` : ctx.t('mf_body');
    $('mapFailLowBw').hidden = !h.actions.includes('lowbw');
    $('mapFailOffline').hidden = !h.actions.includes('offline');
    el.dataset.reason = h.reason;
    el.hidden = false;
    document.documentElement.classList.add('map-failed');
  }
  const check = () => render(mapHealth(observe()));

  ctx.on('mapstyle', () => {
    S.appliedAt = Date.now(); S.styleLoaded = false; S.errors = [];
    clearTimeout(S.timer); S.timer = setTimeout(check, timeoutMs + 50);
  });
  map.on('style.load', () => { S.styleLoaded = true; check(); });
  // A tile that actually loaded clears the error burst ('idle' alone is not proof: it also fires after failed tiles).
  map.on('data', (e) => { if (e.dataType === 'source' && e.tile?.state === 'loaded' && S.errors.length) { S.errors = []; check(); } });
  map.on('idle', () => { if (map.isStyleLoaded() && !S.styleLoaded) { S.styleLoaded = true; check(); } });
  map.on('error', (e) => {
    const msg = String(e?.error?.message || e?.error || '');
    if (!(e.sourceId || e.tile || /style|Failed to fetch|NetworkError|AJAXError|load|tile/i.test(msg))) return;
    S.errors.push(Date.now());
    // Give the automatic offline fallback (map/style.js) a moment to switch before judging.
    setTimeout(check, 400);
  });
  map.on('webglcontextlost', () => render(mapHealth({ ...observe(), webgl: false })));
  map.on('webglcontextrestored', () => { S.current = null; check(); });

  $('mapFailRetry').onclick = () => {
    if (S.current?.reason === 'webgl') { location.reload(); return; }
    S.dismissed = null; render(null);
    ctx.style.apply({ reason: 'retry' });
  };
  $('mapFailLowBw').onclick = () => { ctx.bw.set('on'); S.dismissed = null; render(null); ctx.style.apply({ reason: 'retry-lowbw' }); };
  $('mapFailOffline').onclick = () => { render(null); ctx.style.setForceOffline(true); };
  $('mapFailClose').onclick = () => { S.dismissed = S.current?.reason || null; render(null); };
  ctx.on('lang', () => { if (S.current) render(S.current); });
  if (!webgl) render(mapHealth({ ...observe(), webgl: false }));
  S.timer = setTimeout(check, timeoutMs + 50);

  return { check, observe, get state() { return S.current; }, render: (h) => render(h) };
}
