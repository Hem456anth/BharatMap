// v0.7.20 (G7) arrival / get-off alarms (pure, unit-tested). Foreground only: the alarm is checked on position fixes the
// app already receives (navigation, or a foreground watch started for the alarm) — no geofence API, no background
// location beyond the existing navigation foreground service. Evidence: Where is my Train's destination alarm, a
// Hyderabad commuter's self-built "alarm within ~1 km of your stop" (re-staging/competitor-2026-11/GAPS_RANKED.md G7).
//
// Rules: fires ONCE when `confirmFixes` consecutive fixes are within `radiusM` of the target; a fix whose accuracy
// circle is larger than max(radiusM, 150 m) is ignored (a jumpy indoor fix must not wake you up early); a fix that
// is very stale (> 60 s old) is ignored.
const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
export function distanceM(a, b) {
  const x = rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2)); const y = rad(b.lat - a.lat);
  return Math.hypot(x, y) * R;
}
/** Default radius by alarm kind: metro get-off ≈ one station ahead (HMRL stations are ~1–1.5 km apart). */
export const ALARM_RADIUS_M = { destination: 500, metro: 1000, rail: 3000, bus: 600, stop: 600 };
export const ALARM_RADII = [300, 500, 1000, 2000];

export function createProximityAlarm({ id = null, target, radiusM, kind = 'destination', label = '', confirmFixes = 2 } = {}) {
  if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) throw new Error('invalid_target');
  const r = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : (ALARM_RADIUS_M[kind] || 500);
  let inside = 0, fired = false, last = null, cancelled = false;
  return {
    id: id || `al_${kind}_${target.lat.toFixed(5)}_${target.lng.toFixed(5)}`, kind, label, target, radiusM: r,
    get fired() { return fired; }, get cancelled() { return cancelled; }, get distanceM() { return last; },
    /** Feed a fix { lat, lng, accuracy, ts }. Returns { fire: boolean, distanceM }. */
    update(fix, now = Date.now()) {
      if (fired || cancelled || !fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return { fire: false, distanceM: last };
      if (Number.isFinite(fix.accuracy) && fix.accuracy > Math.max(r, 150)) return { fire: false, distanceM: last, ignored: 'accuracy' };
      if (Number.isFinite(fix.ts) && now - fix.ts > 60_000) return { fire: false, distanceM: last, ignored: 'stale' };
      last = Math.round(distanceM(fix, target));
      inside = last <= r ? inside + 1 : 0;
      if (inside >= confirmFixes) { fired = true; return { fire: true, distanceM: last }; }
      return { fire: false, distanceM: last };
    },
    cancel() { cancelled = true; },
  };
}
