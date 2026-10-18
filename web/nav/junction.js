// Junction view: an enlarged schematic diagram of a complex maneuver (roundabout, fork, ramp, sharp turn), drawn as
// original SVG from the route geometry and the intersection's road bearings (OSRM intersections[].bearings).
// No imagery. Oriented heading-up: the approach always comes from the bottom. Pure (unit-tested).

const COMPLEX = new Set(['roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary', 'fork', 'off ramp', 'on ramp', 'merge']);
/** Is this maneuver complex enough to deserve the enlarged diagram? */
export function isComplexJunction(step) {
  if (!step) return false;
  if (COMPLEX.has(step.type)) return true;
  if (/sharp|uturn/.test(step.modifier || '')) return true;
  return (step.junction?.bearings?.length || 0) >= 5; // 5+ way junctions
}

const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
/** Local metres (x east, y north) of [lng,lat] relative to origin. */
function toLocal(o, p) { return [rad(p[0] - o[0]) * Math.cos(rad(o[1])) * R, rad(p[1] - o[1]) * R]; }

/** Route geometry within `before`/`after` metres of the maneuver point, in local metres; null if not found. */
export function geometryAround(coords, location, { before = 45, after = 55 } = {}) {
  if (!Array.isArray(coords) || coords.length < 2 || !location) return null;
  let bi = 0, bd = Infinity;
  coords.forEach((c, i) => { const [x, y] = toLocal(location, c); const d = Math.hypot(x, y); if (d < bd) { bd = d; bi = i; } });
  if (bd > 40) return null;
  const walk = (dir, limit) => {
    const pts = []; let acc = 0, prev = toLocal(location, coords[bi]);
    for (let i = bi + dir; i >= 0 && i < coords.length; i += dir) {
      const p = toLocal(location, coords[i]); const seg = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      if (acc + seg >= limit) { const t = (limit - acc) / (seg || 1); pts.push([prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t]); break; }
      acc += seg; pts.push(p); prev = p;
    }
    return pts;
  };
  const back = walk(-1, before).reverse();
  const fwd = walk(1, after);
  return [...back, toLocal(location, coords[bi]), ...fwd];
}

const f1 = (n) => Math.round(n * 10) / 10;
/**
 * SVG markup for the junction. step: { type, modifier, bearing_before, bearing_after, location, junction:{bearings,in,out} }.
 * coords: route geometry ([lng,lat]...). Returns '' when there is not enough data.
 */
export function junctionSvg(step, coords, { size = 160, label = 'Junction view' } = {}) {
  if (!step?.location) return '';
  const C = 60;
  const heading = Number.isFinite(step.bearing_before) ? step.bearing_before : 0;
  // Rotate so the approach heading points up the screen.
  const rot = (x, y) => { const a = rad(heading); return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };
  const geo = geometryAround(coords, step.location);
  // Fit the route geometry into the 120×120 box (radius ~48 units around the maneuver point).
  const maxR = geo ? Math.max(20, ...geo.map(([x, y]) => Math.hypot(x, y))) : 50;
  const S = Math.max(0.5, Math.min(2.2, 48 / maxR));
  const scr = ([x, y]) => { const [rx, ry] = rot(x * S, y * S); return [f1(C + rx), f1(C - ry)]; };
  const scrDir = (b, len) => { const a = rad(b); const [rx, ry] = rot(Math.sin(a) * len, Math.cos(a) * len); return [f1(C + rx), f1(C - ry)]; };
  const roads = [];
  const bearings = step.junction?.bearings || [];
  bearings.forEach((b) => { const end = scrDir(b, 58); roads.push(`<line x1="${C}" y1="${C}" x2="${end[0]}" y2="${end[1]}"/>`); });
  let path = null;
  if (geo && geo.length >= 3) path = geo.map(scr);
  else if (Number.isFinite(step.bearing_after)) path = [scrDir(heading + 180, 50), [C, C], scrDir(step.bearing_after, 50)];
  if (!path) return '';
  // Approach road always drawn even without bearings.
  if (!bearings.length) roads.push(`<line x1="${path[0][0]}" y1="${path[0][1]}" x2="${C}" y2="${C}"/>`);
  const ring = /roundabout|rotary/.test(step.type) ? `<circle cx="${C}" cy="${C}" r="14" class="jv-ring"/>` : '';
  const d = `M${path.map((p) => p.join(' ')).join(' L')}`;
  // Arrow head at the end of the path, pointing along its last segment.
  const [p1, p2] = [path[path.length - 2], path[path.length - 1]];
  const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  const head = [[p2[0] + Math.cos(ang) * 8, p2[1] + Math.sin(ang) * 8], [p2[0] + Math.cos(ang + 2.3) * 8, p2[1] + Math.sin(ang + 2.3) * 8], [p2[0] + Math.cos(ang - 2.3) * 8, p2[1] + Math.sin(ang - 2.3) * 8]].map((p) => p.map(f1).join(',')).join(' ');
  return `<svg class="junction-svg" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${label}">`
    + `<rect width="120" height="120" rx="14" class="jv-bg"/>`
    + `<g class="jv-roads">${roads.join('')}</g>${ring}`
    + `<path d="${d}" class="jv-route-casing"/><path d="${d}" class="jv-route"/>`
    + `<polygon points="${head}" class="jv-head"/></svg>`;
}
