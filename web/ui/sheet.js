// Draggable bottom sheet with three detents (peek / half / full), touch + mouse drag with snap and fling,
// keyboard control on the grabber (Enter/Space cycle, ↑/↓ step, Home/End extremes) and screen-reader labels.
// On wide screens it becomes a floating side panel; the same detents set its height.
import { detentHeights, snapDetent, clampHeight, stepDetent, cycleDetent, DETENTS } from './sheet-math.js';

const INTERACTIVE = 'input, select, textarea, button, a, label, [role=tab], [contenteditable], .no-drag';

export function createSheet(ctx) {
  const el = document.getElementById('sheet');
  const body = document.getElementById('sheetBody');
  const handle = document.getElementById('sheetHandle');
  const wide = window.matchMedia('(min-width: 900px)');
  let detent = el.dataset.detent || 'half', lastDir = 1, heights = compute(), drag = null;

  function compute() {
    const vh = window.innerHeight;
    return wide.matches ? detentHeights(vh, { peek: 132, topGap: 92, halfRatio: 0.55, minHalf: 360 }) : detentHeights(vh, { peek: 120, topGap: 72 });
  }
  function setHeight(h, animate) {
    el.classList.toggle('dragging', !animate);
    el.style.height = `${Math.round(h)}px`;
    document.documentElement.style.setProperty('--sheet-h', `${Math.round(Math.min(h, heights.full))}px`);
  }
  function set(d, { animate = true, silent = false } = {}) {
    if (!DETENTS.includes(d)) return;
    const prev = detent; detent = d;
    el.dataset.detent = d;
    setHeight(heights[d], animate && !ctx.cam?.reduced());
    handle.setAttribute('aria-label', ctx.tf('sheet_handle', { state: ctx.t(`detent_${d}`) }));
    handle.setAttribute('aria-expanded', String(d !== 'peek'));
    if (!silent && prev !== d) ctx.emit('sheet', { detent: d, prev });
  }

  // ---- drag ----
  function onDown(e) {
    if (e.button > 0) return;
    const fromHandle = handle.contains(e.target) || e.target.closest('.view-h');
    if (!fromHandle) {
      if (e.target.closest(INTERACTIVE)) return;
      if (!el.contains(e.target)) return;
      if (detent === 'full' && !wide.matches) return; // content scrolls at full; drag from the grabber/header
      if (wide.matches) return; // desktop panel: drag only from grabber/header, wheel scrolls content
    }
    drag = { id: e.pointerId, y0: e.clientY, h0: el.getBoundingClientRect().height, started: false, samples: [[performance.now(), e.clientY]], fromHandle };
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.started) {
      if (Math.abs(dy) < 6) return;
      drag.started = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    e.preventDefault();
    // Mobile: dragging up grows the sheet. Desktop panel is top-anchored: dragging down grows it.
    const sign = wide.matches ? 1 : -1;
    setHeight(clampHeight(heights, drag.h0 + sign * dy), false);
    drag.samples.push([performance.now(), e.clientY]);
    if (drag.samples.length > 6) drag.samples.shift();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.started) return;
    const [t0, y0] = d.samples[0]; const [t1, y1] = d.samples[d.samples.length - 1];
    const sign = wide.matches ? 1 : -1;
    const v = t1 > t0 ? (sign * (y1 - y0)) / (t1 - t0) : 0; // px/ms, + = taller
    const target = snapDetent(heights, el.getBoundingClientRect().height, v);
    lastDir = heights[target] >= heights[detent] ? 1 : -1;
    set(target);
    // swallow the click that follows a drag
    const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    el.addEventListener('click', kill, { capture: true, once: true });
    setTimeout(() => el.removeEventListener('click', kill, { capture: true }), 50);
  }
  el.addEventListener('pointerdown', (e) => {
    drag = null;
    onDown(e);
    if (!drag) return;
    // Track the gesture on window so it survives pointer-capture quirks (Android WebView, emulators).
    const move = (ev) => onMove(ev);
    const up = (ev) => { onUp(ev); cleanup(); };
    const cancel = (ev) => { if (drag?.id === ev.pointerId) { drag = null; set(detent); } cleanup(); };
    const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });

  // ---- grabber: tap + keyboard ----
  handle.addEventListener('click', () => { const c = cycleDetent(detent, lastDir); lastDir = c.dir; set(c.detent); });
  handle.addEventListener('keydown', (e) => {
    const map = { ArrowUp: () => stepDetent(detent, wide.matches ? -1 : 1), ArrowDown: () => stepDetent(detent, wide.matches ? 1 : -1), Home: () => 'full', End: () => 'peek', PageUp: () => 'full', PageDown: () => 'peek' };
    if (map[e.key]) { e.preventDefault(); set(map[e.key]()); }
  });
  // Keyboard users tabbing into a collapsed sheet get it expanded.
  body.addEventListener('focusin', () => { if (detent === 'peek') set('half'); });

  const relayout = () => { heights = compute(); set(detent, { animate: false, silent: true }); };
  window.addEventListener('resize', relayout);
  wide.addEventListener?.('change', relayout);
  set(detent, { animate: false, silent: true });

  return {
    el, body,
    get detent() { return detent; },
    get heights() { return heights; },
    set,
    ensureAtLeast(d) { if (DETENTS.indexOf(detent) < DETENTS.indexOf(d)) set(d); },
    isWide: () => wide.matches,
    hide(v) { el.hidden = !!v; document.documentElement.classList.toggle('sheet-hidden', !!v); },
    coverage() {
      if (el.hidden) return { bottom: 0, left: 0 };
      if (wide.matches) return { bottom: 0, left: el.getBoundingClientRect().right };
      return { bottom: Math.min(heights[detent], heights.half), left: 0 };
    },
  };
}

// ---- view router inside the sheet (home / results / place / directions / …) with a back stack ----
export function createViews(ctx) {
  const views = [...document.querySelectorAll('#sheetBody .view')];
  const stack = ['home'];
  let current = 'home';
  function show(name, { push = true, detent: d0, focus = true } = {}) {
    let detent = d0;
    if (!views.some((v) => v.dataset.view === name)) return;
    if (name === 'home') stack.length = 1;
    else if (push && stack[stack.length - 1] !== name) stack.push(name);
    current = name;
    for (const v of views) v.hidden = v.dataset.view !== name;
    document.getElementById('sheetBody').scrollTop = 0;
    // Desktop side panel: content views use the full panel height (there is no map to keep visible below it).
    if (detent && ctx.sheet.isWide() && name !== 'home' && detent === 'half') detent = 'full';
    if (detent) ctx.sheet.set(detent); else if (name !== 'home') ctx.sheet.ensureAtLeast(ctx.sheet.isWide() ? 'full' : 'half');
    if (focus) { const h = views.find((v) => v.dataset.view === name).querySelector('h3'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
    ctx.emit('view', { name });
  }
  function back() {
    if (stack.length <= 1) return false;
    const leaving = stack.pop();
    ctx.emit('view-leave', { name: leaving });
    show(stack[stack.length - 1], { push: false });
    return true;
  }
  document.getElementById('sheetBody').addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { back(); }
    else if (e.target.closest('[data-home]')) { const leaving = current; ctx.emit('view-leave', { name: leaving, home: true }); show('home', { detent: 'half' }); }
  });
  return { show, back, get current() { return current; }, get depth() { return stack.length; } };
}
