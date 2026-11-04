# Bharat Map HTTP API (v0.7.20)

Canonical API reference (merged from the former `docs/API.md`, now a pointer). Every route below was checked against
`server/app.js`, `server/admin.js`, `server/api-v1.js`, `server/community.js` and `server/services-api.js` at commit
`ff85cb7`. Payload shapes are summarised; the code is the source of truth. Configuration variables are explained in
[SETUP.md](SETUP.md#configuration); tables in [DATABASE.md](DATABASE.md).

## Conventions (all routes)

| Topic | Behaviour | Where |
|---|---|---|
| Format | JSON in/out (`express.json`, 64 kb; `/api/v1` 512 kb). Form-encoded bodies accepted under `/api/payments` (gateway webhooks). Errors: `{"error":"code"}` with an HTTP status; 500 → `{error:'internal_error', request_id}`; bad JSON → `400 invalid_json`; too large → `413 payload_too_large` | `server/app.js` |
| Auth | `Authorization: Bearer <JWT>` (HS256, 12 h, `server/auth.js`). Role, seller business and `disabled` are **re-read from the DB on every request**, so a disabled/demoted user loses access at once | `app.js` live-user middleware |
| Roles | `customer`, `seller`, `rider`, `admin` (DB `CHECK`) | migration 001 |
| India envelope | Coordinates outside India's bounding box → `400 invalid_point` / `invalid_points` / `invalid_line` / `outside_india` | `shared/geo.js#inIndia` |
| Money | Integer INR (GST-inclusive by convention); gateways get paise | `shared/logistics.js#priceOrder` |
| Rate limits | `/api/*` and `/ondc/*`: fixed window `RATE_LIMIT_PER_MIN` (default 240/min/IP, header `RateLimit-Remaining`, `429 rate_limited`). `/api/v1/*`: token bucket `V1_RATE_BURST` (60) / `V1_RATE_PER_SEC` (2) → `429 {error:'rate_limited', retry_after_ms}` + `Retry-After`. `/api/auth/login|register`: token bucket `AUTH_RATE_BURST` (30) / `AUTH_RATE_PER_SEC` (0.5) plus a per-e-mail 5-failure / 5-min lock | `app.js`, `server/lib/ratelimit.js` |
| Compression | JSON responses > 1 KB under `/api` are gzip-encoded when the client accepts gzip | `app.js` |
| Request id | Every response carries `X-Request-Id` (a client id is echoed only if it matches `[A-Za-z0-9._:-]{1,64}`) | `app.js` |
| Security headers | CSP (`shared/csp.js` + `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP; HSTS in production | `app.js` |
| CORS | Allowed origins from `CORS_ORIGINS` (default `https://localhost,capacitor://localhost,http://localhost`) | `app.js` |
| Unknown `/api/*` | `404 not_found` | `app.js` |

## 1. Ops and client config — `server/app.js`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{status: ok\|degraded, db, version, time}`; 503 when the DB check fails. `version` is the constant `VERSION = '0.7.0'` in `server/app.js` (not the release number) |
| GET | `/api/config` | Public config, no secrets: `{version, payments{razorpay, key_id, mode, cod, upi_simulated, online}, routing, services{v1, valhalla, ev_ocm, transit_feeds[]}, llm, integrations}` |
| GET | `/metrics` | Prometheus text (requests, errors, latency quantiles, per-route counts). With `METRICS_TOKEN` it needs `Authorization: Bearer <token>`; in production without a token it returns 404 |
| GET | `/api/i18n` | `{languages[11], strings}` |
| GET | `/config.js` | `window.__MAPOS_CONFIG__ = {apiBase:'', services: direct\|server (CLIENT_SERVICES), regionsBase (REGIONS_BASE)}` |
| GET | `/map/style.json?style=liberty\|dark`, `/map/ofm/*` | Same-origin cached proxy of the vector style/tiles from `TILE_UPSTREAM` (default OpenFreeMap). Style URLs are rewritten per response to this origin (`PUBLIC_BASE_URL` or a validated Host); the cache stores upstream bytes only, bounded by `TILE_CACHE_MAX_MB` and 4,000 entries |
| GET | `/`, static | `web/` (`express.static`, `index.html`) and `/shared/*` |

## 2. Auth and profile — `server/app.js`

| Method | Path | Body / params | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, name, password (≥ 8), role?: customer\|seller, lang?}` | 201 `{token, user}`; `400 invalid_email\|password_too_short\|name_required`; `409 email_taken` |
| POST | `/api/auth/login` | `{email, password}` | `{token, user{…, business_id}}`; `401 invalid_credentials` (same response for unknown e-mail); `429 too_many_attempts` after 5 failures (5 min) |
| GET | `/api/me` | auth | `{id, email, name, role, preferred_lang}` |
| GET | `/api/me/places` | auth | `{data: SavedDoc\|null, updated_ms}` |
| PUT | `/api/me/places` | auth, `SavedDoc` | `{ok, updated_ms}`; `400 invalid_body`; `413 too_large` (> 48,000 chars after `web/lib/saved-model.js#normalizeSaved`) |

`SavedDoc` example: `{ "v":1, "home":{…}, "work":null, "lists":[{"id":"favorites","name":"","items":[…]}], "updated_ms":… }`.
Normalisation drops unknown fields and invalid coordinates and caps lists/items/string lengths.

## 3. Shop search, assistant and legacy geo — `server/app.js`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/search` | `q` (required), `lat`,`lng`, `radius_km` (≤ 50, default 15), `city` → `{intent, origin, count, price_range, results[{business, distance_km, eta_min, rank, products[]}], places[]}`. Understands native-script words, "near me", "cheap/cheapest", "under 30k", "43 inch", "wholesale", "verified", "in stock", "within 5 km", "in <locality>" |
| POST | `/api/assistant` | `{query, lat?, lng?}` → `{intent, reply, action, llm_used, rewritten_query?}`; optional LLM rewrite when `LLM_API_KEY` is set |
| GET | `/api/geocode?q=` | Local address intelligence (`shared/address.js`) first, Nominatim fallback when confidence < 0.6 → `{query, best{…, digipin}, local, external[]}` |
| GET | `/api/reverse?lat&lng` | `{lat, lng, digipin, nearest_business}` |
| GET | `/api/digipin/:code` | Decode DIGIPIN → `{code, lat, lng, …}`; `400 invalid_digipin` |
| GET | `/api/route` | `from_lat,from_lng,to_lat,to_lng`, `profile=driving\|bike\|truck` → `{engine, distance_m, duration_s, geometry}`; straight-line estimate if the router is unreachable |
| POST | `/api/route/optimize` | `{start{lat,lng}, stops[{id,lat,lng}] (≤ 25)}` → `{engine, sequence, total_km}` (nearest neighbour + 2-opt) |
| GET | `/api/mobility` | `kind=metro\|rail\|bus\|airport\|ev\|parking\|toll`, `lat,lng`, `live=1` (adds Overpass results for `ev\|parking\|fuel\|bus`) → `{items, live_count, note}`; non-live items are illustrative seed data |
| GET | `/api/businesses` | `lat,lng,city,type` → `{items[≤ 200]}` with `product_count`, `distance_km` |
| GET | `/api/businesses/:id` | Profile + catalogue; 404 |

## 4. Orders, tracking, seller — `server/app.js`

**POST `/api/orders`** (role customer/admin)
```json
{ "business_id":"b1", "items":[{"product_id":"p1","qty":1}], "fulfilment":"delivery|pickup",
  "payment_method":"cod|online|razorpay|upi_simulated", "drop":{"lat":17.7215,"lng":83.307}, "drop_address":"near RTC Complex" }
```
* `cod` → status `placed`. `online` / `razorpay` → status `pending_payment` (stock and rider reserved; no tracking until a
  verified payment; expires after `PENDING_PAYMENT_TTL_MIN`, default 30, max `MAX_PENDING_PAYMENTS` (5) open per customer →
  `429 too_many_pending_payments`). `razorpay` without keys → `503 payments_not_configured`.
* `upi_simulated` is **refused** (`400 simulated_payments_disabled`) unless `ALLOW_SIMULATED_UPI=1`; it never marks
  anything paid (`payment_status: simulated_not_paid`).
* Errors: `items_required`, `invalid_qty` (1–500), `drop_location_required`, `business_not_found` (404),
  `delivery_not_offered`, `pickup_not_offered`, `out_of_delivery_range` (> 25 km), `product_not_found` (404),
  `insufficient_stock:<id>` (409), `no_rider_available` (503).
* 201 → order view `{id, business, rider, items, fulfilment, payment_method, payment_status, status, source, demo,
  demo_note, subtotal, delivery_fee, handling_fee, total, drop, route, tracking, events}` (`server/app.js#orderView`).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/orders` | Own orders (seller: own shop's; admin: all) |
| GET | `/api/orders/:id` | 404 if not yours (IDOR-safe) |
| GET | `/api/orders/:id/track` | `{status, position, fraction, eta_s, rider}` |
| GET | `/api/orders/:id/stream?token=` | SSE tracking every 1.5 s, closes on a terminal state; capped by `SSE_PER_USER` (4) and `SSE_MAX_MIN` (30) |
| POST | `/api/orders/:id/cancel` | Customer/seller/admin, while `pending_payment`/`placed`/`accepted` (else `409 cannot_cancel_now`); restores stock, frees the rider; a paid order is flagged `refund_required` |
| GET | `/api/seller/dashboard` | Seller/admin: `{business, kpis, orders}` |
| PATCH | `/api/seller/products/:id` | `{price?, stock?}` on own products |
| POST | `/api/seller/products` | `{name, category, price, stock, brand?, unit?, mrp?, tags?[]}` |
| POST | `/api/seller/orders/:id/accept`, `/api/seller/orders/:id/reject` | Reject restores stock and frees the rider |

Status machine (`shared/logistics.js#progress`, DB `CHECK`): `pending_payment → placed → accepted → picked_up →
out_for_delivery → delivered` (delivery) · `accepted → ready_for_pickup → completed` (pickup) · `cancelled`, `rejected`.
Tracking is a pure function of time and the stored route; rider movement is **simulated** (`DEMO_TIME_SCALE`).

## 5. Payments and notifications — `server/app.js`, `server/payments/index.js`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/payments/config` | `{configured, gateways[{id, name, mode, prototype, script, …public ids}], upi: 'inside gateway checkout only', all[]}` (no secrets) |
| POST | `/api/payments/orders` | Auth (order's customer or admin) `{order_id, gateway: razorpay\|cashfree\|phonepe\|paytm}` → 201 `{gateway, mode, prototype, provider_order_id, checkout, amount_paise}`. `409 order_not_awaiting_payment`, `503 payments_not_configured`, `400 gateway_not_enabled`. Amount always from the DB |
| POST | `/api/payments/:gateway/verify` | Auth; Razorpay: `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` (HMAC-SHA256, constant-time); others: `{provider_order_id}` → server-to-server status re-check. Success → order `placed` + `payment_status: paid`; failure → `400 invalid_signature` / `payment_not_verified` |
| POST | `/api/payments/:gateway/webhook` | Signed webhook (raw body kept); Razorpay `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET`; `400 invalid_signature` |
| GET | `/api/notifications?since=<id>` | Auth → `{items[≤ 50], unread}` |
| POST | `/api/notifications/read` | Auth → marks all read |

A payment arriving for a closed order, or a second success for the same order, is recorded and flagged
`refund_required` (refunds are manual — audit item AUD-38). Notification kinds include `order_placed`,
`order_pending_payment`, `order_expired`, `order_accepted`, `order_rejected`, `order_delivered`, `payment_paid`,
`payment_refund_required` (sellers get parallel items).

## 6. Admin — `server/admin.js`, `server/app.js`, `server/services-api.js` (role admin; mutations audited)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/overview` | Users by role, businesses, products, orders by status, GMV, payments, by-city, top 5 sellers, 14-day series (IST), riders |
| GET / PATCH | `/api/admin/users`, `/api/admin/users/:id` | `q, role, limit`; PATCH `{role?, disabled?}` (409 on self-demote/disable) |
| GET / PATCH | `/api/admin/businesses`, `/api/admin/businesses/:id` | `q, verified`; PATCH `{verified?, delivery?, pickup?, gstin?}` (GSTIN validated) |
| POST | `/api/admin/businesses/:id/verify` | `{verified: bool}` (in `app.js`) |
| GET | `/api/admin/fleet` | Riders (in `app.js`) |
| GET / PATCH | `/api/admin/products`, `/api/admin/products/:id` | `q, business_id`; PATCH `{active?, price?, stock?}` |
| GET | `/api/admin/orders`, `/api/admin/orders/:id` | `q, status` |
| GET | `/api/admin/reports/orders.csv` | `from, to` (YYYY-MM-DD); CSV-injection safe |
| GET | `/api/admin/audit` | `limit` |
| GET | `/api/admin/place-services` | Listings + demo sellers + panel types + linkable providers |
| PUT | `/api/admin/place-services/:placeId` | `placeId` = `osm:(node\|way\|relation)/<id>` or `seller:b<n>`; `{verification: unverified\|pending\|verified\|rejected, panel_type?, name?, lat?, lng?, note?}` |
| GET / POST | `/api/admin/provider-links` | `place_id` filter; POST `{place_id, url (safe https), provider_id\|'website', label?, kind: linkout\|tickets\|menu\|reserve\|order\|info}` → stored **unverified**; `409 duplicate_link` |
| PATCH / DELETE | `/api/admin/provider-links/:id` | PATCH `{verified}`; only verified links reach public panels |

## 7. Map services — `/api/v1` (`server/api-v1.js`)

Used when the client has a server (`MAPOS_API_BASE`, Settings → Backend server, or `CLIENT_SERVICES=server`). Upstream
failures that exhaust every provider → `502 {error, tried[]}`; `OFFLINE=1` → `503 offline_mode` (route still answers with
the labelled straight-line estimate). Provider chains: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

| Method | Path | Params | Returns |
|---|---|---|---|
| GET | `/api/v1/route` | `mode` = `drive\|two\|bike\|walk\|truck`; `from_lat,from_lng,to_lat,to_lng`; `via=lat,lng;…` (≤ 8); `avoid_tolls=1`, `avoid_highways=1`, `main_roads=1`, `alternatives=0`; truck: `truck_height\|width\|length\|weight\|axle_load` (m / t), `truck_hazmat=1` | `{mode, provider: valhalla\|osrm\|straight-line, engine, estimate, fallback, avoid_applied, main_roads_applied?, routes[≤ 3]{distance_m, duration_s, summary, geometry, steps[]}, tried[]}`; truck adds `tolls_note`; `400 unknown_mode\|invalid_via` |
| GET | `/api/v1/geocode` | `q` (≥ 2), `lat,lng` bias, `lang`, `limit` (≤ 10), `autocomplete=1` (Photon) | `{provider: photon\|nominatim, items[]}` |
| GET | `/api/v1/reverse` | `lat,lng`, `lang` | `{provider: 'nominatim', item}` |
| GET | `/api/v1/places/nearby` | `category` (`fuel, ev, atm, metro, bus, rail, hospital, pharmacy, restaurant, grocery, parking, toilets, airport`), `lat,lng`, `radius` (m), `limit` (≤ 120) | `{provider, items[], timestamp, attribution}`; `400 unknown_category` |
| GET | `/api/v1/ev` | `lat,lng`, `radius`, `limit` (≤ 100) | Open Charge Map when `OCM_API_KEY` is set (key never returned), else OSM |
| GET | `/api/v1/places/search` | `q` (≤ 120), `lat,lng`, `limit` (≤ 20) | `{query, engine: fts5, results[], attribution}` — SQLite FTS5 over `web/offline/search/index.json`, locality-aware + typo-tolerant (0.7.20) |
| POST | `/api/v1/tolls` | `{coordinates: [[lng,lat],…]}` (2–20,000, inside India) | `{count, plazas[], toll_road_m, toll_roads[], fees: null, note}` — fees are never shown |
| POST | `/api/v1/speed-limits` | `{coordinates, mode?}` | Speed limits along the line (Valhalla `trace_attributes` / OSRM / Overpass) |
| POST | `/api/v1/road-hints` | `{coordinates, mode?}` | Flyover / service road / narrow road / time-restriction hints; `501 not_supported` if the provider lacks it |
| GET | `/api/v1/transit/feeds` | – | `{feeds[]{id, name, attribution, valid, stops, routes}, errors[]}` (HMRL + BMRCL bundled, plus `TRANSIT_FEEDS_DIR`) |
| GET | `/api/v1/transit/plan` | `from_lat,from_lng,to_lat,to_lng`, `date=YYYY-MM-DD`, `time=HH:MM` (IST) | `{scheduled: true, label, when, itineraries[≤ 3]{…legs[]}, reason?}` — times are seconds after midnight IST, **scheduled, not live** |
| GET | `/api/v1/transit/stops` | `lat,lng`, `radius` (≤ 3000) | `{scheduled: true, stops[]{…, departures[]}}` |
| GET | `/api/v1/regions` | – | `web/offline/catalog.json` + `{available, size_bytes, url}` per region (files in `REGIONS_DIR`) |
| GET | `/regions/<id>.pmtiles` | HTTP Range | PMTiles from `REGIONS_DIR` (default `data/regions`); `404 region_not_hosted` |
| GET | `/api/v1/providers` | – | Upstream status (public URLs only, breaker state, cache size, counters) + transit feeds |

### 7.1 Community — `server/community.js` (inside `/api/v1`)

Clients are identified only by a salted hash of IP + User-Agent (`COMMUNITY_SALT`, random per start if unset); no IP is stored.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/incidents?bbox=w,s,e,n` | bbox ≤ 2° each way → `{label: 'Community report, not verified', ttl_ms, incidents[≤ 200]}` |
| POST | `/api/v1/incidents` | `{type, lat, lng, note?}` (validated by `shared/community.js`) → 201; ≤ 10 reports/hour/client (`429 too_many_reports`); expires after 2 h |
| POST | `/api/v1/incidents/:id/vote` | `{vote: up\|down}`; "up" extends by 30 min (≤ 2 h from now); removed when downs ≥ ups + 2; `409 own_report\|already_voted` |
| POST | `/api/v1/live` | `{name?, ttl_min (5–240, default 60)}` → 201 `{id, secret, expires_ms}` |
| PUT | `/api/v1/live/:id` | `{secret, lat, lng, heading?}` |
| DELETE | `/api/v1/live/:id` | `{secret}` |
| GET | `/api/v1/live/:id` | Viewer poll: `{id, name, lat, lng, heading, updated_ms, expires_ms, active}` (`Cache-Control: no-store`) |

### 7.2 Place-card services, traffic, ONDC prototype — `server/services-api.js` (inside `/api/v1`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/integrations` | `{integrations[] (status only, never keys), client, classes[functional, deeplink, prototype, partner-pending, linkout, unavailable, demo]}` |
| GET | `/api/v1/places/:id/services` | `id` = `osm:<type>/<id>`, `seller:b<n>` or other; `lat,lng,name,tags(JSON),category,date,time,origin_lat,origin_lng,eta=1` → `{place, panel, listing, honesty{violations}, generated_at}` (same builder as the app) |
| GET | `/api/v1/address/resolve` | `q` (≥ 3), `offline=1` → landmark-anchor address resolution (offline index, + Overpass when online) |
| GET | `/api/v1/traffic/status` | `{available, provider, tiles, label: live}` or `{available: false, reason: 'no_traffic_provider_configured', label: 'unavailable'}` |
| GET | `/api/v1/traffic/tiles/:z/:x/:y.png` | TomTom/HERE tile proxy (key stays server-side; cached ≤ 2 min); `404 traffic_unavailable` |
| POST | `/api/v1/ondc/prototype/search\|select\|init\|confirm` | Only with `ONDC_PROTOTYPE=1` (else `404 ondc_prototype_disabled`). Beckn-shaped flow against **Bharat's own demo catalogue** (`network: "bharat-demo (not ONDC)"`); `confirm` needs customer/admin and creates a normal order (`source: ondc-prototype`) |
| GET | `/api/v1/ondc/prototype/status/:orderId`, `/api/v1/ondc/prototype/metro?city=` | Status of a prototype order; metro operator coverage list (`fares: null`) |
| POST | `/api/v1/courier/:provider/quote` | `shiprocket\|delhivery` stubs → `501` with `class: partner-pending` |

## 8. ONDC catalogue shape (prototype) — `server/app.js`

`POST /ondc/search` — Beckn `search` → `on_search`-shaped catalogue (`server/services/ondc.js`, BPP id/uri from
`ONDC_BPP_ID` / `ONDC_BPP_URI`). **Unsigned and not registry-subscribed.**

## 9. Services the client calls directly (no server configured)

| Service | Used for | What is sent |
|---|---|---|
| `tiles.openfreemap.org` (or this server's `/map/*`) | Online basemap (light `liberty`, `dark`) | Tile coordinates |
| `overpass-api.de` | Category chips, POI overlays, transit stops, tolls, road hints | Category + bbox (≤ 8 km) or a simplified route |
| `photon.komoot.io` | Type-ahead | Typed text (≥ 3 chars, debounced) + map-centre bias |
| `nominatim.openstreetmap.org` | Search fallback, reverse geocode | Typed text or the tapped coordinate |
| `routing.openstreetmap.de` (FOSSGIS OSRM), `valhalla1.openstreetmap.de` | Directions, rerouting, two-wheeler, main roads | Origin, destination, via points |
| `api.openstreetmap.org` (Notes API) | "Report a map problem", "Suggest an edit", "Add a missing place" (anonymous notes) | Note text + coordinate |

No account data or device identifiers are sent; requests have timeouts, in-memory caching and spacing (Nominatim
≥ 1.1 s, Overpass ≥ 1 s). Production should self-host these ([docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)).
