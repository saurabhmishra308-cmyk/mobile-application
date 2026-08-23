import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StatusPill } from "@/src/components/StatusPill";
import { LiveDeviceCard } from "@/src/components/LiveDeviceCard";
import { HeaderActions } from "@/src/components/HeaderActions";
import { CountUp } from "@/src/components/CountUp";
import { OnlineRing } from "@/src/components/OnlineRing";
import {
  api,
  Instrument,
  LastDataDevice,
  OfflineDevice,
  LimitBreach,
  Weather,
} from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing, font } from "@/src/theme";
import { fmtNum, fromNow, prettyType } from "@/src/utils/format";

const LIVE_POLL_MS = 20_000; // 20s auto-refresh for the home screen

// Time-of-day greeting shown at the top of the Dashboard.
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// Prefer a real given name — if full_name looks like a company (contains
// "Admin", "Envirolytics", "Sustainability") or is missing, fall back to the
// email local-part which is usually the human's identifier.
function friendlyName(fullName?: string | null, email?: string | null): string {
  const first = (fullName || "").split(/\s+/).filter(Boolean)[0];
  const looksLikeCompany = /^(admin|envirolytics|sustainability|test)/i.test(first || "");
  if (first && !looksLikeCompany) return first;
  const local = (email || "").split("@")[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return "there";
}

export default function Dashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [liveDevices, setLiveDevices] = useState<LastDataDevice[]>([]);
  const [offline, setOffline] = useState<OfflineDevice[]>([]);
  const [breaches, setBreaches] = useState<LimitBreach[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [, setBroker] = useState<{ connected: boolean; broker?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [insR, offR, brR, wR, statusR, liveR] = await Promise.allSettled([
        api.instruments(),
        api.offline(24),
        api.limitBreaches(),
        api.weatherLive(),
        api.flowmeterStatus(),
        api.lastData(),
      ]);
      if (insR.status === "fulfilled") setInstruments(insR.value.instruments || []);
      if (offR.status === "fulfilled") setOffline(offR.value.offline || []);
      if (brR.status === "fulfilled") setBreaches(brR.value.breaches || []);
      if (wR.status === "fulfilled") setWeather(wR.value);
      if (statusR.status === "fulfilled") setBroker(statusR.value);
      if (liveR.status === "fulfilled") setLiveDevices(liveR.value.devices || []);

      const failed = [insR, offR, brR, wR, statusR, liveR].find(
        (r) => r.status === "rejected",
      );
      if (failed && failed.status === "rejected") {
        const err = failed.reason as Error & { status?: number };
        if (err.status === 401) {
          await signOut();
          return;
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    load();
    // Auto-refresh the live home screen every 20 seconds.
    const id = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    const total = instruments.length;
    const offlineIds = new Set(offline.map((o) => o.hardware_id));
    const offlineCount = offline.length;
    const onlineCount = Math.max(0, total - offlineIds.size);
    const dwlr = instruments.filter((i) => i.instrument_type === "dwlr").length;
    const fm = instruments.filter((i) => i.instrument_type === "flowmeter").length;
    return { total, onlineCount, offlineCount, dwlr, fm };
  }, [instruments, offline]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScreenHeader eyebrow="ENVIROLYTICS · MONITOR" title="Dashboard" />
        <View style={styles.loading} testID="dashboard-loading">
          <ActivityIndicator color={colors.eco} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe} testID="dashboard-screen">
      <ScreenHeader
        eyebrow={user?.location_name ? `SITE · ${user.location_name.toUpperCase()}` : "ENVIROLYTICS · MONITOR"}
        title={`${greeting()}, ${friendlyName(user?.full_name, user?.email)}`}
        right={
          <HeaderActions
            fullName={user?.full_name || user?.email}
            badgeCount={breaches.length + offline.length}
          />
        }
      />

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
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" color={colors.warning} size={16} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── HERO CARD — animated ring + count-up stats ────────────── */}
        <View style={styles.heroCard} testID="dashboard-hero">
          <LinearGradient
            colors={[
              "rgba(16, 185, 129, 0.16)",
              "rgba(14, 165, 233, 0.08)",
              "rgba(3, 17, 31, 0)",
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.heroLeft}>
            <Text style={styles.heroEyebrow}>NETWORK HEALTH</Text>
            <View style={styles.heroValRow}>
              <CountUp
                value={stats.onlineCount}
                style={styles.heroValue}
                testID="hero-online"
              />
              <Text style={styles.heroSlash}>/</Text>
              <CountUp
                value={stats.total}
                style={styles.heroTotal}
                testID="hero-total"
              />
            </View>
            <Text style={styles.heroSub}>
              instruments reporting to Envirolytics
            </Text>

            {/* Inline mini stats: DWLR / Flowmeter counts + alerts */}
            <View style={styles.miniStats}>
              <View style={styles.miniStat}>
                <View style={[styles.miniDot, { backgroundColor: colors.water }]} />
                <CountUp value={stats.dwlr} style={styles.miniVal} />
                <Text style={styles.miniLbl}>DWLR</Text>
              </View>
              <View style={styles.miniStat}>
                <View style={[styles.miniDot, { backgroundColor: colors.eco }]} />
                <CountUp value={stats.fm} style={styles.miniVal} />
                <Text style={styles.miniLbl}>Flow</Text>
              </View>
              <View style={styles.miniStat}>
                <View style={[styles.miniDot, { backgroundColor: colors.warning }]} />
                <CountUp value={stats.offlineCount} style={styles.miniVal} />
                <Text style={styles.miniLbl}>Offline</Text>
              </View>
              <View style={styles.miniStat}>
                <View style={[styles.miniDot, { backgroundColor: colors.danger }]} />
                <CountUp value={breaches.length} style={styles.miniVal} />
                <Text style={styles.miniLbl}>Alerts</Text>
              </View>
            </View>
          </View>
          <OnlineRing
            online={stats.onlineCount}
            total={stats.total}
            testID="hero-ring"
          />
        </View>

        {/* ── Live Devices — from /api/instrument-registry/last-data ── */}
        {liveDevices.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>Live Data</Text>
              <View style={styles.livePill} testID="dashboard-live-count">
                <View style={styles.livePillDot} />
                <Text style={styles.livePillText}>
                  {liveDevices.filter((d) => d.status === "live").length} / {liveDevices.length} LIVE
                </Text>
              </View>
            </View>
            <View style={styles.liveGrid}>
              {liveDevices.slice(0, 6).map((d, i) => (
                <LiveDeviceCard
                  key={d.hardware_id}
                  device={d}
                  index={i}
                  onPress={() =>
                    router.push({
                      pathname: "/device/[id]",
                      params: {
                        id: d.hardware_id,
                        type: d.instrument_type,
                        label: d.label || d.hardware_id,
                        location: d.location_name || "",
                      },
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        {weather ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Weather · {weather.name || "Site"}</Text>
            <View style={styles.weatherCard} testID="weather-card">
              <LinearGradient
                colors={["rgba(56, 189, 248, 0.14)", "rgba(3, 17, 31, 0)"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                pointerEvents="none"
              />
              <View style={styles.weatherTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weatherTemp}>
                    {fmtNum(weather.main?.temp, 1)}
                    <Text style={styles.weatherUnit}>°C</Text>
                  </Text>
                  <Text style={styles.weatherDesc}>
                    {weather.weather?.[0]?.description
                      ? weather.weather[0].description.replace(/^./, (c) => c.toUpperCase())
                      : (weather as any).weather_code !== undefined
                        ? `Code ${(weather as any).weather_code}`
                        : "—"}
                  </Text>
                  {(weather.main as any)?.feels_like !== undefined ? (
                    <Text style={styles.weatherFeels}>
                      Feels like {fmtNum((weather.main as any).feels_like, 1)}°C
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name={
                    (weather.weather?.[0]?.main || "").toLowerCase().includes("rain") ||
                    ((weather as any).rain && (weather as any).rain["1h"] > 0)
                      ? "rainy-outline"
                      : (weather.weather?.[0]?.main || "").toLowerCase().includes("cloud")
                        ? "cloudy-outline"
                        : "sunny-outline"
                  }
                  size={54}
                  color={colors.water}
                />
              </View>

              {/* ── Full weather grid — every field the upstream returns ── */}
              <View style={styles.weatherGrid}>
                <View style={styles.weatherStat}>
                  <Ionicons name="water-outline" size={14} color={colors.water} />
                  <Text style={styles.weatherStatLbl}>Humidity</Text>
                  <Text style={styles.weatherStatVal}>{fmtNum(weather.main?.humidity, 0)}%</Text>
                </View>
                <View style={styles.weatherStat}>
                  <Ionicons name="speedometer-outline" size={14} color={colors.warning} />
                  <Text style={styles.weatherStatLbl}>Pressure</Text>
                  <Text style={styles.weatherStatVal}>{fmtNum((weather.main as any)?.pressure, 0)} hPa</Text>
                </View>
                <View style={styles.weatherStat}>
                  <Ionicons name="cloudy-night-outline" size={14} color={colors.eco} />
                  <Text style={styles.weatherStatLbl}>Wind</Text>
                  <Text style={styles.weatherStatVal}>
                    {fmtNum(weather.wind?.speed, 1)} m/s
                    {(weather.wind as any)?.deg !== undefined
                      ? ` · ${Math.round((weather.wind as any).deg)}°`
                      : ""}
                  </Text>
                </View>
                <View style={styles.weatherStat}>
                  <Ionicons name="rainy-outline" size={14} color={colors.water} />
                  <Text style={styles.weatherStatLbl}>Rain 1h</Text>
                  <Text style={styles.weatherStatVal}>
                    {fmtNum(((weather as any).rain && (weather as any).rain["1h"]) || 0, 1)} mm
                  </Text>
                </View>
                {(weather as any).coord ? (
                  <View style={styles.weatherStat}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.weatherStatLbl}>Coord</Text>
                    <Text style={styles.weatherStatVal} numberOfLines={1}>
                      {fmtNum((weather as any).coord.lat, 3)}, {fmtNum((weather as any).coord.lon, 3)}
                    </Text>
                  </View>
                ) : null}
                {(weather as any).dt ? (
                  <View style={styles.weatherStat}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.weatherStatLbl}>Updated</Text>
                    <Text style={styles.weatherStatVal} numberOfLines={1}>
                      {fromNow(String((weather as any).dt))}
                    </Text>
                  </View>
                ) : null}
              </View>
              {(weather as any).source ? (
                <Text style={styles.weatherSource}>
                  Source · {String((weather as any).source)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {offline.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Offline Devices</Text>
              <StatusPill label={`${offline.length}`} variant="alert" />
            </View>
            {offline.slice(0, 4).map((d) => (
              <View
                key={d.hardware_id}
                style={styles.listRow}
                testID={`offline-row-${d.hardware_id}`}
              >
                <View
                  style={[
                    styles.listIcon,
                    { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.3)" },
                  ]}
                >
                  <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{d.hardware_id}</Text>
                  <Text style={styles.listSub}>
                    {prettyType(d.instrument_type)} · {d.never_reported ? "Never reported" : `Last seen ${fromNow(d.last_seen)}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  section: { marginTop: spacing.lg },

  // ── Hero card ─────────────────────────────────────────────────────
  heroCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    // Premium 3D lift
    shadowColor: "#10b981",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  heroLeft: { flex: 1 },
  heroEyebrow: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "800",
  },
  heroValRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  heroValue: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    fontFamily: font.mono,
    letterSpacing: -1,
    textShadowColor: "rgba(16, 185, 129, 0.4)",
    textShadowRadius: 20,
  },
  heroSlash: {
    color: colors.textMuted,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: font.mono,
  },
  heroTotal: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: font.mono,
  },
  heroSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  miniStats: {
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  miniStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  miniVal: {
    color: colors.text,
    fontSize: 13,
    fontFamily: font.mono,
    fontWeight: "800",
  },
  miniLbl: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 0.4,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sectionHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  livePillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.eco,
    shadowColor: colors.eco,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  livePillText: {
    color: colors.eco,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "800",
    fontFamily: font.mono,
  },
  liveGrid: {
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  mixCard: {
    flexDirection: "row",
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mixItem: { flex: 1, alignItems: "flex-start" },
  mixDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.sm },
  mixLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  mixValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    fontFamily: font.mono,
  },
  mixDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  weatherCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    overflow: "hidden",
    shadowColor: "#0ea5e9",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  weatherTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  weatherTemp: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "800",
    fontFamily: font.mono,
    letterSpacing: -1,
  },
  weatherUnit: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: "700",
  },
  weatherDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  weatherMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: 4,
  },
  weatherMetaText: { color: colors.text, fontSize: 12, marginLeft: 4 },
  weatherFeels: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  weatherGrid: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  weatherStat: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 100,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  weatherStatLbl: {
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  weatherStatVal: {
    color: colors.text,
    fontSize: 13,
    fontFamily: font.mono,
    fontWeight: "800",
  },
  weatherSource: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: "right",
    textTransform: "uppercase",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  listTitle: { color: colors.text, fontWeight: "700", fontSize: 13 },
  listSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  brokerDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.3)",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  errorText: { color: colors.warning, fontSize: 12, flex: 1 },
});
