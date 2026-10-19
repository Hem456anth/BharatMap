// India road hints (pure, unit-tested; shared by the app and the server). From OpenStreetMap tags along a route:
//   flyover       bridge=* on a motorway/trunk/primary/secondary/tertiary road (or a name with "flyover"/"fly over")
//                 → "Take the flyover"
//   service road  highway=service / Valhalla road_class service_other or use service_road, running alongside a
//                 main road → "Stay on the service road"
//   narrow road   lanes=1 or width ≤ 4 m explicitly tagged on a two-way road (Overpass only: Valhalla reports lane_count 1
//                 for untagged ways too) → "Narrow road ahead"
//   time restriction  access/motor_vehicle/motorcar/hgv/oneway…:conditional (e.g. "no @ (Mo-Sa 08:00-11:00)"),
//                 plus odd-even notes when mapped (a note/description mentioning odd/even) → badge with the condition
// Sources (web/services/roadhints.js): Valhalla /trace_attributes edge.bridge/road_class/use/lane_count, then
// Overpass for the tags Valhalla does not expose (*:conditional, width, notes). Nothing is shown when not mapped.

const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
function dM(a, b) { const x = rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2)); const y = rad(b[1] - a[1]); return Math.hypot(x, y) * R; }
function distToSeg(p, a, b) {
  const k = Math.cos(rad(p[1]));
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return dM(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
}

const MAJOR = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/;
const VALHALLA_MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
export const CONDITIONAL_KEYS = ['access:conditional', 'motor_vehicle:conditional', 'motorcar:conditional', 'vehicle:conditional', 'hgv:conditional', 'goods:conditional', 'motorcycle:conditional', 'oneway:conditional', 'maxspeed:conditional', 'bus:conditional'];
const ODD_EVEN = /odd[\s-]*even|odd\/even|सम[\s-]*विषम|సరి[\s-]*బేసి/i;

/** Parse "no @ (Mo-Sa 08:00-11:00); destination @ (22:00-06:00)" → [{ value, condition }]. Brackets may nest. */
export function parseConditional(raw) {
  const s = String(raw || '').trim(); if (!s) return [];
  const out = []; let depth = 0, cur = '';
  const parts = [];
  for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const m = p.match(/^\s*([^@]+?)\s*@\s*(.+?)\s*$/); if (!m) continue;
    let cond = m[2].trim(); if (cond.startsWith('(') && cond.endsWith(')')) cond = cond.slice(1, -1).trim();
    out.push({ value: m[1].trim(), condition: cond });
  }
  return out;
}

/** Restrictions of one way's tags: [{ key, value, condition, oddEven }]. Only restrictive values (no/private/destination/delivery/-1/yes for oneway). */
export function restrictionsFromTags(tags = {}) {
  const out = [];
  for (const key of CONDITIONAL_KEYS) {
    if (!tags[key]) continue;
    for (const c of parseConditional(tags[key])) {
      const restrictive = key === 'oneway:conditional' ? /^(yes|-1|reversible)$/.test(c.value) : key === 'maxspeed:conditional' ? true : /^(no|private|destination|delivery|permit|customers|agricultural)$/.test(c.value);
      if (restrictive) out.push({ key, value: c.value, condition: c.condition, oddEven: ODD_EVEN.test(c.condition) });
    }
  }
  const note = [tags.note, tags.description, tags['note:en']].filter(Boolean).join(' ');
  if (ODD_EVEN.test(note)) out.push({ key: 'note', value: 'odd-even', condition: note.slice(0, 120), oddEven: true });
  return out;
}

/** Width tag → metres (null when unknown). "3.5", "3.5 m", "12'" (feet). */
export function parseWidth(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  const ft = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)$/); if (ft) return +(Number(ft[1]) * 0.3048).toFixed(2);
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:m)?$/); return m ? Number(m[1]) : null;
}

/** Hint flags of one OSM way: { flyover, service, narrow, restrictions } */
export function flagsFromTags(tags = {}) {
  const hw = tags.highway || '';
  const name = `${tags.name || ''} ${tags['name:en'] || ''}`;
  const flyover = (!!tags.bridge && tags.bridge !== 'no' && MAJOR.test(hw)) || (/fly\s?-?over/i.test(name) && !!hw);
  const service = hw === 'service' && !/^(parking_aisle|driveway|drive-through)$/.test(tags.service || '') || /service road|frontage/i.test(name);
  const lanes = Number(tags.lanes); const width = parseWidth(tags.width ?? tags['est_width']);
  const oneway = /^(yes|1|-1)$/.test(tags.oneway || '');
  const narrow = !/_link$/.test(hw) && hw !== 'service' && ((lanes === 1 && !oneway) || (width != null && width <= 4));
  return { flyover, service, narrow, restrictions: restrictionsFromTags(tags) };
}

/** Valhalla trace_attributes edges → flagged segments [{fromM,toM,flyover,service,narrow,restrictions:[]}] */
export function segmentsFromValhallaEdges(json) {
  const edges = json?.edges; if (!Array.isArray(edges) || !edges.length) return null;
  const mi = json.units === 'miles' ? 1609.344 : 1000;
  const segs = []; let at = 0;
  for (const e of edges) {
    const len = (Number(e.length) || 0) * mi;
    const rc = e.road_class || ''; const use = e.use || '';
    const names = (e.names || []).join(' ');
    const flyover = (!!e.bridge && VALHALLA_MAJOR.has(rc)) || /fly\s?-?over/i.test(names);
    const service = use === 'service_road' || use === 'frontage_road' || (rc === 'service_other' && use === 'road') || /service road/i.test(names);
    // Valhalla's lane_count is 1 both for ways tagged lanes=1 and for untagged ways (its default), so it cannot tell
    // a narrow road from an unmapped one: narrow comes only from explicit OSM tags (Overpass), never from here.
    segs.push({ fromM: at, toM: at + len, flyover, service, narrow: false, restrictions: [] });
    at += len;
  }
  return segs;
}

/**
 * Overpass ways (out tags geom) → flagged segments along the route coordinates (nearest way within maxM).
 * structure=false (the default, used next to Valhalla) keeps only tag-only facts (restrictions, explicit narrow):
 * a flyover and the road under it, or a service road and its main road, run within metres of each other, so the
 * nearest-way match cannot say which one the route is on unless every highway in the corridor was fetched
 * (buildRoadHintsQuery(…, { full: true }), the Overpass-only fallback) — then structure=true is safe.
 */
export function segmentsFromOverpass(json, coords, { maxM = 15, structure = false } = {}) {
  const ways = (json?.elements || []).filter((w) => w.type === 'way' && Array.isArray(w.geometry) && w.tags?.highway)
    .map((w) => ({ id: w.id, f: flagsFromTags(w.tags), name: w.tags.name || '', pts: w.geometry.map((g) => [g.lon, g.lat]) }));
  if (!ways.length || coords.length < 2) return null;
  const segs = []; let at = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i]; const len = dM(a, b);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let best = null, bd = maxM;
    for (const w of ways) for (let j = 1; j < w.pts.length; j++) { const d = distToSeg(mid, w.pts[j - 1], w.pts[j]); if (d < bd) { bd = d; best = w; } }
    segs.push({ fromM: at, toM: at + len, flyover: structure && !!best?.f.flyover, service: structure && !!best?.f.service, narrow: !!best?.f.narrow, restrictions: best?.f.restrictions || [], way: best?.id ?? null, name: best?.name || '' });
    at += len;
  }
  return segs;
}

/** Overpass QL for the route corridor: highways that are bridges, service roads, narrow, conditional or with odd-even notes. */
export function buildRoadHintsQuery(coords, { aroundM = 15, maxPoints = 120, full = false } = {}) {
  const step = Math.max(1, Math.ceil(coords.length / maxPoints));
  const pts = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  const line = pts.map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(',');
  const a = `(around:${aroundM},${line})`;
  if (full) return `[out:json][timeout:25];way(around:${Math.min(aroundM, 10)},${line})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street)(_link)?$"];out tags geom;`;
  const cond = CONDITIONAL_KEYS.map((k) => `way${a}["highway"]["${k}"];`).join('');
  return `[out:json][timeout:25];(way${a}["highway"]["bridge"];way${a}["highway"="service"];way${a}["highway"]["lanes"="1"];way${a}["highway"]["width"];${cond}way${a}["highway"]["note"~"odd|even",i];);out tags geom;`;
}

/** Merge two flagged segment lists: OR the flags, concatenate restrictions (Valhalla structure + Overpass tags). */
export function mergeHintSegments(a, b) {
  if (!a?.length) return b || null; if (!b?.length) return a;
  const cuts = [...new Set([...a, ...b].flatMap((s) => [s.fromM, s.toM]))].sort((x, y) => x - y);
  const at = (list, m) => list.find((s) => m >= s.fromM && m < s.toM);
  const out = [];
  for (let i = 1; i < cuts.length; i++) {
    const mid = (cuts[i - 1] + cuts[i]) / 2; const x = at(a, mid), y = at(b, mid);
    out.push({ fromM: cuts[i - 1], toM: cuts[i], flyover: !!(x?.flyover || y?.flyover), service: !!(x?.service || y?.service), narrow: !!(x?.narrow || y?.narrow), restrictions: [...(x?.restrictions || []), ...(y?.restrictions || [])] });
  }
  return out;
}

/** Scale segments to the route length (map-matched edge lengths differ slightly). */
export function scaleHintSegments(segs, totalM) {
  if (!segs?.length || !(totalM > 0)) return segs;
  const span = segs[segs.length - 1].toM; if (!(span > 0)) return segs;
  const k = totalM / span;
  return segs.map((s) => ({ ...s, fromM: s.fromM * k, toM: s.toM * k }));
}

/**
 * Hint events along the route: [{ type: 'flyover'|'service'|'narrow'|'restriction', atM, toM, restriction? }]
 * A stretch shorter than minM (default 40 m; 15 m for restrictions) is ignored, and consecutive equal stretches
 * merge, so the driver hears one hint per flyover / service road / narrow stretch.
 */
export function hintEvents(segs, { minM = 40 } = {}) {
  if (!segs?.length) return [];
  const ev = [];
  for (const type of ['flyover', 'service', 'narrow']) {
    let open = null;
    for (const s of segs) {
      if (s[type]) { if (open && s.fromM - open.toM < 25) open.toM = s.toM; else { if (open) ev.push(open); open = { type, atM: s.fromM, toM: s.toM }; } }
    }
    if (open) ev.push(open);
  }
  const seen = new Set();
  for (const s of segs) for (const r of s.restrictions || []) {
    const key = `${r.key}|${r.condition}`;
    const last = ev.find((e) => e.type === 'restriction' && e.key === key && s.fromM - e.toM < 30);
    if (last) { last.toM = s.toM; continue; }
    if (seen.has(`${key}|${Math.round(s.fromM / 200)}`)) continue; seen.add(`${key}|${Math.round(s.fromM / 200)}`);
    ev.push({ type: 'restriction', atM: s.fromM, toM: s.toM, key, restriction: r });
  }
  // a flyover must be a real structure (≥ 120 m) — short bridges over drains and culverts are not announced
  return ev.filter((e) => e.type === 'restriction' || e.toM - e.atM >= (e.type === 'flyover' ? Math.max(minM, 120) : minM)).sort((x, y) => x.atM - y.atM);
}

/** The hint to show at `alongM`: the next event starting within `aheadM`, or the one we are on (service/narrow/restriction). */
export function hintAt(events, alongM, { aheadM = 400 } = {}) {
  if (!events?.length || !Number.isFinite(alongM)) return null;
  let best = null;
  for (const e of events) {
    const until = e.atM - alongM;
    const on = alongM >= e.atM && alongM < e.toM;
    if (e.type === 'restriction') continue;
    if (until > 0 && until <= aheadM) { if (!best || until < best.inM) best = { ...e, inM: Math.round(until), on: false }; }
    else if (on && e.type !== 'flyover') { if (!best) best = { ...e, inM: 0, on: true }; }
  }
  return best;
}
/** Restriction badge to show at `alongM`: one ahead within aheadM or the one we are on. */
export function restrictionAt(events, alongM, { aheadM = 800 } = {}) {
  if (!events?.length || !Number.isFinite(alongM)) return null;
  return events.find((e) => e.type === 'restriction' && alongM < e.toM && e.atM - alongM <= aheadM) || null;
}
/** i18n key for a hint event. */
export function hintKey(e) { return e ? ({ flyover: 'hint_flyover', service: 'hint_service', narrow: 'hint_narrow' }[e.type] || null) : null; }
/** Short label for a restriction badge: "Odd-even" or "No entry Mo-Sa 08:00-11:00". */
export function restrictionLabel(r) { return r ? (r.oddEven ? 'odd_even' : r.key === 'oneway:conditional' ? 'one_way' : r.key === 'maxspeed:conditional' ? 'speed' : r.value === 'destination' ? 'access_destination' : 'no_entry') : null; }
