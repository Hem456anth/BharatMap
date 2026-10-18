// Maneuver text builder (display + speech), icon keys and landmark matcher. Pure (unit-tested).
// Instructions are generated from OSRM step data with our own localized templates (shared/i18n.js).
import { t, tf } from '../shared/i18n.js';
import { haversineKm } from '../shared/geo.js';
import { LANDMARKS } from '../shared/seed.js';

const DIR_KEY = { left: 'dir_left', right: 'dir_right', 'slight left': 'dir_slight_left', 'slight right': 'dir_slight_right', 'sharp left': 'dir_sharp_left', 'sharp right': 'dir_sharp_right' };
const sideOf = (mod) => (/left/.test(mod || '') ? 'left' : 'right');

/** Icon key for a step (rendered by web/ui/icons.js). */
export function maneuverIcon(step) {
  const { type, modifier } = step || {};
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (/roundabout|rotary/.test(type || '')) return 'roundabout';
  if (modifier === 'uturn') return 'uturn';
  if (type === 'fork' || type === 'on ramp' || type === 'off ramp' || type === 'merge') return /left/.test(modifier || '') ? 'keep-left' : /right/.test(modifier || '') ? 'keep-right' : 'straight';
  switch (modifier) {
    case 'left': return 'left'; case 'right': return 'right';
    case 'slight left': return 'slight-left'; case 'slight right': return 'slight-right';
    case 'sharp left': return 'sharp-left'; case 'sharp right': return 'sharp-right';
    default: return 'straight';
  }
}

const roadOf = (s) => (s.name && s.ref ? `${s.name} (${s.ref})` : s.name || s.ref || '');

/** Localized instruction for one OSRM step, without distance. */
export function buildInstruction(step, lang = 'en', { landmark = null, destinationName = '' } = {}) {
  const s = step || {};
  const road = roadOf(s);
  const dirKey = DIR_KEY[s.modifier];
  const dir = dirKey ? t(lang, dirKey) : null;
  const side = t(lang, `side_${sideOf(s.modifier)}`);
  let text;
  switch (s.type) {
    case 'depart': text = road ? tf(lang, 'm_depart', { road }) : t(lang, 'm_depart_plain'); break;
    case 'arrive': text = t(lang, 'm_arrive'); break;
    case 'roundabout': case 'rotary': case 'roundabout turn': case 'exit roundabout': case 'exit rotary':
      if (s.exit) { text = road ? tf(lang, 'm_roundabout_onto', { n: s.exit, road }) : tf(lang, 'm_roundabout', { n: s.exit }); break; }
      text = dir ? (road ? tf(lang, 'm_turn_onto', { dir, road }) : tf(lang, 'm_turn', { dir })) : (road ? tf(lang, 'm_continue_on', { road }) : t(lang, 'm_continue'));
      break;
    case 'fork': text = road ? tf(lang, 'm_keep_onto', { side, road }) : tf(lang, 'm_keep', { side }); break;
    case 'merge': text = road ? tf(lang, 'm_merge', { road }) : t(lang, 'm_merge_plain'); break;
    case 'on ramp': text = tf(lang, 'm_ramp', { side }); break;
    case 'off ramp': text = tf(lang, 'm_exit', { side }); break;
    case 'end of road': text = tf(lang, 'm_end_of_road', { dir: dir || t(lang, `dir_${sideOf(s.modifier)}`) }); break;
    default: // turn, new name, continue, notification, use lane
      if (s.modifier === 'uturn') text = t(lang, 'm_uturn');
      else if (dir && s.type !== 'new name' && s.type !== 'continue') text = road ? tf(lang, 'm_turn_onto', { dir, road }) : tf(lang, 'm_turn', { dir });
      else if (dir) text = road ? tf(lang, 'm_turn_onto', { dir, road }) : tf(lang, 'm_turn', { dir });
      else text = road ? tf(lang, 'm_continue_on', { road }) : t(lang, 'm_continue');
  }
  if (landmark && s.type !== 'arrive' && s.type !== 'depart') text = tf(lang, 'm_near', { instr: text, landmark: landmark.name });
  if (s.type === 'arrive' && destinationName && lang === 'en') text = `${text}: ${destinationName}`;
  return text;
}

/** Round a distance the way people say it: 50 m steps under 1 km, 0.1 km above. */
export function roundDistance(m) {
  if (m < 1000) { const r = m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50; return r >= 1000 ? { value: 1, unit: 'km' } : { value: r, unit: 'm' }; }
  const km = m < 10_000 ? Math.round(m / 100) / 10 : Math.round(m / 1000);
  return { value: km, unit: 'km' };
}
export function formatDistance(m) { const d = roundDistance(m); return `${d.value.toLocaleString('en-IN')} ${d.unit}`; }
export function speechDistance(m, lang = 'en') { const d = roundDistance(m); return tf(lang, d.unit === 'km' ? 'dist_km_speech' : 'dist_m_speech', { n: d.value }); }

/** Spoken instruction: "In 200 metres, turn left near RK Beach". */
export function spokenInstruction(step, distanceM, lang = 'en', opts = {}) {
  const instr = buildInstruction(step, lang, opts);
  if (distanceM == null || distanceM < 40 || step?.type === 'arrive' && distanceM < 40) return instr;
  const lower = lang === 'en' ? instr.charAt(0).toLowerCase() + instr.slice(1) : instr;
  return tf(lang, 'dist_in', { d: speechDistance(distanceM, lang), instr: lower });
}

/** Nearest seed landmark within maxM of a maneuver location [lng,lat]. */
export function findLandmark(location, { maxM = 150, landmarks = LANDMARKS } = {}) {
  if (!location) return null;
  const p = { lng: location[0], lat: location[1] };
  let best = null;
  for (const l of landmarks) {
    const d = haversineKm(p, l) * 1000;
    if (d <= maxM && (!best || d < best.distance_m)) best = { name: l.name, distance_m: Math.round(d) };
  }
  return best;
}
