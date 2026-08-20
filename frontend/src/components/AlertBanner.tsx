// Sticky emergency banner shown across all authenticated screens when any
// STP / DO / Chlorine parameter breaches its `safe_min` / `safe_max` band.
// Tapping the banner jumps the user straight to the Quality tab.
//
// Polls the upstream `/api/water-quality/latest` every 90 seconds. Silent when
// there's no alert. Uses reanimated for a subtle red-glow pulse so it never
// gets lost under other UI chrome.

import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { api, WaterQualityLatest, WaterQualityMeta } from "@/src/api/client";
import { colors, spacing } from "@/src/theme";

const POLL_MS = 90_000;

function evaluateBad(value: unknown, meta: WaterQualityMeta): boolean {
  const n = Number(value);
  if (Number.isNaN(n)) return false;
  const min = meta.min ?? -Infinity;
  const max = meta.max ?? Infinity;
  if (n < min || n > max) return true;
  if (meta.safe_min !== undefined && n < meta.safe_min) return true;
  if (meta.safe_max !== undefined && n > meta.safe_max) return true;
  return false;
}

function collectAlerts(data: WaterQualityLatest | null): string[] {
  if (!data) return [];
  const groups: [Record<string, WaterQualityMeta>, any[]][] = [
    [data.stp_params_meta, data.stp || []],
    [data.do_params_meta, data.do || []],
    [data.chlorine_params_meta, data.chlorine || []],
  ];
  const bad: string[] = [];
  for (const [metaMap, readings] of groups) {
    const latest = readings?.[0];
    if (!latest) continue;
    for (const [param, m] of Object.entries(metaMap || {})) {
      if (evaluateBad(latest[param], m)) bad.push(param);
    }
  }
  return bad;
}

export function AlertBanner() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<string[]>([]);
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse]);

  const load = useCallback(async () => {
    try {
      const data = await api.waterQualityLatest();
      setAlerts(collectAlerts(data));
    } catch {
      // network hiccups shouldn't spam the UI — keep last state
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const style = useAnimatedStyle(() => ({
    shadowOpacity: pulse.value,
  }));

  const label = useMemo(() => {
    if (alerts.length === 0) return "";
    if (alerts.length === 1) return `${alerts[0]} out of safe range`;
    return `${alerts.length} parameters out of safe range`;
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <Animated.View style={[styles.bar, style]} testID="emergency-banner">
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.9}
        onPress={() => router.push("/(tabs)/quality")}
        testID="emergency-banner-tap"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="warning" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Water Quality Alert</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {label} — tap to inspect
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.danger,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.25)",
    shadowColor: colors.danger,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 1 },
});
