// Valhalla routing (https://github.com/valhalla/valhalla, MIT): request builder and response parser that
// produce the same route objects as the OSRM parser (web/services/routing.js), so navigation is engine-agnostic.
// Costing: auto (drive), motor_scooter (two-wheeler — a real 2W profile), bicycle, pedestrian.
import { decodePolyline } from './polyline.js';
import { parseValhallaLanes } from './lanes.js';

export const VALHALLA_COSTING = { drive: 'auto', two: 'motor_scooter', bike: 'bicycle', walk: 'pedestrian' };

/** Pure: Valhalla /route JSON body. opts: { alternates, avoidTolls, avoidHighways, lang } */
export function buildValhallaRequest(mode, from, to, { alternates = 2, avoidTolls = false, avoidHighways = false, lang = 'en-US', via = [] } = {}) {
  const costing = VALHALLA_COSTING[mode];
  if (!costing) throw new Error(`unknown_mode:${mode}`);
  for (const p of [from, ...via, to]) if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) throw new Error('invalid_point');
  const co = {};
  if (costing === 'auto' || costing === 'motor_scooter') {
    if (avoidTolls) co.use_tolls = 0;
    if (avoidHighways) co.use_highways = 0;
  }
  // Two-wheelers in India: scooter top speed ~ 60–80 km/h; Valhalla's default motor_scooter top speed is 45.
  if (costing === 'motor_scooter') co.top_speed = 60;
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  return {
    locations: [from, ...via, to].map((p) => ({ lat: r6(p.lat), lon: r6(p.lng) })),
    costing, costing_options: Object.keys(co).length ? { [costing]: co } : undefined,
    alternates: via.length ? 0 : Math.max(0, Math.min(2, alternates)),
    directions_options: { units: 'kilometers', language: lang },
  };
}

// Valhalla maneuver type → OSRM-style { type, modifier } used by nav/maneuver.js.
const VT = {
  1: ['depart', null], 2: ['depart', null], 3: ['depart', null], 4: ['arrive', null], 5: ['arrive', 'right'], 6: ['arrive', 'left'],
  7: ['new name', 'straight'], 8: ['continue', 'straight'], 9: ['turn', 'slight right'], 10: ['turn', 'right'], 11: ['turn', 'sharp right'],
  12: ['turn', 'uturn'], 13: ['turn', 'uturn'], 14: ['turn', 'sharp left'], 15: ['turn', 'left'], 16: ['turn', 'slight left'],
  17: ['on ramp', 'straight'], 18: ['on ramp', 'right'], 19: ['on ramp', 'left'], 20: ['off ramp', 'right'], 21: ['off ramp', 'left'],
  22: ['fork', 'straight'], 23: ['fork', 'right'], 24: ['fork', 'left'], 25: ['merge', 'straight'], 26: ['roundabout', 'straight'],
  27: ['exit roundabout', 'straight'], 28: ['continue', 'straight'], 29: ['continue', 'straight'], 37: ['merge', 'right'], 38: ['merge', 'left'],
};
export function mapValhallaManeuver(m) { const [type, modifier] = VT[m?.type] || ['continue', 'straight']; return { type, modifier }; }

function parseTrip(trip, mode, i, engine) {
  const legs = trip?.legs || [];
  const coords = []; const steps = [];
  legs.forEach((leg, li) => {
    const shape = decodePolyline(leg.shape || '', 6);
    const offset = coords.length ? coords.length - 1 : 0;
    coords.push(...(coords.length ? shape.slice(1) : shape));
    for (const m of leg.maneuvers || []) {
      let { type, modifier } = mapValhallaManeuver(m);
      if (li < legs.length - 1 && type === 'arrive') continue; // intermediate stop: next leg starts with a waypoint
      if (li > 0 && type === 'depart') type = 'waypoint';
      const loc = shape[m.begin_shape_index] || shape[0];
      steps.push({ type, modifier, exit: m.roundabout_exit_count ?? null, bearing_after: m.bearing_after ?? null,
        location: loc ? [loc[0], loc[1]] : null, name: (m.street_names || [])[0] || '', ref: '', rotary_name: '',
        distance_m: Math.round((m.length || 0) * 1000), duration_s: m.time || 0, mode: m.travel_type || mode,
        toll: !!m.toll, highway: !!m.highway, shape_index: offset + (m.begin_shape_index || 0),
        bearing_before: m.bearing_before ?? null, lanes: parseValhallaLanes(m.lanes), junction: null });
    }
  });
  const s = trip?.summary || {};
  const names = steps.filter((x) => x.name).sort((a, b) => b.distance_m - a.distance_m).map((x) => x.name);
  return { id: `r${i}`, index: i, mode, engine, distance_m: Math.round((s.length || 0) * 1000), duration_s: Math.round(s.time || 0),
    summary: [...new Set(names)].slice(0, 2).join(', '), geometry: { type: 'LineString', coordinates: coords }, steps,
    has_toll: !!s.has_toll, has_highway: !!s.has_highway, stops: Math.max(0, legs.length - 1),
    lanes: steps.map((x, si) => (x.lanes && x.location ? { location: x.location, lanes: x.lanes, stepIndex: si, maneuver: true } : null)).filter(Boolean), speed_limits: null };
}
/** Pure: normalise a Valhalla /route response (with alternates) into route objects (max 3). */
export function parseValhalla(json, mode, engine = 'valhalla') {
  if (!json?.trip) throw new Error(`valhalla_${json?.error_code || json?.error || 'bad_response'}`);
  const trips = [json.trip, ...(json.alternates || []).map((a) => a.trip)].slice(0, 3);
  return trips.map((t, i) => parseTrip(t, mode, i, engine));
}
