// "Report a map problem" (OpenStreetMap Notes) and local community incident reports. Pure (unit-tested);
// shared by the app (web/ui/report.js) and the server (/api/v1/incidents).

// ---------- OSM Notes (https://wiki.openstreetmap.org/wiki/API_v0.6#Create_a_new_note) ----------
export const OSM_NOTES_URL = 'https://api.openstreetmap.org/api/0.6/notes';
export const NOTE_CATEGORIES = {
  wrong_road: 'Wrong road / road geometry',
  missing_place: 'Missing place',
  closed_road: 'Closed road',
  wrong_name: 'Wrong name',
};
/**
 * Build the anonymous note: { url, body (x-www-form-urlencoded string), text }. Throws on invalid input.
 * The text says which category, the user's description and that it came from Bharat Map, so mappers have context.
 */
export function buildNotePayload({ lat, lng, category, text, appVersion = '0.5' }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('invalid_point');
  if (!NOTE_CATEGORIES[category]) throw new Error('invalid_category');
  const desc = String(text || '').replace(/\s+/g, ' ').trim();
  if (desc.length < 5) throw new Error('text_too_short');
  if (desc.length > 1000) throw new Error('text_too_long');
  const full = `[${NOTE_CATEGORIES[category]}] ${desc}\n\n— reported in Bharat Map ${appVersion} (anonymous)`;
  const body = new URLSearchParams({ lat: lat.toFixed(6), lon: lng.toFixed(6), text: full }).toString();
  return { url: OSM_NOTES_URL, body, text: full };
}
/** Parse the API's JSON (Accept: application/json) or XML reply for the new note id. */
export function parseNoteResponse(textOrJson) {
  if (textOrJson && typeof textOrJson === 'object') return textOrJson.properties?.id ?? null;
  const s = String(textOrJson || '');
  try { const j = JSON.parse(s); return j.properties?.id ?? null; } catch { /* xml */ }
  const m = s.match(/<id>(\d+)<\/id>/); return m ? Number(m[1]) : null;
}
/**
 * Client-side rate limit for notes: at most `max` in `windowMs` and one per `minGapMs` (OSM asks apps to avoid
 * spamming). history = array of ms timestamps. Returns { ok, waitMs }.
 */
export function noteRateLimit(history, now, { max = 3, windowMs = 3600_000, minGapMs = 60_000 } = {}) {
  const recent = (history || []).filter((t) => now - t < windowMs).sort((a, b) => a - b);
  if (recent.length && now - recent[recent.length - 1] < minGapMs) return { ok: false, waitMs: minGapMs - (now - recent[recent.length - 1]) };
  if (recent.length >= max) return { ok: false, waitMs: windowMs - (now - recent[0]) };
  return { ok: true, waitMs: 0 };
}

// ---------- Community incidents (local, unverified) ----------
export const INCIDENT_TYPES = ['pothole', 'waterlogging', 'closure', 'police'];
export const INCIDENT_TTL_MS = 2 * 3600_000;
export function validateIncident(x) {
  const lat = Number(x?.lat), lng = Number(x?.lng);
  if (!INCIDENT_TYPES.includes(x?.type)) return { error: 'invalid_type' };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: 'invalid_point' };
  const note = String(x.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140);
  return { value: { type: x.type, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, note } };
}
export const expiresAt = (createdMs, ttl = INCIDENT_TTL_MS) => createdMs + ttl;
export const isExpired = (inc, now) => now >= (inc.expires_ms ?? expiresAt(inc.created_ms));
export function activeIncidents(list, now) { return (list || []).filter((i) => !isExpired(i, now)); }
/** Confidence from upvotes ("still there") and downvotes ("gone"): low / medium / high. Never "verified". */
export function confidence(up = 0, down = 0) {
  const score = 1 + up - down * 2; // the reporter counts as one
  if (down > up + 1) return 'low';
  return score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
}
/** Minutes left before an incident disappears. */
export const minutesLeft = (inc, now) => Math.max(0, Math.ceil(((inc.expires_ms ?? expiresAt(inc.created_ms)) - now) / 60000));
