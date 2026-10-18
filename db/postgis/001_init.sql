-- India MapOS production schema (PostgreSQL 16 + PostGIS 3.4 + h3-pg).
-- Mirrors db/migrations/001_init.sql with spatial types, partitioning and RLS hooks.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- fuzzy name search
CREATE EXTENSION IF NOT EXISTS h3;           -- optional: hex indexing for supply/demand
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('customer','seller','rider','admin');
CREATE TYPE biz_type AS ENUM ('shop','wholesaler','manufacturer','restaurant','service');
CREATE TYPE order_status AS ENUM ('placed','accepted','picked_up','out_for_delivery','delivered','ready_for_pickup','completed','cancelled','rejected');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE, phone text UNIQUE, name text NOT NULL,
  role user_role NOT NULL DEFAULT 'customer', password_hash text,
  preferred_lang text NOT NULL DEFAULT 'en', created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id),
  name text NOT NULL, type biz_type NOT NULL, category text NOT NULL, city text NOT NULL,
  geom geography(Point,4326) NOT NULL,
  h3_r9 h3index GENERATED ALWAYS AS (h3_lat_lng_to_cell(geom::geometry, 9)) STORED,
  address text NOT NULL, digipin char(12), pincode char(6), phone text, hours jsonb,
  gstin text, verified boolean NOT NULL DEFAULT false, verification_doc_ref text,
  rating numeric(2,1) NOT NULL DEFAULT 0, delivery boolean NOT NULL DEFAULT true, pickup boolean NOT NULL DEFAULT true,
  ondc_provider_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX businesses_geom_gix ON businesses USING gist (geom);
CREATE INDEX businesses_h3_idx ON businesses (h3_r9);
CREATE INDEX businesses_name_trgm ON businesses USING gin (name gin_trgm_ops);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, category text NOT NULL, brand text, unit text NOT NULL DEFAULT 'piece',
  price_paise bigint NOT NULL CHECK (price_paise >= 0), mrp_paise bigint,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  wholesale_price_paise bigint, min_wholesale_qty integer,
  tags text[] NOT NULL DEFAULT '{}', names_i18n jsonb NOT NULL DEFAULT '{}',  -- {"te":"…","hi":"…"}
  search tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name,'')||' '||coalesce(brand,'')||' '||category||' '||array_to_string(tags,' '))) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_search_idx ON products USING gin (search);
CREATE INDEX products_biz_idx ON products (business_id);

CREATE TABLE riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id),
  name text NOT NULL, vehicle text NOT NULL, city text NOT NULL,
  geom geography(Point,4326) NOT NULL, available boolean NOT NULL DEFAULT true, last_ping timestamptz
);
CREATE INDEX riders_geom_gix ON riders USING gist (geom) WHERE available;

CREATE TABLE warehouses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, city text NOT NULL, geom geography(Point,4326) NOT NULL);

CREATE TABLE mobility_pois (
  id text PRIMARY KEY, kind text NOT NULL, name text NOT NULL, city text,
  geom geography(Point,4326) NOT NULL, meta jsonb, source text NOT NULL, source_updated_at timestamptz
);
CREATE INDEX mobility_geom_gix ON mobility_pois USING gist (geom);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id), business_id uuid NOT NULL REFERENCES businesses(id),
  rider_id uuid REFERENCES riders(id), fulfilment text NOT NULL, status order_status NOT NULL,
  payment_method text NOT NULL, payment_status text NOT NULL DEFAULT 'pending', payment_ref text,
  subtotal_paise bigint NOT NULL, delivery_fee_paise bigint NOT NULL DEFAULT 0, handling_fee_paise bigint NOT NULL DEFAULT 0, total_paise bigint NOT NULL,
  drop_geom geography(Point,4326), drop_address text, route geometry(LineString,4326), route_distance_m int, route_duration_s int,
  ondc_transaction_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);
CREATE TABLE orders_2026 PARTITION OF orders FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE order_items (id bigserial PRIMARY KEY, order_id uuid NOT NULL, product_id uuid NOT NULL, name text NOT NULL, qty int NOT NULL CHECK (qty>0), unit_price_paise bigint NOT NULL);
CREATE TABLE order_events (id bigserial PRIMARY KEY, order_id uuid NOT NULL, status order_status NOT NULL, note text, at timestamptz NOT NULL DEFAULT now());

-- Rider GPS breadcrumbs: high-volume, time-partitioned (consider TimescaleDB hypertable)
CREATE TABLE rider_pings (rider_id uuid NOT NULL, at timestamptz NOT NULL, geom geography(Point,4326) NOT NULL, speed_kmh real) PARTITION BY RANGE (at);

-- Example nearest-seller query used by /api/search in production:
-- SELECT b.*, ST_Distance(b.geom, ST_MakePoint($lng,$lat)::geography) AS dist_m
-- FROM businesses b JOIN products p ON p.business_id = b.id
-- WHERE ST_DWithin(b.geom, ST_MakePoint($lng,$lat)::geography, $radius_m)
--   AND p.search @@ plainto_tsquery('simple', $q) AND p.stock > 0
-- ORDER BY dist_m LIMIT 50;

-- Row-level security: sellers see only their own business rows
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_products ON products USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = current_setting('app.user_id', true)::uuid)
  OR current_setting('app.role', true) IN ('admin','service')
);
