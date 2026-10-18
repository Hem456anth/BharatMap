// Speed limits along a route + overspeed logic. Pure (unit-tested), shared by the app and the server.
// Sources, in order (web/services/speed.js, server/providers): OSRM `annotations=maxspeed` when the OSRM instance
// supports it (self-hosted; the FOSSGIS instance rejects that annotation), Valhalla /trace_attributes
// `edge.speed_limit` (FOSSGIS supports it), then OpenStreetMap `maxspeed` tags of the ways along the route corridor
// (Overpass). A limit is only ever shown when one of these gives an explicit number; unknown stays unknown.

const MPH = 1.609344;
/**
 * Parse an OSM `maxspeed` value to km/h.
 *  "50" → 50 · "50 mph" → 80 · "60;40" → 40 (lowest of a list) · "none"/"signals"/"walk"/"variable" → null
 *  Implicit zone codes such as "IN:urban" / "IN:rural" / "IN:motorway" → null: India has no single national value
 *  for them (limits are notified per state and per vehicle class), so we never invent one.
 * Returns { kmh, unit, raw, implicit } — kmh null when unknown.
 */
export function parseMaxspeed(raw) {
  const out = { kmh: null, unit: null, raw: raw == null ? null : String(raw), implicit: null };
  if (raw == null) return out;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 && raw < 200 ? { ...out, kmh: Math.round(raw), unit: 'km/h' } : out;
  const s = String(raw).trim().toLowerCase();
  if (!s) return out;
  const zone = s.match(/^([a-z]{2}):([a-z_]+)$/);
  if (zone) return { ...out, implicit: `${zone[1].toUpperCase()}:${zone[2]}` };
  const parts = s.split(/[;|]/).map((p) => p.trim()).filter(Boolean);
  let best = null;
  for (const p of parts) {
    const m = p.match(/^(\d+(?:\.\d+)?)\s*(km\/h|kmh|kph|mph|knots)?$/);
    if (!m) continue;
    let v = Number(m[1]); const unit = m[2] || 'km/h';
    if (unit === 'mph') v *= MPH; else if (unit === 'knots') v *= 1.852;
    v = Math.round(v);
    if (v > 0 && v < 200 && (best == null || v < best.kmh)) best = { kmh: v, unit: unit === 'mph' ? 'mph' : 'km/h' };
  }
  return best ? { ...out, ...best } : out;
}

/** OSRM annotation.maxspeed entry ({speed, unit} | {unknown:true} | {none:true}) → km/h or null. */
export function osrmMaxspeedKmh(e) {
  if (!e || e.unknown || e.none || !Number.isFinite(e.speed)) return null;
  return Math.round(e.unit === 'mph' ? e.speed * MPH : e.speed);
}

/** Merge consecutive equal limits: [{fromM,toM,kmh}] (kmh null = unknown). */
export function mergeSegments(segs) {
  const out = [];
  for (const s of segs) {
    if (!(s.toM > s.fromM)) continue;
    const last = out[out.length - 1];
    if (last && last.kmh === s.kmh && Math.abs(last.toM - s.fromM) < 1) last.toM = s.toM; else out.push({ ...s });
  }
  return out;
}

/** OSRM legs[].annotation {distance[], maxspeed[]} → segments along the route. */
export function segmentsFromOsrmAnnotation(legs) {
  const segs = []; let at = 0;
  for (const leg of legs || []) {
    const a = leg.annotation; if (!a?.distance || !a.maxspeed) return null;
    a.distance.forEach((d, i) => { segs.push({ fromM: at, toM: at + d, kmh: osrmMaxspeedKmh(a.maxspeed[i]) }); at += d; });
  }
  return segs.length ? mergeSegments(segs) : null;
}

/** Valhalla /trace_attributes edges [{length (km), speed_limit}] → segments. speed_limit 0/absent/"unlimited" → unknown. */
export function segmentsFromValhallaTrace(json) {
  const edges = json?.edges; if (!Array.isArray(edges) || !edges.length) return null;
  const unitsMiles = json.units === 'miles';
  const segs = []; let at = 0;
  for (const e of edges) {
    const len = (Number(e.length) || 0) * (unitsMiles ? 1609.344 : 1000);
    const v = Number(e.speed_limit);
    segs.push({ fromM: at, toM: at + len, kmh: Number.isFinite(v) && v > 0 && v < 200 ? Math.round(unitsMiles ? v * MPH : v) : null });
    at += len;
  }
  return mergeSegments(segs);
}

/** Stretch segments so they span exactly `totalM` (edge lengths from map matching differ slightly from the route). */
export function scaleSegments(segs, totalM) {
  if (!segs?.length || !(totalM > 0)) return segs;
  const span = segs[segs.length - 1].toM; if (!(span > 0)) return segs;
  const k = totalM / span;
  return segs.map((s) => ({ fromM: s.fromM * k, toM: s.toM * k, kmh: s.kmh }));
}
/** Limit (km/h or null) at a distance along the route. */
export function limitAt(segs, alongM) {
  if (!segs?.length || !Number.isFinite(alongM)) return null;
  let lo = 0, hi = segs.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; const s = segs[m]; if (alongM < s.fromM) hi = m - 1; else if (alongM >= s.toM) lo = m + 1; else return s.kmh; }
  return null;
}
/** Share of the route length (0..1) with a known limit — shown in the route details. */
export function coverage(segs) {
  if (!segs?.length) return 0;
  const total = segs[segs.length - 1].toM - segs[0].fromM;
  return total > 0 ? segs.reduce((a, s) => a + (s.kmh ? s.toM - s.fromM : 0), 0) / total : 0;
}

// ---- Overpass fallback: maxspeed of OSM ways near the route ----
const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
function dM(a, b) { const x = rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2)); const y = rad(b[1] - a[1]); return Math.hypot(x, y) * R; }
function distToSeg(p, a, b) {
  const k = Math.cos(rad(p[1]));
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return dM(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
}
/** Overpass QL: highways with a maxspeed tag within `aroundM` of a (sampled) route line. */
export function buildMaxspeedQuery(coords, { aroundM = 20, maxPoints = 120 } = {}) {
  const step = Math.max(1, Math.ceil(coords.length / maxPoints));
  const pts = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  const line = pts.map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(',');
  return `[out:json][timeout:25];way(around:${aroundM},${line})["highway"]["maxspeed"];out tags geom;`;
}
/**
 * Match Overpass ways (with geometry) to the route: each route segment takes the maxspeed of the nearest way
 * within `maxM` metres (else unknown). Returns merged segments.
 */
export function segmentsFromOverpassWays(json, coords, { maxM = 18 } = {}) {
  const ways = (json?.elements || []).filter((w) => w.type === 'way' && Array.isArray(w.geometry) && w.tags?.maxspeed)
    .map((w) => ({ kmh: parseMaxspeed(w.tags.maxspeed).kmh, pts: w.geometry.map((g) => [g.lon, g.lat]) })).filter((w) => w.kmh);
  if (!ways.length || coords.length < 2) return null;
  const segs = []; let at = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i]; const len = dM(a, b);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let best = null, bd = maxM;
    for (const w of ways) for (let j = 1; j < w.pts.length; j++) { const d = distToSeg(mid, w.pts[j - 1], w.pts[j]); if (d < bd) { bd = d; best = w; } }
    segs.push({ fromM: at, toM: at + len, kmh: best ? best.kmh : null }); at += len;
  }
  return mergeSegments(segs);
}

/**
 * Overspeed monitor. update(speedKmh, limitKmh) → { over, chime, ratio }.
 * Over = speed > limit × (1 + tolerance) (default 10 %), sustained for `holdMs` (avoids GPS spikes).
 * `chime` is true only on the transition into overspeed; it re-arms after the speed has been back at or under
 * the limit (plain, no tolerance) for `rearmMs`, so a driver hovering at the threshold is not nagged.
 */
export function createOverspeedMonitor({ tolerance = 0.10, holdMs = 2000, rearmMs = 10_000, now = () => Date.now() } = {}) {
  let overSince = null, under = null, over = false, armed = true;
  return {
    update(speedKmh, limitKmh) {
      const t = now();
      if (!Number.isFinite(speedKmh) || !Number.isFinite(limitKmh) || limitKmh <= 0) { overSince = null; over = false; return { over: false, chime: false, ratio: null }; }
      const ratio = speedKmh / limitKmh;
      let chime = false;
      if (ratio > 1 + tolerance) {
        under = null;
        if (overSince == null) overSince = t;
        if (!over && t - overSince >= holdMs) { over = true; if (armed) { chime = true; armed = false; } }
      } else {
        overSince = null; over = false;
        if (ratio <= 1) { if (under == null) under = t; if (t - under >= rearmMs) armed = true; } else under = null;
      }
      return { over, chime, ratio };
    },
    get over() { return over; },
  };
}

/** GPS speed (m/s, may be null) → km/h, else derived from two fixes; null when unknown or implausible. */
export function speedKmhFromFixes(fix, prev) {
  if (Number.isFinite(fix?.speed) && fix.speed >= 0) return fix.speed * 3.6;
  if (!prev || !Number.isFinite(fix?.ts) || !Number.isFinite(prev.ts)) return null;
  const dt = (fix.ts - prev.ts) / 1000; if (dt <= 0.4 || dt > 10) return null;
  const v = (dM([prev.lng, prev.lat], [fix.lng, fix.lat]) / dt) * 3.6;
  return v < 250 ? v : null;
}
