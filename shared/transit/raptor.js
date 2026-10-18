// Scheduled public-transport journey planner (RAPTOR, Delling et al. 2012) over the compact timetable built by
// server/transit/gtfs.js. Walk to stop → ride → transfers (footpaths / same station) → walk.
// Every time it returns is SCHEDULED (from GTFS), never live: the UI labels it "scheduled, not live". Pure.
import { haversineKm } from '../geo.js';

export const WALK_MPS = 1.25;      // ≈ 4.5 km/h
export const DETOUR = 1.3;         // street network vs straight line
const INF = Number.POSITIVE_INFINITY;

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
export const fmtTime = (sec) => `${pad(Math.floor(sec / 3600) % 24)}:${pad(Math.floor(sec / 60) % 60)}`;

/** Service ids running on a date ('YYYYMMDD', dow 0 = Monday). */
export function activeServices(tt, date, dow) {
  const out = new Set();
  for (const [id, s] of Object.entries(tt.services || {})) {
    if (s.remove?.includes(date)) continue;
    if (s.add?.includes(date) || (s.days[dow] && date >= s.start && date <= s.end)) out.add(id);
  }
  return out;
}
const walkSec = (m) => Math.round((m * DETOUR) / WALK_MPS);

/** Stops within maxM of a point, nearest first: [{ i, m }]. One entry per station (closest platform kept for each). */
export function stopsNear(tt, p, maxM = 1200) {
  const out = [];
  for (let i = 0; i < tt.stops.length; i++) { const m = haversineKm(p, tt.stops[i]) * 1000; if (m <= maxM) out.push({ i, m }); }
  return out.sort((a, b) => a.m - b.m);
}

function index(tt) {
  if (tt._idx) return tt._idx;
  const byStop = tt.stops.map(() => []);
  tt.patterns.forEach((p, pi) => p.stops.forEach((s, k) => byStop[s].push([pi, k])));
  const foot = tt.stops.map(() => []);
  for (const [a, b, sec] of tt.transfers || []) foot[a].push([b, sec]);
  Object.defineProperty(tt, '_idx', { value: { byStop, foot }, enumerable: false });
  return tt._idx;
}

/**
 * planJourney(tt, from, to, { date:'YYYYMMDD', dow, departSec, maxWalkM, maxRounds, maxResults })
 * → { itineraries: [...], access: n, egress: n, reason? }
 */
export function planJourney(tt, from, to, { date, dow, departSec, maxWalkM = 1500, maxRounds = 5, maxResults = 3 } = {}) {
  const { byStop, foot } = index(tt);
  const services = activeServices(tt, date, dow);
  const access = stopsNear(tt, from, maxWalkM), egress = stopsNear(tt, to, maxWalkM);
  const direct = haversineKm(from, to) * 1000;
  if (!access.length || !egress.length) return { itineraries: [], access: access.length, egress: egress.length, reason: !access.length ? 'no_stop_near_start' : 'no_stop_near_destination', direct_walk_m: Math.round(direct * DETOUR) };
  if (!services.size) return { itineraries: [], access: access.length, egress: egress.length, reason: 'no_service_on_date' };
  const N = tt.stops.length;
  const best = new Float64Array(N).fill(INF);
  const labels = []; // labels[k][stop] = { arr, kind, ... }
  let marked = new Set();
  const L0 = new Array(N).fill(null);
  for (const a of access) { const arr = departSec + walkSec(a.m); if (arr < best[a.i]) { best[a.i] = arr; L0[a.i] = { arr, kind: 'access', m: a.m }; marked.add(a.i); } }
  labels.push(L0);
  const egressSec = new Map(egress.map((e) => [e.i, walkSec(e.m)]));
  let bestTarget = INF;
  for (let k = 1; k <= maxRounds && marked.size; k++) {
    const prev = labels[k - 1]; const cur = new Array(N).fill(null);
    // collect patterns to scan, from the earliest marked stop in each
    const Q = new Map();
    for (const s of marked) for (const [pi, pos] of byStop[s]) { const q = Q.get(pi); if (q === undefined || pos < q) Q.set(pi, pos); }
    const newly = new Set();
    for (const [pi, startPos] of Q) {
      const pat = tt.patterns[pi];
      let trip = null, boardPos = -1, boardStop = -1;
      for (let pos = startPos; pos < pat.stops.length; pos++) {
        const s = pat.stops[pos];
        if (trip) {
          const arr = (trip.a || trip.d)[pos];
          if (arr < best[s] && arr < bestTarget) {
            best[s] = arr; cur[s] = { arr, kind: 'ride', pattern: pi, trip, boardPos, alightPos: pos, from: boardStop };
            newly.add(s);
            if (egressSec.has(s)) bestTarget = Math.min(bestTarget, arr + egressSec.get(s));
          }
        }
        const prevArr = prev[s]?.arr ?? INF;
        // board (or catch an earlier trip) at s if we reached it in the previous round
        if (prevArr < INF && (!trip || prevArr <= trip.d[pos])) {
          const minDep = prevArr + (prev[s].kind === 'ride' ? 0 : 0);
          const t = pat.trips.find((tr) => services.has(tr.service) && tr.d[pos] >= minDep);
          if (t && (!trip || t.d[pos] < trip.d[pos])) { trip = t; boardPos = pos; boardStop = s; }
        }
      }
    }
    // footpaths (transfers) from stops improved by riding in this round
    for (const s of [...newly]) for (const [t, sec] of foot[s]) {
      const arr = cur[s].arr + sec;
      if (arr < best[t] && arr < bestTarget) { best[t] = arr; cur[t] = { arr, kind: 'walk', from: s, sec }; newly.add(t); }
    }
    labels.push(cur); marked = newly;
  }
  // Pareto set over rounds: arrival improves with more rides.
  const its = []; let lastArr = INF;
  for (let k = 1; k < labels.length; k++) {
    let bestE = null;
    for (const [s, esec] of egressSec) { const l = labels[k][s]; if (l && (!bestE || l.arr + esec < bestE.total)) bestE = { s, total: l.arr + esec }; }
    if (bestE && bestE.total < lastArr) { lastArr = bestE.total; its.push(reconstruct(tt, labels, k, bestE.s, from, to, departSec, egress.find((e) => e.i === bestE.s).m)); }
  }
  its.sort((a, b) => a.arrive_s - b.arrive_s || a.transfers - b.transfers);
  return { itineraries: its.slice(0, maxResults), access: access.length, egress: egress.length, direct_walk_m: Math.round(direct * DETOUR), scheduled: true };
}

function reconstruct(tt, labels, k, target, from, to, departSec, egressM) {
  const legs = []; let s = target; let round = k;
  while (round >= 0) {
    const l = labels[round][s];
    if (!l) { round--; continue; }
    if (l.kind === 'access') { legs.unshift({ type: 'walk', from: { name: 'start', lat: from.lat, lng: from.lng }, to: stopRef(tt, s), distance_m: Math.round(l.m * DETOUR), duration_s: walkSec(l.m), depart_s: departSec, arrive_s: l.arr }); break; }
    if (l.kind === 'walk') { legs.unshift({ type: 'transfer', from: stopRef(tt, l.from), to: stopRef(tt, s), duration_s: l.sec, depart_s: labels[round][l.from].arr, arrive_s: l.arr }); s = l.from; continue; }
    const pat = tt.patterns[l.pattern]; const r = tt.routes[pat.route];
    const stopsOnLeg = pat.stops.slice(l.boardPos, l.alightPos + 1);
    legs.unshift({ type: 'ride', route: { id: r.id, short: r.short, long: r.long, color: r.color, text: r.text, type: r.type }, headsign: pat.headsign, trip_id: l.trip.id,
      from: stopRef(tt, l.from), to: stopRef(tt, s), depart_s: l.trip.d[l.boardPos], arrive_s: l.arr, stops: stopsOnLeg.length - 1,
      geometry: { type: 'LineString', coordinates: stopsOnLeg.map((i) => [tt.stops[i].lng, tt.stops[i].lat]) }, scheduled: true });
    s = l.from; round--;
  }
  const last = legs[legs.length - 1];
  const eSec = walkSec(egressM);
  legs.push({ type: 'walk', from: stopRef(tt, target), to: { name: 'destination', lat: to.lat, lng: to.lng }, distance_m: Math.round(egressM * DETOUR), duration_s: eSec, depart_s: last.arrive_s, arrive_s: last.arrive_s + eSec });
  const rides = legs.filter((x) => x.type === 'ride');
  // Leave just in time for the first ride (no waiting at the stop): shift the access walk to end at boarding.
  const first = legs[0]; const firstRide = rides[0];
  if (first?.type === 'walk' && firstRide) { first.arrive_s = firstRide.depart_s; first.depart_s = firstRide.depart_s - first.duration_s; }
  const leave = legs[0].depart_s; const arrive = legs[legs.length - 1].arrive_s;
  return { depart_s: leave, wait_s: Math.max(0, leave - departSec), arrive_s: arrive, duration_s: arrive - leave, transfers: Math.max(0, rides.length - 1),
    walk_m: legs.filter((x) => x.type === 'walk').reduce((m, x) => m + x.distance_m, 0), legs, scheduled: true, feed: tt.id };
}
const stopRef = (tt, i) => ({ id: tt.stops[i].id, name: tt.stops[i].name, lat: tt.stops[i].lat, lng: tt.stops[i].lng, platform: tt.stops[i].platform || '' });

/** Next scheduled departures from a stop (any platform of the same station). */
export function nextDepartures(tt, stopIdx, { date, dow, sec, limit = 6 } = {}) {
  const { byStop } = index(tt); const services = activeServices(tt, date, dow);
  const st = tt.stops[stopIdx]; const same = tt.stops.map((s, i) => (i === stopIdx || (st.parent && s.parent === st.parent) ? i : -1)).filter((i) => i >= 0);
  const out = [];
  for (const s of same) for (const [pi, pos] of byStop[s]) {
    const pat = tt.patterns[pi]; if (pos === pat.stops.length - 1) continue;
    for (const tr of pat.trips) if (services.has(tr.service) && tr.d[pos] >= sec) { out.push({ dep_s: tr.d[pos], route: tt.routes[pat.route], headsign: pat.headsign, platform: tt.stops[s].platform }); break; }
  }
  return out.sort((a, b) => a.dep_s - b.dep_s).slice(0, limit);
}
