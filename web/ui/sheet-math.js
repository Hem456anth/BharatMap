// Bottom-sheet detent geometry and snapping. Pure (unit-tested).
export const DETENTS = ['peek', 'half', 'full'];

/** Heights (px) for each detent given the viewport height. */
export function detentHeights(viewportH, { peek = 120, topGap = 72, halfRatio = 0.5, minHalf = 300 } = {}) {
  const full = Math.max(peek + 40, viewportH - topGap);
  const half = Math.min(full - 40, Math.max(Math.min(minHalf, full - 40), Math.round(viewportH * halfRatio)));
  return { peek: Math.min(peek, half - 40), half, full };
}

/**
 * Pick the detent to settle on after a drag.
 * - |velocity| > flingV (px/ms, + = growing taller) moves one detent in the fling direction
 * - |velocity| > jumpV jumps to the extreme detent
 * - otherwise the nearest detent wins
 */
export function snapDetent(heights, currentH, velocity = 0, { flingV = 0.5, jumpV = 2.0, from = null } = {}) {
  const order = DETENTS.map((d) => [d, heights[d]]).sort((a, b) => a[1] - b[1]);
  if (Math.abs(velocity) >= jumpV) return velocity > 0 ? order[order.length - 1][0] : order[0][0];
  if (Math.abs(velocity) >= flingV) {
    if (velocity > 0) { const up = order.find(([, h]) => h > currentH + 1); return (up || order[order.length - 1])[0]; }
    const down = [...order].reverse().find(([, h]) => h < currentH - 1); return (down || order[0])[0];
  }
  let best = order[0];
  for (const o of order) if (Math.abs(o[1] - currentH) < Math.abs(best[1] - currentH)) best = o;
  return best[0];
}

/** Clamp a dragged height, with rubber-banding beyond the extremes. */
export function clampHeight(heights, h) {
  const min = heights.peek, max = heights.full;
  if (h < min) return min - Math.min(40, (min - h) * 0.25);
  if (h > max) return max + Math.min(24, (h - max) * 0.2);
  return h;
}

/** Keyboard/a11y: next detent up or down from the current one. */
export function stepDetent(current, dir) {
  const i = DETENTS.indexOf(current);
  return DETENTS[Math.max(0, Math.min(DETENTS.length - 1, i + (dir > 0 ? 1 : -1)))];
}
/** Tap on the grabber cycles peek → half → full → half → peek … */
export function cycleDetent(current, lastDir = 1) {
  if (current === 'peek') return { detent: 'half', dir: 1 };
  if (current === 'full') return { detent: 'half', dir: -1 };
  return lastDir > 0 ? { detent: 'full', dir: 1 } : { detent: 'peek', dir: -1 };
}
