// Animated "count-up" number — animates from 0 to the target value on mount /
// on value change. Includes optional prefix, suffix, and configurable duration.
// Used across the redesigned Dashboard hero so every metric feels alive when
// the user opens the app.

import { useEffect } from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors, font } from "@/src/theme";

// We display the value via animatedProps on a plain <Text> so the value can
// update on the UI thread without React re-renders.
const AnimatedText = Animated.createAnimatedComponent(Text);

export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
  style,
  testID,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: TextStyle | TextStyle[];
  testID?: string;
}) {
  const shared = useSharedValue(0);

  useEffect(() => {
    shared.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, shared]);

  const animatedProps = useAnimatedProps(() => {
    const v = shared.value;
    const rounded = decimals === 0 ? Math.round(v) : Number(v.toFixed(decimals));
    return { text: `${prefix}${rounded}${suffix}` } as any;
  });

  return (
    <AnimatedText
      testID={testID}
      style={[styles.text, style]}
      // @ts-ignore — reanimated exposes text via animatedProps on Text.
      animatedProps={animatedProps}
    >
      {`${prefix}${decimals === 0 ? Math.round(value) : value.toFixed(decimals)}${suffix}`}
    </AnimatedText>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.text,
    fontFamily: font.mono,
    fontWeight: "800",
  },
});
