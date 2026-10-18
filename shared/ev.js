// EV charging details. Two sources, both normalised to the same shape:
//  - Open Charge Map API v3 (CC BY 4.0 + per-provider licences), called only by our server with OCM_API_KEY
//  - OpenStreetMap amenity=charging_station tags (socket:*), via Overpass (fallback, no key needed)
// Shape: { connectors: [{ type, count, power_kw }], operator, network, points, access, fee, status, source }
const SOCKET_NAMES = {
  type2: 'Type 2', type2_combo: 'CCS2', type2_cable: 'Type 2 (cable)', chademo: 'CHAdeMO', type1: 'Type 1 (J1772)', type1_combo: 'CCS1',
  gb_t: 'GB/T', gb_ac: 'GB/T AC', gb_dc: 'GB/T DC', type3c: 'Type 3C', schuko: 'Schuko', bs1363: '3-pin (BS1363)', 'indian_15A': 'Indian 15 A', iec_60309: 'IEC 60309', tesla_supercharger: 'Tesla', nacs: 'NACS',
  bharat_ac001: 'Bharat AC-001', bharat_dc001: 'Bharat DC-001', 'bharat_ac-001': 'Bharat AC-001', 'bharat_dc-001': 'Bharat DC-001', type6: 'Type 6', chaoji: 'ChaoJi',
};
export function parsePowerKw(v) {
  if (v == null) return null;
  const m = String(v).match(/([\d.]+)\s*(k?w)?/i); if (!m) return null;
  const n = Number(m[1]); if (!Number.isFinite(n)) return null;
  return /^w$/i.test(m[2] || '') ? n / 1000 : n;
}
/** Pure: OSM charging_station tags → EV details (null if no EV-relevant tags). */
export function parseOsmCharger(tags = {}) {
  const connectors = [];
  for (const [k, v] of Object.entries(tags)) {
    const m = k.match(/^socket:([a-z0-9_\-A-Z]+)$/); if (!m) continue;
    const key = m[1]; const count = Number.parseInt(v, 10);
    if (v === 'no' || count === 0) continue;
    connectors.push({ type: SOCKET_NAMES[key] || key.replace(/_/g, ' '), count: Number.isFinite(count) ? count : null, power_kw: parsePowerKw(tags[`socket:${key}:output`]) });
  }
  const maxOut = parsePowerKw(tags['charging_station:output'] || tags.output);
  const d = { connectors, operator: tags.operator || tags.brand || '', network: tags.network || '', points: Number.parseInt(tags.capacity, 10) || null,
    access: tags.access || '', fee: tags.fee || '', max_power_kw: maxOut ?? (connectors.reduce((m, c) => Math.max(m, c.power_kw || 0), 0) || null),
    opening_hours: tags.opening_hours || '', status: null, source: 'OpenStreetMap' };
  return d;
}
/** Pure: Open Charge Map /v3/poi (compact=false) → place objects with `ev` details. */
export function parseOcm(list, origin, haversineKm) {
  return (Array.isArray(list) ? list : []).map((p) => {
    const a = p.AddressInfo || {};
    const connectors = (p.Connections || []).map((c) => ({ type: c.ConnectionType?.Title || 'Unknown', count: c.Quantity ?? null, power_kw: c.PowerKW ?? null, current: c.CurrentType?.Title || '' }));
    const lat = a.Latitude, lng = a.Longitude;
    return {
      id: `ocm:${p.ID}`, source: 'ocm', category: 'ev', name: a.Title || p.OperatorInfo?.Title || 'EV charging', lat, lng,
      address: [a.AddressLine1, a.AddressLine2, a.Town, a.StateOrProvince, a.Postcode].filter(Boolean).join(', '),
      distance_m: origin && Number.isFinite(lat) && haversineKm ? Math.round(haversineKm(origin, { lat, lng }) * 1000) : null,
      tags: { amenity: 'charging_station', ...(p.OperatorInfo?.WebsiteURL ? { website: p.OperatorInfo.WebsiteURL } : {}), ...(a.ContactTelephone1 ? { phone: a.ContactTelephone1 } : {}) },
      ev: { connectors, operator: p.OperatorInfo?.Title || '', network: '', points: p.NumberOfPoints ?? null, access: p.UsageType?.Title || '', fee: '',
        max_power_kw: connectors.reduce((m, c) => Math.max(m, c.power_kw || 0), 0) || null, opening_hours: a.AccessComments || '',
        status: p.StatusType ? { title: p.StatusType.Title, operational: p.StatusType.IsOperational } : null,
        verified: p.DateLastVerified || null, source: `${p.DataProvider?.Title || 'Open Charge Map'} via Open Charge Map` },
    };
  }).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
}
/** Pure: parking details from OSM tags. */
export function parseParking(tags = {}) {
  const cap = Number.parseInt(tags.capacity, 10);
  return { fee: tags.fee || '', capacity: Number.isFinite(cap) ? cap : null, kind: tags.parking || '', access: tags.access || '', covered: tags.covered || '',
    disabled: tags['capacity:disabled'] || '', maxstay: tags.maxstay || '', operator: tags.operator || '', two_wheeler: tags.motorcycle || tags['parking:motorcycle'] || '' };
}
