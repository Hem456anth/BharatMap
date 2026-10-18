// In-browser backend used when no API server is reachable (static/Page demo).
// Same shared modules as the server => identical search, address, pricing and tracking logic.
// State lives in store. NOT secure: demo only.
import { store } from './shared/storage.js';
import { BUSINESSES, RIDERS, MOBILITY } from './shared/seed.js';
import { searchMarketplace, searchPlaces, searchMobility, assistant } from './shared/search.js';
import { parseIndianAddress } from './shared/address.js';
import { encodeDigipin, haversineKm, fallbackRoute } from './shared/geo.js';
import { priceOrder, assignRider, progress, RULES } from './shared/logistics.js';

const KEY = 'mapos-demo-v1';
const load = () => { try { return JSON.parse(store.getItem(KEY)) || null; } catch { return null; } };
let S = load() || { businesses: structuredClone(BUSINESSES), riders: structuredClone(RIDERS), orders: [], user: null };
const save = () => store.setItem(KEY, JSON.stringify(S));
const err = (status, error) => Object.assign(new Error(error), { status, body: { error } });

async function route(from, to) {
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`, { signal: ctl.signal });
    const j = await r.json();
    const r0 = j.routes?.[0];
    if (r0) return { engine: 'osrm-public-demo', distance_m: Math.round(r0.distance), duration_s: Math.round(r0.duration), geometry: r0.geometry };
  } catch { /* ignore */ }
  return fallbackRoute(from, to);
}

const USERS = {
  'customer@mapos.demo': { id: 'u_customer', role: 'customer', name: 'Demo Customer' },
  'admin@mapos.demo': { id: 'u_admin', role: 'admin', name: 'Admin' },
};
function view(o) {
  const b = S.businesses.find((x) => x.id === o.business_id);
  const tr = progress({ ...o, business: b }, Date.now(), RULES.demoTimeScale);
  if (tr.status === 'delivered' && o.status !== 'delivered') {
    o.status = 'delivered';
    const r = S.riders.find((x) => x.id === o.rider?.id); if (r) r.available = true;
    o.events.push({ status: 'delivered', note: 'auto (simulated rider)', at: new Date().toISOString() }); save();
  }
  return { ...o, business: { id: b.id, name: b.name, lat: b.lat, lng: b.lng, address: b.address }, tracking: { order_id: o.id, ...tr, rider: o.rider } };
}

export async function mockApi(method, path, body) {
  const url = new URL(path, 'http://x');
  const qp = Object.fromEntries(url.searchParams);
  const p = url.pathname;
  const origin = qp.lat ? { lat: +qp.lat, lng: +qp.lng } : body?.lat ? { lat: +body.lat, lng: +body.lng } : null;

  if (p === '/api/health') return { status: 'ok', mode: 'in-browser-demo' };
  if (p === '/api/search') return { ...searchMarketplace(S.businesses.filter((b) => !qp.city || b.city === qp.city), qp.q, { origin, radiusKm: +qp.radius_km || 15 }), places: searchPlaces(qp.q, qp.city) };
  if (p === '/api/assistant') {
    const out = assistant(body.query, { origin, businesses: S.businesses, mobility: MOBILITY, radiusKm: 15 });
    if (out.action?.type === 'route') out.action.route = await route(out.action.from, out.action.to);
    return out;
  }
  if (p === '/api/geocode') { const local = parseIndianAddress(qp.q); return { query: qp.q, best: local.best ? { ...local.best, digipin: encodeDigipin(local.best.lat, local.best.lng) } : null, local, external: [] }; }
  if (p === '/api/route') return route({ lat: +qp.from_lat, lng: +qp.from_lng }, { lat: +qp.to_lat, lng: +qp.to_lng });
  if (p === '/api/mobility') return { items: searchMobility(MOBILITY, qp.kind, origin, 20), live_count: 0, note: 'Demo mode: sample data only.' };
  if (p === '/api/auth/login') {
    const email = String(body.email || '').toLowerCase();
    if (body.password !== 'demo1234') throw err(401, 'invalid_credentials');
    let u = USERS[email];
    const m = /^seller\+(b\d+)@mapos\.demo$/.exec(email);
    if (m && S.businesses.some((b) => b.id === m[1])) u = { id: `u_seller_${m[1]}`, role: 'seller', name: 'Seller', business_id: m[1] };
    if (!u) throw err(401, 'invalid_credentials');
    S.user = { ...u, email }; save();
    return { token: 'demo', user: S.user };
  }
  if (p === '/api/orders' && method === 'POST') {
    if (!S.user) throw err(401, 'auth_required');
    const b = S.businesses.find((x) => x.id === body.business_id);
    if (!b) throw err(404, 'business_not_found');
    const lines = body.items.map((it) => {
      const pr = b.products.find((x) => x.id === it.product_id);
      if (!pr) throw err(404, 'product_not_found');
      if (pr.stock < it.qty) throw err(409, 'insufficient_stock');
      return { product_id: pr.id, qty: it.qty, unit_price: pr.price, name: pr.name, category: pr.category, wholesale_price: pr.wholesale_price, min_wholesale_qty: pr.min_wholesale_qty };
    });
    const drop = body.fulfilment === 'delivery' ? body.drop : null;
    const dist = drop ? haversineKm(b, drop) : 0;
    if (drop && dist > 25) throw err(400, 'out_of_delivery_range');
    const priced = priceOrder(lines, dist, body.fulfilment);
    let rider = null, rt = null;
    if (drop) {
      const pick = assignRider(S.riders.filter((r) => r.city === b.city), b, lines);
      if (!pick) throw err(503, 'no_rider_available');
      rider = pick.rider; rider.available = false;
      rt = await route(b, drop);
    }
    for (const l of priced.lines) b.products.find((x) => x.id === l.product_id).stock -= l.qty;
    const o = { id: `ord_${Math.random().toString(16).slice(2, 10)}`, customer_id: S.user.id, business_id: b.id, rider: rider && { id: rider.id, name: rider.name, vehicle: rider.vehicle }, fulfilment: body.fulfilment, payment_method: body.payment_method, status: 'placed', subtotal: priced.subtotal, delivery_fee: priced.delivery_fee, handling_fee: priced.handling_fee, total: priced.total, items: priced.lines.map(({ product_id, name, qty, unit_price }) => ({ product_id, name, qty, unit_price })), drop, route: rt, created_ms: Date.now(), created_at: new Date().toISOString(), events: [{ status: 'placed', note: rider ? `rider ${rider.name} (${rider.vehicle}) assigned` : 'pickup order', at: new Date().toISOString() }] };
    S.orders.unshift(o); save();
    return view(o);
  }
  if (p === '/api/orders') return { items: S.orders.filter((o) => S.user && (S.user.role !== 'seller' ? o.customer_id === S.user.id || S.user.role === 'admin' : o.business_id === S.user.business_id)).map(view) };
  let m = /^\/api\/orders\/([\w]+)(\/track)?$/.exec(p);
  if (m) { const o = S.orders.find((x) => x.id === m[1]); if (!o) throw err(404, 'not_found'); const v = view(o); return m[2] ? v.tracking : v; }
  if (p === '/api/seller/dashboard') {
    if (S.user?.role !== 'seller') throw err(403, 'forbidden');
    const b = S.businesses.find((x) => x.id === S.user.business_id);
    const orders = S.orders.filter((o) => o.business_id === b.id).map(view);
    return { business: b, kpis: { orders: orders.length, revenue: orders.reduce((s, o) => s + o.subtotal, 0), low_stock: b.products.filter((x) => x.stock <= 2).length, catalogue: b.products.length }, orders };
  }
  m = /^\/api\/seller\/products\/(\w+)$/.exec(p);
  if (m && method === 'PATCH') {
    const b = S.businesses.find((x) => x.id === S.user?.business_id); const pr = b?.products.find((x) => x.id === m[1]);
    if (!pr) throw err(404, 'not_found');
    if (body.price !== undefined) pr.price = Math.max(0, Math.round(+body.price));
    if (body.stock !== undefined) pr.stock = Math.max(0, Math.round(+body.stock));
    save(); return pr;
  }
  if (p === '/api/reset') { store.removeItem(KEY); S = { businesses: structuredClone(BUSINESSES), riders: structuredClone(RIDERS), orders: [], user: null }; return { ok: true }; }
  throw err(404, 'not_found');
}
export const mockLogout = () => { S.user = null; save(); };
