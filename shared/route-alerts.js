// v0.7.20 (G8) community incidents along the active route, with a "Still there?" check after passing (pure).
// Extends the v0.5 expiring incidents (shared/community.js: 2-hour TTL, votes, never "verified"). Evidence: HERE WeGo
// "confirm it is still active", Mappls users asking to mark accidents / waterlogging (GAPS_RANKED.md G8).
//
// incidentsOnRoute: incidents within `bufferM` of the route line, with their along-route distance.
// createRouteAlerts: per navigation session — announce each incident once when it is ≤ announceM ahead, then after the
// vehicle has passed it by passM, ask "Still there?" once (one chip at a time). Votes feed the existing vote rules.
const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
function dM(a, b) { const x = rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2)); const y = rad(b[1] - a[1]); return Math.hypot(x, y) * R; }

/** Project p [lng,lat] on the polyline → { dist, along }. Full scan (incidents are few). */
export function projectPoint(coords, p) {
  let best = { dist: Infinity, along: 0 }, acc = 0;
  const k = Math.cos(rad(p[1]));
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = dM(p, q);
    if (d < best.dist) best = { dist: d, along: acc + dM(a, q) };
    acc += dM(a, b);
  }
  return best;
}

export function incidentsOnRoute(incidents, coords, { bufferM = 50 } = {}) {
  if (!Array.isArray(incidents) || !coords?.length) return [];
  return incidents.map((inc) => { const pr = projectPoint(coords, [inc.lng, inc.lat]); return { id: inc.id, type: inc.type, along: Math.round(pr.along), off: Math.round(pr.dist), incident: inc }; })
    .filter((x) => x.off <= bufferM).sort((a, b) => a.along - b.along);
}

/** Corridor bbox (with a margin in degrees) for fetching incidents near a route. */
export function routeBbox(coords, marginDeg = 0.005) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return { w: w - marginDeg, s: s - marginDeg, e: e + marginDeg, n: n + marginDeg };
}

export function createRouteAlerts({ announceM = 500, passM = 40, askForS = 20 } = {}) {
  let items = []; const announced = new Set(), asked = new Set(); let ask = null;
  return {
    setItems(list) { items = list || []; },
    get items() { return items; },
    get asking() { return ask; },
    /** along = vehicle's along-route distance (m). Returns { announce: [item], ask: item|null, expired: boolean }. */
    update(along, now = Date.now()) {
      const announce = [];
      for (const it of items) {
        const ahead = it.along - along;
        if (!announced.has(it.id) && ahead > 0 && ahead <= announceM) { announced.add(it.id); announce.push({ ...it, aheadM: Math.round(ahead) }); }
      }
      let expired = false;
      if (ask && now - ask.at > askForS * 1000) { ask = null; expired = true; }
      if (!ask) {
        const passed = items.find((it) => !asked.has(it.id) && along - it.along >= passM && along - it.along < passM + 600);
        if (passed) { asked.add(passed.id); ask = { ...passed, at: now }; }
      }
      return { announce, ask, expired };
    },
    answer() { const a = ask; ask = null; return a; },
  };
}
