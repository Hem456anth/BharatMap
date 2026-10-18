-- 002: real payment provider (Razorpay) + notifications + soft-disable for users/products.
-- Runs with foreign_keys OFF (see server/db.js) so the orders table can be rebuilt to widen
-- its payment_method CHECK without cascading deletes into order_items/order_events.
CREATE TABLE orders_new (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES users(id),
  business_id     TEXT NOT NULL REFERENCES businesses(id),
  rider_id        TEXT REFERENCES riders(id),
  fulfilment      TEXT NOT NULL CHECK (fulfilment IN ('delivery','pickup')),
  status          TEXT NOT NULL CHECK (status IN ('placed','accepted','picked_up','out_for_delivery','delivered','ready_for_pickup','completed','cancelled','rejected')),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cod','upi_simulated','razorpay')),
  payment_status  TEXT NOT NULL DEFAULT 'pending',
  subtotal        INTEGER NOT NULL,
  delivery_fee    INTEGER NOT NULL DEFAULT 0,
  handling_fee    INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  drop_lat        REAL, drop_lng REAL, drop_address TEXT,
  route_json      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_ms      INTEGER NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO orders_new SELECT * FROM orders;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_ms);

CREATE TABLE IF NOT EXISTS payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,             -- 'razorpay'
  provider_order_id   TEXT UNIQUE,
  provider_payment_id TEXT,
  amount_paise        INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'created', -- created | paid | failed
  raw                 TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  order_id   TEXT,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id);

ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
