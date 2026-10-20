// Track recording model (v0.8, CoMaps-inspired; original code). Pure (unit-tested); the recorder UI is web/ui/tracks.js.
// A track = { id, name, started_ms, ended_ms|null, segments: [[{lat,lng,ele?,time,acc?}]], paused }.
// Fix filtering keeps the file small and the distance honest:
//   • fixes worse than `maxAccuracyM` are dropped (indoor / cell-tower fixes),
//   • a new point is stored only after `minDistM` metres (or `maxGapMs` of time, so long stops still leave a point),
//   • implausible jumps (> `maxSpeedMps`, e.g. a GPS glitch across town) are dropped,
//   • pausing starts a new segment, so the gap is not counted as distance.
// Storage: tracks live only on this device (localStorage key bm-tracks-v1) unless the user exports them.

export const TRACK_DEFAULTS = { maxAccuracyM: 35, minDistM: 8, maxGapMs: 60_000, maxSpeedMps: 70, maxPoints: 20000, maxTracks: 30 };
const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
export function distM(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
const okFix = (f) => f && Number.isFinite(f.lat) && Number.isFinite(f.lng) && Math.abs(f.lat) <= 90 && Math.abs(f.lng) <= 180;

export function createTrack({ name = '', now = Date.now() } = {}) {
  return { id: `t_${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: String(name).slice(0, 80), started_ms: now, ended_ms: null, paused: false, segments: [[]] };
}
const pointCount = (t) => t.segments.reduce((n, s) => n + s.length, 0);

/** Add a GPS fix. Returns { track, added: boolean, reason?: 'paused'|'ended'|'invalid'|'inaccurate'|'too_close'|'jump'|'full' }. */
export function addFix(track, fix, opts = {}) {
  const o = { ...TRACK_DEFAULTS, ...opts };
  if (track.ended_ms) return { track, added: false, reason: 'ended' };
  if (track.paused) return { track, added: false, reason: 'paused' };
  if (!okFix(fix)) return { track, added: false, reason: 'invalid' };
  if (Number.isFinite(fix.accuracy) && fix.accuracy > o.maxAccuracyM) return { track, added: false, reason: 'inaccurate' };
  if (pointCount(track) >= o.maxPoints) return { track, added: false, reason: 'full' };
  const time = Number.isFinite(fix.ts) ? fix.ts : Date.now();
  const seg = track.segments[track.segments.length - 1];
  const last = seg[seg.length - 1];
  if (last) {
    const d = distM(last, fix), dt = Math.max(1, time - last.time) / 1000;
    if (d / dt > o.maxSpeedMps) return { track, added: false, reason: 'jump' };
    if (d < o.minDistM && time - last.time < o.maxGapMs) return { track, added: false, reason: 'too_close' };
  }
  const p = { lat: +fix.lat.toFixed(6), lng: +fix.lng.toFixed(6), time, ...(Number.isFinite(fix.altitude) ? { ele: +fix.altitude.toFixed(1) } : {}), ...(Number.isFinite(fix.accuracy) ? { acc: Math.round(fix.accuracy) } : {}) };
  const segments = track.segments.slice(0, -1).concat([[...seg, p]]);
  return { track: { ...track, segments }, added: true };
}
export function pauseTrack(track) { return track.paused || track.ended_ms ? track : { ...track, paused: true }; }
export function resumeTrack(track) {
  if (!track.paused || track.ended_ms) return track;
  const last = track.segments[track.segments.length - 1];
  return { ...track, paused: false, segments: last.length ? [...track.segments, []] : track.segments };
}
export function stopTrack(track, now = Date.now()) {
  if (track.ended_ms) return track;
  return { ...track, paused: false, ended_ms: now, segments: track.segments.filter((s) => s.length) };
}

/** Stats: distance (m, within segments only), duration (ms, wall clock), moving time (ms), avg/max speed (m/s), ascent/descent (m). */
export function trackStats(track, now = Date.now()) {
  let distance = 0, moving = 0, maxSpeed = 0, ascent = 0, descent = 0, points = 0;
  for (const s of track.segments) {
    points += s.length;
    for (let i = 1; i < s.length; i++) {
      const d = distM(s[i - 1], s[i]), dt = (s[i].time - s[i - 1].time) / 1000;
      distance += d;
      if (dt > 0) { const v = d / dt; if (v > 0.5) moving += dt * 1000; if (v > maxSpeed && dt >= 2) maxSpeed = v; }
      if (Number.isFinite(s[i].ele) && Number.isFinite(s[i - 1].ele)) { const de = s[i].ele - s[i - 1].ele; if (de > 0) ascent += de; else descent -= de; }
    }
  }
  const duration = (track.ended_ms || now) - track.started_ms;
  return { distance_m: Math.round(distance), duration_ms: Math.max(0, duration), moving_ms: Math.round(moving), avg_speed_mps: moving > 0 ? distance / (moving / 1000) : 0, max_speed_mps: maxSpeed, ascent_m: Math.round(ascent), descent_m: Math.round(descent), points };
}

/** GeoJSON MultiLineString for drawing (segments with ≥ 2 points). */
export function trackToGeoJSON(track) {
  const lines = track.segments.filter((s) => s.length >= 2).map((s) => s.map((p) => [p.lng, p.lat]));
  return { type: 'FeatureCollection', features: lines.length ? [{ type: 'Feature', properties: { id: track.id }, geometry: { type: 'MultiLineString', coordinates: lines } }] : [] };
}
/** Track → geoformats document for toGPX / toKML. */
export function trackToDoc(track) {
  return { name: track.name, time: track.started_ms, tracks: [{ name: track.name, segments: track.segments.map((s) => s.map((p) => ({ lat: p.lat, lng: p.lng, ...(Number.isFinite(p.ele) ? { ele: p.ele } : {}), time: p.time }))) }] };
}
/** Imported GPX/KML track → a stored (ended) track. */
export function trackFromImport(t, { now = Date.now() } = {}) {
  const segments = t.segments.map((s) => s.map((p) => ({ lat: p.lat, lng: p.lng, ...(Number.isFinite(p.ele) ? { ele: p.ele } : {}), time: Number.isFinite(p.time) ? p.time : now }))).filter((s) => s.length);
  const times = segments.flat().map((p) => p.time);
  const start = Math.min(...times), end = Math.max(...times);
  return { ...createTrack({ name: t.name || '', now }), started_ms: Number.isFinite(start) ? start : now, ended_ms: Number.isFinite(end) ? Math.max(end, start) : now, segments };
}

/** Keep the newest `max` tracks (by start time) and sanitise what was read from storage. */
export function normalizeTracks(list, max = TRACK_DEFAULTS.maxTracks) {
  return (Array.isArray(list) ? list : []).filter((t) => t && t.id && Array.isArray(t.segments))
    .map((t) => ({ id: String(t.id).slice(0, 40), name: String(t.name || '').slice(0, 80), started_ms: +t.started_ms || 0, ended_ms: t.ended_ms ? +t.ended_ms : null, paused: !!t.paused, segments: t.segments.map((s) => (Array.isArray(s) ? s.filter(okFix) : [])) }))
    .sort((a, b) => b.started_ms - a.started_ms).slice(0, max);
}
