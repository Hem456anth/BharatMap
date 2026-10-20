// Community services (v0.5): OpenStreetMap notes (anonymous, direct to api.openstreetmap.org) and incident reports
// (Bharat Map server when configured; otherwise kept on this device only and labelled so).
import { buildNotePayload, parseNoteResponse, noteRateLimit, validateIncident, INCIDENT_TTL_MS, activeIncidents, confidence, minutesLeft } from '../shared/community.js';
import { store } from '../shared/storage.js';
import { buildEditNotePayload } from '../shared/osm-edit.js';
import { useServer, v1 } from './server.js';

const read = (k, d) => { try { return JSON.parse(store.getItem(k) || '') ?? d; } catch { return d; } };

export async function sendOsmNote({ lat, lng, category, text }, { fetchImpl = fetch, now = Date.now() } = {}) {
  const hist = read('bm-notes-history', []);
  const rl = noteRateLimit(hist, now);
  if (!rl.ok) { const e = new Error('rate_limited'); e.waitMs = rl.waitMs; throw e; }
  const p = buildNotePayload({ lat, lng, category, text });
  const r = await fetchImpl(`${p.url}.json`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: p.body });
  if (!r.ok) throw new Error(`http_${r.status}`);
  const id = parseNoteResponse(await r.text());
  store.setItem('bm-notes-history', JSON.stringify([...hist.filter((t) => now - t < 3600_000), now]));
  return { id, url: id ? `https://www.openstreetmap.org/note/${id}` : null };
}

/** v0.8: "Suggest an edit" → structured anonymous OSM note on the place (shares the notes rate limit above). */
export async function sendOsmEditSuggestion({ place, changes, comment }, { fetchImpl = fetch, now = Date.now() } = {}) {
  const hist = read('bm-notes-history', []);
  const rl = noteRateLimit(hist, now);
  if (!rl.ok) { const e = new Error('rate_limited'); e.waitMs = rl.waitMs; throw e; }
  const p = buildEditNotePayload({ place, changes, comment });
  const r = await fetchImpl(`${p.url}.json`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: p.body });
  if (!r.ok) throw new Error(`http_${r.status}`);
  const id = parseNoteResponse(await r.text());
  store.setItem('bm-notes-history', JSON.stringify([...hist.filter((t) => now - t < 3600_000), now]));
  return { id, url: id ? `https://www.openstreetmap.org/note/${id}` : null, text: p.text };
}

export const incidentsMode = () => (useServer() ? 'server' : 'device');

export async function listIncidents(bounds, { now = Date.now() } = {}) {
  if (useServer()) {
    const r = await v1(`/incidents?bbox=${[bounds.w, bounds.s, bounds.e, bounds.n].map((x) => x.toFixed(4)).join(',')}`, { ttl: 0, timeout: 10000 });
    return r.incidents;
  }
  const list = activeIncidents(read('bm-incidents-local', []), now);
  store.setItem('bm-incidents-local', JSON.stringify(list));
  return list.filter((i) => i.lng >= bounds.w && i.lng <= bounds.e && i.lat >= bounds.s && i.lat <= bounds.n)
    .map((i) => ({ ...i, confidence: confidence(i.up, i.down), minutes_left: minutesLeft(i, now), verified: false, device_only: true }));
}
export async function reportIncident(x, { now = Date.now() } = {}) {
  const v = validateIncident(x); if (v.error) throw new Error(v.error);
  if (useServer()) return v1('/incidents', { method: 'POST', body: v.value, ttl: 0 });
  const inc = { id: `local_${now.toString(36)}`, ...v.value, created_ms: now, expires_ms: now + INCIDENT_TTL_MS, up: 0, down: 0 };
  store.setItem('bm-incidents-local', JSON.stringify([...activeIncidents(read('bm-incidents-local', []), now), inc]));
  return { ...inc, confidence: 'low', minutes_left: 120, device_only: true };
}
export async function voteIncident(id, vote) {
  if (!useServer()) return null;
  return v1(`/incidents/${encodeURIComponent(id)}/vote`, { method: 'POST', body: { vote }, ttl: 0 });
}
