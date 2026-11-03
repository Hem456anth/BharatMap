// v0.7.20 (G10) "your route, your voice": no silent route changes (pure, unit-tested). Evidence: silent reroutes and a
// forced AI voice are top complaints about Google Maps in 2026 (GAPS_RANKED.md G10, USER_FEEDBACK theme F).
//   • Off-route (the existing 3-fix rule) → a new route is needed; it keeps the user's choices (main roads, avoid tolls /
//     highways, mode) and is announced, never silent.
//   • While ON the route, a faster alternative is only OFFERED ("Faster route · saves N min — Switch / Keep"); it is
//     taken automatically only when the user turned on "Switch to faster routes automatically" (default off), and then
//     announced. Offers need a saving of ≥ 2 min AND ≥ 10 % of the remaining time.
export const FASTER_MIN_SAVING_S = 120;
export const FASTER_MIN_FRACTION = 0.1;
export const FASTER_CHECK_MS = 5 * 60_000;
export const AUTO_ACCEPT_KEY = 'bm-auto-faster';

/** Should a candidate route be offered? remainingS = time left on the current route. */
export function fasterRouteOffer(remainingS, candidate, { minSavingS = FASTER_MIN_SAVING_S, minFraction = FASTER_MIN_FRACTION } = {}) {
  if (!candidate || candidate.fallback || !Number.isFinite(candidate.duration_s) || !Number.isFinite(remainingS) || remainingS <= 0) return { offer: false, savedS: 0 };
  const savedS = Math.round(remainingS - candidate.duration_s);
  return { offer: savedS >= minSavingS && savedS >= remainingS * minFraction, savedS };
}
export const autoAcceptFaster = (storage) => storage?.getItem?.(AUTO_ACCEPT_KEY) === '1';
export const setAutoAcceptFaster = (on, storage) => storage?.setItem?.(AUTO_ACCEPT_KEY, on ? '1' : '0');

/** Routing options a reroute must keep (the user's choices for this trip). */
export function rerouteOptions(navOpts = {}) {
  return { mainRoads: !!navOpts.mainRoads, avoidTolls: !!navOpts.avoidTolls, avoidHighways: !!navOpts.avoidHighways };
}
