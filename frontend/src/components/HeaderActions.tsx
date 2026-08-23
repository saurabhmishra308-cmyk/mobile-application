// Animated notification bell + circular profile avatar for authenticated
// screens. Bell rings (rotate + counter-rotate) when the badge count > 0.
// Avatar shows initials on a soft-tinted background matching the eco brand.

import { useEffect } from "react";
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

import { colors, font } from "@/src/theme";

function initials(name?: string | null): string {
  const parts = (name || "?").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0][0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${a}${b}`.toUpperCase();
}

export function HeaderActions({
  fullName,
  badgeCount = 0,
  onAvatarPress,
}: {
  fullName?: string | null;
  badgeCount?: number;
  onAvatarPress?: () => void;
}) {
  const router = useRouter();
  const rot = useSharedValue(0);

  useEffect(() => {
    if (badgeCount <= 0) {
      rot.value = 0;
      return;
    }
    rot.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(14, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(-10, { duration: 160, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 2200 }), // pause between rings
      ),
      -1,
    );
  }, [badgeCount, rot]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <View style={styles.row}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push("/(tabs)/alerts")}
        style={styles.bellBtn}
        hitSlop={8}
        testID="header-bell"
      >
        <Animated.View style={bellStyle}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
        </Animated.View>
        {badgeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : String(badgeCount)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => (onAvatarPress ? onAvatarPress() : router.push("/(tabs)/profile"))}
        style={styles.avatar}
        hitSlop={8}
        testID="header-avatar"
      >
        <Text style={styles.avatarText}>{initials(fullName)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    fontFamily: font.mono,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.5)",
  },
  avatarText: {
    color: colors.eco,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
