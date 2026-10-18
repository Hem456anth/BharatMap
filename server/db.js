import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESSES, RIDERS, WAREHOUSES, MOBILITY } from '../shared/seed.js';
import { encodeDigipin } from '../shared/geo.js';
import { hashPassword } from './auth.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function openDb(file = process.env.DB_FILE || path.join(ROOT, 'data', 'mapos.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  migrate(db);
  return db;
}

export function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const dir = path.join(ROOT, 'db', 'migrations');
  const done = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    // FK checks off while a migration rebuilds tables (SQLite's documented ALTER procedure);
    // integrity is re-verified with foreign_key_check before commit.
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
      const broken = db.prepare('PRAGMA foreign_key_check').all();
      if (broken.length) throw new Error(`migration ${f} broke foreign keys: ${JSON.stringify(broken.slice(0, 3))}`);
      db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, datetime(\'now\'))').run(f);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); db.exec('PRAGMA foreign_keys = ON'); throw e; }
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export function seed(db, { demoPassword = process.env.DEMO_PASSWORD || 'demo1234' } = {}) {
  if (db.prepare('SELECT COUNT(*) c FROM businesses').get().c > 0) return false;
  const pw = hashPassword(demoPassword);
  // Production never ships a known admin password: ADMIN_PASSWORD (≥12 chars) is required.
  const adminPw = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : demoPassword);
  if (!adminPw || adminPw.length < (process.env.NODE_ENV === 'production' ? 12 : 1)) throw new Error('ADMIN_PASSWORD (min 12 chars) is required in production');
  const insUser = db.prepare('INSERT INTO users(id,email,name,role,password_hash) VALUES (?,?,?,?,?)');
  db.exec('BEGIN');
  insUser.run('u_admin', process.env.ADMIN_EMAIL || 'admin@mapos.demo', 'Admin', 'admin', hashPassword(adminPw));
  insUser.run('u_customer', 'customer@mapos.demo', 'Demo Customer', 'customer', pw);
  const insB = db.prepare(`INSERT INTO businesses(id,owner_id,name,type,category,city,lat,lng,address,digipin,phone,hours,verified,rating,delivery,pickup)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insP = db.prepare(`INSERT INTO products(id,business_id,name,category,brand,unit,price,mrp,stock,wholesale_price,min_wholesale_qty,tags)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const b of BUSINESSES) {
    const owner = `u_seller_${b.id}`;
    insUser.run(owner, `seller+${b.id}@mapos.demo`, `${b.name} (owner)`, 'seller', pw);
    insB.run(b.id, owner, b.name, b.type, b.category, b.city, b.lat, b.lng, b.address, encodeDigipin(b.lat, b.lng), b.phone, b.hours, b.verified ? 1 : 0, b.rating, b.delivery ? 1 : 0, b.pickup ? 1 : 0);
    for (const p of b.products) insP.run(p.id, b.id, p.name, p.category, p.brand, p.unit, p.price, p.mrp, p.stock, p.wholesale_price, p.min_wholesale_qty, JSON.stringify(p.tags));
  }
  const insR = db.prepare('INSERT INTO riders(id,user_id,name,vehicle,city,lat,lng,available) VALUES (?,?,?,?,?,?,?,?)');
  for (const r of RIDERS) { insUser.run(`u_${r.id}`, `rider+${r.id}@mapos.demo`, r.name, 'rider', pw); insR.run(r.id, `u_${r.id}`, r.name, r.vehicle, r.city, r.lat, r.lng, 1); }
  const insW = db.prepare('INSERT INTO warehouses VALUES (?,?,?,?,?)');
  for (const w of WAREHOUSES) insW.run(w.id, w.name, w.city, w.lat, w.lng);
  const insM = db.prepare('INSERT INTO mobility_pois(id,kind,name,city,lat,lng,meta,source) VALUES (?,?,?,?,?,?,?,?)');
  for (const m of MOBILITY) insM.run(m.id, m.kind, m.name, m.city, m.lat, m.lng, m.meta || null, 'sample');
  db.exec('COMMIT');
  return true;
}

// Hydrate businesses with nested products in the shape shared/search.js expects.
// MVP: in-process scan (fine for ~10k businesses). Production: PostGIS ST_DWithin + tsvector.
export function loadCatalog(db, city, { includeInactive = false } = {}) {
  const biz = city ? db.prepare('SELECT * FROM businesses WHERE city = ?').all(city) : db.prepare('SELECT * FROM businesses').all();
  const prods = db.prepare(includeInactive ? 'SELECT * FROM products' : 'SELECT * FROM products WHERE active = 1').all();
  const byBiz = new Map();
  for (const p of prods) {
    if (!byBiz.has(p.business_id)) byBiz.set(p.business_id, []);
    byBiz.get(p.business_id).push({ ...p, tags: JSON.parse(p.tags || '[]') });
  }
  return biz.map((b) => ({ ...b, verified: !!b.verified, delivery: !!b.delivery, pickup: !!b.pickup, products: (byBiz.get(b.id) || []).map((p) => ({ ...p, active: p.active !== 0 })) }));
}
