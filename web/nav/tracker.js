// Route progress, off-route detection and arrival — pure functions (unit-tested).
// Distances use a local equirectangular projection, accurate to well under 1 m at city scale.

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

/** Metres between two [lng,lat] points (fast, local). */
export function distM(a, b) {
  const x = rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2));
  const y = rad(b[1] - a[1]);
  return Math.hypot(x, y) * R;
}
export function bearingDeg(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function cumulative(coords) {
  const c = [0];
  for (let i = 1; i < coords.length; i++) c.push(c[i - 1] + distM(coords[i - 1], coords[i]));
  return c;
}

/**
 * Project point p [lng,lat] onto the polyline. Returns the closest point, the perpendicular
 * distance (m), the segment index and the distance along the line (m).
 * `hint` limits the search window to segments near the previous match (performance + avoids
 * snapping to a parallel return leg); pass null for a full scan.
 */
export function projectOnRoute(coords, cum, p, hint = null) {
  let best = { dist: Infinity, index: 0, along: 0, point: coords[0] };
  const from = hint == null ? 0 : Math.max(0, hint - 30);
  const to = hint == null ? coords.length - 1 : Math.min(coords.length - 1, hint + 200);
  const k = Math.cos(rad(p[1]));
  for (let i = from; i < to; i++) {
    const a = coords[i], b = coords[i + 1];
    const ax = (a[0] - p[0]) * k, ay = a[1] - p[1];
    const bx = (b[0] - p[0]) * k, by = b[1] - p[1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let tt = len2 ? -(ax * dx + ay * dy) / len2 : 0;
    tt = Math.max(0, Math.min(1, tt));
    const q = [a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt];
    const d = distM(p, q);
    if (d < best.dist) best = { dist: d, index: i, along: cum[i] + distM(a, q), point: q };
  }
  if (hint != null && best.dist > 60) return projectOnRoute(coords, cum, p, null);
  return best;
}

/** Along-route distance of each step's maneuver (sum of previous step distances, scaled to the geometry length). */
export function stepOffsets(steps, totalM) {
  const raw = []; let acc = 0;
  for (const s of steps) { raw.push(acc); acc += s.distance_m || 0; }
  const k = acc > 0 ? totalM / acc : 1;
  return raw.map((x) => x * k);
}

/**
 * Off-route detector: triggers when `fixes` consecutive positions are more than `thresholdM`
 * from the route. Positions with poor accuracy widen the threshold (accuracy/2), so a noisy
 * fix does not cause a false reroute.
 */
export class OffRouteDetector {
  constructor({ thresholdM = 50, fixes = 3 } = {}) { this.thresholdM = thresholdM; this.fixes = fixes; this.count = 0; }
  update(distanceM, accuracyM = 0) {
    const limit = this.thresholdM + Math.max(0, (accuracyM || 0) - 20) / 2;
    this.count = distanceM > limit ? this.count + 1 : 0;
    return this.count >= this.fixes;
  }
  reset() { this.count = 0; }
}

/**
 * Create a route progress tracker. update(fix) returns the navigation state used by the UI:
 * current step index (the NEXT maneuver), distance to it, remaining distance/time, off-route and arrival.
 */
export function createTracker(route, { offRoute = new OffRouteDetector(), arriveM = 25 } = {}) {
  const coords = route.geometry.coordinates;
  const cum = cumulative(coords);
  const total = cum[cum.length - 1];
  const offsets = stepOffsets(route.steps, total);
  const durTotal = route.duration_s || 0;
  let hint = 0, lastAlong = 0;
  return {
    total, offsets, coords, cumulative: cum,
    update(fix) {
      const p = [fix.lng, fix.lat];
      const proj = projectOnRoute(coords, cum, p, hint);
      hint = proj.index;
      // Never move backwards more than 30 m (GPS jitter on the same road).
      const along = Math.max(proj.along, lastAlong - 30);
      lastAlong = Math.max(lastAlong, along);
      const off = offRoute.update(proj.dist, fix.accuracy);
      let stepIndex = offsets.findIndex((o, i) => i > 0 && o > along + 5);
      if (stepIndex < 0) stepIndex = route.steps.length - 1;
      const remainingM = Math.max(0, total - along);
      const toDest = distM(p, coords[coords.length - 1]);
      return {
        stepIndex,
        distanceToManeuverM: Math.max(0, offsets[stepIndex] - along),
        remainingM,
        remainingS: total > 0 ? Math.round((durTotal * remainingM) / total) : 0,
        offRouteM: proj.dist,
        offRoute: off,
        snapped: proj.point,
        arrived: remainingM <= arriveM || (toDest <= arriveM && proj.dist <= 50),
        progress: total ? along / total : 1,
        along,
      };
    },
  };
}

/** Point at distance d (m) along the polyline, plus the bearing there (used by the drive simulator). */
export function pointAtDistance(coords, cum, d) {
  if (d <= 0) return { point: coords[0], bearing: bearingDeg(coords[0], coords[1] || coords[0]) };
  const total = cum[cum.length - 1];
  if (d >= total) { const n = coords.length; return { point: coords[n - 1], bearing: bearingDeg(coords[Math.max(0, n - 2)], coords[n - 1]), done: true }; }
  let i = 1; while (cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1]; const tt = seg ? (d - cum[i - 1]) / seg : 0;
  const a = coords[i - 1], b = coords[i];
  return { point: [a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt], bearing: bearingDeg(a, b) };
}
