-- India MapOS MVP schema (SQLite dialect, used by the reference server).
-- Production PostGIS equivalent: db/postgis/001_init.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('customer','seller','rider','admin')),
  password_hash TEXT NOT NULL,
  preferred_lang TEXT NOT NULL DEFAULT 'en',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS businesses (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT REFERENCES users(id),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('shop','wholesaler','manufacturer','restaurant','service')),
  category   TEXT NOT NULL,
  city       TEXT NOT NULL,
  lat        REAL NOT NULL CHECK (lat BETWEEN 6 AND 38),
  lng        REAL NOT NULL CHECK (lng BETWEEN 68 AND 98),
  address    TEXT NOT NULL,
  digipin    TEXT,
  phone      TEXT,
  hours      TEXT,
  verified   INTEGER NOT NULL DEFAULT 0,
  rating     REAL NOT NULL DEFAULT 0,
  delivery   INTEGER NOT NULL DEFAULT 1,
  pickup     INTEGER NOT NULL DEFAULT 1,
  gstin      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_biz_geo ON businesses(lat, lng);
CREATE INDEX IF NOT EXISTS idx_biz_city ON businesses(city, category);

CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  brand             TEXT,
  unit              TEXT NOT NULL DEFAULT 'piece',
  price             INTEGER NOT NULL CHECK (price >= 0),      -- INR, GST inclusive
  mrp               INTEGER,
  stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  wholesale_price   INTEGER,
  min_wholesale_qty INTEGER,
  tags              TEXT NOT NULL DEFAULT '[]',               -- JSON array
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prod_biz ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(category);

CREATE TABLE IF NOT EXISTS riders (
  id        TEXT PRIMARY KEY,
  user_id   TEXT REFERENCES users(id),
  name      TEXT NOT NULL,
  vehicle   TEXT NOT NULL CHECK (vehicle IN ('bike','ev-scooter','mini-truck','truck')),
  city      TEXT NOT NULL,
  lat       REAL NOT NULL,
  lng       REAL NOT NULL,
  available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS mobility_pois (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('rail','metro','bus','airport','ev','parking','toll')),
  name TEXT NOT NULL, city TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, meta TEXT, source TEXT NOT NULL DEFAULT 'sample'
);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES users(id),
  business_id     TEXT NOT NULL REFERENCES businesses(id),
  rider_id        TEXT REFERENCES riders(id),
  fulfilment      TEXT NOT NULL CHECK (fulfilment IN ('delivery','pickup')),
  status          TEXT NOT NULL CHECK (status IN ('placed','accepted','picked_up','out_for_delivery','delivered','ready_for_pickup','completed','cancelled','rejected')),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cod','upi_simulated')),
  payment_status  TEXT NOT NULL DEFAULT 'pending',
  subtotal        INTEGER NOT NULL,
  delivery_fee    INTEGER NOT NULL DEFAULT 0,
  handling_fee    INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  drop_lat        REAL, drop_lng REAL, drop_address TEXT,
  route_json      TEXT,               -- GeoJSON LineString + distance/duration
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_ms      INTEGER NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id, status);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  name       TEXT NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  unit_price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL, note TEXT, at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT, at TEXT NOT NULL DEFAULT (datetime('now'))
);
