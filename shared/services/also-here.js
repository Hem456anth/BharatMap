// "Also here" (teardown #5): other places INSIDE the same building / mall / station, by OSM containment.
// Overpass is_in finds the enclosing areas of the point; we keep buildings, malls, stations, hospitals, campuses,
// then list named POIs inside that area. Pure query builder + parser (no network here); the client runs it online only.
export const CONTAINER_FILTER = /^(building|shop=mall|amenity=marketplace|railway=station|public_transport=station|amenity=hospital|amenity=university|amenity=college|aeroway=terminal|tourism=attraction)$/;

export function buildAlsoHereQuery(p, { limit = 30, timeout = 15 } = {}) {
  const ll = `${(+p.lat).toFixed(6)},${(+p.lng).toFixed(6)}`;
  return `[out:json][timeout:${timeout}];is_in(${ll})->.a;
(area.a["shop"="mall"];area.a["building"]["name"];area.a["railway"="station"];area.a["public_transport"="station"];area.a["amenity"~"^(hospital|marketplace|university|college)$"];area.a["aeroway"="terminal"];)->.c;
.c out tags 1;
(node(area.c)["name"]["shop"];node(area.c)["name"]["amenity"];node(area.c)["name"]["office"];node(area.c)["name"]["craft"];node(area.c)["name"]["healthcare"];);
out center tags ${limit};`;
}

/** → { container: { name, kind } | null, items: [{ id, name, lat, lng, tags, kind }] } — excludes the place itself. */
export function parseAlsoHere(json, self = {}) {
  const els = json?.elements || [];
  const area = els.find((e) => e.type === 'area');
  const t = area?.tags || {};
  const container = area ? { name: t.name || t['name:en'] || '', kind: t.shop === 'mall' ? 'mall' : t.railway === 'station' || t.public_transport === 'station' ? 'station' : t.amenity || t.aeroway || (t.building ? 'building' : 'area') } : null;
  const items = [];
  const seen = new Set();
  for (const e of els) {
    if (e.type !== 'node' || !e.tags?.name) continue;
    const id = `osm:node/${e.id}`;
    if (id === self.id || (self.name && e.tags.name === self.name) || seen.has(e.tags.name)) continue;
    seen.add(e.tags.name);
    items.push({ id, name: e.tags.name, lat: e.lat, lng: e.lon, tags: e.tags, kind: e.tags.shop ? `shop:${e.tags.shop}` : e.tags.amenity ? e.tags.amenity : e.tags.office ? 'office' : e.tags.healthcare || e.tags.craft || 'place' });
  }
  return { container, items: items.slice(0, 20) };
}
