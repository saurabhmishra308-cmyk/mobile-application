import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Switch,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { useAuth } from "@/src/context/AuthContext";
import {
  getAuthToken,
  getEmailSubscription,
  setEmailSubscription,
} from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [weekly, setWeekly] = useState(false);
  const [monthly, setMonthly] = useState(false);
  const [subLoading, setSubLoading] = useState(true);
  const [subSaving, setSubSaving] = useState<"weekly" | "monthly" | null>(null);
  const [subNote, setSubNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const s = await getEmailSubscription(user.id);
        setWeekly(!!s.weekly);
        setMonthly(!!s.monthly);
      } catch {}
      setSubLoading(false);
    })();
  }, [user?.id]);

  const persist = useCallback(
    async (nextWeekly: boolean, nextMonthly: boolean, cadence: "weekly" | "monthly") => {
      if (!user?.id || !user.email) return;
      setSubSaving(cadence);
      setSubNote(null);
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("Please sign in again to update subscriptions.");
        await setEmailSubscription({
          user_id: user.id,
          email: user.email,
          envirolytics_token: token,
          full_name: user.full_name,
          weekly: nextWeekly,
          monthly: nextMonthly,
        });
        setSubNote("Preferences saved.");
      } catch (e: any) {
        // Revert the toggle on failure.
        if (cadence === "weekly") setWeekly(!nextWeekly);
        else setMonthly(!nextMonthly);
        setSubNote(e?.message || "Could not save.");
      } finally {
        setSubSaving(null);
      }
    },
    [user?.id, user?.email, user?.full_name],
  );

  const onToggleWeekly = (v: boolean) => {
    setWeekly(v);
    persist(v, monthly, "weekly");
  };
  const onToggleMonthly = (v: boolean) => {
    setMonthly(v);
    persist(weekly, v, "monthly");
  };

  const onLogout = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [signOut, router]);

  return (
    <View style={styles.safe} testID="profile-screen">
      <ScreenHeader eyebrow="ACCOUNT" title="Profile" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card} testID="profile-card">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name || user?.email || "U")
                .split(" ")
                .map((s) => s.charAt(0))
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} testID="profile-name">
            {user?.full_name || "Envirolytics User"}
          </Text>
          <Text style={styles.email} testID="profile-email">
            {user?.email}
          </Text>
          <View style={styles.rolePill}>
            <View style={styles.dot} />
            <Text style={styles.roleText}>
              {(user?.role || "user").toUpperCase()}
            </Text>
          </View>
        </View>

        <Section title="Details">
          <Row
            icon="location-outline"
            label="Location"
            value={user?.location_name || "—"}
          />
          <Row
            icon="navigate-outline"
            label="Coordinates"
            value={
              user?.latitude != null && user?.longitude != null
                ? `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}`
                : "—"
            }
          />
          <Row icon="person-outline" label="Username" value={user?.username || "—"} />
          <Row
            icon="shield-checkmark-outline"
            label="Active"
            value={user?.is_active ? "Yes" : "No"}
          />
        </Section>

        {user?.permissions ? (
          <Section title="Permissions">
            {Object.entries(user.permissions).map(([k, v]) => (
              <Row
                key={k}
                icon={v ? "checkmark-circle-outline" : "close-circle-outline"}
                iconColor={v ? colors.eco : colors.textMuted}
                label={k.replace(/^./, (c) => c.toUpperCase())}
                value={v ? "Allowed" : "Denied"}
              />
            ))}
          </Section>
        ) : null}

        <Section title="Email Reports · Pro">
          <View style={styles.subRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subTitle}>Weekly report</Text>
              <Text style={styles.subSub}>
                Every Monday 6:00 AM IST · CSV + PDF for last 7 days
              </Text>
            </View>
            {subLoading ? (
              <ActivityIndicator color={colors.eco} size="small" />
            ) : (
              <Switch
                testID="sub-weekly-toggle"
                value={weekly}
                onValueChange={onToggleWeekly}
                disabled={subSaving === "weekly"}
                trackColor={{ false: colors.border, true: "rgba(16,185,129,0.6)" }}
                thumbColor={weekly ? colors.eco : "#f4f3f4"}
              />
            )}
          </View>
          <View style={styles.subRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subTitle}>Monthly report</Text>
              <Text style={styles.subSub}>
                1st of each month 6:00 AM IST · CSV + PDF for last 30 days
              </Text>
            </View>
            {subLoading ? (
              <ActivityIndicator color={colors.eco} size="small" />
            ) : (
              <Switch
                testID="sub-monthly-toggle"
                value={monthly}
                onValueChange={onToggleMonthly}
                disabled={subSaving === "monthly"}
                trackColor={{ false: colors.border, true: "rgba(16,185,129,0.6)" }}
                thumbColor={monthly ? colors.eco : "#f4f3f4"}
              />
            )}
          </View>
          {subNote ? (
            <Text style={styles.subNote} testID="sub-note">
              {subNote}
            </Text>
          ) : null}
          <Text style={styles.subFooter}>
            Sent from info@envirolytics.in to {user?.email || "your account email"}.
          </Text>
        </Section>

        <TouchableOpacity
          testID="open-web-link"
          style={styles.linkBtn}
          onPress={() => Linking.openURL("https://monitor.envirolytics.in")}
        >
          <Ionicons name="open-outline" size={18} color={colors.water} />
          <Text style={styles.linkBtnText}>Open monitor.envirolytics.in</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {user?.role === "admin" ? (
          <TouchableOpacity
            testID="open-admin-users"
            style={styles.linkBtn}
            onPress={() => router.push("/admin/users")}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.eco} />
            <Text style={styles.linkBtnText}>Manage users</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          testID="logout-button"
          style={styles.logoutBtn}
          onPress={onLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Envirolytics Monitor · v1.0</Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  iconColor = colors.textSecondary,
}: {
  icon: any;
  label: string;
  value: string;
  iconColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  card: {
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.eco,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  name: { color: colors.text, fontSize: 18, fontWeight: "800" },
  email: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.12)",
    borderColor: "rgba(14,165,233,0.35)",
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.water },
  roleText: { color: colors.water, fontSize: 10.5, letterSpacing: 1.5, fontWeight: "800" },
  section: { marginTop: spacing.md },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  sectionBody: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 12, width: 100 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkBtnText: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  footer: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: spacing.md,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  subTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  subSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  subNote: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.eco,
    fontSize: 11.5,
  },
  subFooter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
});
