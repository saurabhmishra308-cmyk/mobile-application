// Water Quality parameter trend — 24h chart for one parameter (STP / DO /
// Chlorine). Not directly served by the upstream today, so we reconstruct a
// series by re-fetching /api/water-quality/latest on a short interval and
// caching what we observe locally for the session. This lets the user see the
// value drift live even before the upstream exposes a proper history endpoint.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LineChart } from "@/src/components/LineChart";
import { StatusPill } from "@/src/components/StatusPill";
import { api, WaterQualityMeta, WaterQualityLatest } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing } from "@/src/theme";
import { fmtNum, fromNow } from "@/src/utils/format";

type Group = "stp" | "do" | "chlorine";

function verdictOf(value: number, meta: WaterQualityMeta): "safe" | "danger" {
  if (Number.isNaN(value)) return "safe";
  const min = meta.min ?? -Infinity;
  const max = meta.max ?? Infinity;
  if (value < min || value > max) return "danger";
  if (meta.safe_min !== undefined && value < meta.safe_min) return "danger";
  if (meta.safe_max !== undefined && value > meta.safe_max) return "danger";
  return "safe";
}

export default function ParamTrend() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { group, param } = useLocalSearchParams<{ group: Group; param: string }>();
  const g = String(group || "stp") as Group;
  const p = String(param || "");

  const [meta, setMeta] = useState<WaterQualityMeta | null>(null);
  const [seriesPoints, setSeriesPoints] = useState<{ t: number; v: number }[]>([]);
  const [latestValue, setLatestValue] = useState<number | null>(null);
  const [latestTs, setLatestTs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastValueRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data: WaterQualityLatest = await api.waterQualityLatest();
      const metaMap =
        g === "stp"
          ? data.stp_params_meta
          : g === "do"
            ? data.do_params_meta
            : data.chlorine_params_meta;
      const readings =
        g === "stp" ? data.stp : g === "do" ? data.do : data.chlorine;
      setMeta(metaMap?.[p] || null);
      const latest = readings?.[0];
      const ts = latest?.timestamp || latest?.ts || null;
      setLatestTs(ts);
      const raw = latest?.[p];
      const n = raw !== undefined && raw !== null ? Number(raw) : NaN;
      if (!Number.isNaN(n)) {
        setLatestValue(n);
        // Only append to series if the value has changed OR we have no history yet.
        if (lastValueRef.current !== n || seriesPoints.length === 0) {
          lastValueRef.current = n;
          const stamp = ts ? new Date(ts).getTime() : Date.now();
          setSeriesPoints((prev) => {
            const next = [...prev, { t: stamp, v: n }];
            // keep last 24h
            const cutoff = Date.now() - 24 * 3600 * 1000;
            return next.filter((pt) => pt.t >= cutoff).slice(-500);
          });
        }
      } else {
        setLatestValue(null);
      }
    } catch (e: any) {
      if (e?.status === 401) {
        await signOut();
        return;
      }
      setError(e?.message || "Failed to load trend.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [g, p, seriesPoints.length, signOut]);

  useEffect(() => {
    load();
    // Poll every 60s to keep the trend fresh.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const verdict = useMemo<"safe" | "danger" | "unknown">(() => {
    if (latestValue === null || !meta) return "unknown";
    return verdictOf(latestValue, meta);
  }, [latestValue, meta]);

  const chartWidth = 340; // works for both phones + tablets
  const chartColor = verdict === "danger" ? colors.danger : colors.eco;

  return (
    <View style={styles.safe} testID="wq-trend-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          testID="wq-trend-back"
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{g.toUpperCase()} · TREND</Text>
          <Text style={styles.title} numberOfLines={1}>
            {p}
          </Text>
        </View>
        <StatusPill
          label={
            verdict === "unknown" ? "No data" : verdict === "danger" ? "Alert" : "Safe"
          }
          variant={
            verdict === "unknown" ? "warning" : verdict === "danger" ? "alert" : "online"
          }
          testID="wq-trend-verdict"
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.eco} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.eco}
            />
          }
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" color={colors.warning} size={16} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Current</Text>
                <View style={styles.valueRow}>
                  <Text style={[styles.valueText, verdict === "danger" && { color: colors.danger }]}>
                    {latestValue === null ? "—" : fmtNum(latestValue, 2)}
                  </Text>
                  <Text style={styles.valueUnit}>{meta?.unit_default || ""}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.summaryLabel}>Updated</Text>
                <Text style={styles.summaryValue}>
                  {latestTs ? fromNow(latestTs) : "—"}
                </Text>
              </View>
            </View>
            {meta ? (
              <View style={styles.safeBand}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.safeText}>
                  Safe range
                  {meta.safe_min !== undefined ? ` ≥ ${fmtNum(meta.safe_min, 2)}` : ""}
                  {meta.safe_max !== undefined ? ` ≤ ${fmtNum(meta.safe_max, 2)}` : ""}
                  {meta.unit_default ? ` ${meta.unit_default}` : ""}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartHead}>
              <View>
                <Text style={styles.chartEyebrow}>LAST 24 HOURS</Text>
                <Text style={styles.chartTitle}>{p}</Text>
              </View>
              <Text style={styles.chartMeta}>
                {seriesPoints.length} pts · live
              </Text>
            </View>
            <LineChart
              testID="wq-trend-chart"
              points={seriesPoints}
              color={chartColor}
              width={chartWidth}
              height={200}
              unit={meta?.unit_default ? ` ${meta.unit_default}` : ""}
            />
            {seriesPoints.length === 0 ? (
              <Text style={styles.emptyChart}>
                Waiting for the first reading… trend will build as data arrives.
              </Text>
            ) : null}
          </View>

          <View style={styles.footerCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>
              Series is refreshed live from the Envirolytics compliance server every 60 s.
              For a permanent audit trail, download the daily CSV / PDF export from the
              Reports tab.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: { color: colors.textSecondary, fontSize: 10.5, letterSpacing: 2, fontWeight: "700" },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },

  errorBanner: {
    flexDirection: "row",
    gap: 8,
    padding: spacing.md,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.3)",
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
  },
  errorText: { color: colors.warning, fontSize: 12, flex: 1 },

  summaryCard: {
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 1.4,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: { color: colors.text, fontSize: 13, fontFamily: font.mono },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  valueText: { color: colors.text, fontSize: 32, fontWeight: "800", fontFamily: font.mono },
  valueUnit: { color: colors.textSecondary, fontSize: 12, fontFamily: font.mono },

  safeBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  safeText: { color: colors.textSecondary, fontSize: 12 },

  chartCard: {
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  chartEyebrow: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "700",
  },
  chartTitle: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: 2 },
  chartMeta: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 1,
  },
  emptyChart: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: spacing.md },

  footerCard: {
    flexDirection: "row",
    gap: 8,
    padding: spacing.md,
    backgroundColor: "rgba(14,165,233,0.06)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.22)",
    alignItems: "flex-start",
  },
  footerText: { color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 17 },
});
