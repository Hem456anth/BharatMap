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
| Release-signed APK | `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (see below) | CI still builds the release APK, but unsigned (kept as a CI artifact); only the debug APK is published |
| Live traffic, tolls, transit schedules | Licensed feeds (e.g. NHAI/FASTag, GTFS from agencies) | Labelled sample data |

## Android release signing

The app's release key was generated on 19 Oct 2026: PKCS12 keystore, alias `bharatmap`, RSA 4096, validity 10,000 days
(until 6 Mar 2054), `CN=Bharat Map`.

| | |
|---|---|
| Certificate SHA-256 | `d0:4d:20:f9:fd:72:7d:7c:a6:d9:66:e7:71:e2:ed:57:60:b2:0f:ef:e9:c1:39:d3:6f:0e:3e:86:b7:99:7c:6c` |
| Certificate SHA-1 | `3f:67:79:6d:59:35:66:df:f9:fd:f2:40:b7:78:bd:5d:82:31:f8:e3` |
| Signature schemes | v1 (JAR) + v2 + v3 |
| Keystore file SHA-256 | `4f8a2779bba25c1bf8014aa0f974f646236f144e69212145f3979fd9f64323ab` |

**Key backup.** The keystore and its passwords are **not** in this repository (`.gitignore` excludes `signing/`, `*.jks`,
`*.keystore`). The owner's backup is kept outside the repo (`signing/bharatmap-release.jks`, `signing/bharatmap-release.jks.b64`,
`signing/credentials.txt`, all mode 600). Copy it to a second safe place (password manager / encrypted drive). **If the key is lost,
no future build can update an installed copy** — every user would have to uninstall and reinstall.

**CI secrets.** Settings → Secrets and variables → Actions → *Repository secrets*:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_B64` | contents of `bharatmap-release.jks.b64` (single-line base64 of the keystore) |
| `ANDROID_KEYSTORE_PASSWORD` | from `credentials.txt` |
| `ANDROID_KEY_ALIAS` | `bharatmap` |
| `ANDROID_KEY_PASSWORD` | from `credentials.txt` (same as the store password — PKCS12) |

With the secrets present, the `android` job decodes the keystore to `$RUNNER_TEMP` (deleted after the build), checks it opens with
the password/alias, runs `assembleDebug assembleRelease` (`android/app/build.gradle` reads `ANDROID_KEYSTORE_PATH` and the three
password/alias variables; if any is missing the release build is produced **unsigned** instead of failing), verifies with
`apksigner verify --print-certs` (must be `CN=Bharat Map`), `zipalign -c -P 16 4` and `aapt dump badging` (must not be
debuggable), then publishes `bharat-map-0.5.N.apk` (release, main asset) and `bharat-map-0.5.N-debug.apk`.

Without the secrets, CI warns, uploads `bharat-map-0.5.N-release-unsigned.apk` as a 7-day artifact, and publishes only the debug APK.
An unsigned build can be signed offline with the backed-up key:

```bash
apksigner sign --ks signing/bharatmap-release.jks --ks-key-alias bharatmap \
  --ks-pass env:KSP --key-pass env:KSP --out bharat-map-0.5.N.apk bharat-map-0.5.N-release-unsigned.apk
apksigner verify --print-certs bharat-map-0.5.N.apk
```

(v0.5.13 was produced this way: the secrets could not be written through the automation's GitHub token, which has no
Actions-secrets permission. Add the four secrets once in the GitHub UI and every later build is signed in CI.)

**Switching from debug builds.** 0.5.12 and earlier were signed with the CI's throwaway debug key. Android will not install a
release-signed build over them: uninstall the old app once (on-device saved places and downloaded offline data are removed), then
install the release APK. Later release builds install as normal updates.
