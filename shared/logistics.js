// Logistics core: pricing, vehicle selection, rider assignment, live progress.
// Shared by the API server and the browser demo so both behave identically.
import { haversineKm, pointAlong } from './geo.js';

export const RULES = {
  freeDeliveryAbove: 999,      // INR subtotal
  baseFee: 25, perKmAfter2: 8,  // INR
  bulkyHandlingFee: 299,        // TVs 43"+ / bulk wholesale
  pickPackSec: 8 * 60,          // seller acceptance + packing
  demoTimeScale: 20,            // demo runs 20x faster than real time (env DEMO_TIME_SCALE)
};

export function isBulky(items) {
  return items.some((it) => (it.category === 'tv' && /\b(4[3-9]|[5-9]\d)\s*"/.test(it.name)) || (it.min_wholesale_qty && it.qty >= it.min_wholesale_qty));
}

export function vehicleFor(items) {
  const units = items.reduce((s, it) => s + it.qty, 0);
  if (isBulky(items) && units >= 5) return ['mini-truck', 'truck'];
  if (isBulky(items)) return ['mini-truck', 'ev-scooter', 'bike']; // prefer van, allow 2W for single 43" with carrier (assumed)
  return ['bike', 'ev-scooter', 'mini-truck'];
}

// items: [{product_id, qty, unit_price, name, category, min_wholesale_qty, wholesale_price}]
export function priceOrder(items, distanceKm, fulfilment) {
  const lines = items.map((it) => {
    const wholesale = it.wholesale_price && it.min_wholesale_qty && it.qty >= it.min_wholesale_qty;
    const unit = wholesale ? it.wholesale_price : it.unit_price;
    return { ...it, unit_price: unit, wholesale_applied: !!wholesale, line_total: unit * it.qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  let delivery_fee = 0, handling_fee = 0;
  if (fulfilment === 'delivery') {
    delivery_fee = subtotal >= RULES.freeDeliveryAbove ? 0 : RULES.baseFee + Math.max(0, Math.ceil(distanceKm - 2)) * RULES.perKmAfter2;
    if (isBulky(items)) handling_fee = RULES.bulkyHandlingFee;
  }
  return { lines, subtotal, delivery_fee, handling_fee, total: subtotal + delivery_fee + handling_fee };
}

// Nearest available rider whose vehicle is acceptable; score = distance with vehicle preference penalty.
export function assignRider(riders, pickup, items) {
  const prefs = vehicleFor(items);
  let best = null;
  for (const r of riders) {
    if (!r.available) continue;
    const pref = prefs.indexOf(r.vehicle);
    if (pref < 0) continue;
    const d = haversineKm(r, pickup);
    if (d > 12) continue;
    const score = d + pref * 2.5;
    if (!best || score < best.score) best = { rider: r, distance_km: +d.toFixed(2), score };
  }
  return best;
}

// Status + position as a pure function of elapsed time (stateless, horizontally scalable).
// route: {geometry:{coordinates}, duration_s}
export function progress(order, nowMs = Date.now(), timeScale = RULES.demoTimeScale) {
  const elapsed = ((nowMs - order.created_ms) / 1000) * timeScale;
  const pick = order.business ? { lat: order.business.lat, lng: order.business.lng } : null;
  if (['cancelled', 'rejected'].includes(order.status)) return { status: order.status, position: pick, fraction: 0, eta_s: null };
  if (order.fulfilment === 'pickup') {
    const ready = elapsed >= RULES.pickPackSec;
    return { status: order.status === 'completed' ? 'completed' : ready ? 'ready_for_pickup' : 'accepted', position: pick, fraction: ready ? 1 : elapsed / RULES.pickPackSec, eta_s: Math.max(0, Math.round((RULES.pickPackSec - elapsed) / timeScale)) };
  }
  const dur = order.route?.duration_s || 600;
  const coords = order.route?.geometry?.coordinates || [];
  if (elapsed < 30) return { status: 'placed', position: pick, fraction: 0, eta_s: Math.round((RULES.pickPackSec + dur) / timeScale) };
  if (elapsed < RULES.pickPackSec) return { status: 'accepted', position: pick, fraction: 0, eta_s: Math.round((RULES.pickPackSec - elapsed + dur) / timeScale) };
  const travel = elapsed - RULES.pickPackSec;
  if (travel < 45) return { status: 'picked_up', position: pick, fraction: 0, eta_s: Math.round(dur / timeScale) };
  const f = Math.min(1, travel / dur);
  if (f >= 1) return { status: 'delivered', position: pointAlong(coords, 1), fraction: 1, eta_s: 0 };
  return { status: 'out_for_delivery', position: pointAlong(coords, f), fraction: +f.toFixed(3), eta_s: Math.round((dur - travel) / timeScale) };
}

// Multi-stop sequencing for fleets (nearest-neighbour + 2-opt). For production use VROOM/OR-Tools.
export function optimizeStops(start, stops) {
  const rest = [...stops];
  const seq = [];
  let cur = start;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((s, i) => { const d = haversineKm(cur, s); if (d < bd) { bd = d; bi = i; } });
    cur = rest.splice(bi, 1)[0];
    seq.push(cur);
  }
  const len = (arr) => arr.reduce((acc, s, i) => acc + haversineKm(i ? arr[i - 1] : start, s), 0);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < seq.length - 1; i++) for (let k = i + 1; k < seq.length; k++) {
      const cand = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)];
      if (len(cand) + 1e-9 < len(seq)) { seq.splice(0, seq.length, ...cand); improved = true; }
    }
  }
  return { sequence: seq, total_km: +len(seq).toFixed(2) };
}
