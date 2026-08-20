// Cinematic mobile-first backdrop for the login screen.
// Dark navy → deep water gradient with slowly drifting eco/water/warning orbs
// and a subtle animated waveform along the bottom. Distinct from the bright
// scenic web login — this feels premium, sensor-native, at-night operations.

import { useMemo } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, LinearGradient as SvgLG, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A large blurred colour orb that slowly drifts on a loop.
function Orb({
  color,
  size,
  startX,
  startY,
  endX,
  endY,
  duration,
  delay = 0,
  opacity = 0.55,
}: {
  color: string;
  size: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  delay?: number;
  opacity?: number;
}) {
  const t = useSharedValue(0);
  useMemo(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [t, duration]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + (endX - startX) * t.value },
      { translateY: startY + (endY - startY) * t.value },
      { scale: 1 + 0.08 * t.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          shadowColor: color,
        },
        style,
      ]}
    />
  );
}

// A "breathing" data pulse ring around the brand mark.
function PulseRing({ size = 140, color = "#10b981", delay = 0 }: { size?: number; color?: string; delay?: number }) {
  const scale = useSharedValue(0.6);
  const op = useSharedValue(0.45);
  useMemo(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(1.4, { duration: 2400, easing: Easing.out(Easing.quad) }),
      ),
      -1,
    );
    op.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 0 }),
        withTiming(0, { duration: 2400, easing: Easing.out(Easing.quad) }),
      ),
      -1,
    );
  }, [scale, op, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: op.value,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

// A slow flowing sine-wave that hints at "live data" along the bottom.
function DataWave({ y, color, opacity = 0.35, duration = 8000 }: { y: number; color: string; opacity?: number; duration?: number }) {
  const width = Dimensions.get("window").width;
  const shift = useSharedValue(0);
  useMemo(() => {
    shift.value = withRepeat(
      withTiming(width, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [shift, width, duration]);

  // Build a full sine wave path across width * 2 so we can translate it seamlessly.
  const buildPath = (offset: number) => {
    const w = width * 2;
    const amp = 14;
    const pts: string[] = [];
    for (let x = 0; x <= w; x += 8) {
      const yv = Math.sin(((x + offset) / w) * Math.PI * 4) * amp;
      pts.push(`${x === 0 ? "M" : "L"}${x} ${yv}`);
    }
    return pts.join(" ") + ` L${w} 40 L0 40 Z`;
  };

  const animatedProps = useAnimatedProps(() => ({
    // translate the path negative to give the illusion of movement.
    d: buildPath(-shift.value),
  }));

  return (
    <View pointerEvents="none" style={[styles.wave, { top: y, width: width * 2 }]}>
      <Svg width={width * 2} height={40}>
        <Defs>
          <SvgLG id="waveG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </SvgLG>
        </Defs>
        <AnimatedPath animatedProps={animatedProps} fill="url(#waveG)" />
      </Svg>
    </View>
  );
}

// A subtle constellation of drifting sensor points.
function Particle({
  x,
  y,
  size = 3,
  color = "#38bdf8",
  duration = 4000,
  delay = 0,
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
  duration?: number;
  delay?: number;
}) {
  const op = useSharedValue(0.15);
  const ty = useSharedValue(0);
  useMemo(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration / 2 }),
        withTiming(0.15, { duration: duration / 2 }),
      ),
      -1,
    );
    ty.value = withRepeat(
      withSequence(
        withTiming(-6, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(6, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [op, ty, duration, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 5,
        },
        style,
      ]}
    />
  );
}

export default function LoginHero() {
  const { width, height } = Dimensions.get("window");

  const particles = useMemo(
    () => [
      { x: width * 0.12, y: height * 0.15, color: "#10b981", size: 3 },
      { x: width * 0.28, y: height * 0.08, color: "#38bdf8", size: 2 },
      { x: width * 0.7, y: height * 0.11, color: "#f59e0b", size: 3 },
      { x: width * 0.86, y: height * 0.2, color: "#10b981", size: 2 },
      { x: width * 0.4, y: height * 0.22, color: "#38bdf8", size: 3 },
      { x: width * 0.6, y: height * 0.3, color: "#10b981", size: 2 },
      { x: width * 0.18, y: height * 0.35, color: "#38bdf8", size: 2 },
      { x: width * 0.82, y: height * 0.28, color: "#f59e0b", size: 2 },
    ],
    [width, height],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Deep-navy base gradient — night operations feel. */}
      <LinearGradient
        colors={["#03111f", "#0a1e33", "#0f2b46", "#082033"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* Slow-drifting colour orbs (blurred via opacity + large radius). */}
      <Orb
        color="#10b981"
        size={280}
        startX={-60}
        startY={80}
        endX={40}
        endY={140}
        duration={12000}
        opacity={0.35}
      />
      <Orb
        color="#0ea5e9"
        size={340}
        startX={width - 200}
        startY={40}
        endX={width - 260}
        endY={120}
        duration={14000}
        delay={2000}
        opacity={0.3}
      />
      <Orb
        color="#f59e0b"
        size={200}
        startX={width * 0.3}
        startY={height * 0.55}
        endX={width * 0.6}
        endY={height * 0.62}
        duration={16000}
        opacity={0.22}
      />
      <Orb
        color="#22d3ee"
        size={220}
        startX={-40}
        startY={height * 0.68}
        endX={20}
        endY={height * 0.62}
        duration={15000}
        delay={3500}
        opacity={0.25}
      />

      {/* Sensor "constellation" pinpoints. */}
      {particles.map((p, i) => (
        <Particle key={i} x={p.x} y={p.y} color={p.color} size={p.size} duration={3200 + (i % 4) * 400} delay={i * 350} />
      ))}

      {/* Ambient pulse rings behind where the brand mark will sit (top ~ 12% of screen). */}
      <View style={[styles.pulseAnchor, { top: height * 0.09, left: width / 2 - 70 }]}>
        <PulseRing size={140} color="#10b981" />
        <PulseRing size={140} color="#22d3ee" delay={1200} />
      </View>

      {/* Live data waves near the bottom third — evokes real-time streaming. */}
      <DataWave y={height - 200} color="#10b981" opacity={0.35} duration={9000} />
      <DataWave y={height - 160} color="#0ea5e9" opacity={0.28} duration={11000} />

      {/* Soft radial vignette to focus attention on the card. */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.55)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.4 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    shadowOpacity: 0.8,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.4,
  },
  pulseAnchor: {
    position: "absolute",
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  wave: {
    position: "absolute",
    height: 40,
  },
});
