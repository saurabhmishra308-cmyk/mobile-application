import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusPill } from "@/src/components/StatusPill";
import { LineChart } from "@/src/components/LineChart";
import { api, EmailKind, FlowmeterReading } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing, font } from "@/src/theme";
import {
  fmtDateTime,
  fmtNum,
  fromNow,
  pickReadingValue,
  prettyType,
  readingTs,
} from "@/src/utils/format";
import { downloadAndShare } from "@/src/utils/download";
import { EmailReportSheet } from "@/src/components/EmailReportSheet";

const HOUR_OPTIONS = [6, 24, 72, 168] as const;

export default function DeviceDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { id, type, label, location } = useLocalSearchParams<{
    id: string;
    type?: string;
    label?: string;
    location?: string;
  }>();
  const hardwareId = String(id || "");
  const kind = String(type || "flowmeter"); // fallback

  const [latest, setLatest] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(24);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingKind, setDownloadingKind] = useState<null | "csv" | "pdf">(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const load = useCallback(
    async (hrs: number = hours) => {
      try {
        if (kind === "flowmeter") {
          const [latestRes, histRes, off] = await Promise.all([
            api.flowmeterLatest(),
            api.flowmeterHistory(hardwareId, hrs),
            api.offline(24),
          ]);
          const mine = (latestRes.flowmeters || []).find(
            (r) => r.hardware_id === hardwareId,
          );
          setLatest(mine || null);
          setHistory(histRes.readings || []);
          const o = (off.offline || []).find((d) => d.hardware_id === hardwareId);
          setIsOffline(!!o);
          setLastSeen(o?.last_seen ?? (mine ? readingTs(mine || {}) : null));
        } else {
          // dwlr
          const [latestRes, histRes, off] = await Promise.all([
            api.dwlrLatest(),
            api.dwlrHistory(hardwareId, hrs),
            api.offline(24),
          ]);
          const mine = (latestRes.readings || []).find(
            (r) => r.hardware_id === hardwareId,
          );
          setLatest(mine || null);
          setHistory(histRes.readings || []);
          const o = (off.offline || []).find((d) => d.hardware_id === hardwareId);
          setIsOffline(!!o);
          setLastSeen(o?.last_seen ?? (mine ? readingTs(mine || {}) : null));
        }
      } catch (e: any) {
        if (e?.status === 401) await signOut();
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hardwareId, kind, hours, signOut],
  );

  useEffect(() => {
    load(hours);
  }, [load, hours]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(hours);
  }, [load, hours]);

  const chartData = useMemo(() => {
    if (kind === "flowmeter") {
      return history
        .map((r: FlowmeterReading) => {
          const ts = readingTs(r);
          const v = pickReadingValue(r, ["flow_rate", "rate", "flow", "flowrate"]);
          if (!ts || v === null) return null;
          const t = new Date(ts).getTime();
          if (Number.isNaN(t)) return null;
          return { t, v };
        })
        .filter((p): p is { t: number; v: number } => !!p)
        .sort((a, b) => a.t - b.t);
    }
    // DWLR — plot water level.
    return history
      .map((r: Record<string, any>) => {
        const ts = readingTs(r);
        const v = pickReadingValue(r, ["water_level", "level", "depth"]);
        if (!ts || v === null) return null;
        const t = new Date(ts).getTime();
        if (Number.isNaN(t)) return null;
        return { t, v };
      })
      .filter((p): p is { t: number; v: number } => !!p)
      .sort((a, b) => a.t - b.t);
  }, [history, kind]);

  const chartMeta = useMemo(
    () =>
      kind === "dwlr"
        ? { title: "WATER LEVEL", color: colors.water, unit: " m" }
        : { title: "FLOW RATE", color: colors.eco, unit: " m³/h" },
    [kind],
  );

  const chartWidth = Dimensions.get("window").width - spacing.lg * 2 - spacing.lg * 2;

  const primaryMetrics = useMemo(() => {
    if (!latest) return [];
    if (kind === "flowmeter") {
      return [
        {
          label: "Flow Rate",
          key: "flow",
          value: pickReadingValue(latest, ["flow_rate", "rate", "flow", "flowrate"]),
          unit: "m³/h",
          icon: "speedometer-outline" as const,
          color: colors.eco,
        },
        {
          label: "Totalizer",
          key: "totalizer",
          value: pickReadingValue(latest, [
            "totalizer",
            "totaliser",
            "cumulative_flow",
            "total",
          ]),
          unit: "m³",
          icon: "layers-outline" as const,
          color: colors.water,
        },
        {
          label: "Battery",
          key: "battery",
          value: pickReadingValue(latest, ["battery", "battery_v", "bat"]),
          unit: "V",
          icon: "battery-half-outline" as const,
          color: colors.warning,
        },
      ];
    }
    return [
      {
        label: "Water Level",
        key: "level",
        value: pickReadingValue(latest, ["water_level", "level", "depth"]),
        unit: "m",
        icon: "water-outline" as const,
        color: colors.water,
      },
      {
        label: "Temperature",
        key: "temp",
        value: pickReadingValue(latest, ["temperature", "temp"]),
        unit: "°C",
        icon: "thermometer-outline" as const,
        color: colors.warning,
      },
      {
        label: "Battery",
        key: "battery",
        value: pickReadingValue(latest, ["battery", "battery_v", "bat"]),
        unit: "V",
        icon: "battery-half-outline" as const,
        color: colors.eco,
      },
    ];
  }, [latest, kind]);

  return (
    <View style={styles.safe} testID="device-detail-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          testID="detail-back-button"
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{prettyType(kind).toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {label || hardwareId}
          </Text>
        </View>
        <StatusPill
          label={isOffline ? "Offline" : latest ? "Online" : "Idle"}
          variant={isOffline ? "offline" : latest ? "online" : "warning"}
          testID="detail-status-pill"
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
              onRefresh={onRefresh}
              tintColor={colors.eco}
            />
          }
        >
          <View style={styles.headerCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hwLabel}>Hardware ID</Text>
              <Text style={styles.hwValue} testID="detail-hardware-id">
                {hardwareId}
              </Text>
              {location ? (
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.locText}>{location}</Text>
                </View>
              ) : null}
              <View style={styles.locRow}>
                <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.locText}>
                  Last seen · {lastSeen ? fromNow(lastSeen) : "Never"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            {primaryMetrics.map((m) => (
              <View
                key={m.key}
                style={styles.metricCard}
                testID={`detail-metric-${m.key}`}
              >
                <View
                  style={[
                    styles.metricIcon,
                    { backgroundColor: `${m.color}22`, borderColor: `${m.color}44` },
                  ]}
                >
                  <Ionicons name={m.icon} size={16} color={m.color} />
                </View>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <View style={styles.metricValRow}>
                  <Text style={styles.metricValue}>{fmtNum(m.value, 2)}</Text>
                  <Text style={styles.metricUnit}>{m.unit}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Chart card (flowmeter → flow rate; DWLR → water level) */}
          <View style={styles.chartCard}>
            <View style={styles.chartHead}>
              <View>
                <Text style={styles.chartEyebrow}>{chartMeta.title}</Text>
                <Text style={styles.chartTitle}>Last {hours}h</Text>
              </View>
              <View style={styles.chartTabs}>
                {HOUR_OPTIONS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    testID={`hours-${h}`}
                    onPress={() => setHours(h)}
                    style={[
                      styles.chartTab,
                      hours === h && {
                        backgroundColor: `${chartMeta.color}22`,
                        borderColor: chartMeta.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chartTabText,
                        hours === h && { color: chartMeta.color },
                      ]}
                    >
                      {h < 24 ? `${h}h` : `${h / 24}d`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <LineChart
              testID="detail-chart"
              points={chartData}
              color={chartMeta.color}
              width={chartWidth}
              height={180}
              unit={chartMeta.unit}
            />
            <Text style={styles.chartMeta}>
              {chartData.length} data point{chartData.length === 1 ? "" : "s"}
            </Text>
          </View>

          {/* Download buttons */}
          <View style={styles.chartCard} testID="detail-downloads">
            <Text style={styles.chartEyebrow}>DOWNLOAD DATA</Text>
            <Text style={styles.chartTitle}>Share as CSV or PDF</Text>
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
              <TouchableOpacity
                testID="detail-download-csv"
                style={styles.dlBtn}
                disabled={downloadingKind === "csv"}
                onPress={async () => {
                  setDownloadingKind("csv");
                  setDownloadNote(null);
                  const url = api.exportUrl({
                    instrument_type: kind === "dwlr" ? "dwlr" : "flowmeter",
                    format: "csv",
                    hardware_id: hardwareId,
                  });
                  const filename = `${hardwareId}_${new Date().toISOString().slice(0, 10)}.csv`;
                  const res = await downloadAndShare({ url, filename, mime: "text/csv" });
                  setDownloadNote("error" in res ? `Failed: ${res.error}` : `Saved ${res.filename}`);
                  setDownloadingKind(null);
                }}
              >
                {downloadingKind === "csv" ? (
                  <ActivityIndicator color={colors.eco} size="small" />
                ) : (
                  <Ionicons name="document-text-outline" size={16} color={colors.eco} />
                )}
                <Text style={styles.dlBtnText}>Excel-ready CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="detail-download-pdf"
                style={styles.dlBtn}
                disabled={downloadingKind === "pdf"}
                onPress={async () => {
                  setDownloadingKind("pdf");
                  setDownloadNote(null);
                  const url = api.exportUrl({
                    instrument_type: kind === "dwlr" ? "dwlr" : "flowmeter",
                    format: "pdf",
                    hardware_id: hardwareId,
                  });
                  const filename = `${hardwareId}_${new Date().toISOString().slice(0, 10)}.pdf`;
                  const res = await downloadAndShare({ url, filename, mime: "application/pdf" });
                  setDownloadNote("error" in res ? `Failed: ${res.error}` : `Saved ${res.filename}`);
                  setDownloadingKind(null);
                }}
              >
                {downloadingKind === "pdf" ? (
                  <ActivityIndicator color={colors.water} size="small" />
                ) : (
                  <Ionicons name="document-attach-outline" size={16} color={colors.water} />
                )}
                <Text style={styles.dlBtnText}>Compliance PDF</Text>
              </TouchableOpacity>
            </View>
            {downloadNote ? (
              <Text style={styles.dlNote} testID="detail-download-note">
                {downloadNote}
              </Text>
            ) : null}
            <TouchableOpacity
              testID="detail-email-button"
              style={styles.emailBtn}
              activeOpacity={0.85}
              onPress={() => setEmailOpen(true)}
            >
              <Ionicons name="mail-outline" size={16} color="#fff" />
              <Text style={styles.emailBtnText}>Send by email</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Latest Reading</Text>
            {latest ? (
              <>
                <DetailRow label="Timestamp" value={fmtDateTime(readingTs(latest))} />
                {Object.entries(latest)
                  .filter(
                    ([k, v]) =>
                      !["hardware_id", "timestamp", "ts", "received_at", "created_at"].includes(k) &&
                      v !== null &&
                      v !== undefined &&
                      typeof v !== "object",
                  )
                  .slice(0, 12)
                  .map(([k, v]) => (
                    <DetailRow key={k} label={k} value={String(v)} />
                  ))}
              </>
            ) : (
              <Text style={styles.emptyText}>No readings received yet from this device.</Text>
            )}
          </View>
        </ScrollView>
      )}
      <EmailReportSheet
        visible={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultRecipient={user?.email}
        initialKinds={
          kind === "dwlr"
            ? (["dwlr_csv", "dwlr_pdf"] as EmailKind[])
            : (["flowmeter_csv", "flowmeter_pdf"] as EmailKind[])
        }
        hardwareId={hardwareId}
        subject={`Envirolytics · ${label || hardwareId} report`}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        {label.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}
      </Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
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
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 2,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },

  headerCard: {
    flexDirection: "row",
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hwLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 1.6,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  hwValue: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.mono,
    marginTop: 4,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  locRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  locText: { color: colors.textSecondary, fontSize: 12 },

  metricsGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 1.2,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 6 },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: font.mono,
  },
  metricUnit: { color: colors.textSecondary, fontSize: 11, fontFamily: font.mono },

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
  chartTabs: { flexDirection: "row", gap: 6 },
  chartTab: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  chartTabText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  chartMeta: {
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: spacing.sm,
    letterSpacing: 1,
    textAlign: "right",
  },

  infoCard: {
    flexDirection: "row",
    padding: spacing.lg,
    backgroundColor: "rgba(14,165,233,0.08)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.25)",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  infoText: { color: colors.text, fontSize: 12.5, flex: 1, lineHeight: 18 },

  detailCard: {
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 14,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  detailLabel: { color: colors.textSecondary, fontSize: 12 },
  detailValue: { color: colors.text, fontSize: 12, fontFamily: font.mono, flex: 1, textAlign: "right" },

  emptyText: { color: colors.textMuted, fontSize: 12 },
  dlBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  dlBtnText: { color: colors.text, fontSize: 12.5, fontWeight: "700" },
  dlNote: {
    color: colors.eco,
    fontSize: 11.5,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  emailBtn: {
    marginTop: spacing.md,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.water,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  emailBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },
});
