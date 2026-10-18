# Deployment Guide

## Option A — single VM / container (pilot, ≤ ~1,500 rps measured on 1 vCPU process)
```bash
cp .env.example .env            # set JWT_SECRET (openssl rand -hex 64), CORS_ORIGINS, DEMO_PASSWORD, HTTP_USER_AGENT
docker build -t india-mapos .
docker run -d --name mapos -p 8080:8080 --env-file .env -v mapos-data:/data --restart unless-stopped india-mapos
curl localhost:8080/api/health
```
Put a TLS reverse proxy in front (Caddy example):
```
mapos.example.in {
  encode zstd gzip
  reverse_proxy localhost:8080 { flush_interval -1 }   # -1 keeps SSE streaming
}
```
Set `TRUST_PROXY=1` so rate limiting sees real client IPs. Back up `/data/mapos.db` (SQLite WAL) with `sqlite3 mapos.db ".backup '/backup/mapos-$(date +%F).db'"` hourly.

India-hosted regions (Mumbai/Hyderabad) are recommended for latency and DPDP data-localisation posture.

## Option B — docker compose with self-hosted routing
```bash
./scripts/prepare-osrm.sh        # downloads India PBF from Geofabrik, builds OSRM MLD graph (~16 GB RAM, ~1 h)
docker compose up -d app osrm    # app uses OSRM_URL=http://osrm:5000
docker compose --profile next up -d postgis valhalla   # phase-2 services
```

## Option C — Kubernetes (scale)
- API is stateless (JWT auth, time-derived tracking) → `Deployment` with HPA on CPU/RPS; readiness `/api/health`.
- **Must change before multi-replica**: SQLite → PostgreSQL/PostGIS (`db/postgis/001_init.sql`), in-memory rate-limit/login-lockout/tile cache → Redis.
- Tiles: run planetiler nightly on the Geofabrik India extract with Survey-of-India boundary layer, publish `india.pmtiles` to object storage behind CDN; set `TILE_UPSTREAM` or point the style at PMTiles directly.
- Routing: Valhalla (2-wheeler/auto/truck costing) + OSRM for matrices; geocoding: Photon + Nominatim self-hosted. Public demo servers (OSRM, Nominatim, Overpass, OpenFreeMap) must **not** be used for production traffic.
- Observability: scrape `/metrics` with Prometheus; ship JSON request logs (stdout) to Loki/ELK; alert on 5xx rate, p95 latency, health failures.

## Environment variables
See `.env.example` (every variable documented inline). Required in production: `JWT_SECRET`, `NODE_ENV=production`, `CORS_ORIGINS`, `HTTP_USER_AGENT`.

## Database migrations
- SQLite: applied automatically on boot from `db/migrations/*.sql` in a transaction, recorded in `schema_migrations`; `npm run migrate` to run explicitly.
- PostGIS: `psql "$DATABASE_URL" -f db/postgis/001_init.sql` (requires postgis, pg_trgm, h3, pgcrypto extensions).

## Static / serverless demo
`npm run build:demo` → `dist/india-mapos-demo.html` (single file; deploy to any static host). Uses browser storage and public OSRM/OpenFreeMap directly; demo only.

## Android
See `android/README.md` (PWA install today; Capacitor or TWA wrapper for Play Store).

## Production checklist
- [ ] Remove/replace seeded demo users & fictional sellers; disable `seed()` (or set strong `DEMO_PASSWORD`)
- [ ] JWT secret rotation, refresh tokens, HttpOnly cookie option for web
- [ ] Real payments (UPI PSP) + webhook signature verification
- [ ] PostGIS + Redis, multi-AZ, backups with restore drills
- [ ] Self-hosted tiles with SoI boundaries, routing, geocoding
- [ ] DPDP Act: consent, privacy notice, data retention for rider GPS
- [ ] Native-speaker review of 11-language strings
- [ ] Pen-test, dependency scanning (npm audit / Dependabot), WAF


## v0.2: backend on Render (free) + Android app

1. Render Dashboard → **New → Blueprint** → select this GitHub repo (uses `render.yaml`, Docker, Singapore region).
2. Set `ADMIN_PASSWORD` (≥12 chars; required in production — no default admin password is ever shipped).
   Optional: `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (Test Mode `rzp_test_…` keys from dashboard.razorpay.com → Settings → API Keys)
   and `RAZORPAY_WEBHOOK_SECRET` (webhook URL `https://<service>.onrender.com/api/payments/razorpay/webhook`, events `payment.captured`, `payment.failed`).
3. In GitHub → Settings → Secrets and variables → Actions → **Variables**, add `MAPOS_API_BASE=https://<service>.onrender.com` and re-run CI:
   the next APK talks to your backend by default. (Users can also enter the URL in the app's ⚙ Settings.)
4. Free plan caveats: the instance sleeps after ~15 min idle (first request ~30–60 s) and has no persistent disk, so SQLite resets on redeploy.
   For real users use a paid instance with the disk in `render.yaml`, or migrate to PostGIS (`db/postgis/001_init.sql`).

### Required external credentials (none are needed for tests/on-device mode)
| Feature | Credential | Without it |
|---|---|---|
| Online payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | COD + clearly-labelled simulated UPI only |
| Push when app closed | Firebase project, `google-services.json`, FCM service account | In-app + local notifications while app is open/backgrounded |
| AI rewrite layer | `LLM_API_KEY` (+ `LLM_BASE_URL`, `LLM_MODEL`) | Rule-based multilingual intent engine |
| Production routing/geocoding | Self-hosted `OSRM_URL` / `NOMINATIM_URL` / Valhalla | Public OSRM/Nominatim demo servers (rate-limited, dev only) |
| Release-signed APK | `ANDROID_KEYSTORE_*` secrets | Debug-signed APK (sideload only) |
| Live traffic, tolls, transit schedules | Licensed feeds (e.g. NHAI/FASTag, GTFS from agencies) | Labelled sample data |
