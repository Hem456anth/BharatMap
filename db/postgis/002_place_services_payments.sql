-- v0.7 PostGIS update: mirrors db/migrations/005_place_services_payments.sql with spatial types.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_payment' BEFORE 'placed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'shop';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod','upi_simulated','razorpay','online'));

CREATE TYPE listing_verification AS ENUM ('unverified','pending','verified','rejected');
CREATE TABLE IF NOT EXISTS place_services (
  place_id     text PRIMARY KEY,                       -- 'osm:node/123' | 'seller:<uuid>'
  name         text,
  geom         geography(Point,4326),
  panel_type   text CHECK (panel_type IS NULL OR panel_type IN ('restaurant','cinema','station','grocery','ride','hotel','fuel','parking','health','retail','courier','venue')),
  verification listing_verification NOT NULL DEFAULT 'unverified',
  note         text,
  updated_by   uuid REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_services_geom_gix ON place_services USING gist (geom);

CREATE TABLE IF NOT EXISTS provider_links (
  id           bigserial PRIMARY KEY,
  place_id     text NOT NULL,
  provider_id  text NOT NULL,
  label        text,
  url          text NOT NULL CHECK (url ~ '^https?://'),
  host         text NOT NULL,
  kind         text NOT NULL DEFAULT 'linkout' CHECK (kind IN ('linkout','tickets','menu','reserve','order','info')),
  verified     boolean NOT NULL DEFAULT false,
  added_by     uuid REFERENCES users(id),
  verified_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, provider_id, url)
);
CREATE INDEX IF NOT EXISTS provider_links_place_idx ON provider_links (place_id) WHERE verified;
-- Payment gateways beyond Razorpay: provider is free text ('razorpay'|'cashfree'|'phonepe'|'paytm'), see server/payments/.
