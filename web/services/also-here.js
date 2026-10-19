// Client runner for "Also here" (shared/services/also-here.js): online only, cached 10 min, never blocks the card.
import { fetchJSON } from './net.js';
import { OVERPASS_URL } from './overpass.js';
import { buildAlsoHereQuery, parseAlsoHere } from '../shared/services/also-here.js';
export async function alsoHere(place, { fetchImpl } = {}) {
  const q = buildAlsoHereQuery(place);
  const json = await fetchJSON(OVERPASS_URL, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, ttl: 10 * 60_000, fetchImpl });
  return parseAlsoHere(json, place);
}
