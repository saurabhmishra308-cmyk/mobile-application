// Premium live-data device card — pastel icon badge, high-contrast metrics,
// staggered entrance animation, press-scale micro-interaction, and a status
// LED that pulses green for "live", amber for "stale", red for "silent".
//
// Sourced from the upstream `/api/instrument-registry/last-data` endpoint so
// every field (owner, last-seen, live_values chips) is authoritative.

import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { LastDataDevice, LastDataStatus } from "@/src/api/client";
import { colors, font, radius, spacing } from "@/src/theme";
import { instrumentMeta } from "@/src/utils/format";

const STATUS_COLOR: Record<LastDataStatus, string> = {
  live: "#10b981",
  stale: "#f59e0b",
  silent: "#ef4444",
};

const STATUS_LABEL: Record<LastDataStatus, string> = {
  live: "LIVE",
  stale: "STALE",
  silent: "SILENT",
};

function formatSinceLast(s: number | null | undefined): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export function LiveDeviceCard({
  device,
  index,
  onPress,
}: {
  device: LastDataDevice;
  index: number;
  onPress?: () => void;
}) {
  const meta = instrumentMeta(device.instrument_type);
  const statusColor = STATUS_COLOR[device.status] || STATUS_COLOR.silent;

  // Entrance — sequential fade + slide-up per card.
  const opacity = useSharedValue(0);
  const y = useSharedValue(20);
  useEffect(() => {
    opacity.value = withDelay(index * 70, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    y.value = withDelay(index * 70, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [index, opacity, y]);

  // Status LED pulse (only when live).
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (device.status === "live") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 700 }),
          withTiming(1, { duration: 700 }),
        ),
        -1,
      );
    } else {
      pulse.value = 1;
    }
  }, [device.status, pulse]);

  // Press-scale.
  const scale = useSharedValue(1);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));
  const ledStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const chips = Object.entries(device.last_values || {}).slice(0, 3);

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      onTouchStart={() => (scale.value = withSpring(0.98, { damping: 20 }))}
      onTouchEnd={() => (scale.value = withSpring(1, { damping: 12 }))}
      onTouchCancel={() => (scale.value = withSpring(1, { damping: 12 }))}
      testID={`live-card-${device.hardware_id}`}
    >
      {onPress ? (
        <View
          accessibilityRole="button"
          onStartShouldSetResponder={() => true}
          onResponderRelease={onPress}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <LinearGradient
        colors={[`${meta.color}22`, `${meta.color}05`]}
        style={styles.gradientBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.head}>
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}55` },
          ]}
        >
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title} numberOfLines={1}>
            {device.label || device.hardware_id}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {meta.label}
            {device.location_name ? ` · ${device.location_name}` : ""}
          </Text>
        </View>
        <View style={styles.statusWrap}>
          <Animated.View style={[styles.led, { backgroundColor: statusColor }, ledStyle]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABEL[device.status] || "—"}
          </Text>
        </View>
      </View>

      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map(([k, v]) => (
            <View key={k} style={styles.chip}>
              <Text style={styles.chipKey}>{k}</Text>
              <Text style={styles.chipVal} numberOfLines={1}>
                {String(v)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noData}>Waiting for first reading…</Text>
      )}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text style={styles.footerText} numberOfLines={1}>
            {formatSinceLast(device.seconds_since_last)}
          </Text>
        </View>
        {device.owner_name ? (
          <View style={styles.footerItem}>
            <Ionicons name="person-outline" size={11} color={colors.textMuted} />
            <Text style={styles.footerText} numberOfLines={1}>
              {device.owner_name}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    // Premium 3D lift
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
  },
  head: { flexDirection: "row", alignItems: "center" },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: "800", letterSpacing: 0.1 },
  subtitle: { color: colors.textSecondary, fontSize: 11.5, marginTop: 2, letterSpacing: 0.2 },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 10 },
  led: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800", fontFamily: font.mono },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 90,
    flexGrow: 1,
  },
  chipKey: {
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chipVal: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: font.mono,
    marginTop: 2,
  },
  noData: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 11.5,
    fontStyle: "italic",
  },

  footer: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 0.3,
    maxWidth: 140,
  },
});
