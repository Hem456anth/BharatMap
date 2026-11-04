# Database

Bharat Map runs on **SQLite** through Node's built-in `node:sqlite` (`DatabaseSync`, no native build). A PostgreSQL 16 +
PostGIS target schema exists in `db/postgis/` but **is not used by the running server** (see [DECISIONS.md](DECISIONS.md)
ADR-008). The column lists below were produced by applying `db/migrations/001…006` to an in-memory database and reading
`PRAGMA table_info` / `foreign_key_list` (commit `ff85cb7`).

## Files and lifecycle

| Item | Value | Source |
|---|---|---|
| Main DB | `DB_FILE` (default `data/mapos.db`; Docker image sets `/data/mapos.db`) | `server/db.js#openDb` |
| Pragmas | `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 3000` | `server/db.js` |
| Migrations | Every `db/migrations/*.sql` not yet in `schema_migrations` is applied **automatically at start**, in filename order, each in a transaction with FK checks off during the rebuild and `PRAGMA foreign_key_check` before commit | `server/db.js#migrate` |
| Explicit run | `npm run migrate` (`scripts/migrate.mjs`: migrate + seed) | `package.json` |
| Seed | `seed()` runs only when `businesses` is empty: admin (`ADMIN_EMAIL`, default `admin@mapos.demo`; password `ADMIN_PASSWORD`, required ≥ 12 chars in production), demo customer/sellers/riders (password from `demoPasswordFor()`: `demo1234` in dev, `DEMO_PASSWORD` ≥ 12 chars or random in production), fictional businesses/products/riders/warehouses/mobility POIs from `shared/seed.js` | `server/db.js` |
| Search DB | `SEARCH_DB` (default `data/search.db`): one FTS5 virtual table `places(latin, native, phon)` built from `web/offline/search/index.json` by `server/lib/search-fts.js#buildFtsDb`; opened read-only; falls back to the in-memory token index when FTS5 is unavailable | `server/lib/search-fts.js` |
| Git | `*.db`, `*.db-*` and everything in `data/` except `data/deeplinks/` are gitignored | `.gitignore` |
| Backup (single VM) | `sqlite3 mapos.db ".backup '/backup/mapos-$(date +%F).db'"` | [SETUP.md](SETUP.md#deployment) |

## Migrations

| File | What it does |
|---|---|
| `001_init.sql` | `schema_migrations`, `users`, `businesses`, `products`, `riders`, `warehouses`, `mobility_pois`, `orders`, `order_items`, `order_events`, `audit_log` + geo/city/category indexes |
| `002_payments_notifications.sql` | Rebuilds `orders` (payment fields), adds `payments` (unique `provider_order_id`), `notifications`; `users.disabled`, `products.active` |
| `003_saved_places.sql` | `user_places` (one saved-places JSON document per user) |
| `004_community_live.sql` | `incidents`, `incident_votes`, `live_shares` |
| `005_place_services_payments.sql` | Rebuilds `orders` (`pending_payment` status, `online` method, `source`), adds `place_services`, `provider_links` (unique `place_id, provider_id, url`) |
| `006_audit_indexes.sql` | Indexes from the Nov 2026 audit (AUD-15): `order_items(order_id)`, `order_events(order_id,id)`, `incidents(reporter,created_ms)`, `orders(status,created_ms)` |

Rule: **never edit an applied migration**; add `007_*.sql`. A table rebuild follows SQLite's documented ALTER
procedure (create `*_new`, copy, drop, rename) as 002 and 005 do. Mirror schema changes in `db/postgis/` as a new file
(`002_place_services_payments.sql` mirrors 005).

## Tables (SQLite, current)

Types are SQLite affinities. `NN` = NOT NULL. Money columns are **integer rupees** except `payments.amount_paise`.

| Table | Columns | Keys / constraints |
|---|---|---|
| `schema_migrations` | `version` TEXT PK, `applied_at` TEXT NN | |
| `users` | `id` TEXT PK, `email` TEXT NN UNIQUE, `name` NN, `phone`, `role` NN, `password_hash` NN, `preferred_lang` NN = 'en', `created_at`, `disabled` INTEGER NN = 0 | `role IN ('customer','seller','rider','admin')` |
| `businesses` | `id` PK, `owner_id`, `name`, `type`, `category`, `city`, `lat` REAL, `lng` REAL, `address`, `digipin`, `phone`, `hours`, `verified` INT = 0, `rating` REAL = 0, `delivery` INT = 1, `pickup` INT = 1, `gstin`, `created_at` | FK `owner_id → users.id`; idx `(lat,lng)`, `(city,category)` |
| `products` | `id` PK, `business_id` NN, `name`, `category`, `brand`, `unit` = 'piece', `price` INT NN, `mrp` INT, `stock` INT = 0, `wholesale_price` INT, `min_wholesale_qty` INT, `tags` TEXT = '[]', `updated_at`, `active` INT = 1 | FK `business_id → businesses.id`; `price >= 0`, `stock >= 0` |
| `riders` | `id` PK, `user_id`, `name`, `vehicle`, `city`, `lat`, `lng`, `available` INT = 1 | FK `user_id → users.id` |
| `warehouses` | `id` PK, `name`, `city`, `lat`, `lng` | |
| `mobility_pois` | `id` PK, `kind`, `name`, `city`, `lat`, `lng`, `meta`, `source` = 'sample' | illustrative seed data |
| `orders` | `id` PK, `customer_id` NN, `business_id` NN, `rider_id`, `fulfilment` NN, `status` NN, `payment_method` NN, `payment_status` NN = 'pending', `subtotal` INT, `delivery_fee` INT = 0, `handling_fee` INT = 0, `total` INT, `drop_lat`, `drop_lng`, `drop_address`, `route_json`, `created_at`, `created_ms` INT NN, `updated_at`, `source` NN = 'shop' | FKs to `users`, `businesses`, `riders`; `fulfilment IN ('delivery','pickup')`; `status IN ('pending_payment','placed','accepted','picked_up','out_for_delivery','delivered','ready_for_pickup','completed','cancelled','rejected')`; `payment_method IN ('cod','upi_simulated','razorpay','online')`; idx customer, `(business_id,status)`, `created_ms`, `(status,created_ms)` |
| `order_items` | `id` INTEGER PK, `order_id` NN, `product_id` NN, `name`, `qty` INT, `unit_price` INT | FKs to `orders`, `products`; idx `order_id` |
| `order_events` | `id` INTEGER PK, `order_id` NN, `status` NN, `note`, `at` | FK `orders`; idx `(order_id,id)` |
| `audit_log` | `id` INTEGER PK, `user_id`, `action` NN, `entity`, `entity_id`, `at` | written by every admin mutation and order creation |
| `payments` | `id` INTEGER PK, `order_id` NN, `provider` NN, `provider_order_id` UNIQUE, `provider_payment_id`, `amount_paise` INT NN, `status` NN = 'created', `raw`, `created_at`, `updated_at` | FK `orders`; idx `order_id` |
| `notifications` | `id` INTEGER PK, `user_id` NN, `kind`, `title`, `body`, `order_id`, `read` INT = 0, `created_at` | FK `users`; idx `(user_id,id)` |
| `user_places` | `user_id` PK, `data` TEXT NN (normalised JSON), `updated_ms` INT | FK `users` |
| `incidents` | `id` PK, `type`, `lat`, `lng`, `note` = '', `created_ms`, `expires_ms`, `up` = 0, `down` = 0, `reporter` NN (salted hash, never an IP) | idx `(lat,lng)`, `expires_ms`, `(reporter,created_ms)`; rows purged when expired |
| `incident_votes` | `incident_id` + `voter` (composite PK), `vote` INT | FK `incidents` |
| `live_shares` | `id` PK, `secret_hash` NN (SHA-256 of the secret), `name`, `lat`, `lng`, `heading`, `updated_ms`, `created_ms`, `expires_ms` | purged when expired |
| `place_services` | `place_id` PK, `name`, `lat`, `lng`, `panel_type`, `verification` NN = 'unverified', `note`, `updated_by`, `updated_at` | FK `updated_by → users`; `verification IN ('unverified','pending','verified','rejected')` |
| `provider_links` | `id` INTEGER PK, `place_id` NN, `provider_id` NN, `label`, `url` NN, `host` NN, `kind` = 'linkout', `verified` INT = 0, `added_by`, `verified_by`, `created_at` | UNIQUE `(place_id, provider_id, url)`; FKs to `users`; idx `(place_id, verified)` |

Status vocabulary in use: `orders.payment_status` takes `pending` (COD), `awaiting_payment` (razorpay), `pending_payment` (online), `paid`, `collected` (COD on
delivery), `simulated_not_paid`, `payment_init_failed`, `expired`, `refund_required` (from `server/app.js`). This list is
read from the code paths, not from a DB constraint (there is none on `payment_status`).

## PostGIS target (not wired)

| File | Contents |
|---|---|
| `db/postgis/001_init.sql` | Extensions `postgis`, `pg_trgm`, `h3`, `pgcrypto`; enums `user_role`, `biz_type`, `order_status`; geography points + GiST, `h3_r9` generated column, trigram/tsvector search, `orders` partitioned by year (`orders_2026`), `rider_pings` partitioned, RLS policy `seller_products` |
| `db/postgis/002_place_services_payments.sql` | `pending_payment` enum value, `orders.source`, payment-method check, `place_services` (geography), `provider_links` |

Apply manually: `psql "$DATABASE_URL" -f db/postgis/001_init.sql` (comment in `scripts/migrate.mjs`). **No code reads
`DATABASE_URL`**; the PostGIS schema does not yet mirror migrations 003, 004 and 006 (saved places, community, audit
indexes) — unverified beyond a grep of `db/postgis/*.sql`. Moving to PostGIS + Redis is a roadmap item
([ROADMAP.md](ROADMAP.md)), required before running more than one API replica (in-memory rate limits, login lockout,
tile cache and SSE state are per-process).

## Client-side storage (not a server DB)

On the device the app keeps saved places (`localStorage` key `bm-saved-v1`), recents, settings, recorded tracks and
downloaded regions (Cache Storage). What is stored and how to delete it is shown in the in-app Privacy dashboard
(`web/lib/privacy-model.js`, `web/ui/privacy.js`).
