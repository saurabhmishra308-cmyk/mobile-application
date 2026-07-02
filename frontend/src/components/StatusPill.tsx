import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/src/theme";

type Variant = "online" | "offline" | "alert" | "warning" | "info";

const map: Record<Variant, { bg: string; fg: string; border: string }> = {
  online: {
    bg: "rgba(16, 185, 129, 0.10)",
    fg: colors.eco,
    border: "rgba(16, 185, 129, 0.30)",
  },
  offline: {
    bg: "rgba(100, 116, 139, 0.15)",
    fg: colors.textSecondary,
    border: "rgba(100, 116, 139, 0.30)",
  },
  alert: {
    bg: "rgba(239, 68, 68, 0.12)",
    fg: colors.danger,
    border: "rgba(239, 68, 68, 0.30)",
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.12)",
    fg: colors.warning,
    border: "rgba(245, 158, 11, 0.30)",
  },
  info: {
    bg: "rgba(14, 165, 233, 0.12)",
    fg: colors.water,
    border: "rgba(14, 165, 233, 0.30)",
  },
};

export function StatusPill({
  label,
  variant = "info",
  testID,
}: {
  label: string;
  variant?: Variant;
  testID?: string;
}) {
  const c = map[variant];
  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}
    >
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
});
