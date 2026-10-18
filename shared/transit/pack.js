// Compact wire format for a timetable (used for the bundled client copy, web/transit/*.json):
// trips that share a pattern usually share their running times, so each trip is stored as
// [serviceIndex, firstDeparture, profileIndex] and each pattern keeps its unique offset profiles. Lossless.
export function packTimetable(tt) {
  const services = Object.keys(tt.services);
  const sIdx = new Map(services.map((s, i) => [s, i]));
  const patterns = tt.patterns.map((p) => {
    const profiles = []; const key = new Map();
    const trips = p.trips.map((t) => {
      const arr = t.a || t.d; const o = [...t.d.map((v) => v - t.d[0]), ...(t.a ? ['a', ...arr.map((v) => v - t.d[0])] : [])];
      const k = o.join(',');
      if (!key.has(k)) { key.set(k, profiles.length); profiles.push(o); }
      return [sIdx.get(t.service), t.d[0], key.get(k), t.id];
    });
    return { route: p.route, headsign: p.headsign, stops: p.stops, profiles, trips };
  });
  return { ...tt, packed: 1, serviceList: services, patterns, stops: tt.stops.map((s) => [s.id, s.name, s.lat, s.lng, s.parent, s.platform]) };
}
export function unpackTimetable(pk) {
  if (!pk.packed) return pk;
  const stops = pk.stops.map(([id, name, lat, lng, parent, platform]) => ({ id, name, lat, lng, parent, platform }));
  const patterns = pk.patterns.map((p) => ({ route: p.route, headsign: p.headsign, stops: p.stops, trips: p.trips.map(([si, t0, pi, id]) => {
    const prof = p.profiles[pi]; const ai = prof.indexOf('a');
    const d = (ai < 0 ? prof : prof.slice(0, ai)).map((x) => x + t0);
    const tr = { id, service: pk.serviceList[si], d };
    if (ai >= 0) tr.a = prof.slice(ai + 1).map((x) => x + t0);
    return tr;
  }) }));
  const { packed, serviceList, ...rest } = pk;
  return { ...rest, stops, patterns };
}
