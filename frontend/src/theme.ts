// Envirolytics Monitor mobile theme (dark-first, matches web app).
export const colors = {
  bg: "#1a2332",
  bgElevated: "#243042",
  surface: "#2a384d",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.18)",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  water: "#0ea5e9",
  eco: "#10B981",
  ecoDark: "#059669",
  danger: "#EF4444",
  warning: "#F59E0B",
  online: "#10B981",
  offline: "#64748B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const font = {
  // System fonts; use monospace for numerals to match the "JetBrains Mono" spec.
  mono: "monospace" as const,
};

// Envirolytics API base URL. Reads from EXPO_PUBLIC_ENVIROLYTICS_URL so we
// can point to staging / production per-deployment without a rebuild.
export const API_BASE =
  process.env.EXPO_PUBLIC_ENVIROLYTICS_URL || "https://monitor.envirolytics.in";
