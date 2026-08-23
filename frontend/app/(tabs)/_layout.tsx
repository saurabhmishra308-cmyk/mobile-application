import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/src/theme";
import { AlertBanner } from "@/src/components/AlertBanner";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

// Pulsing wrapper around the tab icon — gently scales the active tab so users
// always know which section they're on. Passive tabs stay static for battery.
function PulseIcon({
  name,
  color,
  size,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  focused: boolean;
}) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      s.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      );
    } else {
      s.value = withTiming(1, { duration: 200 });
    }
  }, [focused, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const { user } = useAuth();

  // ── Dynamic tab visibility ────────────────────────────────────────────
  // Show a data-related tab only if:
  //   (a) the user's view_permissions allow it (upstream flag), AND
  //   (b) there is at least one instrument of that type installed.
  // Fall back to "show everything" while we're still hydrating so first paint
  // never flashes an empty tab bar.
  const [presentTypes, setPresentTypes] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.lastData();
        if (cancelled) return;
        const types = new Set<string>(
          (res.devices || []).map((d) => (d.instrument_type || "").toLowerCase()),
        );
        setPresentTypes(types);
      } catch {
        // On any failure keep tabs visible; safer than hiding by mistake.
        if (!cancelled) setPresentTypes(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const perms = user?.view_permissions || {};
  const permOk = (key: string) => perms[key] !== false; // undefined = allow
  const anyDevice = presentTypes === null || presentTypes.size > 0;
  const anyFlowMeter = presentTypes === null || presentTypes.has("flowmeter");
  const anyDwlr = presentTypes === null || presentTypes.has("dwlr");
  const wqTypes = ["ph", "tds", "conductivity"];
  const anyWQ =
    presentTypes === null ||
    permOk("view_water_quality") ||
    wqTypes.some((t) => presentTypes.has(t));

  // Devices tab hides only if user has no device permission AND no devices at all.
  const showDevices = anyDevice && (permOk("view_flowmeter") || permOk("view_dwlr") || permOk("view_instruments"));
  // Quality tab appears when the user has WQ permission or WQ-capable device.
  const showQuality = anyWQ;
  const showReports = anyFlowMeter || anyDwlr || permOk("view_reports");
  const showAlerts = permOk("view_alerts");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AlertBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.eco,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 6,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: Platform.OS === "ios" ? "600" : "700",
            letterSpacing: 0.4,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size, focused }) => (
              <PulseIcon name="grid-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="devices"
          options={{
            title: "Devices",
            href: showDevices ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <PulseIcon name="hardware-chip-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="quality"
          options={{
            title: "Quality",
            href: showQuality ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <PulseIcon name="flask-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            href: showReports ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <PulseIcon name="bar-chart-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: "Alerts",
            href: showAlerts ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <PulseIcon name="notifications-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size, focused }) => (
              <PulseIcon name="person-outline" color={color} size={size} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
