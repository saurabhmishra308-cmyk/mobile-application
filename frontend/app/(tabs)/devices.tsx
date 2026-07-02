import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StatusPill } from "@/src/components/StatusPill";
import { api, Instrument, OfflineDevice } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { prettyCategory, prettyType, fromNow } from "@/src/utils/format";

type FilterKey = "all" | "dwlr" | "flowmeter" | "offline";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "dwlr", label: "DWLR" },
  { key: "flowmeter", label: "Flowmeters" },
  { key: "offline", label: "Offline" },
];

export default function DevicesScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [offline, setOffline] = useState<OfflineDevice[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ins, off] = await Promise.all([api.instruments(), api.offline(24)]);
      setInstruments(ins.instruments || []);
      setOffline(off.offline || []);
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

  const offlineIds = useMemo(
    () => new Set(offline.map((o) => o.hardware_id)),
    [offline],
  );

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instruments.filter((i) => {
      if (filter === "dwlr" && i.instrument_type !== "dwlr") return false;
      if (filter === "flowmeter" && i.instrument_type !== "flowmeter") return false;
      if (filter === "offline" && !offlineIds.has(i.hardware_id)) return false;
      if (!q) return true;
      return (
        i.hardware_id.toLowerCase().includes(q) ||
        (i.label || "").toLowerCase().includes(q) ||
        (i.location_name || "").toLowerCase().includes(q) ||
        (i.owner_name || "").toLowerCase().includes(q)
      );
    });
  }, [instruments, filter, query, offlineIds]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <View style={styles.safe} testID="devices-screen">
      <ScreenHeader
        eyebrow="INSTRUMENTS"
        title={`${instruments.length} Devices`}
        right={
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textMuted} />
            <TextInput
              testID="devices-search-input"
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
      />

      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`devices-filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.85}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: "rgba(16,185,129,0.15)",
                    borderColor: colors.eco,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    active && { color: colors.eco },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.eco} size="large" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.hardware_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.eco}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="devices-empty">
              <Ionicons name="hardware-chip-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No instruments match your filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOffline = offlineIds.has(item.hardware_id);
            return (
              <TouchableOpacity
                testID={`device-card-${item.hardware_id}`}
                activeOpacity={0.85}
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: "/device/[id]",
                    params: {
                      id: item.hardware_id,
                      type: item.instrument_type,
                      label: item.label || item.hardware_id,
                      location: item.location_name || "",
                    },
                  })
                }
              >
                <View
                  style={[
                    styles.typeIcon,
                    {
                      backgroundColor:
                        item.instrument_type === "dwlr"
                          ? "rgba(14,165,233,0.15)"
                          : "rgba(16,185,129,0.15)",
                      borderColor:
                        item.instrument_type === "dwlr"
                          ? "rgba(14,165,233,0.35)"
                          : "rgba(16,185,129,0.35)",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      item.instrument_type === "dwlr"
                        ? "water-outline"
                        : "speedometer-outline"
                    }
                    size={22}
                    color={item.instrument_type === "dwlr" ? colors.water : colors.eco}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.label || item.hardware_id}
                    </Text>
                    <StatusPill
                      label={isOffline ? "Offline" : "Online"}
                      variant={isOffline ? "offline" : "online"}
                      testID={`device-status-${item.hardware_id}`}
                    />
                  </View>
                  <Text style={styles.cardId}>{item.hardware_id}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>{prettyType(item.instrument_type)}</Text>
                    </View>
                    {item.category ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="git-branch-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{prettyCategory(item.category)}</Text>
                      </View>
                    ) : null}
                    {item.location_name ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {item.location_name}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.owner_name ? (
                    <Text style={styles.owner}>Owner · {item.owner_name}</Text>
                  ) : null}
                  {isOffline ? (
                    <Text style={styles.offlineHint}>
                      {(() => {
                        const o = offline.find((d) => d.hardware_id === item.hardware_id);
                        if (!o) return "";
                        if (o.never_reported) return "Never reported yet";
                        return `Last seen ${fromNow(o.last_seen)}`;
                      })()}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 130,
  },
  searchInput: {
    color: colors.text,
    fontSize: 12,
    padding: 0,
    minWidth: 90,
  },
  chipsWrap: {
    height: 56,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    justifyContent: "center",
    flexShrink: 0,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl * 2, gap: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 14, flex: 1 },
  cardId: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 0.5,
    marginTop: 2,
    fontFamily: "monospace",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 10,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 180 },
  metaText: { color: colors.textSecondary, fontSize: 11 },
  owner: { color: colors.textMuted, fontSize: 10.5, marginTop: 4 },
  offlineHint: { color: colors.warning, fontSize: 11, marginTop: 4 },
});
