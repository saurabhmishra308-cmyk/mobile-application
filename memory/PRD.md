# Envirolytics Monitor — Mobile app (Expo, iOS + Android)

## Purpose
Companion mobile app for the web dashboard at https://monitor.envirolytics.in — allows Envirolytics customers to sign in with the SAME web credentials and view the exact same IoT field-instrument data on their phones.

## Backend
- **No new backend created.** The mobile app calls the existing production API at `https://monitor.envirolytics.in/api/*` directly with JWT Bearer authentication.
- API base URL is defined once in `/app/frontend/src/theme.ts` (`API_BASE`).
- Our `/app/backend/server.py` is left as the template stub (only `/api/status` demo routes). It is not used by the mobile app.

## API endpoints consumed (all on monitor.envirolytics.in)
| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login` | Sign in with `{email, password}` — returns `access_token` + user |
| `GET /api/auth/me` | Full profile (used to enrich user after login) |
| `GET /api/instrument-registry` | List of instruments (DWLR + Flowmeter) |
| `GET /api/instruments/all/latest` | Latest reading per type |
| `GET /api/instruments/dwlr/latest` | Latest DWLR readings |
| `GET /api/flowmeter/latest` | Latest flowmeter readings |
| `GET /api/flowmeter/status` | MQTT broker connection state |
| `GET /api/flowmeter/history/{hw}?hours=` | Flow-rate history (chart) |
| `GET /api/alerts/offline?hours=24` | Devices with no data in last N hours |
| `GET /api/alerts/limit-breaches` | Parameter limit breach alerts |
| `GET /api/weather/live` | Live weather for the site (used on Dashboard) |
| `GET /api/reports/borewell-consumption?days=` | Borewell consumption summary |

## Frontend (Expo Router)
Structure:
- `app/_layout.tsx` — AuthProvider + SafeArea + status bar
- `app/index.tsx` — Redirects based on auth state
- `app/login.tsx` — Email + password sign-in
- `app/(tabs)/_layout.tsx` — Bottom tabs (Dashboard, Devices, Alerts, Profile)
- `app/(tabs)/dashboard.tsx` — Stats, instrument mix, live weather, offline preview, MQTT broker status
- `app/(tabs)/devices.tsx` — Instrument registry with chips (All/DWLR/Flowmeter/Offline) + search
- `app/(tabs)/alerts.tsx` — Limit breaches + Offline devices
- `app/(tabs)/profile.tsx` — User info, permissions, logout
- `app/device/[id].tsx` — Device detail: latest reading + 24h/72h/7d flow-rate chart (SVG)

Shared code:
- `src/api/client.ts` — thin fetch wrapper with token
- `src/context/AuthContext.tsx` — SecureStore-backed auth state
- `src/components/*` — StatusPill, MetricCard, ScreenHeader, LineChart
- `src/utils/format.ts` — number/date helpers

## Design
Dark-mode-first — deep navy `#1a2332` base with water-blue `#0ea5e9` and eco-green `#10B981` accents (matches the web app's theme color). System fonts with monospace numerals for readings/metrics. Data-testid on every interactive & key info element.

## Auth
- JWT stored in `expo-secure-store` (`envirolytics.token`).
- User profile cached in AsyncStorage (`envirolytics.user`), refreshed on boot & after login via `/api/auth/me`.
- On any 401 response the app auto-signs-out and returns to Login.

## Testing credentials
See `/app/memory/test_credentials.md`.

## Known limitations
- DWLR history endpoint was not discovered on the production API — the DWLR device-detail page shows the latest reading only (chart is only rendered for flowmeters). If the backend adds one later, wire `api.dwlrHistory` and reuse the same chart component.
- The app talks to the production API directly. Field-instrument data on the account is currently sparse (test devices with 0 readings) — all rendering handles empty states.
