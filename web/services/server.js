// Which backend serves map services. The app uses Bharat Map's own server (/api/v1: routing, geocoding,
// POIs, tolls, EV, transit) when a backend is configured — MAPOS_API_BASE at build time, the backend URL saved in
// Settings, or CLIENT_SERVICES=server on a server-hosted web app — and the public OSM services directly otherwise.
import { store } from '../shared/storage.js';
import { fetchJSON } from './net.js';

export function serverBase() {
  const w = globalThis.window;
  if (!w) return '';
  const c = w.__MAPOS_CONFIG__ || {};
  const saved = store.getItem('mapos-api');
  const base = (saved ?? c.apiBase ?? '').replace(/\/$/, '');
  if (base) return base;
  if (c.services === 'server' && /^https?:$/.test(w.location?.protocol || '')) return w.location.origin;
  return '';
}
export const useServer = () => !!serverBase();

/** GET/POST an /api/v1 path on our server (gzip handled by the browser). */
export function v1(path, { method = 'GET', body = null, timeout = 15000, ttl = 5 * 60_000, fetchImpl } = {}) {
  return fetchJSON(`${serverBase()}/api/v1${path}`, { method, body: body ? JSON.stringify(body) : null, headers: body ? { 'Content-Type': 'application/json' } : {}, timeout, ttl, fetchImpl });
}
