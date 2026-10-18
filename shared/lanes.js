// Lane guidance: parse lanes from OSRM step intersections (lanes[].indications + valid) and Valhalla maneuvers
// (lanes[].directions / valid / active bitmasks), and render a lane strip with original SVG arrows. Pure (unit-tested).

// Valhalla turn-lane bit flags (valhalla/baldr/turnlanes.h), as returned in maneuver.lanes[].directions/valid/active.
const VBITS = [[1, 'none'], [2, 'straight'], [4, 'sharp left'], [8, 'left'], [16, 'slight left'], [32, 'slight right'], [64, 'right'], [128, 'sharp right'], [256, 'uturn'], [512, 'merge to left'], [1024, 'merge to right']];
const KNOWN = new Set(['none', 'straight', 'sharp left', 'left', 'slight left', 'slight right', 'right', 'sharp right', 'uturn', 'merge to left', 'merge to right']);

/** OSRM intersection.lanes → [{ indications: [...], valid }] (null when absent). */
export function parseOsrmLanes(lanes) {
  if (!Array.isArray(lanes) || !lanes.length) return null;
  return lanes.map((l) => ({ indications: (Array.isArray(l.indications) && l.indications.length ? l.indications : ['none']).map((x) => (KNOWN.has(x) ? x : 'none')), valid: !!l.valid }));
}
/**
 * Every intersection with lane data on an OSRM route, in order: [{ location:[lng,lat], lanes, stepIndex, maneuver }].
 * OSRM gives approach lanes on the intersection they apply to — the maneuver point (intersections[0]) or any
 * intersection passed along a step. `maneuver` is true for the step's own maneuver intersection.
 */
export function collectOsrmLanes(rawSteps) {
  const out = [];
  (rawSteps || []).forEach((s, si) => (s.intersections || []).forEach((x, k) => {
    const lanes = parseOsrmLanes(x.lanes);
    if (lanes && Array.isArray(x.location)) out.push({ location: x.location, lanes, stepIndex: si, maneuver: k === 0 });
  }));
  return out;
}
/** Valhalla maneuver.lanes → same shape. A lane is valid when its `valid` (or `active`) mask is non-zero. */
export function parseValhallaLanes(lanes) {
  if (!Array.isArray(lanes) || !lanes.length) return null;
  return lanes.map((l) => {
    const dirs = VBITS.filter(([b]) => (Number(l.directions) & b) !== 0).map(([, n]) => n);
    return { indications: dirs.length ? dirs : ['none'], valid: !!(Number(l.valid) || Number(l.active)) };
  });
}
/** True when lane guidance is worth showing (some lanes valid, some not). */
export function laneHintUseful(lanes) {
  return Array.isArray(lanes) && lanes.length >= 2 && lanes.some((l) => l.valid) && lanes.some((l) => !l.valid);
}

// ---- Original SVG arrows (24×32 viewBox; drawn for Bharat Map) ----
const ARROWS = {
  straight: 'M12 28V8M12 4l-5 6h10z',
  left: 'M14 28V16a4 4 0 0 0-4-4H6M3 12l6-5v10z',
  right: 'M10 28V16a4 4 0 0 1 4-4h4M21 12l-6-5v10z',
  'slight left': 'M14 28V18l-6-8M5 6l7 1-5 6z',
  'slight right': 'M10 28V18l6-8M19 6l-7 1 5 6z',
  'sharp left': 'M14 28V12l-6 8M4 24l2-8 6 4z',
  'sharp right': 'M10 28V12l6 8M20 24l-2-8-6 4z',
  uturn: 'M16 28V12a4 4 0 0 0-8 0v6M4 16l4 6 4-6z',
  'merge to left': 'M16 28v-8l-8-8V6M8 2l-4 6h8z',
  'merge to right': 'M8 28v-8l8-8V6M16 2l-4 6h8z',
  none: 'M12 28V8M12 4l-5 6h10z',
};
/** One lane: overlaid arrows for each indication; `primary` (the one matching the maneuver) drawn strongest. */
export function laneSvg(lane, { size = 28, primary = null } = {}) {
  const ind = lane.indications || ['none'];
  const paths = ind.map((d) => {
    const strong = lane.valid && (!primary || d === primary || ind.length === 1);
    return `<path d="${ARROWS[d] || ARROWS.none}" fill="none" stroke="currentColor" stroke-width="${strong ? 2.6 : 1.8}" stroke-linecap="round" stroke-linejoin="round" opacity="${strong ? 1 : 0.45}"/>`;
  }).join('');
  return `<svg class="lane-svg" viewBox="0 0 24 32" width="${Math.round(size * 0.75)}" height="${size}" aria-hidden="true">${paths}</svg>`;
}
const MOD_TO_IND = { left: 'left', right: 'right', 'slight left': 'slight left', 'slight right': 'slight right', 'sharp left': 'sharp left', 'sharp right': 'sharp right', straight: 'straight', uturn: 'uturn' };
/** Lane strip HTML for a step (empty string when there is nothing useful to show). */
export function laneStripHtml(lanes, modifier, { label = 'Lanes' } = {}) {
  if (!Array.isArray(lanes) || !lanes.length) return '';
  const primary = MOD_TO_IND[modifier] || null;
  const desc = lanes.map((l, i) => `${i + 1}: ${l.indications.join('/')}${l.valid ? ' ✓' : ''}`).join(', ');
  return `<div class="lane-strip" role="img" aria-label="${label}: ${desc}">${lanes.map((l) => `<span class="lane${l.valid ? ' ok' : ''}">${laneSvg(l, { primary })}</span>`).join('')}</div>`;
}
