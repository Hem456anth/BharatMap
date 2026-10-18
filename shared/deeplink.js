// Deep links (pure, unit-tested): geo: URIs (RFC 5870 + the Android "geo:0,0?q=lat,lng(label)" convention),
// bharatmap:// app links and https share links carrying lat/lon/name. Used by the Android intent filters
// (Capacitor App plugin appUrlOpen / launch URL) and by the web app's ?lat=&lon= query parameters.
import { inIndia } from './geo.js';

const num = (v) => (v == null || v === '' ? NaN : Number(v));
const valid = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120);

/**
 * Parse a link. Returns { kind: 'place', lat, lng, name, zoom, inIndia } | { kind: 'search', query } |
 * { kind: 'directions', to:{lat,lng,name}, mode } | null.
 */
export function parseDeepLink(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (/^geo:/i.test(s)) return parseGeo(s);
  let u;
  try { u = new URL(s); } catch { return null; }
  const p = u.searchParams;
  const host = u.protocol === 'bharatmap:' ? u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0] : u.pathname.replace(/^\/+/, '').split('/').pop();
  if (!['bharatmap:', 'https:', 'http:'].includes(u.protocol)) return null;
  const lat = num(p.get('lat')), lng = num(p.get('lon') ?? p.get('lng'));
  const name = clean(p.get('name') || p.get('q') || '');
  if (p.get('list')) { const list = decodeList(p.get('list')); return list ? { kind: 'list', ...list } : null; }
  if (p.get('live') && /^[A-Za-z0-9_-]{6,32}$/.test(p.get('live'))) return { kind: 'live', id: p.get('live') };
  if (host === 'list' && p.get('d')) { const list = decodeList(p.get('d')); return list ? { kind: 'list', ...list } : null; }
  if (host === 'live' && /^[A-Za-z0-9_-]{6,32}$/.test(p.get('id') || '')) return { kind: 'live', id: p.get('id') };
  if ((host === 'directions' || p.get('dir') === '1') && valid(lat, lng)) {
    return { kind: 'directions', to: { lat, lng, name }, mode: ['drive', 'two', 'bike', 'walk', 'transit'].includes(p.get('mode')) ? p.get('mode') : 'drive', inIndia: inIndia({ lat, lng }) };
  }
  if (valid(lat, lng)) return { kind: 'place', lat, lng, name, zoom: clampZoom(num(p.get('z'))), inIndia: inIndia({ lat, lng }) };
  if (host === 'search' && name) return { kind: 'search', query: name };
  return null;
}
const clampZoom = (z) => (Number.isFinite(z) ? Math.max(3, Math.min(19, Math.round(z))) : 16);

function parseGeo(s) {
  // geo:lat,lng[,alt][;u=..][?q=...&z=..]
  const m = s.match(/^geo:([^?]*)(?:\?(.*))?$/i); if (!m) return null;
  const [coordPart] = m[1].split(';');
  const [a, b] = coordPart.split(',').map((x) => num(decodeURIComponent(x)));
  const params = new URLSearchParams((m[2] || '').replace(/\+/g, '%20'));
  const q = params.get('q') || '';
  const zoom = clampZoom(num(params.get('z')));
  // q=lat,lng(label) takes precedence (used with geo:0,0)
  const qm = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:\((.*)\))?\s*$/);
  if (qm && valid(+qm[1], +qm[2])) return { kind: 'place', lat: +qm[1], lng: +qm[2], name: clean(qm[3] || ''), zoom, inIndia: inIndia({ lat: +qm[1], lng: +qm[2] }) };
  if (valid(a, b) && !(a === 0 && b === 0)) return { kind: 'place', lat: a, lng: b, name: clean(q), zoom, inIndia: inIndia({ lat: a, lng: b }) };
  if (q) return { kind: 'search', query: clean(q) };
  return null;
}

const r6 = (x) => Math.round(x * 1e6) / 1e6;
/** Links for sharing a place: geo: URI (opens any maps app), bharatmap:// app link and (when the web app is hosted) an https link. */
export function buildShareLinks({ lat, lng, name = '' }, { webBase = '' } = {}) {
  const n = clean(name);
  const qs = new URLSearchParams({ lat: String(r6(lat)), lon: String(r6(lng)), ...(n ? { name: n } : {}) }).toString();
  const geo = `geo:${r6(lat)},${r6(lng)}?q=${r6(lat)},${r6(lng)}${n ? encodeURIComponent(`(${n})`) : ''}`;
  const app = `bharatmap://place?${qs}`;
  const web = /^https:\/\//.test(webBase) ? `${webBase.replace(/\/$/, '')}/?${qs}` : null;
  return { geo, app, web };
}

// ---- favourites list sharing: the list travels inside the link (no server needed) ----
const b64u = (str) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, 'utf8').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { const b = s.replace(/-/g, '+').replace(/_/g, '/'); return typeof atob === 'function' ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, 'base64').toString('utf8'); };
/** Encode a list { name, items:[{name,lat,lng}] } (max 50 places) into a compact payload. */
export function encodeList({ name, items }) {
  const rows = (items || []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).slice(0, 50).map((x) => [clean(x.name || ''), r6(x.lat), r6(x.lng)]);
  return b64u(JSON.stringify({ v: 1, n: clean(name || ''), p: rows }));
}
export function decodeList(d) {
  try {
    const j = JSON.parse(unb64u(String(d)));
    if (j?.v !== 1 || !Array.isArray(j.p)) return null;
    const items = j.p.filter((r) => Array.isArray(r) && valid(+r[1], +r[2])).slice(0, 50).map((r) => ({ name: clean(r[0]), lat: +r[1], lng: +r[2] }));
    return items.length ? { name: clean(j.n) || 'Shared list', items } : null;
  } catch { return null; }
}
export function buildListLink(list, { webBase = '' } = {}) {
  const d = encodeList(list);
  return { app: `bharatmap://list?d=${d}`, web: /^https:\/\//.test(webBase) ? `${webBase.replace(/\/$/, '')}/?list=${d}` : null };
}
