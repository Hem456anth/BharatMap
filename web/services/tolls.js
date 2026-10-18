// Toll plazas along a route (OpenStreetMap via Overpass, or /api/v1/tolls on our server). No fees are shown.
import { fetchJSON } from './net.js';
import { useServer, v1 } from './server.js';
import { buildTollQuery, parseTolls } from '../shared/tolls.js';
import { OVERPASS_URL } from './overpass.js';

export async function fetchTolls(coords, { fetchImpl } = {}) {
  if (useServer()) {
    try { return await v1('/tolls', { method: 'POST', body: { coordinates: coords }, timeout: 30000, ttl: 30 * 60_000, fetchImpl }); } catch { /* go direct */ }
  }
  const q = buildTollQuery(coords);
  const json = await fetchJSON(OVERPASS_URL, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000, ttl: 30 * 60_000, fetchImpl });
  return { provider: 'overpass', ...parseTolls(json, coords) };
}
