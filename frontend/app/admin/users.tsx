// Admin — Manage Users
// Visible only to admins. Lists all users on monitor.envirolytics.in, shows
// their status + days-since-creation, and lets the admin activate/deactivate.
// Also flags anyone who has passed the 365-day auto-expiry threshold.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusPill } from "@/src/components/StatusPill";
import { AdminUser, api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing } from "@/src/theme";
import { fromNow } from "@/src/utils/format";

const EXPIRY_DAYS = 365;
const WARNING_DAYS = 30;

type FilterKey = "all" | "active" | "inactive" | "expired" | "expiring";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "expiring", label: "Expiring" },
  { key: "expired", label: "Expired" },
];

function daysSince(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.adminUsersList();
      setUsers(res.users || []);
    } catch (e: any) {
      if (e?.status === 401 || String(e?.message || "").includes("401")) {
        await signOut();
        return;
      }
      setError(e?.message || "Failed to load users.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .map((u) => {
        const isAdminUser = (u.role || "").toLowerCase() === "admin";
        // Admins are GOD mode — never expire.
        const _days = isAdminUser ? 0 : daysSince(u.created_at);
        return { ...u, _days, _isAdmin: isAdminUser };
      })
      .filter((u) => {
        const expired = !u._isAdmin && u._days >= EXPIRY_DAYS;
        const expiring = !u._isAdmin && !expired && u._days >= EXPIRY_DAYS - WARNING_DAYS;
        if (filter === "active" && !u.is_active) return false;
        if (filter === "inactive" && u.is_active) return false;
        if (filter === "expired" && !expired) return false;
        if (filter === "expiring" && !expiring) return false;
        if (!q) return true;
        return (
          u.email.toLowerCase().includes(q) ||
          (u.full_name || "").toLowerCase().includes(q) ||
          (u.username || "").toLowerCase().includes(q) ||
          (u.company_name || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b._days - a._days));
  }, [users, filter, query]);

  const stats = useMemo(() => {
    const nonAdmin = users.filter((u) => (u.role || "").toLowerCase() !== "admin");
    const active = users.filter((u) => u.is_active).length;
    const expired = nonAdmin.filter(
      (u) => daysSince(u.created_at) >= EXPIRY_DAYS,
    ).length;
    const expiring = nonAdmin.filter((u) => {
      const d = daysSince(u.created_at);
      return d < EXPIRY_DAYS && d >= EXPIRY_DAYS - WARNING_DAYS;
    }).length;
    return { total: users.length, active, expired, expiring };
  }, [users]);

  const onToggle = useCallback(
    async (u: AdminUser) => {
      if (u.id === user?.id) {
        // Guard: don't let the admin lock themselves out.
        if (Platform.OS === "web") {
          window.alert("You can't deactivate your own account from the app.");
        } else {
          Alert.alert("Not allowed", "You can't deactivate your own account.");
        }
        return;
      }
      // Guard: never deactivate a fellow admin from the mobile app.
      if ((u.role || "").toLowerCase() === "admin" && u.is_active) {
        const msg = "Admins are GOD mode — deactivating another admin can lock the tenant. Use the web console.";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert("Protected account", msg);
        return;
      }
      setBusyId(u.id);
      const next = !u.is_active;
      // Optimistic update.
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, is_active: next } : x)),
      );
      try {
        await api.setUserStatus(u.id, next);
      } catch (e: any) {
        // Revert on failure.
        setUsers((prev) =>
          prev.map((x) => (x.id === u.id ? { ...x, is_active: !next } : x)),
        );
        setError(e?.message || "Failed to update status.");
      } finally {
        setBusyId(null);
      }
    },
    [user?.id],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <View style={styles.safe} testID="admin-users-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          testID="admin-back"
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text style={styles.title}>Manage Users</Text>
        </View>
      </View>

      {/* Stat strip */}
      <View style={styles.statStrip}>
        <StatCell label="Users" value={stats.total} testID="admin-stat-total" />
        <View style={styles.statDivider} />
        <StatCell
          label="Active"
          value={stats.active}
          color={colors.eco}
          testID="admin-stat-active"
        />
        <View style={styles.statDivider} />
        <StatCell
          label="Expiring"
          value={stats.expiring}
          color={colors.warning}
          testID="admin-stat-expiring"
        />
        <View style={styles.statDivider} />
        <StatCell
          label="Expired"
          value={stats.expired}
          color={colors.danger}
          testID="admin-stat-expired"
        />
      </View>

      <View style={styles.chipsWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                testID={`admin-filter-${f.key}`}
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
          }}
        />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={14} color={colors.textMuted} />
        <TextInput
          testID="admin-users-search"
          style={styles.searchInput}
          placeholder="Search email, name, company"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.eco} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.eco}
            />
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner} testID="admin-error">
                <Ionicons name="warning-outline" color={colors.warning} size={16} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No users match this filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isAdminRow = (item.role || "").toLowerCase() === "admin";
            const d = daysSince(item.created_at);
            const expired = !isAdminRow && d >= EXPIRY_DAYS;
            const expiring = !isAdminRow && !expired && d >= EXPIRY_DAYS - WARNING_DAYS;
            const remaining = Math.max(EXPIRY_DAYS - d, 0);
            return (
              <View
                style={styles.userCard}
                testID={`admin-user-${item.id}`}
              >
                <View
                  style={[
                    styles.userAvatar,
                    isAdminRow && {
                      backgroundColor: "rgba(245,158,11,0.14)",
                      borderColor: "rgba(245,158,11,0.5)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.userAvatarText,
                      isAdminRow && { color: colors.warning },
                    ]}
                  >
                    {(item.full_name || item.email || "?")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.userTitleRow}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {item.full_name || item.email}
                    </Text>
                    <StatusPill
                      testID={`admin-user-status-${item.id}`}
                      label={
                        isAdminRow
                          ? "GOD"
                          : expired
                            ? "Expired"
                            : !item.is_active
                              ? "Inactive"
                              : expiring
                                ? "Expiring"
                                : "Active"
                      }
                      variant={
                        isAdminRow
                          ? "warning"
                          : expired
                            ? "alert"
                            : !item.is_active
                              ? "offline"
                              : expiring
                                ? "warning"
                                : "online"
                      }
                    />
                  </View>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {item.email}
                  </Text>
                  <View style={styles.userMetaRow}>
                    <View style={styles.userMetaItem}>
                      <Ionicons name="briefcase-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.userMeta}>{item.role.toUpperCase()}</Text>
                    </View>
                    <View style={styles.userMetaItem}>
                      <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.userMeta}>
                        Created {fromNow(item.created_at)}
                      </Text>
                    </View>
                    {isAdminRow ? (
                      <View style={styles.userMetaItem}>
                        <Ionicons name="infinite-outline" size={11} color={colors.warning} />
                        <Text style={[styles.userMeta, { color: colors.warning }]}>
                          No expiry · GOD mode
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.userMetaItem}>
                        <Ionicons
                          name={expired ? "close-circle-outline" : "hourglass-outline"}
                          size={11}
                          color={expired ? colors.danger : expiring ? colors.warning : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.userMeta,
                            expired && { color: colors.danger },
                            expiring && { color: colors.warning },
                          ]}
                        >
                          {expired
                            ? `Past 365d by ${d - EXPIRY_DAYS}d`
                            : `${remaining}d to auto-expiry`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                {busyId === item.id ? (
                  <ActivityIndicator color={colors.eco} size="small" />
                ) : (
                  <Switch
                    testID={`admin-toggle-${item.id}`}
                    value={item.is_active}
                    onValueChange={() => onToggle(item)}
                    disabled={isAdminRow && item.is_active && item.id !== user?.id}
                    trackColor={{
                      false: colors.border,
                      true: isAdminRow
                        ? "rgba(245,158,11,0.55)"
                        : "rgba(16,185,129,0.6)",
                    }}
                    thumbColor={
                      item.is_active
                        ? isAdminRow
                          ? colors.warning
                          : colors.eco
                        : "#f4f3f4"
                    }
                  />
                )}
              </View>
            );
          }}
        />
      )}
      <Text style={styles.footer}>
        Non-admin users are auto-deactivated 365 days after creation. Admins are GOD mode — never auto-expired.
      </Text>
    </View>
  );
}

function StatCell({
  label,
  value,
  color = colors.text,
  testID,
}: {
  label: string;
  value: number;
  color?: string;
  testID?: string;
}) {
  return (
    <View style={styles.statCell} testID={testID}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  statStrip: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  statCell: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: font.mono,
    letterSpacing: -0.3,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
  },
  statDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 6 },
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  searchInput: { color: colors.text, fontSize: 13, flex: 1, padding: 0 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
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
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(14,165,233,0.12)",
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: colors.water,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  userTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  userName: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  userEmail: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontFamily: font.mono,
  },
  userMetaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 10 },
  userMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  userMeta: { color: colors.textSecondary, fontSize: 11 },
  footer: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
