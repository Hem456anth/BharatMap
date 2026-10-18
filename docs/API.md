# India MapOS REST API (v0.2)

Base URL: `/`. JSON in/out. Auth: `Authorization: Bearer <JWT>` (HS256, 12 h). Errors: `{"error":"code"}` with HTTP status.
Rate limit: `RATE_LIMIT_PER_MIN` per IP on `/api/*` (header `RateLimit-Remaining`, 429 when exceeded).
Coordinates must fall inside India's bounding box or the API returns `400 invalid_point(s)`.
Every response carries `X-Request-Id`.

## Ops
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{status, db, version, time}`; 503 if DB down |
| GET | `/metrics` | Prometheus text: requests, errors, latency quantiles, per-route counts |
| GET | `/api/i18n` | `{languages[11], strings{lang:{key:text}}}` |
| GET | `/map/style.json`, `/map/ofm/*` | Same-origin, cached proxy of vector style/tiles (`TILE_UPSTREAM`) |

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, name, password(≥8), role?: customer\|seller, lang?}` | 201 `{token, user}`; 409 `email_taken` |
| POST | `/api/auth/login` | `{email, password}` | `{token, user}`; 401; 429 after 5 failures (5 min lock) |
| GET | `/api/me` | – | profile (auth) |

## Search & AI
**GET `/api/search`** `q` (required), `lat`,`lng` (origin), `radius_km` (≤50, default 15), `city` (`vizag|hyderabad`)
```json
{ "intent": {"terms":["led","tv"],"nearMe":true,"sort":"relevance","wholesale":false,"maxPrice":null,"size":null,"locality":null},
  "origin": {"lat":17.7289,"lng":83.305}, "count": 4, "price_range": {"min":13490,"max":47990},
  "results": [{ "business": {"id":"b1","name":"Sri Sai Electronics","verified":true,"rating":4.4,"lat":17.7295,"lng":83.3062,"delivery":true,"pickup":true},
                "distance_km": 0.14, "eta_min": 12, "rank": 3.42,
                "products": [{"id":"p2","name":"LG 32\" HD Ready LED TV","price":13490,"mrp":17990,"discount_pct":25,"stock":9,"wholesale_price":null}] }],
  "places": [] }
```
Understands: native-script words (టీవీ, दूध, டிவி…), "near me", "cheap/cheapest", "under 30k", "43 inch", "wholesale/bulk/supplier", "verified", "in stock", "within 5 km", "in Gajuwaka" (re-centres on locality).

**POST `/api/assistant`** `{query, lat?, lng?}` → `{intent, reply, action, llm_used}`
Intents: `product_search`, `supplier_discovery`, `route` (action includes computed `route`), `mobility` (`items`), `geocode` (`result`), `search` (no match).

## Geo
| Method | Path | Notes |
|---|---|---|
| GET | `/api/geocode?q=` | Local address intelligence first; Nominatim fallback when confidence < 0.6. Returns `best{lat,lng,confidence,precision_m,source,digipin}`, `local{components,candidates,explanation}`, `external[]` |
| GET | `/api/reverse?lat&lng` | DIGIPIN + nearest business |
| GET | `/api/digipin/:code` | Decode DIGIPIN to cell centre |
| GET | `/api/route?from_lat&from_lng&to_lat&to_lng&profile=driving\|bike\|truck` | `{engine, distance_m, duration_s, geometry(GeoJSON LineString)}`; falls back to straight-line estimate if router unreachable |
| POST | `/api/route/optimize` | `{start:{lat,lng}, stops:[{id,lat,lng}] (≤25)}` → `{sequence, total_km}` (NN + 2-opt) |

## Mobility
**GET `/api/mobility?kind=metro|rail|bus|airport|ev|parking|toll&lat&lng&live=1`** → `{items[{kind,name,lat,lng,meta,source,distance_km}], live_count, note}`. `live=1` adds OpenStreetMap results via Overpass for `ev|parking|fuel|bus`.

## Marketplace
| Method | Path | Notes |
|---|---|---|
| GET | `/api/businesses?lat&lng&city&type` | list with distance |
| GET | `/api/businesses/:id` | profile + catalogue |

## Orders (auth)
**POST `/api/orders`** (customer/admin)
```json
{ "business_id":"b1", "items":[{"product_id":"p1","qty":1}], "fulfilment":"delivery|pickup",
  "payment_method":"cod|upi_simulated", "drop":{"lat":17.7215,"lng":83.307}, "drop_address":"near RTC Complex" }
```
201 → order view `{id, business, rider, items, subtotal, delivery_fee, handling_fee, total, route, tracking, events}`.
Errors: `items_required`, `invalid_qty`, `drop_location_required`, `product_not_found`(404), `insufficient_stock:<id>`(409), `out_of_delivery_range`, `delivery_not_offered`, `no_rider_available`(503).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/orders` | own orders (seller: own shop's; admin: all) |
| GET | `/api/orders/:id` | 404 if not yours (IDOR-safe) |
| GET | `/api/orders/:id/track` | `{status, position, fraction, eta_s, rider}` |
| GET | `/api/orders/:id/stream?token=` | **SSE** stream of tracking every 1.5 s, closes on terminal state |
| POST | `/api/orders/:id/cancel` | while `placed/accepted`; restores stock |

Status machine: `placed → accepted → picked_up → out_for_delivery → delivered` (delivery) · `accepted → ready_for_pickup → completed` (pickup) · `cancelled`, `rejected`.

## Seller (role seller/admin)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/seller/dashboard` | `{business, kpis{orders,revenue,low_stock,catalogue}, orders}` |
| PATCH | `/api/seller/products/:id` | `{price?, stock?}` own products only |
| POST | `/api/seller/products` | `{name, category, price, stock, brand?, unit?, mrp?, tags?[]}` |
| POST | `/api/seller/orders/:id/accept\|reject` | reject restores stock & frees rider |

## Admin
`POST /api/admin/businesses/:id/verify {verified:bool}` · `GET /api/admin/fleet`

## ONDC (prototype)
`POST /ondc/search` Beckn `search` → `on_search` catalogue (`bpp/providers[].items[]` with INR price, stock, GPS, DIGIPIN, fulfilments). Not signed, not registry-subscribed.


## v0.2 additions

### Config
- `GET /api/config` → `{ version, payments: { razorpay, key_id, mode: disabled|test|live, cod, upi_simulated }, routing, llm }` (no secrets).

### Payments (Razorpay — real provider)
- `POST /api/orders` with `payment_method: "razorpay"` → order created with `payment_status: "awaiting_payment"` plus
  `razorpay: { key_id, order_id, amount (paise), currency }` for Checkout. Returns **503 `payments_not_configured`** (and creates nothing) when keys are absent.
- `POST /api/payments/razorpay/verify` (auth: order's customer) `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` →
  HMAC-SHA256(`order_id|payment_id`, key_secret) checked in constant time → `payment_status: "paid"`. Idempotent. 400 `invalid_signature`.
- `POST /api/payments/razorpay/webhook` — header `X-Razorpay-Signature` over the raw body with `RAZORPAY_WEBHOOK_SECRET`.
  Handles `payment.captured`, `order.paid`, `payment.failed`.

### Notifications (auth)
- `GET /api/notifications?since=<id>` → `{ items: [{id, kind, title, body, order_id, read, created_at}], unread }`
- `POST /api/notifications/read` → marks all read.
Kinds: `order_placed`, `order_accepted`, `order_rejected`, `order_delivered`, `payment_paid` (sellers get `seller_*`).

### Admin (role admin; every mutation audited)
- `GET /api/admin/overview` — users by role, businesses verified/total, products active/low-stock, orders by status, GMV, payments, by-city, top 5 sellers, 14-day daily series (IST), riders.
- `GET /api/admin/users?q=&role=&limit=` · `PATCH /api/admin/users/:id { role?, disabled? }` (disabling revokes live JWTs immediately; 409 on self-demote/disable)
- `GET /api/admin/businesses?q=&verified=0|1` · `PATCH /api/admin/businesses/:id { verified?, delivery?, pickup?, gstin? }` (GSTIN format validated)
- `GET /api/admin/products?q=&business_id=` · `PATCH /api/admin/products/:id { active?, price?, stock? }` (inactive = hidden from search, cannot be ordered)
- `GET /api/admin/orders?q=&status=` · `GET /api/admin/orders/:id`
- `GET /api/admin/reports/orders.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` (CSV-injection safe)
- `GET /api/admin/audit?limit=`
