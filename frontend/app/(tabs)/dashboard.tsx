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

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { MetricCard } from "@/src/components/MetricCard";
import { StatusPill } from "@/src/components/StatusPill";
import {
  api,
  Instrument,
  OfflineDevice,
  LimitBreach,
  Weather,
} from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing, font } from "@/src/theme";
import { fmtNum, fromNow, prettyType } from "@/src/utils/format";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [offline, setOffline] = useState<OfflineDevice[]>([]);
  const [breaches, setBreaches] = useState<LimitBreach[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [broker, setBroker] = useState<{ connected: boolean; broker?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [insR, offR, brR, wR, statusR] = await Promise.allSettled([
        api.instruments(),
        api.offline(24),
        api.limitBreaches(),
        api.weatherLive(),
        api.flowmeterStatus(),
      ]);
      if (insR.status === "fulfilled") setInstruments(insR.value.instruments || []);
      if (offR.status === "fulfilled") setOffline(offR.value.offline || []);
      if (brR.status === "fulfilled") setBreaches(brR.value.breaches || []);
      if (wR.status === "fulfilled") setWeather(wR.value);
      if (statusR.status === "fulfilled") setBroker(statusR.value);

      const failed = [insR, offR, brR, wR, statusR].find(
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
        title={`Hello, ${user?.full_name?.split(" ")[0] || "Admin"}`}
        right={
          <View
            style={[
              styles.brokerDot,
              {
                backgroundColor: broker?.connected
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(239,68,68,0.15)",
                borderColor: broker?.connected
                  ? "rgba(16,185,129,0.4)"
                  : "rgba(239,68,68,0.4)",
              },
            ]}
            testID="broker-status"
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: broker?.connected ? colors.eco : colors.danger,
              }}
            />
            <Text style={{ color: colors.text, fontSize: 10, letterSpacing: 1, fontWeight: "700" }}>
              {broker?.connected ? "MQTT" : "MQTT DOWN"}
            </Text>
          </View>
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

        <View style={styles.row}>
          <MetricCard
            testID="metric-total"
            label="Instruments"
            value={stats.total}
            icon="hardware-chip-outline"
            accent={colors.water}
          />
          <MetricCard
            testID="metric-online"
            label="Online"
            value={stats.onlineCount}
            icon="pulse-outline"
            accent={colors.eco}
          />
        </View>
        <View style={styles.row}>
          <MetricCard
            testID="metric-offline"
            label="Offline"
            value={stats.offlineCount}
            icon="cloud-offline-outline"
            accent={colors.warning}
          />
          <MetricCard
            testID="metric-alerts"
            label="Alerts"
            value={breaches.length}
            icon="alert-circle-outline"
            accent={colors.danger}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instrument Mix</Text>
          <View style={styles.mixCard} testID="mix-card">
            <View style={styles.mixItem}>
              <View style={[styles.mixDot, { backgroundColor: colors.water }]} />
              <Text style={styles.mixLabel}>DWLR</Text>
              <Text style={styles.mixValue}>{stats.dwlr}</Text>
            </View>
            <View style={styles.mixDivider} />
            <View style={styles.mixItem}>
              <View style={[styles.mixDot, { backgroundColor: colors.eco }]} />
              <Text style={styles.mixLabel}>Flowmeter</Text>
              <Text style={styles.mixValue}>{stats.fm}</Text>
            </View>
          </View>
        </View>

        {weather ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Weather · {weather.name || "Site"}</Text>
            <View style={styles.weatherCard} testID="weather-card">
              <View style={{ flex: 1 }}>
                <Text style={styles.weatherTemp}>
                  {fmtNum(weather.main?.temp, 1)}
                  <Text style={styles.weatherUnit}>°C</Text>
                </Text>
                <Text style={styles.weatherDesc}>
                  {weather.weather?.[0]?.description
                    ? weather.weather[0].description.replace(/^./, (c) => c.toUpperCase())
                    : "—"}
                </Text>
                <View style={styles.weatherMeta}>
                  <Ionicons name="water-outline" size={14} color={colors.water} />
                  <Text style={styles.weatherMetaText}>
                    Humidity {fmtNum(weather.main?.humidity, 0)}%
                  </Text>
                  <Ionicons
                    name="speedometer-outline"
                    size={14}
                    color={colors.textSecondary}
                    style={{ marginLeft: spacing.md }}
                  />
                  <Text style={styles.weatherMetaText}>
                    Wind {fmtNum(weather.wind?.speed, 1)} m/s
                  </Text>
                </View>
              </View>
              <Ionicons
                name={
                  (weather.weather?.[0]?.main || "").toLowerCase().includes("rain")
                    ? "rainy-outline"
                    : (weather.weather?.[0]?.main || "").toLowerCase().includes("cloud")
                      ? "cloudy-outline"
                      : "sunny-outline"
                }
                size={54}
                color={colors.water}
              />
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
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
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
