// OSM tags → service panel type (docs/re/UI_UX_SPEC_V2.md §4). First matching rule wins: OSM tags, then Bharat's own
// catalogue (demo Shop seller category), then the category chip. A place shows ONE service panel; Ride is always
// available as a secondary service ("More services"), and primary only on taxi / auto stands.
// Never invents tags: `shop=kirana` is not a standard OSM value, so kirana stores match on shop=convenience|general.

export const PANEL_TYPES = ['restaurant', 'cinema', 'station', 'grocery', 'ride', 'hotel', 'fuel', 'parking', 'health', 'retail', 'courier', 'venue'];

const has = (v, re) => typeof v === 'string' && re.test(v);
export const RULES = [
  ['ride', (t) => t.amenity === 'taxi' || has(t.taxi, /^(yes|auto|motorcycle)$/) && t.highway !== 'bus_stop'],
  ['health', (t) => has(t.amenity, /^(pharmacy|clinic|doctors|hospital|dentist)$/) || !!t.healthcare || t.emergency === 'yes' && !t.highway],
  ['station', (t) => has(t.public_transport, /^(station|stop_position|platform)$/) || has(t.railway, /^(station|halt|tram_stop|subway_entrance)$/) || t.highway === 'bus_stop' || t.amenity === 'bus_station'],
  ['restaurant', (t) => has(t.amenity, /^(restaurant|cafe|fast_food|food_court|ice_cream)$/) || has(t.shop, /^(confectionery|pastry|bakery)$/)],
  ['cinema', (t) => has(t.amenity, /^(cinema|theatre)$/)],
  ['fuel', (t) => has(t.amenity, /^(fuel|charging_station)$/)],
  ['parking', (t) => has(t.amenity, /^(parking|motorcycle_parking|bicycle_parking|parking_entrance)$/) || t.barrier === 'toll_booth'],
  ['hotel', (t) => has(t.tourism, /^(hotel|guest_house|hostel|motel|apartment)$/) || t.amenity === 'dharamshala'],
  ['courier', (t) => t.amenity === 'post_office' || has(t.office, /^courier$/) || has(t.shop, /^courier$/) || t.amenity === 'post_depot'],
  ['grocery', (t) => has(t.shop, /^(supermarket|convenience|greengrocer|general|dairy|grocery|butcher|seafood|frozen_food)$/)],
  ['venue', (t) => t.amenity === 'place_of_worship' || has(t.leisure, /^(stadium|park|garden|sports_centre)$/) || has(t.amenity, /^(university|college|events_venue|community_centre|exhibition_centre|conference_centre|arts_centre)$/) || t.shop === 'mall' || t.tourism === 'attraction' || t.tourism === 'museum'],
  ['retail', (t) => !!t.shop],
];
/** Demo Shop seller category → panel (Bharat's own catalogue). */
export const SELLER_CATEGORY_PANEL = { restaurant: 'restaurant', grocery: 'grocery', pharmacy: 'health', electronics: 'retail', hardware: 'retail', textiles: 'retail', services: 'retail' };
/** Category chip id → panel (last resort). */
export const CHIP_PANEL = { restaurant: 'restaurant', grocery: 'grocery', metro: 'station', bus: 'station', rail: 'station', fuel: 'fuel', ev: 'fuel', parking: 'parking', hospital: 'health', pharmacy: 'health', airport: 'venue' };

/** panelTypeFor(tags, { seller, category }) → panel type or null (no service panel, Ride still offered). */
export function panelTypeFor(tags = {}, { seller = null, category = null } = {}) {
  for (const [type, test] of RULES) if (test(tags || {})) return type;
  if (seller) return SELLER_CATEGORY_PANEL[seller.category] || 'retail';
  if (category && CHIP_PANEL[category]) return CHIP_PANEL[category];
  return null;
}
/** Station sub-kind for copy and ticketing: metro | rail | bus | other. */
export function stationKind(tags = {}) {
  if (has(tags.station, /subway|light_rail|monorail/) || tags.subway === 'yes' || has(tags.network, /metro/i) || tags.railway === 'subway_entrance') return 'metro';
  if (has(tags.railway, /^(station|halt)$/) || tags.train === 'yes') return 'rail';
  if (tags.highway === 'bus_stop' || tags.amenity === 'bus_station' || tags.bus === 'yes') return 'bus';
  return 'other';
}
/** Fuel vs EV charging. */
export const fuelKind = (tags = {}) => (tags.amenity === 'charging_station' ? 'ev' : 'fuel');
/** Health sub-kind. */
export function healthKind(tags = {}) {
  if (tags.amenity === 'pharmacy' || tags.healthcare === 'pharmacy') return 'pharmacy';
  if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') return 'hospital';
  return 'clinic';
}
/** Is this an emergency-capable card (shows the fixed "In an emergency call 112" line)? */
export const emergencyCapable = (tags = {}) => tags.emergency === 'yes' || tags.amenity === 'hospital' || tags.healthcare === 'hospital';
/** Secondary services for a panel type (Ride is always offered unless the panel is the ride panel). */
export const secondaryFor = (type) => (type === 'ride' ? [] : ['ride']);
