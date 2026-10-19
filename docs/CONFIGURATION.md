# Configuration

Every variable is read from the server environment. Core, map-service and v0.4 variables are documented inline in
`.env.example`; this page covers the variables **added in v0.7** (service panels, payments, traffic, ONDC prototype)
and what each one changes in the app. Unset = the honest fallback in the last column. Keys never reach the client:
`GET /api/v1/integrations` reports `configured: true/false` per adapter and never echoes a secret.

## Payments (`server/payments/index.js`)

Each gateway is enabled only when **all** of its required keys are present. With none, `GET /api/payments/config` says
`configured: false`, `POST /api/payments/orders` answers `503 payments_not_configured`, and the payment screen shows
"Payments not configured" (the order stays `pending_payment`, nothing is ever marked paid).

| Variable | Required for | Notes | Unset |
| --- | --- | --- | --- |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay | Test keys `rzp_test_…` from the Razorpay dashboard. (Existing since v0.2.) | Razorpay off |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook | Webhook URL `https://<host>/api/payments/razorpay/webhook` | Webhook rejected |
| `RAZORPAY_API_BASE` | — | Override for tests | `https://api.razorpay.com` |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Cashfree (prototype) | Webhook signature uses the secret key | Cashfree off |
| `CASHFREE_ENV` | — | `production` switches to the live API | sandbox |
| `CASHFREE_API_BASE` | — | Override the API base (tests) | from `CASHFREE_ENV` |
| `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION` | PhonePe PG v2 (prototype) | OAuth client credentials | PhonePe off |
| `PHONEPE_ENV` | — | `production` switches to the live API | sandbox |
| `PHONEPE_AUTH_BASE`, `PHONEPE_PG_BASE` | — | Override the OAuth / PG bases (tests) | from `PHONEPE_ENV` |
| `PHONEPE_WEBHOOK_USER`, `PHONEPE_WEBHOOK_PASSWORD` | PhonePe webhook | Used to check the webhook `Authorization` hash | Webhook rejected |
| `PAYTM_MID`, `PAYTM_MERCHANT_KEY` | Paytm PG (prototype) | Checksum is computed with the merchant key | Paytm off |
| `PAYTM_WEBSITE` | — | Paytm website name | `WEBSTAGING` (staging) / `DEFAULT` (production) |
| `PAYTM_ENV` | — | `production` switches to the live API | staging |
| `PAYTM_API_BASE` | — | Override the API base (tests) | from `PAYTM_ENV` |
| `PUBLIC_BASE_URL` | Gateway return URLs | Public origin used to build `…/#/pay/<orderId>` return links | request protocol + host |

Cashfree, PhonePe and Paytm are **prototype adapters**: written from public docs and unit/API-tested with locally computed
signatures, never run against a live sandbox. Treat a first real sandbox run as required before enabling them.

## Live traffic (`server/integrations/index.js`)

| Variable | Meaning | Unset |
| --- | --- | --- |
| `TRAFFIC_PROVIDER` | `tomtom` or `here` | Layers shows **"Live traffic unavailable"** and the toggle is disabled; drive times are free-flow estimates |
| `TOMTOM_API_KEY` | Key for `TRAFFIC_PROVIDER=tomtom` | — |
| `HERE_API_KEY` | Key for `TRAFFIC_PROVIDER=here` | — |

Tiles go through the server proxy `/api/v1/traffic/tiles/{z}/{x}/{y}.png` so the key stays on the server; status is `live`
only when a provider **and** its key are set.

## Rides and link-outs

| Variable | Meaning | Unset |
| --- | --- | --- |
| `UBER_CLIENT_ID` | Public client id added to the Uber universal link (`m.uber.com/ul/?client_id=…`) | Link still opens Uber, without a client id |
| `OLA_XAPP_TOKEN` | Ola affiliate X-APP token; upgrades Ola from partner-pending to deep link | Ola shown as partner-pending, no link |

## ONDC buyer prototype (`server/services-api.js`)

| Variable | Meaning | Unset |
| --- | --- | --- |
| `ONDC_PROTOTYPE` | `1` enables `POST /api/v1/ondc/prototype/{search,select,init,confirm}` and `GET …/status/:orderId`. The flow uses Beckn-shaped messages against **Bharat's own demo catalogue** (`network: "bharat-demo (not ONDC)"`); it does not talk to the ONDC network | Endpoints return 404 |
| `ONDC_BAP_ID` | Subscriber id put in the Beckn context | `bharatmap.prototype.bap` |
| `ONDC_SIGNING_KEY` | Listed for the future ed25519 request signing; **not used yet** (no registry onboarding) | — |

## Data feeds

| Variable | Meaning | Unset |
| --- | --- | --- |
| `TRANSIT_FEEDS_DIR` | Extra GTFS feeds (zip or folder) loaded at start, besides the bundled HMRL feed | `data/gtfs` |
| `SHOWTIMES_FEED_URL` | Placeholder for a licensed cinema showtimes feed. Setting it only changes the panel's source note; **no adapter is connected**, so showtimes stay Unavailable | Showtimes Unavailable |

## Honesty rules enforced in code

- A value is labelled **Live** only when a configured feed produced it; Demo data (Bharat's fictional sellers) is always
  labelled Demo and never Live.
- No fabricated prices, fares, showtimes, slots or ETAs: ride panels show a routing **Estimate** ETA and fare
  **Unavailable**; metro panels show **Scheduled** departures only where a GTFS feed exists.
- No hand-built `upi://` intents; UPI happens inside the gateway checkout.
- `tests/v07.test.js` runs the panel honesty self-check over every sample place and fails on any violation.
