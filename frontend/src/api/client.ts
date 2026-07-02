import { storage } from "@/src/utils/storage";
import { API_BASE } from "@/src/theme";

export const TOKEN_KEY = "envirolytics.token";
export const USER_KEY = "envirolytics.user";

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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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

export type Weather = {
  main?: { temp?: number; humidity?: number; feels_like?: number };
  weather?: { main?: string; description?: string; icon?: string }[];
  wind?: { speed?: number };
  name?: string;
  rain?: Record<string, number>;
};

// ---------- Endpoints ----------
export const api = {
  me: () => authed<UserProfile>("/api/auth/me"),
  instruments: () =>
    authed<{ instruments: Instrument[] }>("/api/instrument-registry"),
  latestAll: () =>
    authed<{ by_type: Record<string, any[]>; total: number }>(
      "/api/instruments/all/latest",
    ),
  dwlrLatest: () =>
    authed<{ readings: DwlrReading[]; count: number }>(
      "/api/instruments/dwlr/latest",
    ),
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
};
