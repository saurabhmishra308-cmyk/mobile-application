// Water Quality tab — surfaces the latest STP / DO / Chlorine parameters from
// monitor.envirolytics.in/api/water-quality/latest with red/green safety pills
// based on `safe_min`/`safe_max` thresholds returned by the upstream.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StatusPill } from "@/src/components/StatusPill";
import { api, WaterQualityLatest, WaterQualityMeta } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing, font } from "@/src/theme";
import { fmtNum, fromNow } from "@/src/utils/format";

type Group = "stp" | "do" | "chlorine";

const GROUP_META: Record<
  Group,
  { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  stp: {
    title: "STP Effluent",
    subtitle: "COD · BOD · TSS · pH · Turbidity · Chlorine",
    icon: "flask-outline",
    color: "#0ea5e9",
  },
  do: {
    title: "Dissolved Oxygen",
    subtitle: "DO tanks · aeration temperature · saturation",
    icon: "cellular-outline",
    color: "#10b981",
  },
  chlorine: {
    title: "Chlorine Dosing",
    subtitle: "Residual chlorine · dose set-point",
    icon: "water-outline",
    color: "#a855f7",
  },
};

// Return "safe" | "warning" | "danger" based on a reading vs. thresholds.
function evaluate(value: number, meta: WaterQualityMeta): "safe" | "warning" | "danger" {
  if (Number.isNaN(value)) return "warning";
  const sMin = meta.safe_min;
  const sMax = meta.safe_max;
  const min = meta.min ?? -Infinity;
  const max = meta.max ?? Infinity;
  // Below sensor range or clearly out-of-band → danger.
  if (value < min || value > max) return "danger";
  if (sMin !== undefined && value < sMin) return "danger";
  if (sMax !== undefined && value > sMax) return "danger";
  // Within "safe" band with some slack considered normal.
  if (sMin !== undefined || sMax !== undefined) return "safe";
  return "safe";
}

function prettyParam(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/\b(\w)/g, (m) => m.toUpperCase())
    .replace("Do", "DO")
    .replace("Ph", "pH")
    .replace("Bod", "BOD")
    .replace("Cod", "COD")
    .replace("Tss", "TSS");
}

export default function WaterQualityScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [data, setData] = useState<WaterQualityLatest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<Group, boolean>>({
    stp: true,
    do: true,
    chlorine: true,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.waterQualityLatest();
      setData(res);
    } catch (e: any) {
      if (e?.status === 401) {
        await signOut();
        return;
      }
      setError(e?.message || "Failed to load water quality readings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Flatten latest reading per group into { param, value, meta, verdict } rows.
  const rows = useMemo(() => {
    if (!data) return { stp: [], do: [], chlorine: [] } as Record<Group, any[]>;
    const build = (readings: any[], meta: Record<string, WaterQualityMeta>) => {
      const latest = readings?.[0]; // upstream returns array; first entry is newest
      const out: {
        param: string;
        value: number | null;
        unit: string;
        verdict: "safe" | "warning" | "danger" | "unknown";
        safe_min?: number;
        safe_max?: number;
      }[] = [];
      for (const [param, m] of Object.entries(meta || {})) {
        const raw = latest?.[param];
        const num = raw !== undefined && raw !== null ? Number(raw) : NaN;
        const known = !Number.isNaN(num);
        out.push({
          param,
          value: known ? num : null,
          unit: m.unit_default || "",
          verdict: known ? evaluate(num, m) : "unknown",
          safe_min: m.safe_min,
          safe_max: m.safe_max,
        });
      }
      return out;
    };
    return {
      stp: build(data.stp, data.stp_params_meta),
      do: build(data.do, data.do_params_meta),
      chlorine: build(data.chlorine, data.chlorine_params_meta),
    };
  }, [data]);

  const summary = useMemo(() => {
    const all = [...rows.stp, ...rows.do, ...rows.chlorine];
    const withValues = all.filter((r) => r.value !== null);
    return {
      total: all.length,
      reporting: withValues.length,
      alerting: withValues.filter((r) => r.verdict === "danger").length,
    };
  }, [rows]);

  const groupTimestamp: Record<Group, string | null> = useMemo(() => {
    if (!data) return { stp: null, do: null, chlorine: null };
    return {
      stp: data.stp?.[0]?.timestamp || data.stp?.[0]?.ts || null,
      do: data.do?.[0]?.timestamp || data.do?.[0]?.ts || null,
      chlorine: data.chlorine?.[0]?.timestamp || data.chlorine?.[0]?.ts || null,
    };
  }, [data]);

  return (
    <View style={styles.safe} testID="water-quality-screen">
      <ScreenHeader
        eyebrow="COMPLIANCE"
        title="Water Quality"
        right={
          <View style={styles.summary}>
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: colors.eco }]} />
              <Text style={styles.summaryText}>{summary.reporting}/{summary.total}</Text>
            </View>
            {summary.alerting > 0 ? (
              <View style={[styles.summaryChip, { borderColor: colors.danger, backgroundColor: "rgba(239,68,68,0.08)" }]}>
                <View style={[styles.summaryDot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.summaryText, { color: colors.danger }]}>{summary.alerting}</Text>
              </View>
            ) : null}
          </View>
        }
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.eco} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.eco}
            />
          }
        >
          {error ? (
            <View style={styles.errorBanner} testID="wq-error">
              <Ionicons name="warning-outline" color={colors.warning} size={16} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {(["stp", "do", "chlorine"] as Group[]).map((g) => {
            const meta = GROUP_META[g];
            const items = rows[g];
            const ts = groupTimestamp[g];
            const active = expanded[g];
            const alertingCount = items.filter((r) => r.verdict === "danger").length;

            return (
              <View key={g} style={styles.group} testID={`wq-group-${g}`}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.groupHead}
                  onPress={() => setExpanded((prev) => ({ ...prev, [g]: !prev[g] }))}
                  testID={`wq-group-toggle-${g}`}
                >
                  <View
                    style={[
                      styles.groupIcon,
                      { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}55` },
                    ]}
                  >
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>{meta.title}</Text>
                    <Text style={styles.groupSub}>
                      {ts ? `Updated ${fromNow(ts)} · ` : "No reading yet · "}
                      {meta.subtitle}
                    </Text>
                  </View>
                  {alertingCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{alertingCount}</Text>
                    </View>
                  ) : null}
                  <Ionicons
                    name={active ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {active ? (
                  <View style={styles.itemsGrid}>
                    {items.length === 0 ? (
                      <Text style={styles.empty}>No parameters configured upstream.</Text>
                    ) : (
                      items.map((r) => {
                        const isDanger = r.verdict === "danger";
                        const isUnknown = r.verdict === "unknown";
                        return (
                          <View
                            key={r.param}
                            style={[
                              styles.itemCard,
                              isDanger && { borderColor: "rgba(239, 68, 68, 0.55)", backgroundColor: "rgba(239, 68, 68, 0.05)" },
                            ]}
                            testID={`wq-item-${g}-${r.param}`}
                          >
                            <View style={styles.itemHead}>
                              <Text style={styles.itemName} numberOfLines={1}>
                                {prettyParam(r.param)}
                              </Text>
                              <StatusPill
                                testID={`wq-verdict-${g}-${r.param}`}
                                label={
                                  isUnknown
                                    ? "No data"
                                    : isDanger
                                      ? "Alert"
                                      : "Safe"
                                }
                                variant={
                                  isUnknown ? "warning" : isDanger ? "alert" : "online"
                                }
                              />
                            </View>
                            <View style={styles.itemValueRow}>
                              <Text style={[styles.itemValue, isDanger && { color: colors.danger }]}>
                                {r.value === null ? "—" : fmtNum(r.value, r.param.toLowerCase() === "ph" ? 2 : 2)}
                              </Text>
                              <Text style={styles.itemUnit}>{r.unit}</Text>
                            </View>
                            {(r.safe_min !== undefined || r.safe_max !== undefined) ? (
                              <Text style={styles.itemThresh}>
                                Safe
                                {r.safe_min !== undefined ? ` ≥ ${fmtNum(r.safe_min, 2)}` : ""}
                                {r.safe_max !== undefined ? ` ≤ ${fmtNum(r.safe_max, 2)}` : ""}
                                {r.unit ? ` ${r.unit}` : ""}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={styles.footerCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>
              Thresholds are read live from the Envirolytics compliance server. Values outside
              `safe_min` / `safe_max` are highlighted for CGWA / CPCB reporting.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summary: { flexDirection: "row", gap: 6 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  summaryDot: { width: 6, height: 6, borderRadius: 3 },
  summaryText: {
    color: colors.text,
    fontSize: 11,
    fontFamily: font.mono,
    fontWeight: "700",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.3)",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  errorText: { color: colors.warning, fontSize: 12, flex: 1 },

  group: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  groupSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "rgba(239, 68, 68, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.danger, fontSize: 11, fontFamily: font.mono, fontWeight: "800" },

  itemsGrid: {
    padding: spacing.md,
    paddingTop: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  itemCard: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 140,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 6,
  },
  itemName: { color: colors.textSecondary, fontSize: 11, letterSpacing: 0.4, fontWeight: "800", flex: 1 },
  itemValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  itemValue: { color: colors.text, fontSize: 20, fontWeight: "800", fontFamily: font.mono },
  itemUnit: { color: colors.textSecondary, fontSize: 11, fontFamily: font.mono },
  itemThresh: { color: colors.textMuted, fontSize: 10.5, marginTop: 4, letterSpacing: 0.3 },
  empty: { color: colors.textMuted, fontSize: 12, padding: spacing.md },

  footerCard: {
    flexDirection: "row",
    gap: 8,
    padding: spacing.md,
    backgroundColor: "rgba(14,165,233,0.06)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.22)",
    alignItems: "flex-start",
    marginTop: spacing.sm,
  },
  footerText: { color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 17 },
});
