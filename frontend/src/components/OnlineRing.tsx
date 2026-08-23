// Animated online / offline ratio ring — a circular progress arc that draws
// itself from 0° to (online / total) * 360° on mount. Centered number counts
// up simultaneously. Dominates the Dashboard hero card so the operator's
// first glance tells them "how many of my sensors are alive right now".

import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors, font } from "@/src/theme";
import { CountUp } from "./CountUp";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function OnlineRing({
  online,
  total,
  size = 132,
  strokeWidth = 12,
  testID,
}: {
  online: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  testID?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const target = total > 0 ? online / total : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    // Draw + count-up after a small delay so the entrance feels intentional.
    progress.value = withDelay(
      120,
      withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - progress.value),
  }));

  const pct = total > 0 ? Math.round(target * 100) : 0;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      testID={testID}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#34d399" />
            <Stop offset="1" stopColor="#0ea5e9" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(148, 163, 184, 0.16)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc — rotated -90° so 0% starts at top */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringG)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.centre}>
        <CountUp
          value={pct}
          suffix="%"
          style={styles.pct}
          testID={testID ? `${testID}-pct` : undefined}
        />
        <Text style={styles.label}>ONLINE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pct: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    fontFamily: font.mono,
    letterSpacing: 0.3,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 9.5,
    letterSpacing: 2,
    fontWeight: "800",
    marginTop: 2,
  },
});
