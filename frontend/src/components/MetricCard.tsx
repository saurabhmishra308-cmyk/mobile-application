import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, font } from "@/src/theme";

export function MetricCard({
  label,
  value,
  suffix,
  icon,
  accent = colors.eco,
  testID,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        {icon ? (
          <View style={[styles.iconBox, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}>
            <Ionicons name={icon} size={16} color={accent} />
          </View>
        ) : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 96,
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    flex: 1,
  },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: spacing.md },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    fontFamily: font.mono,
    letterSpacing: -0.5,
  },
  suffix: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: font.mono,
  },
});
