// Animated scenic backdrop for the login screen — mirrors the web app's
// illustration: sky gradient, sun, drifting clouds, mountains, rotating wind
// turbines, plants in pots, solar panels, falling rain, water ripples,
// fireflies. Built with react-native-svg + react-native-reanimated so it runs
// natively on iOS + Android at 60fps.

import { useMemo } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

// A single wind turbine — pole + rotating blades.
function Turbine({
  x,
  bladeSize = 46,
  duration = 4200,
  delay = 0,
}: {
  x: number;
  bladeSize?: number;
  duration?: number;
  delay?: number;
}) {
  const rot = useSharedValue(0);
  // Start rotation once mounted.
  useMemo(() => {
    rot.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [rot, duration, delay]);
  const bladeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <View style={[styles.turbineWrap, { left: x }]} pointerEvents="none">
      {/* Pole */}
      <View style={styles.turbinePole} />
      {/* Rotating blades */}
      <Animated.View style={[styles.turbineBlades, { width: bladeSize * 2, height: bladeSize * 2 }, bladeStyle]}>
        <Svg width={bladeSize * 2} height={bladeSize * 2} viewBox="-50 -50 100 100">
          <G fill="#f1f5f9">
            <Path d="M0 0 L4 -46 L-4 -46 Z" />
            <Path d="M0 0 L40 -22 L44 -14 Z" />
            <Path d="M0 0 L-40 -22 L-44 -14 Z" />
          </G>
          <Circle r={5} fill="#cbd5e1" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// A drifting cloud that loops across the sky.
function Cloud({
  y,
  scale = 1,
  duration = 30000,
  delay = 0,
  opacity = 0.9,
}: {
  y: number;
  scale?: number;
  duration?: number;
  delay?: number;
  opacity?: number;
}) {
  const width = Dimensions.get("window").width;
  const x = useSharedValue(-140);
  useMemo(() => {
    x.value = withDelay(
      delay,
      withRepeat(withTiming(width + 140, { duration, easing: Easing.linear }), -1),
    );
  }, [x, width, duration, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale }],
  }));
  return (
    <Animated.View style={[styles.cloud, { top: y, opacity }, style]} pointerEvents="none">
      <Svg width={120} height={54} viewBox="0 0 120 54">
        <G fill="#f8fafc">
          <Ellipse cx="30" cy="34" rx="30" ry="18" />
          <Ellipse cx="60" cy="24" rx="28" ry="20" />
          <Ellipse cx="88" cy="34" rx="26" ry="16" />
        </G>
      </Svg>
    </Animated.View>
  );
}

// A single vertical rain streak that falls from the sky.
function RainDrop({
  x,
  topY,
  bottomY,
  duration,
  delay,
}: {
  x: number;
  topY: number;
  bottomY: number;
  duration: number;
  delay: number;
}) {
  const y = useSharedValue(topY);
  useMemo(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(bottomY, { duration, easing: Easing.in(Easing.quad) }),
          withTiming(topY, { duration: 0 }),
        ),
        -1,
      ),
    );
  }, [y, topY, bottomY, duration, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));
  return (
    <Animated.View style={[styles.rain, { left: x }, style]} pointerEvents="none">
      <Svg width={2} height={14}>
        <Rect width={2} height={14} rx={1} fill="#60a5fa" opacity={0.55} />
      </Svg>
    </Animated.View>
  );
}

// A pulsing firefly / distant light.
function Firefly({
  x,
  y,
  duration,
  delay,
  color = "#fbbf24",
  size = 4,
}: {
  x: number;
  y: number;
  duration: number;
  delay: number;
  color?: string;
  size?: number;
}) {
  const op = useSharedValue(0.2);
  useMemo(() => {
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration / 2 }),
          withTiming(0.15, { duration: duration / 2 }),
        ),
        -1,
      ),
    );
  }, [op, duration, delay]);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.firefly,
        {
          left: x,
          top: y,
          width: size * 2,
          height: size * 2,
          borderRadius: size,
          backgroundColor: color,
          shadowColor: color,
        },
        style,
      ]}
    />
  );
}

// A water ripple that expands and fades.
function Ripple({
  x,
  y,
  duration,
  delay,
}: {
  x: number;
  y: number;
  duration: number;
  delay: number;
}) {
  const scale = useSharedValue(0.4);
  const op = useSharedValue(0.8);
  useMemo(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(2.2, { duration, easing: Easing.out(Easing.quad) }),
          withTiming(0.4, { duration: 0 }),
        ),
        -1,
      ),
    );
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration, easing: Easing.out(Easing.quad) }),
          withTiming(0.8, { duration: 0 }),
        ),
        -1,
      ),
    );
  }, [scale, op, duration, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ripple, { left: x, top: y }, style]}>
      <Svg width={40} height={16}>
        <Ellipse cx={20} cy={8} rx={18} ry={6} stroke="#bae6fd" strokeWidth={1.2} fill="none" />
      </Svg>
    </Animated.View>
  );
}

// A small potted plant sitting on the ground.
function Plant({ x, size = 34 }: { x: number; size?: number }) {
  return (
    <View style={[styles.plant, { left: x, width: size, height: size + 14 }]} pointerEvents="none">
      <Svg width={size} height={size + 14} viewBox="0 0 34 48">
        {/* Pot */}
        <Polygon points="6,34 28,34 25,46 9,46" fill="#c2410c" />
        <Rect x="5" y="31" width="24" height="5" fill="#9a3412" />
        {/* Leaves */}
        <G fill="#22c55e" stroke="#166534" strokeWidth={0.5}>
          <Path d="M17 31 C 8 26 6 18 13 12 C 15 20 17 25 17 31 Z" />
          <Path d="M17 31 C 26 26 28 18 21 12 C 19 20 17 25 17 31 Z" />
          <Path d="M17 30 C 17 22 17 14 17 8" strokeWidth={1.6} />
        </G>
        <Circle cx="17" cy="8" r="2.4" fill="#f472b6" />
      </Svg>
    </View>
  );
}

// A tilted solar panel array.
function SolarPanel({ x, y }: { x: number; y: number }) {
  return (
    <View style={[styles.solar, { left: x, top: y }]} pointerEvents="none">
      <Svg width={54} height={38} viewBox="0 0 54 38">
        <G>
          <Polygon points="4,26 42,4 52,4 14,26" fill="#1e3a8a" />
          <Polygon points="14,26 52,4 52,10 14,32" fill="#1e40af" opacity={0.7} />
          <G stroke="#60a5fa" strokeWidth={0.6}>
            <Path d="M12 22 L46 4" />
            <Path d="M20 26 L54 8" />
          </G>
          <Rect x="26" y="26" width="2" height="10" fill="#334155" />
        </G>
      </Svg>
    </View>
  );
}

export default function LoginScene() {
  const width = Dimensions.get("window").width;
  const height = Dimensions.get("window").height;
  const groundY = height - 180;
  const waterY = height - 90;

  // Slow sun bob.
  const sunBob = useSharedValue(0);
  useMemo(() => {
    sunBob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
        withTiming(4, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [sunBob]);
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sunBob.value }] }));

  // Rain drop positions (spread across the whole width).
  const raindrops = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: (i * (width / 22)) + ((i % 3) * 7),
        delay: (i * 137) % 2200,
        duration: 1400 + ((i * 53) % 900),
      })),
    [width],
  );

  // Fireflies around the mountains.
  const fireflies = useMemo(
    () => [
      { x: width * 0.15, y: groundY - 40, delay: 0, duration: 2600 },
      { x: width * 0.28, y: groundY - 20, delay: 700, duration: 3400 },
      { x: width * 0.72, y: groundY - 55, delay: 1300, duration: 2900 },
      { x: width * 0.86, y: groundY - 22, delay: 400, duration: 3100 },
      { x: width * 0.45, y: groundY - 70, delay: 1900, duration: 2700 },
    ],
    [width, groundY],
  );

  // Ripples in the water.
  const ripples = useMemo(
    () => [
      { x: width * 0.15, y: waterY + 18, delay: 0, duration: 3200 },
      { x: width * 0.42, y: waterY + 40, delay: 1100, duration: 3600 },
      { x: width * 0.7, y: waterY + 22, delay: 1900, duration: 3000 },
      { x: width * 0.88, y: waterY + 46, delay: 500, duration: 3400 },
    ],
    [width, waterY],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Sky gradient */}
      <LinearGradient
        colors={["#8ec5e8", "#a9d4ec", "#c9e2f2", "#dfeef5"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Sun */}
      <Animated.View style={[styles.sunWrap, { top: 50, right: 30 }, sunStyle]} pointerEvents="none">
        <Svg width={110} height={110}>
          <Defs>
            <SvgLinearGradient id="sunG" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#fde68a" />
              <Stop offset="1" stopColor="#f59e0b" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={55} cy={55} r={40} fill="url(#sunG)" opacity={0.4} />
          <Circle cx={55} cy={55} r={30} fill="url(#sunG)" />
        </Svg>
      </Animated.View>

      {/* Distant birds */}
      <Bird x={width * 0.18} y={130} duration={22000} delay={0} />
      <Bird x={width * 0.62} y={170} duration={26000} delay={4000} />

      {/* Clouds */}
      <Cloud y={60} scale={0.95} duration={44000} delay={-8000} />
      <Cloud y={110} scale={0.7} duration={52000} delay={-24000} opacity={0.8} />
      <Cloud y={30} scale={1.15} duration={60000} delay={-32000} opacity={0.95} />

      {/* Mountains */}
      <View style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]} pointerEvents="none">
        <Svg width={width} height={220} viewBox={`0 0 ${width} 220`}>
          <G>
            <Polygon
              points={`0,220 ${width * 0.15},120 ${width * 0.28},170 ${width * 0.4},80 ${width * 0.55},175 ${width * 0.7},110 ${width * 0.85},175 ${width},130 ${width},220`}
              fill="#334e73"
            />
            <Polygon
              points={`0,220 ${width * 0.1},170 ${width * 0.22},210 ${width * 0.35},155 ${width * 0.5},210 ${width * 0.62},170 ${width * 0.78},205 ${width * 0.9},160 ${width},220`}
              fill="#4a678f"
              opacity={0.85}
            />
          </G>
        </Svg>
      </View>

      {/* Rain */}
      {raindrops.map((r, i) => (
        <RainDrop
          key={i}
          x={r.x}
          topY={-16}
          bottomY={groundY - 40}
          duration={r.duration}
          delay={r.delay}
        />
      ))}

      {/* Fireflies */}
      {fireflies.map((f, i) => (
        <Firefly key={i} x={f.x} y={f.y} duration={f.duration} delay={f.delay} />
      ))}

      {/* Ground strip */}
      <View style={[styles.ground, { top: groundY }]} pointerEvents="none" />

      {/* Wind turbines */}
      <Turbine x={width * 0.12} bladeSize={34} duration={5200} delay={0} />
      <Turbine x={width * 0.32} bladeSize={40} duration={4400} delay={800} />
      <Turbine x={width * 0.56} bladeSize={44} duration={3800} delay={1600} />
      <Turbine x={width * 0.78} bladeSize={32} duration={5600} delay={400} />

      {/* Solar panels */}
      <SolarPanel x={width * 0.72} y={groundY + 20} />
      <SolarPanel x={width * 0.84} y={groundY + 30} />

      {/* Potted plants along the ground line */}
      <Plant x={width * 0.06} size={30} />
      <Plant x={width * 0.2} size={32} />
      <Plant x={width * 0.36} size={30} />
      <Plant x={width * 0.5} size={34} />
      <Plant x={width * 0.62} size={30} />

      {/* Water */}
      <LinearGradient
        colors={["#1d4ed8", "#0ea5e9", "#38bdf8"]}
        style={[StyleSheet.absoluteFill, { top: waterY }]}
        pointerEvents="none"
      />
      {ripples.map((r, i) => (
        <Ripple key={i} x={r.x} y={r.y} duration={r.duration} delay={r.delay} />
      ))}
    </View>
  );
}

function Bird({ x, y, duration, delay }: { x: number; y: number; duration: number; delay: number }) {
  const width = Dimensions.get("window").width;
  const tx = useSharedValue(x);
  useMemo(() => {
    tx.value = withDelay(
      delay,
      withRepeat(withTiming(width + 30, { duration, easing: Easing.linear }), -1),
    );
  }, [tx, delay, duration, width]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  return (
    <Animated.View style={[styles.bird, { top: y }, style]} pointerEvents="none">
      <Svg width={22} height={10} viewBox="0 0 22 10">
        <Path
          d="M0 6 Q4 0 8 6 Q11 3 14 6 Q18 0 22 6"
          stroke="#1e293b"
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  turbineWrap: {
    position: "absolute",
    bottom: 90,
    width: 100,
    height: 200,
    alignItems: "center",
  },
  turbinePole: {
    position: "absolute",
    bottom: 0,
    width: 4,
    height: 130,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
  },
  turbineBlades: {
    position: "absolute",
    top: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  cloud: {
    position: "absolute",
    left: 0,
  },
  rain: {
    position: "absolute",
    top: 0,
  },
  firefly: {
    position: "absolute",
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  ripple: { position: "absolute" },
  plant: { position: "absolute", bottom: 60 },
  solar: { position: "absolute" },
  sunWrap: { position: "absolute" },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: "#c8a26a",
    borderTopWidth: 2,
    borderTopColor: "#84a24a",
  },
  bird: {
    position: "absolute",
    left: -30,
  },
});
