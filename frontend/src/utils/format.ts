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
  const key = t.toLowerCase();
  if (key === "dwlr") return "DWLR";
  if (key === "flowmeter") return "Flowmeter";
  if (key === "ph") return "pH Sensor";
  if (key === "tds") return "TDS";
  if (key === "conductivity") return "Conductivity";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Central metadata for every instrument type — icon, colour, and default unit.
// Used by Devices tab, device-detail, and the new Water-Quality screen so we
// stay consistent as more instrument types are added upstream.
export const INSTRUMENT_META: Record<
  string,
  { icon: any; color: string; label: string; unit: string; primaryKeys: string[] }
> = {
  dwlr: {
    icon: "water-outline",
    color: "#0ea5e9",
    label: "DWLR",
    unit: "m",
    primaryKeys: ["water_level", "level", "depth", "LVL", "RAW", "D_SEN"],
  },
  flowmeter: {
    icon: "speedometer-outline",
    color: "#10b981",
    label: "Flowmeter",
    // NEW: web uses m³/h everywhere; lph / lpm are deprecated + hidden.
    unit: "m³/h",
    primaryKeys: [
      "flow_rate_m3h",
      "flow_rate",
      "rate",
      "flow",
      "flowrate",
    ],
  },
  ph: {
    icon: "flask-outline",
    color: "#a855f7", // purple — matches pH scale gradient
    label: "pH Sensor",
    unit: "pH",
    primaryKeys: ["ph", "PH", "value", "reading"],
  },
  tds: {
    icon: "beaker-outline",
    color: "#f59e0b", // amber — dissolved solids
    label: "TDS",
    unit: "ppm",
    primaryKeys: ["tds", "TDS", "value", "reading"],
  },
  conductivity: {
    icon: "pulse-outline",
    color: "#22d3ee", // cyan
    label: "Conductivity",
    unit: "µS/cm",
    primaryKeys: ["conductivity", "CONDUCTIVITY", "ec", "EC", "value", "reading"],
  },
};

export function instrumentMeta(type?: string | null) {
  return INSTRUMENT_META[(type || "").toLowerCase()] || {
    icon: "hardware-chip-outline",
    color: "#94a3b8",
    label: prettyType(type),
    unit: "",
    primaryKeys: ["value", "reading"],
  };
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
  // Flowmeter — the web app now standardises on m³/h ONLY, with 3 decimals.
  // We still list lph/lpm as fallbacks in case an old device reports them.
  flowRate: [
    "flow_rate_m3h",                            // preferred
    "flow_rate", "rate", "flow", "flowrate",
    "flow_rate_lph", "flow_rate_lpm",           // legacy — should be m³/h from now on
  ],
  // Totalizer — the web renamed initial/final -> totaliser_start/end. Live MQTT
  // still emits `forward_totalizer` = the cumulative end reading.
  totalizer: [
    "totaliser_end_reading",                    // preferred end reading
    "totaliser_start_reading",
    "forward_totalizer",                        // live MQTT cumulative
    "totalizer", "totaliser", "cumulative_flow", "total",
    "final_forward_totalizer",                  // legacy
    "initial_forward_totalizer",                // legacy
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
