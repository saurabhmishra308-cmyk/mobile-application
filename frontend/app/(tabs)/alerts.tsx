import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StatusPill } from "@/src/components/StatusPill";
import { api, OfflineDevice, LimitBreach } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fromNow, prettyType, fmtNum } from "@/src/utils/format";

export default function AlertsScreen() {
  const { signOut } = useAuth();
  const [offline, setOffline] = useState<OfflineDevice[]>([]);
  const [breaches, setBreaches] = useState<LimitBreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [off, br] = await Promise.all([api.offline(24), api.limitBreaches()]);
      setOffline(off.offline || []);
      setLastChecked(off.checked_at || null);
      setBreaches(br.breaches || []);
    } catch (e: any) {
      if (e?.status === 401) await signOut();
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

  return (
    <View style={styles.safe} testID="alerts-screen">
      <ScreenHeader
        eyebrow="ALERTS · LAST 24H"
        title="System Alerts"
        right={
          <View style={styles.badge} testID="alerts-total-badge">
            <Text style={styles.badgeText}>{offline.length + breaches.length}</Text>
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
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleWrap}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.sectionTitle}>Limit Breaches</Text>
              </View>
              <StatusPill
                label={`${breaches.length}`}
                variant={breaches.length ? "alert" : "offline"}
                testID="breaches-count-pill"
              />
            </View>
            {breaches.length === 0 ? (
              <EmptyRow
                icon="checkmark-circle-outline"
                color={colors.eco}
                testID="breaches-empty"
                text="No parameter limit breaches."
              />
            ) : (
              breaches.map((b, idx) => (
                <View
                  key={`${b.hardware_id || "hw"}-${idx}`}
                  style={[styles.row, { borderColor: "rgba(239,68,68,0.25)" }]}
                  testID={`breach-row-${idx}`}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.3)" },
                    ]}
                  >
                    <Ionicons name="warning-outline" size={16} color={colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {b.parameter || "Parameter"} · {b.hardware_id || "—"}
                    </Text>
                    <Text style={styles.rowSub}>
                      value {fmtNum(b.value)} · limit {fmtNum(b.limit)}
                      {b.detected_at ? ` · ${fromNow(b.detected_at)}` : ""}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleWrap}>
                <Ionicons name="cloud-offline" size={16} color={colors.warning} />
                <Text style={styles.sectionTitle}>Offline Devices</Text>
              </View>
              <StatusPill
                label={`${offline.length}`}
                variant={offline.length ? "warning" : "offline"}
                testID="offline-count-pill"
              />
            </View>
            {offline.length === 0 ? (
              <EmptyRow
                icon="wifi-outline"
                color={colors.eco}
                testID="offline-empty"
                text="All instruments are online."
              />
            ) : (
              offline.map((d) => (
                <View
                  key={d.hardware_id}
                  style={styles.row}
                  testID={`offline-alert-row-${d.hardware_id}`}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)" },
                    ]}
                  >
                    <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{d.hardware_id}</Text>
                    <Text style={styles.rowSub}>
                      {prettyType(d.instrument_type)} ·{" "}
                      {d.never_reported
                        ? "Never reported"
                        : `Last seen ${fromNow(d.last_seen)}`}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {lastChecked ? (
            <Text style={styles.footer}>Checked {fromNow(lastChecked)}</Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function EmptyRow({
  icon,
  color,
  text,
  testID,
}: {
  icon: any;
  color: string;
  text: string;
  testID?: string;
}) {
  return (
    <View style={styles.emptyRow} testID={testID}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  section: { marginBottom: spacing.xl },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  row: {
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
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(16,185,129,0.05)",
  },
  emptyText: { color: colors.textSecondary, fontSize: 12 },
  badge: {
    minWidth: 30,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.35)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  footer: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
