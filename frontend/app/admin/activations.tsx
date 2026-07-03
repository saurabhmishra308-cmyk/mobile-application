// Admin — Site Activations
// Admins can enable / renew customer sites without opening the web dashboard.
// Uses upstream:
//   GET  /api/admin/site/activations
//   POST /api/admin/site/activate     body: { user_id, subscription_type }

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusPill } from "@/src/components/StatusPill";
import { AdminUser, SiteActivation, api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing } from "@/src/theme";
import { fmtDateTime, fromNow } from "@/src/utils/format";

type PlanKey = "monthly" | "quarterly" | "yearly";
const PLANS: { key: PlanKey; label: string; helper: string; icon: any }[] = [
  { key: "monthly", label: "Monthly", helper: "+30 days", icon: "calendar-outline" },
  { key: "quarterly", label: "Quarterly", helper: "+90 days", icon: "calendar-clear-outline" },
  { key: "yearly", label: "Yearly", helper: "+365 days · best value", icon: "medal-outline" },
];

function daysUntil(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function latestPer(activations: SiteActivation[]): Record<string, SiteActivation> {
  const map: Record<string, SiteActivation> = {};
  for (const a of activations) {
    const prev = map[a.user_id];
    if (!prev) {
      map[a.user_id] = a;
      continue;
    }
    if (new Date(a.end_date).getTime() > new Date(prev.end_date).getTime()) {
      map[a.user_id] = a;
    }
  }
  return map;
}

export default function ActivationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activations, setActivations] = useState<SiteActivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<AdminUser | null>(null);
  const [pickerBusy, setPickerBusy] = useState<PlanKey | null>(null);
  const [feedback, setFeedback] = useState<
    { userId: string; message: string; kind: "success" | "error" } | null
  >(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [uRes, aRes] = await Promise.all([
        api.adminUsersList(),
        api.siteActivations(),
      ]);
      setUsers((uRes.users || []).filter((u) => (u.role || "").toLowerCase() !== "admin"));
      setActivations(aRes.activations || []);
    } catch (e: any) {
      if (String(e?.message || "").includes("401")) {
        await signOut();
        return;
      }
      setError(e?.message || "Failed to load activations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const activeByUser = useMemo(() => latestPer(activations), [activations]);

  const stats = useMemo(() => {
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let never = 0;
    for (const u of users) {
      const a = activeByUser[u.id];
      if (!a) {
        never += 1;
        continue;
      }
      const remaining = daysUntil(a.end_date);
      if (remaining <= 0) expired += 1;
      else if (remaining <= 14) expiringSoon += 1;
      else active += 1;
    }
    return { active, expiringSoon, expired, never, total: users.length };
  }, [users, activeByUser]);

  const onActivate = useCallback(
    async (u: AdminUser, plan: PlanKey) => {
      setPickerBusy(plan);
      setFeedback(null);
      try {
        const res = await api.activateSite(u.id, plan);
        // Refresh activations optimistically with the new one.
        setActivations((prev) => [...prev, res.activation]);
        setFeedback({
          userId: u.id,
          kind: "success",
          message: `Activated ${plan}. Valid until ${fmtDateTime(res.activation.end_date)}.`,
        });
        // Close the modal shortly.
        setTimeout(() => {
          setPickerFor(null);
          setPickerBusy(null);
        }, 900);
      } catch (e: any) {
        setFeedback({
          userId: u.id,
          kind: "error",
          message: e?.message || "Activation failed.",
        });
        setPickerBusy(null);
      }
    },
    [],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <View style={styles.safe} testID="activations-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          testID="activations-back"
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text style={styles.title}>Site Activations</Text>
        </View>
      </View>

      <View style={styles.statStrip}>
        <StatCell label="Active" value={stats.active} color={colors.eco} testID="stat-active" />
        <View style={styles.statDivider} />
        <StatCell
          label="≤14d"
          value={stats.expiringSoon}
          color={colors.warning}
          testID="stat-expiring"
        />
        <View style={styles.statDivider} />
        <StatCell
          label="Expired"
          value={stats.expired}
          color={colors.danger}
          testID="stat-expired"
        />
        <View style={styles.statDivider} />
        <StatCell
          label="Never"
          value={stats.never}
          color={colors.textSecondary}
          testID="stat-never"
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.eco} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
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
              <View style={styles.errorBanner} testID="activation-error">
                <Ionicons name="warning-outline" color={colors.warning} size={16} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No customer sites yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const a = activeByUser[item.id];
            const remaining = a ? daysUntil(a.end_date) : 0;
            let variant: "online" | "warning" | "alert" | "offline" = "offline";
            let statusLabel = "Not activated";
            if (a) {
              if (remaining <= 0) {
                variant = "alert";
                statusLabel = `Expired ${fromNow(a.end_date)}`;
              } else if (remaining <= 14) {
                variant = "warning";
                statusLabel = `Renew in ${remaining}d`;
              } else {
                variant = "online";
                statusLabel = `${remaining}d left`;
              }
            }
            const success = feedback?.userId === item.id && feedback.kind === "success";
            return (
              <View style={styles.card} testID={`activation-card-${item.id}`}>
                <View style={styles.cardHead}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.full_name || item.email || "?")
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.full_name || item.email}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>
                      {item.email}
                    </Text>
                  </View>
                  <StatusPill
                    testID={`activation-status-${item.id}`}
                    label={statusLabel}
                    variant={variant}
                  />
                </View>

                {a ? (
                  <View style={styles.detailRow}>
                    <View>
                      <Text style={styles.detailLabel}>PLAN</Text>
                      <Text style={styles.detailValue}>
                        {a.subscription_type.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View>
                      <Text style={styles.detailLabel}>STARTED</Text>
                      <Text style={styles.detailValue}>{fmtDateTime(a.start_date)}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View>
                      <Text style={styles.detailLabel}>ENDS</Text>
                      <Text style={styles.detailValue}>{fmtDateTime(a.end_date)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noActivation}>
                    No subscription on file. Activate to enable data access.
                  </Text>
                )}

                <TouchableOpacity
                  testID={`open-plans-${item.id}`}
                  style={styles.actionBtn}
                  onPress={() => {
                    setPickerFor(item);
                    setFeedback(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    {a ? "Renew or upgrade" : "Activate site"}
                  </Text>
                </TouchableOpacity>

                {success ? (
                  <View style={styles.successNote} testID={`activation-success-${item.id}`}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.eco} />
                    <Text style={styles.successText}>{feedback?.message}</Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* Plan picker */}
      <Modal
        visible={!!pickerFor}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPickerFor(null);
          setPickerBusy(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (pickerBusy) return;
              setPickerFor(null);
            }}
            style={StyleSheet.absoluteFill}
            testID="plans-backdrop"
          />
          {pickerFor ? (
            <View style={styles.sheet} testID="plans-sheet">
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>SUBSCRIPTION</Text>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {pickerFor.full_name || pickerFor.email}
                  </Text>
                  <Text style={styles.sheetSub}>
                    Pick a plan — dates extend from now.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (pickerBusy) return;
                    setPickerFor(null);
                  }}
                  hitSlop={12}
                  testID="plans-close"
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {PLANS.map((p) => {
                const busy = pickerBusy === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    testID={`plan-${p.key}`}
                    activeOpacity={0.85}
                    disabled={!!pickerBusy}
                    onPress={() => onActivate(pickerFor, p.key)}
                    style={styles.planRow}
                  >
                    <View
                      style={[
                        styles.planIcon,
                        {
                          backgroundColor:
                            p.key === "yearly"
                              ? "rgba(16,185,129,0.18)"
                              : "rgba(14,165,233,0.15)",
                          borderColor:
                            p.key === "yearly"
                              ? "rgba(16,185,129,0.45)"
                              : "rgba(14,165,233,0.35)",
                        },
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.eco} size="small" />
                      ) : (
                        <Ionicons
                          name={p.icon}
                          size={18}
                          color={p.key === "yearly" ? colors.eco : colors.water}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planLabel}>{p.label}</Text>
                      <Text style={styles.planHelper}>{p.helper}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}

              {feedback && feedback.userId === pickerFor.id ? (
                <View
                  style={[
                    styles.feedback,
                    {
                      backgroundColor:
                        feedback.kind === "success"
                          ? "rgba(16,185,129,0.10)"
                          : "rgba(239,68,68,0.12)",
                      borderColor:
                        feedback.kind === "success"
                          ? "rgba(16,185,129,0.30)"
                          : "rgba(239,68,68,0.30)",
                    },
                  ]}
                  testID="plans-feedback"
                >
                  <Ionicons
                    name={feedback.kind === "success" ? "checkmark-circle" : "alert-circle"}
                    size={16}
                    color={feedback.kind === "success" ? colors.eco : colors.danger}
                  />
                  <Text
                    style={[
                      styles.feedbackText,
                      {
                        color: feedback.kind === "success" ? colors.eco : colors.danger,
                      },
                    ]}
                  >
                    {feedback.message}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
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

  card: {
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(14,165,233,0.12)",
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.water,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  name: { color: colors.text, fontSize: 14, fontWeight: "700" },
  email: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontFamily: font.mono,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 9.5,
    letterSpacing: 1.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: font.mono,
  },
  divider: { width: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  noActivation: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  actionBtn: {
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.eco,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: colors.eco,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },
  successNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    padding: 10,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderColor: "rgba(16,185,129,0.30)",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  successText: { color: colors.eco, fontSize: 11.5, flex: 1 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderColor: colors.border,
    borderTopWidth: 1,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2,
  },
  sheetSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  planLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  planHelper: { color: colors.textSecondary, fontSize: 11.5, marginTop: 2 },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  feedbackText: { flex: 1, fontSize: 12.5 },
});
