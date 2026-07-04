// Format helpers for the mobile app.
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function fromNow(iso?: string | null): string {
  if (!iso) return "Never";
  const d = dayjs(iso);
  if (!d.isValid()) return "—";
  return d.fromNow();
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = dayjs(iso);
  if (!d.isValid()) return "—";
  return d.format("DD MMM YYYY, HH:mm");
}

export function fmtNum(v: unknown, digits = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function prettyType(t?: string | null): string {
  if (!t) return "Instrument";
  if (t === "dwlr") return "DWLR";
  if (t === "flowmeter") return "Flowmeter";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function prettyCategory(c?: string | null): string {
  if (!c) return "—";
  return c
    .split(/[_\s-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function pickReadingValue(r: Record<string, any>, keys: string[]): number | null {
  for (const k of keys) {
    const v = r?.[k];
    if (v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return null;
}

// New DWLR firmware sends a compact "YYMMDDHHmmss" string (e.g. "260703135219").
// Detect + convert to ISO so downstream chart / fromNow work uniformly.
function _parseFirmwareTs(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12) return null;
  const yy = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const HH = digits.slice(6, 8);
  const MM = digits.slice(8, 10);
  const SS = digits.slice(10, 12);
  const year = 2000 + Number(yy);
  const iso = `${year}-${mm}-${dd}T${HH}:${MM}:${SS}+05:30`; // device is India-local
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function readingTs(r: Record<string, any>): string | null {
  const direct =
    r?.timestamp || r?.ts || r?.received_at || r?.time || r?.created_at;
  if (direct) return String(direct);
  // Firmware-native field name is TIME (uppercase, YYMMDDHHmmss).
  const fw = _parseFirmwareTs(r?.TIME);
  if (fw) return fw;
  return null;
}

// Central catalogue of reading-field aliases so mobile stays forward-compatible
// with any new DWLR / flowmeter firmware that renames columns.
export const READING_KEYS = {
  waterLevel: [
    "water_level", "level", "depth",           // legacy
    "LVL", "RAW", "D_SEN",                      // firmware v2
  ],
  waterTemp: [
    "water_temperature", "wtemp", "temperature", "temp",
    "WTEMP", "ATEMP",                           // firmware v2 (ATEMP = ambient)
  ],
  battery: [
    "battery", "battery_v", "bat", "voltage",
    "BVOLT",                                    // firmware v2
  ],
  signal: [
    "signal", "rssi", "signal_strength",
    "SIGNAL",                                   // firmware v2
  ],
  flowRate: [
    "flow_rate", "rate", "flow", "flowrate",
  ],
  totalizer: [
    "totalizer", "totaliser", "cumulative_flow", "total",
  ],
} as const;

// Firmware diagnostic string fields — displayed as-is in device detail.
export const DIAGNOSTIC_STRING_KEYS: { key: string; label: string }[] = [
  { key: "VER", label: "Firmware" },
  { key: "HVER", label: "Hardware Rev" },
  { key: "IMEI", label: "IMEI" },
  { key: "IMSI", label: "SIM IMSI" },
  { key: "GINT", label: "Global Interval" },
  { key: "SDINT", label: "SD Interval" },
  { key: "P_SEN", label: "Pressure Sensor" },
  { key: "APRES", label: "Atm. Pressure" },
  { key: "E_COM", label: "Comm Error" },
];
