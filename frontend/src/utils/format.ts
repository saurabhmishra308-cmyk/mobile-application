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

export function readingTs(r: Record<string, any>): string | null {
  return (
    r?.timestamp || r?.ts || r?.received_at || r?.time || r?.created_at || null
  );
}
