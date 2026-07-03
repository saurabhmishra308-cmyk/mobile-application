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

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { LineChart } from "@/src/components/LineChart";
import { api, Instrument, EmailKind } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing, font } from "@/src/theme";
import { fmtNum } from "@/src/utils/format";
import { downloadAndShare } from "@/src/utils/download";
import { EmailReportSheet } from "@/src/components/EmailReportSheet";

const RANGE_OPTIONS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

export default function ReportsScreen() {
  const { user, signOut } = useAuth();
  const [days, setDays] = useState<number>(7);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [consumption, setConsumption] = useState<{
    borewells: { hardware_id: string; label: string; consumption_kl: number }[];
    grand_total_kl: number;
  } | null>(null);
  const [selectedFm, setSelectedFm] = useState<string | null>(null);
  const [pumping, setPumping] = useState<
    { hour_label: string; start: string; pumped_kl: number; level_m: number | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<null | "csv-fm" | "csv-dwlr" | "pdf-fm" | "pdf-dwlr">(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailInitialKinds, setEmailInitialKinds] = useState<EmailKind[]>([
    "flowmeter_csv",
    "flowmeter_pdf",
  ]);

  const flowmeters = useMemo(
    () => instruments.filter((i) => i.instrument_type === "flowmeter"),
    [instruments],
  );

  const load = useCallback(
    async (d: number = days, fmHw?: string) => {
      try {
        const [insRes, consumRes] = await Promise.all([
          api.instruments(),
          api.borewellConsumption(d),
        ]);
        setInstruments(insRes.instruments || []);
        setConsumption({
          borewells: (consumRes.borewells || []).filter(
            (b) => b.hardware_id && b.hardware_id !== "nan",
          ),
          grand_total_kl: consumRes.grand_total_kl || 0,
        });

        const pickedFm =
          fmHw ||
          selectedFm ||
          (insRes.instruments || []).find((i) => i.instrument_type === "flowmeter")
            ?.hardware_id ||
          null;
        setSelectedFm(pickedFm);
        if (pickedFm) {
          const pump = await api.hourlyPumpingVsLevel(pickedFm, 24);
          setPumping(pump.series || []);
        } else {
          setPumping([]);
        }
      } catch (e: any) {
        if (e?.status === 401) await signOut();
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days, selectedFm, signOut],
  );

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(days, selectedFm || undefined);
  }, [load, days, selectedFm]);

  const chartPoints = useMemo(
    () =>
      pumping
        .map((p) => ({
          t: new Date(p.start).getTime(),
          v: Number(p.pumped_kl) || 0,
        }))
        .filter((p) => !Number.isNaN(p.t)),
    [pumping],
  );
  const totalPumped = useMemo(
    () => pumping.reduce((acc, p) => acc + (Number(p.pumped_kl) || 0), 0),
    [pumping],
  );

  const runDownload = useCallback(
    async (
      kind: "csv-fm" | "csv-dwlr" | "pdf-fm" | "pdf-dwlr",
    ) => {
      setDownloading(kind);
      setDownloadNote(null);
      const [format, type] = kind.split("-") as ["csv" | "pdf", "fm" | "dwlr"];
      const instrument_type = type === "fm" ? "flowmeter" : "dwlr";
      const url = api.exportUrl({ instrument_type, format, days });
      const filename = `envirolytics_${instrument_type}_${format === "csv" ? "data" : "report"}_${
        new Date().toISOString().slice(0, 10)
      }.${format}`;
      const mime = format === "csv" ? "text/csv" : "application/pdf";
      const res = await downloadAndShare({ url, filename, mime });
      if ("error" in res) setDownloadNote(`Download failed: ${res.error}`);
      else setDownloadNote(`Saved ${res.filename}`);
      setDownloading(null);
    },
    [days],
  );

  return (
    <View style={styles.safe} testID="reports-screen">
      <ScreenHeader
        eyebrow="COMPLIANCE"
        title="Reports"
        right={
          <View style={styles.rangeWrap}>
            {RANGE_OPTIONS.map((r) => {
              const active = days === r.days;
              return (
                <TouchableOpacity
                  key={r.days}
                  testID={`range-${r.days}`}
                  onPress={() => setDays(r.days)}
                  style={[
                    styles.rangeChip,
                    active && {
                      backgroundColor: "rgba(16,185,129,0.15)",
                      borderColor: colors.eco,
                    },
                  ]}
                >
                  <Text
                    style={[styles.rangeChipText, active && { color: colors.eco }]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        }
      />

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
          {/* Borewell consumption */}
          <View style={styles.card} testID="consumption-card">
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardEyebrow}>GROUNDWATER</Text>
                <Text style={styles.cardTitle}>Borewell Consumption · Last {days}d</Text>
              </View>
              <View style={styles.totalPill}>
                <Text style={styles.totalPillLabel}>TOTAL</Text>
                <Text style={styles.totalPillValue}>
                  {fmtNum(consumption?.grand_total_kl, 2)}
                </Text>
                <Text style={styles.totalPillUnit}>KL</Text>
              </View>
            </View>
            {consumption && consumption.borewells.length > 0 ? (
              consumption.borewells.map((b) => (
                <View
                  key={b.hardware_id}
                  style={styles.consumRow}
                  testID={`consum-row-${b.hardware_id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.consumLabel}>{b.label || b.hardware_id}</Text>
                    <Text style={styles.consumSub}>{b.hardware_id}</Text>
                  </View>
                  <View style={styles.consumMetric}>
                    <Text style={styles.consumValue}>{fmtNum(b.consumption_kl, 2)}</Text>
                    <Text style={styles.consumUnit}>KL</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No borewell consumption recorded yet.</Text>
            )}
          </View>

          {/* Hourly pumping trend */}
          <View style={styles.card} testID="pumping-card">
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>OPERATIONS</Text>
                <Text style={styles.cardTitle}>Hourly Pumping · Last 24h</Text>
              </View>
            </View>
            {flowmeters.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.fmChipRow}
              >
                {flowmeters.map((f) => {
                  const active = selectedFm === f.hardware_id;
                  return (
                    <TouchableOpacity
                      key={f.hardware_id}
                      testID={`select-fm-${f.hardware_id}`}
                      onPress={() => {
                        setSelectedFm(f.hardware_id);
                        load(days, f.hardware_id);
                      }}
                      style={[
                        styles.fmChip,
                        active && {
                          backgroundColor: "rgba(16,185,129,0.15)",
                          borderColor: colors.eco,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.fmChipText,
                          active && { color: colors.eco },
                        ]}
                        numberOfLines={1}
                      >
                        {f.label || f.hardware_id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <LineChart
              points={chartPoints}
              color={colors.eco}
              height={170}
              unit=" KL"
              testID="pumping-chart"
            />
            <Text style={styles.chartFooter}>
              Total pumped · {fmtNum(totalPumped, 2)} KL over {pumping.length}h
            </Text>
          </View>

          {/* Downloads */}
          <View style={styles.card} testID="downloads-card">
            <Text style={styles.cardEyebrow}>DOWNLOAD DATA · PRO</Text>
            <Text style={styles.cardTitle}>Compliance Exports</Text>
            <Text style={styles.subText}>
              Server-generated files. Share to email, WhatsApp, or save to Files.
            </Text>

            <View style={styles.downloadGrid}>
              <DownloadButton
                testID="dl-fm-csv"
                icon="document-text-outline"
                label="Flowmeter · CSV"
                helper="Excel-ready"
                busy={downloading === "csv-fm"}
                onPress={() => runDownload("csv-fm")}
              />
              <DownloadButton
                testID="dl-fm-pdf"
                icon="document-attach-outline"
                label="Flowmeter · PDF"
                helper="Board-ready"
                busy={downloading === "pdf-fm"}
                onPress={() => runDownload("pdf-fm")}
              />
              <DownloadButton
                testID="dl-dwlr-csv"
                icon="water-outline"
                label="DWLR · CSV"
                helper="Excel-ready"
                busy={downloading === "csv-dwlr"}
                onPress={() => runDownload("csv-dwlr")}
              />
              <DownloadButton
                testID="dl-dwlr-pdf"
                icon="document-attach-outline"
                label="DWLR · PDF"
                helper="Board-ready"
                busy={downloading === "pdf-dwlr"}
                onPress={() => runDownload("pdf-dwlr")}
              />
            </View>
            {downloadNote ? (
              <Text style={styles.dlNote} testID="download-note">
                {downloadNote}
              </Text>
            ) : null}

            <TouchableOpacity
              testID="reports-email-button"
              style={styles.emailBtn}
              activeOpacity={0.85}
              onPress={() => {
                setEmailInitialKinds([
                  "flowmeter_csv",
                  "flowmeter_pdf",
                  "dwlr_csv",
                  "dwlr_pdf",
                ]);
                setEmailOpen(true);
              }}
            >
              <Ionicons name="mail-outline" size={16} color="#fff" />
              <Text style={styles.emailBtnText}>Send report by email</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
      <EmailReportSheet
        visible={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultRecipient={user?.email}
        initialKinds={emailInitialKinds}
        days={days}
        subject={`Envirolytics · ${days}-day compliance report`}
      />
    </View>
  );
}

function DownloadButton({
  icon,
  label,
  helper,
  onPress,
  busy,
  testID,
}: {
  icon: any;
  label: string;
  helper: string;
  onPress: () => void;
  busy?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      style={styles.dlBtn}
      onPress={onPress}
      disabled={busy}
    >
      <View
        style={[
          styles.dlIcon,
          { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.35)" },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.eco} size="small" />
        ) : (
          <Ionicons name={icon} size={18} color={colors.eco} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.dlLabel}>{label}</Text>
        <Text style={styles.dlHelper}>{helper}</Text>
      </View>
      <Ionicons name="download-outline" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },

  rangeWrap: { flexDirection: "row", gap: 6 },
  rangeChip: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },

  card: {
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  cardEyebrow: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "700",
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: 2 },
  subText: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },

  totalPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.30)",
    alignItems: "center",
  },
  totalPillLabel: {
    color: colors.eco,
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: "700",
  },
  totalPillValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: font.mono,
    letterSpacing: -0.3,
  },
  totalPillUnit: { color: colors.textSecondary, fontSize: 10, fontFamily: font.mono },

  consumRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  consumLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  consumSub: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontFamily: font.mono,
    marginTop: 2,
  },
  consumMetric: { alignItems: "flex-end" },
  consumValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: font.mono,
  },
  consumUnit: { color: colors.textSecondary, fontSize: 10, fontFamily: font.mono },

  fmChipRow: {
    gap: 6,
    paddingBottom: spacing.md,
  },
  fmChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    maxWidth: 180,
  },
  fmChipText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: "700",
  },
  chartFooter: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
    textAlign: "right",
    letterSpacing: 0.4,
  },

  downloadGrid: { gap: 8, marginTop: spacing.md },
  dlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dlIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  dlLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  dlHelper: { color: colors.textMuted, fontSize: 10.5, marginTop: 2 },
  dlNote: {
    color: colors.eco,
    fontSize: 11.5,
    marginTop: spacing.md,
    textAlign: "center",
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
    shadowColor: colors.water,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  emailBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 12 },
});
