import { storage } from "@/src/utils/storage";
import { API_BASE } from "@/src/theme";

export const TOKEN_KEY = "envirolytics.token";
export const USER_KEY = "envirolytics.user";

export const OWN_BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "";

// Central URL builder — the web app had a CSV-returns-HTML bug because raw
// template literals interpolated `process.env.REACT_APP_BACKEND_URL` (undefined
// at build). Never build URLs by hand — always go through apiUrl().
export function apiUrl(path: string): string {
  const base = (API_BASE || "").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// Same helper for our own container backend (email / push / cron).
export function ownBackendUrl(path: string): string {
  const base = (OWN_BACKEND_URL || "").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type UserProfile = {
  id: string;
  email: string;
  username?: string;
  full_name: string;
  role: string;
  is_active?: boolean;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  permissions?: Record<string, boolean>;
  // NEW: /api/auth/me now returns view_permissions to drive tab visibility.
  view_permissions?: Record<string, boolean>;
  service_expiry_date?: string | null;
  service_term_years?: number | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: UserProfile;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), { ...options, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message =
      (body && (body.detail || body.message)) || `HTTP ${res.status}`;
    const err = new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export async function loginRequest(email: string, password: string) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function authed<T>(path: string): Promise<T> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return request<T>(path, { method: "GET" }, token);
}

// ---------- Types ----------
export type Instrument = {
  hardware_id: string;
  instrument_type: string; // "dwlr" | "flowmeter" | ...
  owner_user_id?: string;
  label?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  imei?: string | null;
  manual_water_temp_c?: number | null;
  device_key?: string | null;
  created_at?: string;
  created_by?: string;
  owner_email?: string;
  owner_name?: string;
};

export type OfflineDevice = {
  kind: string;
  instrument_type: string;
  hardware_id: string;
  last_seen: string | null;
  minutes_since_last_seen: number | null;
  never_reported: boolean;
};

export type LimitBreach = {
  hardware_id?: string;
  parameter?: string;
  value?: number;
  limit?: number;
  detected_at?: string;
  [k: string]: any;
};

export type FlowmeterReading = {
  hardware_id?: string;
  timestamp?: string;
  ts?: string;
  flow_rate?: number | null;
  totalizer?: number | null;
  totaliser?: number | null;
  cumulative_flow?: number | null;
  battery?: number | null;
  [k: string]: any;
};

export type DwlrReading = {
  hardware_id?: string;
  timestamp?: string;
  ts?: string;
  water_level?: number | null;
  level?: number | null;
  depth?: number | null;
  temperature?: number | null;
  battery?: number | null;
  [k: string]: any;
};

// Generic reading shape for the new instrument types (pH / TDS / Conductivity).
export type GenericReading = {
  hardware_id?: string;
  timestamp?: string;
  ts?: string;
  value?: number | null;
  [k: string]: any;
};

// STP / DO / Chlorine live values returned by /api/water-quality/latest.
export type WaterQualityMeta = {
  unit_default?: string;
  min?: number;
  max?: number;
  safe_min?: number;
  safe_max?: number;
};

export type WaterQualityReading = {
  hardware_id?: string;
  timestamp?: string;
  location_name?: string | null;
  // dynamic — one column per param (COD, BOD, TSS, PH, DO_TANK_1, CHLORINE etc.)
  [k: string]: any;
};

export type WaterQualityLatest = {
  unit?: string;
  stp_params_meta: Record<string, WaterQualityMeta>;
  do_params_meta: Record<string, WaterQualityMeta>;
  chlorine_params_meta: Record<string, WaterQualityMeta>;
  stp: WaterQualityReading[];
  do: WaterQualityReading[];
  chlorine: WaterQualityReading[];
};

export type Weather = {
  main?: { temp?: number; humidity?: number; feels_like?: number };
  weather?: { main?: string; description?: string; icon?: string }[];
  wind?: { speed?: number };
  name?: string;
  rain?: Record<string, number>;
};

export type SiteActivation = {
  id: string;
  user_id: string;
  subscription_type: "monthly" | "quarterly" | "yearly";
  start_date: string;
  end_date: string;
  status: string;
  created_by?: string | null;
  created_at?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  username?: string | null;
  full_name: string;
  company_name?: string | null;
  phone?: string | null;
  role: string;
  is_active: boolean;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  created_by?: string | null;
  permissions?: Record<string, boolean>;
};

// ---------- Endpoints ----------
// ── /api/instrument-registry/last-data ──────────────────────────────────
// The upstream's home-screen endpoint. Returns every visible device + latest
// reading + status ("live" / "stale" / "silent") + owner + last_values chips.
// Suggested poll interval: 15–30 s.
export type LastDataStatus = "live" | "stale" | "silent";

export type LastDataDevice = {
  hardware_id: string;
  instrument_type: string;
  label?: string | null;
  location_name?: string | null;
  category?: string | null;
  owner_user_id?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  seconds_since_last?: number | null;
  status: LastDataStatus;
  last_seen?: string | null;
  // Small key/value chips (e.g., { level: "12.4 m", battery: "6.1 V" })
  last_values?: Record<string, string>;
  // Raw latest reading if the client wants deeper inspection
  latest?: Record<string, any> | null;
};

export type LastDataResponse = {
  devices: LastDataDevice[];
  count: number;
  generated_at?: string;
};

// ── Certificates ────────────────────────────────────────────────────────
export type Certificate = {
  id: string;
  hardware_id?: string;
  title?: string;
  issued_on?: string;
  valid_till?: string;
  status?: string;
  file_url?: string;
};

// ── Reports (analytics dashboards on the web) ──────────────────────────
export type FlowVsLevelPoint = {
  timestamp: string;
  flow_m3h?: number | null;
  level_m?: number | null;
};

// ── Notifications / alert histories ─────────────────────────────────────
export type AlertEntry = {
  id?: string;
  hardware_id?: string;
  parameter?: string;
  value?: number;
  threshold?: number;
  severity?: "warning" | "critical" | string;
  timestamp?: string;
  resolved?: boolean;
};

// ── Customer profile ────────────────────────────────────────────────────
export type CustomerProfile = {
  id?: string;
  email?: string;
  full_name?: string;
  company_name?: string;
  phone?: string;
  address?: string;
  service_expiry_date?: string | null;
  service_term_years?: number | null;
  view_permissions?: Record<string, boolean>;
  permissions?: Record<string, boolean>;
  [k: string]: any;
};

export const api = {
  me: () => authed<UserProfile>("/api/auth/me"),
  instruments: () =>
    authed<{ instruments: Instrument[] }>("/api/instrument-registry"),

  // NEW — single call for the mobile home screen.
  // Falls back gracefully if the upstream doesn't have this endpoint yet
  // (HTTP 404 / 405) — we synthesise the same shape from the endpoints
  // that DO exist: instruments + dwlrLatest + flowmeterLatest + offline.
  lastData: async (): Promise<LastDataResponse> => {
    try {
      return await authed<LastDataResponse>("/api/instrument-registry/last-data");
    } catch (e: any) {
      if (e?.status !== 404 && e?.status !== 405) throw e;
      // ── Client-side fallback ─────────────────────────────────────────
      const [insR, dwR, fmR, offR] = await Promise.allSettled([
        authed<{ instruments: Instrument[] }>("/api/instrument-registry"),
        authed<{ readings: DwlrReading[] }>("/api/instruments/dwlr/latest"),
        authed<{ flowmeters: FlowmeterReading[] }>("/api/flowmeter/latest"),
        authed<{ offline: OfflineDevice[] }>("/api/alerts/offline?hours=24"),
      ]);
      const instruments =
        insR.status === "fulfilled" ? insR.value.instruments || [] : [];
      const dwlrByHw = new Map<string, DwlrReading>();
      if (dwR.status === "fulfilled") {
        for (const r of dwR.value.readings || []) {
          if (r.hardware_id) dwlrByHw.set(r.hardware_id, r);
        }
      }
      const fmByHw = new Map<string, FlowmeterReading>();
      if (fmR.status === "fulfilled") {
        for (const r of fmR.value.flowmeters || []) {
          if (r.hardware_id) fmByHw.set(r.hardware_id, r);
        }
      }
      const offlineByHw = new Map<string, OfflineDevice>();
      if (offR.status === "fulfilled") {
        for (const o of offR.value.offline || []) {
          if (o.hardware_id) offlineByHw.set(o.hardware_id, o);
        }
      }
      const now = Date.now();
      const devices: LastDataDevice[] = instruments.map((ins) => {
        const type = (ins.instrument_type || "").toLowerCase();
        const latest =
          type === "dwlr"
            ? dwlrByHw.get(ins.hardware_id)
            : type === "flowmeter"
              ? fmByHw.get(ins.hardware_id)
              : undefined;
        const off = offlineByHw.get(ins.hardware_id);
        const tsRaw =
          (latest && (latest as any).timestamp) ||
          (latest && (latest as any).ts) ||
          off?.last_seen ||
          null;
        const secondsSinceLast = tsRaw
          ? Math.max(0, Math.round((now - new Date(tsRaw).getTime()) / 1000))
          : null;
        let status: LastDataStatus = "silent";
        if (off) status = "silent";
        else if (secondsSinceLast === null) status = "silent";
        else if (secondsSinceLast < 15 * 60) status = "live";
        else if (secondsSinceLast < 6 * 3600) status = "stale";
        else status = "silent";

        // Build 3 short display chips from the freshest fields we have.
        const chips: Record<string, string> = {};
        if (latest) {
          const raw = latest as Record<string, any>;
          const pick = (keys: string[], label: string, unit: string, decimals = 2) => {
            for (const k of keys) {
              const v = raw[k];
              if (v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v))) {
                chips[label] = `${Number(v).toFixed(decimals)}${unit}`;
                return;
              }
            }
          };
          if (type === "dwlr") {
            pick(["water_level", "level", "depth", "LVL", "RAW", "D_SEN"], "Level", " m", 2);
            pick(["water_temperature", "wtemp", "temperature", "temp", "WTEMP", "ATEMP"], "Temp", "°C", 1);
            pick(["battery", "battery_v", "bat", "voltage", "BVOLT"], "Battery", " V", 2);
          } else if (type === "flowmeter") {
            pick(["flow_rate_m3h", "flow_rate", "rate", "flow", "flowrate"], "Flow", " m³/h", 3);
            pick(
              [
                "totaliser_end_reading",
                "forward_totalizer",
                "totalizer",
                "totaliser",
                "cumulative_flow",
                "total",
                "final_forward_totalizer",
              ],
              "Total",
              " m³",
              3,
            );
            pick(["battery", "battery_v", "bat", "voltage", "BVOLT"], "Battery", " V", 2);
          } else {
            // pH / TDS / Conductivity — pick "value" as the headline.
            pick(["value", "reading", type], "Value", "", 2);
            pick(["battery", "battery_v", "bat", "voltage"], "Battery", " V", 2);
            pick(["signal", "rssi", "SIGNAL"], "Signal", "", 0);
          }
        }

        return {
          hardware_id: ins.hardware_id,
          instrument_type: ins.instrument_type,
          label: ins.label,
          location_name: ins.location_name,
          category: ins.category,
          owner_user_id: ins.owner_user_id,
          owner_email: ins.owner_email,
          owner_name: ins.owner_name,
          seconds_since_last: secondsSinceLast,
          status,
          last_seen: tsRaw,
          last_values: chips,
          latest: latest as Record<string, any> | null,
        };
      });
      return {
        devices,
        count: devices.length,
        generated_at: new Date().toISOString(),
      };
    }
  },

  latestAll: () =>
    authed<{ by_type: Record<string, any[]>; total: number }>(
      "/api/instruments/all/latest",
    ),
  dwlrLatest: () =>
    authed<{ readings: DwlrReading[]; count: number }>(
      "/api/instruments/dwlr/latest",
    ),
  dwlrHistory: (hw: string, hours: number = 24) =>
    authed<{
      instrument_type: string;
      hardware_id: string;
      readings: DwlrReading[];
      count: number;
    }>(`/api/instruments/dwlr/${encodeURIComponent(hw)}/history?hours=${hours}`),

  // DWLR daily aggregates for long-range trends (up to 3,650 days lifetime).
  dwlrDaily: (hw: string, days: number = 30) =>
    authed<{
      hardware_id: string;
      days: number;
      readings: { date: string; min: number; max: number; avg: number }[];
    }>(
      `/api/flowmeter-mgmt/dwlr/${encodeURIComponent(hw)}/daily?days=${Math.min(days, 3650)}`,
    ),

  // ── Generic instrument endpoints (pH / TDS / Conductivity — same shape) ──
  instrumentLatest: (type: string) =>
    authed<{ instrument_type: string; readings: GenericReading[]; count: number }>(
      `/api/instruments/${encodeURIComponent(type)}/latest`,
    ),
  instrumentHistory: (type: string, hw: string, hours: number = 24) =>
    authed<{
      instrument_type: string;
      hardware_id: string;
      readings: GenericReading[];
      count: number;
    }>(
      `/api/instruments/${encodeURIComponent(type)}/${encodeURIComponent(hw)}/history?hours=${hours}`,
    ),

  // Advertised instrument types on the upstream (dwlr, ph, tds, conductivity …).
  instrumentTypes: () =>
    authed<{ types: string[] }>(`/api/instruments/types`),

  // Water quality (STP / DO / Chlorine). Returns latest values + safety thresholds.
  waterQualityLatest: () =>
    authed<WaterQualityLatest>(`/api/water-quality/latest`),
  flowmeterLatest: () =>
    authed<{ flowmeters: FlowmeterReading[]; count: number }>(
      "/api/flowmeter/latest",
    ),
  flowmeterStatus: () =>
    authed<{ connected: boolean; subscribed_topics: string[]; broker: string }>(
      "/api/flowmeter/status",
    ),
  flowmeterHistory: (hw: string, hours: number = 24) =>
    authed<{ readings: FlowmeterReading[]; count: number }>(
      `/api/flowmeter/history/${encodeURIComponent(hw)}?hours=${hours}`,
    ),
  offline: (hours: number = 24) =>
    authed<{
      threshold_hours: number;
      checked_at: string;
      count: number;
      offline: OfflineDevice[];
    }>(`/api/alerts/offline?hours=${hours}`),
  limitBreaches: () =>
    authed<{ count: number; breaches: LimitBreach[] }>(
      "/api/alerts/limit-breaches",
    ),
  weatherLive: () => authed<Weather>("/api/weather/live"),
  borewellConsumption: (days: number = 7) =>
    authed<{
      start: string;
      end: string;
      borewells: { hardware_id: string; label: string; consumption_kl: number }[];
      grand_total_kl: number;
      count: number;
    }>(`/api/reports/borewell-consumption?days=${days}`),
  hourlyPumpingVsLevel: (hardwareId: string, hours: number = 24) =>
    authed<{
      flowmeter_id: string;
      dwlr_id: string | null;
      hours: number;
      series: { hour_label: string; start: string; end: string; pumped_kl: number; level_m: number | null }[];
    }>(
      `/api/reports/hourly-pumping-vs-level?hardware_id=${encodeURIComponent(
        hardwareId,
      )}&hours=${hours}`,
    ),
  levelVsRainfall: (hardwareId: string, days: number = 7) =>
    authed<{
      dwlr_id: string;
      latitude: number | null;
      longitude: number | null;
      start: string;
      end: string;
      series: { date: string; level_m: number | null; rainfall_mm: number | null }[];
    }>(
      `/api/reports/level-vs-rainfall?hardware_id=${encodeURIComponent(
        hardwareId,
      )}&days=${days}`,
    ),
  // Admin — user management (upstream is monitor.envirolytics.in).
  adminUsersList: () =>
    authed<{ users: AdminUser[]; count?: number }>("/api/admin/users/list"),
  setUserStatus: async (userId: string, isActive: boolean) => {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    const res = await fetch(
      `${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/status?is_active=${isActive}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return res.json();
  },
  deleteUser: async (userId: string) => {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    const res = await fetch(
      `${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  // Site activation subscriptions (admin-only upstream endpoints).
  siteActivations: () =>
    authed<{ activations: SiteActivation[]; count: number }>(
      "/api/admin/site/activations",
    ),
  activateSite: async (
    userId: string,
    subscriptionType: "monthly" | "quarterly" | "yearly",
  ) => {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    const res = await fetch(`${API_BASE}/api/admin/site/activate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        subscription_type: subscriptionType,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ success: boolean; activation: SiteActivation }>;
  },

  // Server-generated file exports; caller downloads binary via the URL.
  // NEW: exports now cap at 100,000 rows (was 5k), and only m³/h columns.
  exportUrl: (params: {
    instrument_type: "dwlr" | "flowmeter";
    format: "csv" | "pdf";
    hardware_id?: string;
    days?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    qs.set("instrument_type", params.instrument_type);
    qs.set("format", params.format);
    if (params.hardware_id) qs.set("hardware_id", params.hardware_id);
    if (params.days) qs.set("days", String(params.days));
    if (params.limit) qs.set("limit", String(Math.min(params.limit, 100_000)));
    return apiUrl(`/api/flowmeter-mgmt/export?${qs.toString()}`);
  },

  // ── Certificates ─────────────────────────────────────────────────────
  certificates: (clientUserId?: string) => {
    const qs = clientUserId
      ? `?client_user_id=${encodeURIComponent(clientUserId)}`
      : "";
    return authed<{ certificates: Certificate[]; count: number }>(
      `/api/certificates${qs}`,
    );
  },
  certificateDownloadUrl: (certId: string) =>
    apiUrl(`/api/certificates/download/${encodeURIComponent(certId)}`),

  // ── Instrument photos ───────────────────────────────────────────────
  instrumentPhotos: (hw: string) =>
    authed<{ photos: { id: string; url: string; caption?: string }[] }>(
      `/api/instrument-photos/${encodeURIComponent(hw)}`,
    ),

  // ── Reports (analytics dashboards) — extras beyond legacy ones above ─
  flowVsLevel: (hardware_id: string, days: number = 7) =>
    authed<{ points: FlowVsLevelPoint[] }>(
      `/api/reports/flow-vs-level?hardware_id=${encodeURIComponent(hardware_id)}&days=${days}`,
    ),

  // ── Customer profile ────────────────────────────────────────────────
  customerProfile: () => authed<CustomerProfile>("/api/customer-profile"),

  // ── Water quality reports (POST — CSV/PDF binary download) ──────────
  waterQualityReportUrl: () => apiUrl("/api/water-quality/report"),
  waterQualityHistory: (hw: string, from: string, to: string) =>
    authed<{ hardware_id: string; readings: WaterQualityReading[] }>(
      `/api/water-quality/history/${encodeURIComponent(hw)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  // ── Notifications / alert histories ─────────────────────────────────
  doAlertHistory: () =>
    authed<{ alerts: AlertEntry[] }>("/api/notifications/do-alerts/history"),
  chlorineAlertHistory: () =>
    authed<{ alerts: AlertEntry[] }>(
      "/api/notifications/chlorine-alerts/history",
    ),
};

// ── Client OTP recovery (public, unauthenticated) ─────────────────────
export async function requestClientRecoveryOtp(email: string) {
  return request<{ ok: boolean; message?: string }>(
    "/api/auth/client-recovery/request-otp",
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export async function verifyClientRecoveryOtp(
  email: string,
  otp: string,
  new_password: string,
) {
  return request<{ ok: boolean; message?: string }>(
    "/api/auth/client-recovery/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password }),
    },
  );
}

// ---------- Our own backend (push relay + email) ----------
export async function registerPushOnBackend(body: {
  user_id: string;
  platform: string;
  device_token: string;
  envirolytics_token?: string;
  email?: string;
  full_name?: string;
  role?: string;
}) {
  if (!OWN_BACKEND_URL) throw new Error("EXPO_PUBLIC_BACKEND_URL not set");
  const res = await fetch(`${OWN_BACKEND_URL}/api/register-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`register-push HTTP ${res.status}`);
  }
  return res.json();
}

export async function unregisterPushOnBackend(user_id: string) {
  if (!OWN_BACKEND_URL) return;
  try {
    await fetch(`${OWN_BACKEND_URL}/api/unregister-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id }),
    });
  } catch {
    /* best effort */
  }
}

export type EmailKind =
  | "flowmeter_csv"
  | "flowmeter_pdf"
  | "dwlr_csv"
  | "dwlr_pdf";

async function ownBackend<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  if (!OWN_BACKEND_URL) throw new Error("EXPO_PUBLIC_BACKEND_URL not set");
  const res = await fetch(`${OWN_BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail =
      (body && (body.detail || body.message)) || `HTTP ${res.status}`;
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    );
  }
  return body as T;
}

export async function emailReport(body: {
  recipient: string;
  envirolytics_token: string;
  kinds: EmailKind[];
  hardware_id?: string;
  days?: number;
  subject?: string;
  note?: string;
}) {
  return ownBackend<{ status: string; recipient: string; count: number }>(
    "/api/email-report",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function setEmailSubscription(body: {
  user_id: string;
  email: string;
  envirolytics_token: string;
  full_name?: string;
  weekly: boolean;
  monthly: boolean;
}) {
  return ownBackend<{ status: string; weekly: boolean; monthly: boolean }>(
    "/api/email-subscriptions",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function getEmailSubscription(user_id: string) {
  return ownBackend<{ weekly: boolean; monthly: boolean; email?: string }>(
    `/api/email-subscriptions/${encodeURIComponent(user_id)}`,
    { method: "GET" },
  );
}

export async function getAuthToken() {
  return storage.secureGet<string>(TOKEN_KEY, "");
}
