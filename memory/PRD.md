# Envirolytics Monitor — Mobile app (Expo, iOS + Android)

## Purpose
Companion mobile app for the web dashboard at https://monitor.envirolytics.in — Envirolytics customers sign in with the SAME web credentials and view the exact same IoT field-instrument data on their phones, download compliance-ready CSV/PDF exports, and receive push alerts for offline devices & limit breaches.

## Branding
- **App store name / display name**: `Envirolytics Monitor`
- **iOS bundle identifier**: `in.envirolytics.mobile`
- **Android package**: `in.envirolytics.mobile`
- **Deep-link domain**: `mobileapp.envirolytics.in` (iOS Universal Link via `applinks:` + Android App Link via verified `https` intent filter)
- Also supports the custom scheme `envirolytics://` for local routing.

To finish App Link verification, the operator must host:
- `https://mobileapp.envirolytics.in/.well-known/apple-app-site-association`
- `https://mobileapp.envirolytics.in/.well-known/assetlinks.json`
(with the same bundle ID `in.envirolytics.mobile` and the sha256 fingerprint from the signed Android build).

## Backend (our own)
`/app/backend/server.py` is a tiny FastAPI service with two purposes:

1. **`POST /api/register-push`** — relays device registration to the Emergent push service (SuprSend) and stores `{user_id, device_token, envirolytics_token}` in Mongo (`push_users` collection).
2. **Background alert poller** — every `ALERT_POLL_INTERVAL_SECONDS` (default 300s), iterates every registered user, calls `monitor.envirolytics.in/api/alerts/offline?hours=24` and `monitor.envirolytics.in/api/alerts/limit-breaches` with their token, diffs against last-known state, and fires a push via `send_push()` for each new offline device / breach. Idempotency keys prevent duplicates.

Extra: `POST /api/unregister-push` on logout removes the record.

The mobile app talks to `monitor.envirolytics.in` DIRECTLY for all data reads; our backend never proxies user-facing reads.

## Upstream API endpoints consumed (all on monitor.envirolytics.in)
| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login` | Sign in — returns JWT + user |
| `GET /api/auth/me` | Full profile |
| `GET /api/instrument-registry` | Instrument list (DWLR + Flowmeter) |
| `GET /api/instruments/all/latest` | Latest reading per type |
| `GET /api/instruments/dwlr/latest` | Latest DWLR readings |
| `GET /api/instruments/dwlr/{hw}/history?hours=` | DWLR history — water level trend |
| `GET /api/flowmeter/latest` | Latest flowmeter readings |
| `GET /api/flowmeter/status` | MQTT broker state |
| `GET /api/flowmeter/history/{hw}?hours=` | Flow-rate history |
| `GET /api/alerts/offline?hours=` | Offline devices |
| `GET /api/alerts/limit-breaches` | Parameter limit breaches |
| `GET /api/weather/live` | Site weather |
| `GET /api/reports/borewell-consumption?days=` | Consumption summary |
| `GET /api/reports/hourly-pumping-vs-level?hardware_id=&hours=` | Hourly pumping trend |
| `GET /api/reports/level-vs-rainfall?hardware_id=&days=` | Level vs rainfall (DWLR) |
| `GET /api/flowmeter-mgmt/export?instrument_type=&format=csv\|pdf` | **Server-generated file exports** — downloaded natively via `expo-file-system` + `expo-sharing` |

## Frontend (Expo Router)
Structure:
- `app/_layout.tsx` — SafeArea, AuthProvider, module-scope push handlers, tap listeners (warm + cold-start)
- `app/index.tsx` — routes to /login or /(tabs)/dashboard based on auth
- `app/login.tsx` — animated login screen mimicking the web illustration (see below)
- `app/(tabs)/_layout.tsx` — 5 tabs
- `app/(tabs)/dashboard.tsx`, `devices.tsx`, `reports.tsx`, `alerts.tsx`, `profile.tsx`
- `app/device/[id].tsx` — flowmeter (flow-rate) + DWLR (water-level) history chart, CSV & PDF download buttons

Shared:
- `src/api/client.ts` — remote fetch + push-relay client
- `src/context/AuthContext.tsx` — SecureStore token, `registerForPush()` on sign-in
- `src/components/LoginScene.tsx` — animated SVG scene: sky gradient, sun, drifting clouds, birds, mountains, rotating wind turbines, falling rain, potted plants, solar panels, water ripples, fireflies
- `src/components/LineChart.tsx`, `MetricCard.tsx`, `StatusPill.tsx`, `ScreenHeader.tsx`
- `src/utils/download.ts` — native download + share (web fallback via Blob URL)
- `src/utils/push.ts` — device-token registration
- `src/utils/format.ts` — helpers

## Downloadable exports
Buttons on Device Detail (per-device) and Reports tab (fleet-wide) fetch the server-generated CSV or PDF at `/api/flowmeter-mgmt/export` and open the native share sheet via `expo-sharing` — user can save to Files, email, or WhatsApp. CSV is directly openable in Excel/Numbers/Sheets.

## Push notifications (Emergent-managed)
- `expo-notifications` module-scope handler + Android channel in `_layout.tsx`.
- Registers `Notifications.getDevicePushTokenAsync()` after login, POSTs to `/api/register-push`.
- Tap handlers route to `/(tabs)/alerts` (via `action_url`).
- **Won't fire in Expo Go**; requires an EAS build. Android additionally requires `google-services.json` at `frontend/google-services.json` (user-provided) before the build is generated. `EMERGENT_PUSH_KEY` in `backend/.env` is set to `placeholder` — the deployer replaces it during publish.

## Email delivery (SendGrid, from info@envirolytics.in)
- Backend `POST /api/email-report` fetches the CSV/PDF from the upstream and sends via SendGrid with attachments.
- `POST /api/email-subscriptions` stores per-user preferences `{weekly, monthly}`.
- APScheduler in the FastAPI lifespan runs:
  - `_send_scheduled_reports("weekly")` every Monday 06:00 IST
  - `_send_scheduled_reports("monthly")` on the 1st at 06:00 IST
- **On-demand button** in the mobile app (Device Detail + Reports tab) opens an `EmailReportSheet` bottom sheet where the user picks recipient + attachments and taps Send. Verified in the UI test with the sub-user's account round-tripped through Mongo.
- SendGrid API key placeholder in `backend/.env`; SPF/DKIM setup is documented at `/app/EMAIL_SETUP.md`.

## Admin — Site Activations
- `/app/frontend/app/admin/activations.tsx` — admin-only, reachable from Profile → "Site activations".
- Calls upstream:
  - `GET /api/admin/site/activations`
  - `POST /api/admin/site/activate` with `{user_id, subscription_type: "monthly"|"quarterly"|"yearly"}`
- Merges the activations list with the user list, picks the latest end-date per user, and shows a per-customer card with plan / start / end + a countdown status pill (Active / ≤14d / Expired / Not activated).
- "Activate site" / "Renew or upgrade" button opens a bottom-sheet with three plans (`+30d`, `+90d`, `+365d`). Tap → POST → refresh + success toast. Admin's own row is filtered out so you can't self-subscribe.

## Admin — Manage Users
- `/app/frontend/app/admin/users.tsx` — full-screen route, reachable from Profile only when `user.role === "admin"`.
- Talks DIRECTLY to the upstream endpoints:
  - `GET /api/admin/users/list`
  - `PUT /api/admin/users/{id}/status?is_active=true|false`
- UI: stat strip (Total / Active / Expiring / Expired), filter chips (All / Active / Inactive / Expiring / Expired), search, per-user card with:
  - Status pill (Active / Inactive / Expiring / Expired)
  - Age-since-creation + countdown to auto-expiry
  - Toggle switch that PUTs upstream `.../status`
- Guards the admin from deactivating their own account.
- **365-day auto-deactivate cron** — `_auto_deactivate_expired_users()` runs daily at 03:00 IST. Fetches the upstream user list with a registered admin's stored `envirolytics_token`, computes days-since-`created_at`, and deactivates any non-admin whose age ≥ 365 days. Admins are always skipped so the tenant is never locked out. Can be triggered on-demand at `POST /api/admin/run-auto-deactivate`.

## Domain / deep-link setup
Step-by-step guide at `/app/DOMAIN_SETUP.md` — covers the DNS CNAME for
`mobileapp.envirolytics.in`, attaching the subdomain during Emergent Publish,
and hosting `apple-app-site-association` + `assetlinks.json` under
`/.well-known/` so iOS Universal Links & Android App Links open the app.

## Testing credentials
See `/app/memory/test_credentials.md`.
