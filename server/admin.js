// Admin API: users, businesses, products, orders, reports, audit. All routes require role=admin
// and every mutation is written to audit_log.
import { requireRole } from './auth.js';

const ROLES = ['customer', 'seller', 'rider', 'admin'];
const LIVE = "status NOT IN ('cancelled','rejected')";

export function mountAdmin(app, { db, orderView, bad, str, num }) {
  const admin = requireRole('admin');
  const audit = (req, action, entity, id) => db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES (?,?,?,?)').run(req.user.sub, action, entity, id);
  const lim = (v, d = 50) => Math.min(200, Math.max(1, Math.floor(num(v) || d)));
  const like = (v) => `%${str(v, 80).replace(/[%_]/g, '')}%`;

  app.get('/api/admin/overview', admin, (_req, res) => {
    const one = (sql, ...a) => db.prepare(sql).get(...a);
    const all = (sql, ...a) => db.prepare(sql).all(...a);
    const since14 = Date.now() - 14 * 86400_000;
    res.json({
      users: Object.fromEntries(all('SELECT role, COUNT(*) c FROM users GROUP BY role').map((r) => [r.role, r.c])),
      users_disabled: one('SELECT COUNT(*) c FROM users WHERE disabled=1').c,
      businesses: one('SELECT COUNT(*) total, SUM(verified) verified FROM businesses'),
      products: one('SELECT COUNT(*) total, SUM(active) active, SUM(CASE WHEN stock<=2 THEN 1 ELSE 0 END) low_stock FROM products'),
      orders: { total: one('SELECT COUNT(*) c FROM orders').c, by_status: Object.fromEntries(all('SELECT status, COUNT(*) c FROM orders GROUP BY status').map((r) => [r.status, r.c])) },
      gmv: one(`SELECT COALESCE(SUM(total),0) v FROM orders WHERE ${LIVE}`).v,
      payments: Object.fromEntries(all('SELECT payment_status s, COUNT(*) c FROM orders GROUP BY payment_status').map((r) => [r.s, r.c])),
      by_city: all(`SELECT b.city, COUNT(o.id) orders, COALESCE(SUM(CASE WHEN o.${LIVE} THEN o.total END),0) gmv FROM businesses b LEFT JOIN orders o ON o.business_id=b.id GROUP BY b.city`),
      top_businesses: all(`SELECT b.id, b.name, b.city, COUNT(o.id) orders, COALESCE(SUM(o.total),0) gmv FROM orders o JOIN businesses b ON b.id=o.business_id WHERE o.${LIVE} GROUP BY b.id ORDER BY gmv DESC LIMIT 5`),
      daily: all(`SELECT date(created_ms/1000,'unixepoch','+05:30') day, COUNT(*) orders, COALESCE(SUM(CASE WHEN ${LIVE} THEN total END),0) gmv FROM orders WHERE created_ms>=? GROUP BY day ORDER BY day`, since14),
      riders: one('SELECT COUNT(*) total, SUM(available) available FROM riders'),
    });
  });

  app.get('/api/admin/users', admin, (req, res) => {
    const role = ROLES.includes(req.query.role) ? req.query.role : null;
    const rows = db.prepare(`SELECT id,email,name,role,disabled,preferred_lang,created_at FROM users WHERE (? IS NULL OR role=?) AND (email LIKE ? OR name LIKE ?) ORDER BY created_at DESC, id LIMIT ?`)
      .all(role, role, like(req.query.q), like(req.query.q), lim(req.query.limit));
    res.json({ items: rows });
  });
  app.patch('/api/admin/users/:id', admin, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!u) return bad(res, 'not_found', 404);
    if (u.id === req.user.sub && (req.body?.disabled || (req.body?.role && req.body.role !== 'admin'))) return bad(res, 'cannot_change_self', 409);
    const role = req.body?.role === undefined ? u.role : req.body.role;
    if (!ROLES.includes(role)) return bad(res, 'invalid_role');
    const disabled = req.body?.disabled === undefined ? u.disabled : req.body.disabled ? 1 : 0;
    db.prepare('UPDATE users SET role=?, disabled=? WHERE id=?').run(role, disabled, u.id);
    audit(req, `user.update role=${role} disabled=${disabled}`, 'user', u.id);
    res.json(db.prepare('SELECT id,email,name,role,disabled FROM users WHERE id=?').get(u.id));
  });

  app.get('/api/admin/businesses', admin, (req, res) => {
    const v = req.query.verified === '1' ? 1 : req.query.verified === '0' ? 0 : null;
    const rows = db.prepare(`SELECT b.id,b.name,b.type,b.category,b.city,b.address,b.verified,b.rating,b.delivery,b.pickup,b.gstin,u.email owner_email,
        (SELECT COUNT(*) FROM products p WHERE p.business_id=b.id) products,
        (SELECT COUNT(*) FROM orders o WHERE o.business_id=b.id) orders
      FROM businesses b LEFT JOIN users u ON u.id=b.owner_id
      WHERE (? IS NULL OR b.verified=?) AND (b.name LIKE ? OR b.city LIKE ? OR b.category LIKE ?) ORDER BY b.verified, b.name LIMIT ?`)
      .all(v, v, like(req.query.q), like(req.query.q), like(req.query.q), lim(req.query.limit));
    res.json({ items: rows });
  });
  app.patch('/api/admin/businesses/:id', admin, (req, res) => {
    const b = db.prepare('SELECT * FROM businesses WHERE id=?').get(req.params.id);
    if (!b) return bad(res, 'not_found', 404);
    const flag = (k) => (req.body?.[k] === undefined ? b[k] : req.body[k] ? 1 : 0);
    const gstin = req.body?.gstin === undefined ? b.gstin : str(req.body.gstin, 15).toUpperCase() || null;
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return bad(res, 'invalid_gstin');
    db.prepare('UPDATE businesses SET verified=?, delivery=?, pickup=?, gstin=? WHERE id=?').run(flag('verified'), flag('delivery'), flag('pickup'), gstin, b.id);
    audit(req, 'business.update', 'business', b.id);
    res.json(db.prepare('SELECT * FROM businesses WHERE id=?').get(b.id));
  });

  app.get('/api/admin/products', admin, (req, res) => {
    const bid = str(req.query.business_id, 40) || null;
    const rows = db.prepare(`SELECT p.id,p.name,p.category,p.brand,p.price,p.mrp,p.stock,p.active,p.business_id,b.name business_name,b.city
      FROM products p JOIN businesses b ON b.id=p.business_id WHERE (? IS NULL OR p.business_id=?) AND (p.name LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)
      ORDER BY p.active, p.stock, p.name LIMIT ?`).all(bid, bid, like(req.query.q), like(req.query.q), like(req.query.q), lim(req.query.limit, 100));
    res.json({ items: rows.map((r) => ({ ...r, active: !!r.active })) });
  });
  app.patch('/api/admin/products/:id', admin, (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
    if (!p) return bad(res, 'not_found', 404);
    const active = req.body?.active === undefined ? p.active : req.body.active ? 1 : 0;
    const price = req.body?.price === undefined ? p.price : Math.round(num(req.body.price));
    const stock = req.body?.stock === undefined ? p.stock : Math.round(num(req.body.stock));
    if (!(price >= 0 && price <= 10_000_000) || !(stock >= 0 && stock <= 1_000_000)) return bad(res, 'invalid_values');
    db.prepare("UPDATE products SET active=?, price=?, stock=?, updated_at=datetime('now') WHERE id=?").run(active, price, stock, p.id);
    audit(req, `product.admin_update active=${active}`, 'product', p.id);
    res.json({ ...db.prepare('SELECT * FROM products WHERE id=?').get(p.id), active: !!active });
  });

  app.get('/api/admin/orders', admin, (req, res) => {
    const st = str(req.query.status, 30) || null;
    const rows = db.prepare(`SELECT o.id,o.status,o.payment_method,o.payment_status,o.total,o.fulfilment,o.created_at,b.name business_name,b.city,u.email customer_email
      FROM orders o JOIN businesses b ON b.id=o.business_id JOIN users u ON u.id=o.customer_id
      WHERE (? IS NULL OR o.status=?) AND (o.id LIKE ? OR b.name LIKE ? OR u.email LIKE ?) ORDER BY o.created_ms DESC LIMIT ?`)
      .all(st, st, like(req.query.q), like(req.query.q), like(req.query.q), lim(req.query.limit));
    res.json({ items: rows });
  });
  app.get('/api/admin/orders/:id', admin, (req, res) => {
    if (!db.prepare('SELECT 1 FROM orders WHERE id=?').get(req.params.id)) return bad(res, 'not_found', 404);
    res.json(orderView(req.params.id));
  });

  app.get('/api/admin/reports/orders.csv', admin, (req, res) => {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : '1970-01-01';
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : '9999-12-31';
    const rows = db.prepare(`SELECT o.id,o.created_at,b.name business,b.city,u.email customer,o.fulfilment,o.status,o.payment_method,o.payment_status,o.subtotal,o.delivery_fee,o.handling_fee,o.total
      FROM orders o JOIN businesses b ON b.id=o.business_id JOIN users u ON u.id=o.customer_id
      WHERE date(o.created_at) BETWEEN ? AND ? ORDER BY o.created_ms`).all(from, to);
    const cols = ['id', 'created_at', 'business', 'city', 'customer', 'fulfilment', 'status', 'payment_method', 'payment_status', 'subtotal', 'delivery_fee', 'handling_fee', 'total'];
    // CSV-injection safe: prefix cells that start with = + - @ so spreadsheets don't execute them.
    const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    res.type('text/csv').setHeader('Content-Disposition', `attachment; filename="mapos-orders-${from}-${to}.csv"`);
    res.send([cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n'));
  });
  app.get('/api/admin/audit', admin, (req, res) => {
    res.json({ items: db.prepare('SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT ?').all(lim(req.query.limit)) });
  });
}
