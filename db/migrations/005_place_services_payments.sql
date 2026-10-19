-- 005 (v0.7): place-card service panels + order→payment separation.
-- 1) orders: new status 'pending_payment' (order created, not confirmed, no tracking until a VERIFIED payment) and
--    payment_method 'online' (gateway chosen on the separate payment screen). Rebuilt with foreign_keys OFF (server/db.js).
CREATE TABLE orders_new (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES users(id),
  business_id     TEXT NOT NULL REFERENCES businesses(id),
  rider_id        TEXT REFERENCES riders(id),
  fulfilment      TEXT NOT NULL CHECK (fulfilment IN ('delivery','pickup')),
  status          TEXT NOT NULL CHECK (status IN ('pending_payment','placed','accepted','picked_up','out_for_delivery','delivered','ready_for_pickup','completed','cancelled','rejected')),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cod','upi_simulated','razorpay','online')),
  payment_status  TEXT NOT NULL DEFAULT 'pending',
  subtotal        INTEGER NOT NULL,
  delivery_fee    INTEGER NOT NULL DEFAULT 0,
  handling_fee    INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  drop_lat        REAL, drop_lng REAL, drop_address TEXT,
  route_json      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_ms      INTEGER NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  source          TEXT NOT NULL DEFAULT 'shop'   -- shop | ondc-prototype
);
INSERT INTO orders_new (id,customer_id,business_id,rider_id,fulfilment,status,payment_method,payment_status,subtotal,delivery_fee,handling_fee,total,drop_lat,drop_lng,drop_address,route_json,created_at,created_ms,updated_at)
  SELECT id,customer_id,business_id,rider_id,fulfilment,status,payment_method,payment_status,subtotal,delivery_fee,handling_fee,total,drop_lat,drop_lng,drop_address,route_json,created_at,created_ms,updated_at FROM orders;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_ms);

-- 2) place_services: admin listing verification per place (OSM id or seller id) and the panel type shown.
CREATE TABLE IF NOT EXISTS place_services (
  place_id      TEXT PRIMARY KEY,                -- 'osm:node/123' | 'seller:b2'
  name          TEXT,
  lat           REAL, lng REAL,
  panel_type    TEXT CHECK (panel_type IS NULL OR panel_type IN ('restaurant','cinema','station','grocery','ride','hotel','fuel','parking','health','retail','courier','venue')),
  verification  TEXT NOT NULL DEFAULT 'unverified' CHECK (verification IN ('unverified','pending','verified','rejected')),
  note          TEXT,
  updated_by    TEXT REFERENCES users(id),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 3) provider_links: admin-managed official link-outs for a place (shown publicly only when verified=1).
CREATE TABLE IF NOT EXISTS provider_links (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id      TEXT NOT NULL,
  provider_id   TEXT NOT NULL,                   -- shared/services/catalog.js id, or 'website'
  label         TEXT,
  url           TEXT NOT NULL CHECK (url LIKE 'https://%' OR url LIKE 'http://%'),
  host          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'linkout' CHECK (kind IN ('linkout','tickets','menu','reserve','order','info')),
  verified      INTEGER NOT NULL DEFAULT 0,
  added_by      TEXT REFERENCES users(id),
  verified_by   TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (place_id, provider_id, url)
);
CREATE INDEX IF NOT EXISTS idx_provider_links_place ON provider_links(place_id, verified);
