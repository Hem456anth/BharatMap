// v0.7.20 (G1) India road-quality guardrails — the "Prefer main roads" preference (pure, unit-tested).
// The costing options themselves live in shared/valhalla.js (MAIN_ROADS). Evidence for the gap:
// re-staging/competitor-2026-11/GAPS_RANKED.md G1 (narrow lanes in car mode, service lanes / dead ends; OsmAnd's
// main-roads-first behaviour). Default: ON for two-wheelers (already routed by Valhalla motor_scooter, so the
// guardrail adds no engine change), OFF for cars until the user turns it on — turning it on moves car routing from
// OSRM to Valhalla, whose public FOSSGIS instance is shared (1 req/s policy); self-hosted VALHALLA_URL lifts that.
import { mainRoadsApplies } from './valhalla.js';

export const MAIN_ROADS_DEFAULT = { drive: false, two: true };
const key = (mode) => `bm-main-roads-${mode}`;

/** Is "Prefer main roads" on for this mode? (persisted per mode; false for modes it does not apply to) */
export function mainRoadsPref(mode, storage) {
  if (!mainRoadsApplies(mode)) return false;
  const v = storage?.getItem?.(key(mode));
  return v === '1' ? true : v === '0' ? false : !!MAIN_ROADS_DEFAULT[mode];
}
export function setMainRoadsPref(mode, on, storage) {
  if (!mainRoadsApplies(mode)) return;
  storage?.setItem?.(key(mode), on ? '1' : '0');
}
