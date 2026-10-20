// "Suggest an edit" for an OpenStreetMap place (v0.8, CoMaps-inspired; original code). Pure (unit-tested).
// CoMaps ships a built-in OSM editor that writes changesets after an OSM account login (OAuth2). Bharat Map does the
// lighter, account-free version: the user's proposed tag changes become a structured, anonymous OSM *note* on the
// place (OSM Notes API, same endpoint and rate limit as "Report a map problem"), which local mappers review and apply.
// Nothing is written to the OSM database by the app.
import { OSM_NOTES_URL } from './community.js';

/** Fields a user may propose. `kind` drives validation and the input type in the dialog. */
export const EDIT_FIELDS = [
  { key: 'name', kind: 'text', max: 120 },
  { key: 'name:te', kind: 'text', max: 120 },
  { key: 'name:hi', kind: 'text', max: 120 },
  { key: 'opening_hours', kind: 'hours', max: 255 },
  { key: 'phone', kind: 'phone', max: 255 },
  { key: 'website', kind: 'url', max: 255 },
  { key: 'wheelchair', kind: 'enum', values: ['yes', 'limited', 'no'] },
];
const FIELD = Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, f]));
export const OSM_TYPES = ['node', 'way', 'relation'];

const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

/** Normalise one Indian/international phone number: "+91 98765 43210" style for Indian mobiles, digits kept otherwise. */
export function normalizePhone(raw) {
  const s = clean(raw);
  if (!s) return '';
  let d = s.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(d)) return null;
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  if (/^[6-9]\d{9}$/.test(d)) d = `+91${d}`;                         // 10-digit mobile
  else if (/^91[6-9]\d{9}$/.test(d)) d = `+${d}`;
  else if (/^0\d{9,10}$/.test(d)) d = `+91${d.slice(1)}`;            // trunk 0: STD landline or mobile, kept ungrouped (ambiguous)
  const digits = d.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (!d.startsWith('+')) d = `+${d}`;
  const m = !/^0/.test(s.replace(/[\s().-]/g, '')) && /^\+91([6-9]\d{4})(\d{5})$/.exec(d);
  return m ? `+91 ${m[1]} ${m[2]}` : d;
}

/** Validate + normalise a proposed value. Returns { value } or { error }. Empty string = "remove this value". */
export function validateField(key, raw) {
  const f = FIELD[key]; if (!f) return { error: 'unknown_field' };
  const v = clean(raw);
  if (!v) return { value: '' };
  if (f.max && v.length > f.max) return { error: 'too_long' };
  switch (f.kind) {
    case 'enum': return f.values.includes(v) ? { value: v } : { error: 'invalid_value' };
    case 'url': {
      let u; try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return { error: 'invalid_url' }; }
      if (!/^https?:$/.test(u.protocol) || u.username || u.password || !u.hostname.includes('.')) return { error: 'invalid_url' };
      return { value: u.href.replace(/\/$/, '') };
    }
    case 'phone': {
      const parts = v.split(/\s*;\s*/).filter(Boolean).map(normalizePhone);
      return parts.some((p) => !p) ? { error: 'invalid_phone' } : { value: parts.join('; ') };
    }
    case 'hours':
      // OSM opening_hours syntax is rich; accept its character set and leave detailed checking to mappers.
      return /^[A-Za-z0-9:,;\-+/ ."[\]]+$/.test(v) ? { value: v } : { error: 'invalid_hours' };
    default: return { value: v };
  }
}

/**
 * Compare the place's current OSM tags with the proposal. proposed = { key: value } (only keys present are considered).
 * Returns { changes: [{ key, from, to }], errors: { key: code } }. Unchanged values are not reported.
 */
export function diffEdit(currentTags = {}, proposed = {}) {
  const changes = [], errors = {};
  for (const f of EDIT_FIELDS) {
    if (!(f.key in proposed)) continue;
    const r = validateField(f.key, proposed[f.key]);
    if (r.error) { errors[f.key] = r.error; continue; }
    const from = clean(currentTags[f.key]);
    if (r.value === from) continue;
    if (f.kind === 'url' && from && r.value === validateField(f.key, from).value) continue; // same URL, different spelling
    if (f.kind === 'phone' && from && r.value === validateField(f.key, from).value) continue;
    changes.push({ key: f.key, from, to: r.value });
  }
  return { changes, errors };
}

/**
 * Build the anonymous note for a proposed edit: { url, body, text }. Throws Error('invalid_place' | 'invalid_point' | 'no_changes' | 'text_too_long').
 * place = { osm_type, osm_id, name, lat, lng }.
 */
export function buildEditNotePayload({ place, changes = [], comment = '', appVersion = '0.7' }) {
  const { osm_type: type, osm_id: id, lat, lng } = place || {};
  if (!OSM_TYPES.includes(type) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('invalid_place');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('invalid_point');
  const c = clean(comment).slice(0, 500);
  const ch = changes.filter((x) => FIELD[x.key]);
  if (!ch.length && c.length < 5) throw new Error('no_changes');
  const q = (v) => (v ? `"${v}"` : '(none)');
  const lines = [`[Place details update] ${clean(place.name) || `${type} ${id}`}`, `https://www.openstreetmap.org/${type}/${Number(id)}`, ''];
  for (const x of ch) lines.push(`- ${x.key}: ${q(x.from)} → ${x.to ? q(x.to) : '(remove)'}`);
  if (c) lines.push('', `Comment: ${c}`);
  lines.push('', `— suggested in Bharat Map ${appVersion} (anonymous). Please verify on the ground or from an allowed source before editing OSM.`);
  const text = lines.join('\n');
  if (text.length > 2000) throw new Error('text_too_long');
  const body = new URLSearchParams({ lat: lat.toFixed(6), lon: lng.toFixed(6), text }).toString();
  return { url: OSM_NOTES_URL, body, text };
}

/** The OSM element behind a place: from osm_type/osm_id (Overpass) or an id like "osm:way/123" (Photon, Nominatim). */
export function osmRef(p) {
  if (!p) return null;
  if (OSM_TYPES.includes(p.osm_type) && Number(p.osm_id) > 0) return { osm_type: p.osm_type, osm_id: Number(p.osm_id) };
  const m = /^osm:(node|way|relation)\/(\d+)$/.exec(String(p.id || ''));
  return m && Number(m[2]) > 0 ? { osm_type: m[1], osm_id: Number(m[2]) } : null;
}
/** Can this place get an edit suggestion? Only OSM features with a real element id. */
export const canSuggestEdit = (p) => !!osmRef(p);
