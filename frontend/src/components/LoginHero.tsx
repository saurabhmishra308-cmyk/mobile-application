// Login backdrop: a cinematic, dark, mobile-native scene that visually maps to
// what the Envirolytics platform actually monitors — water abstraction, air
// pollution, soil, and live analytics. Each domain gets its own subtle
// animated glyph so a first-time visitor immediately understands the app.
//
// Layout (top to bottom):
//   • Air layer   — rising smoke/particles + PM pill orbiting an AQI dot
//   • Analytics   — a live sine wave "heart-monitor" line drawn across mid-screen
//   • Water layer — animated water tank with rising fill level (abstraction)
//   • Soil layer  — cross-section with an animated pulse from a soil probe
//
// Built with react-native-svg + reanimated so it runs 60 fps on device.

import { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLG,
  Path,
  Rect,
  Stop,
  G,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── AIR: a smokestack that emits pulsing particles + an AQI ring badge ──
function SmokeParticle({ delay, offsetX }: { delay: number; offsetX: number }) {
  const puff = useSharedValue(0);
  useEffect(() => {
    puff.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.out(Easing.quad) }),
      -1,
    );
  }, [puff]);
  const style = useAnimatedStyle(() => {
    const p = (puff.value + delay) % 1;
    return {
      transform: [
        { translateY: -70 * p },
        { translateX: offsetX * Math.sin(p * Math.PI * 2) },
        { scale: 1 - p * 0.6 },
      ],
      opacity: 0.55 * (1 - p),
    };
  });
  return <Animated.View style={[styles.smokeParticle, style]} />;
}

function AirLayer({ x, y }: { x: number; y: number }) {
  return (
    <View style={[styles.abs, { left: x, top: y }]} pointerEvents="none">
      {/* Stack */}
      <Svg width={60} height={80} viewBox="0 0 60 80">
        <Defs>
          <SvgLG id="stackG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f59e0b" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#7c2d12" stopOpacity={0.9} />
          </SvgLG>
        </Defs>
        <Rect x="20" y="30" width="20" height="46" rx="3" fill="url(#stackG)" opacity={0.7} />
        <Rect x="18" y="26" width="24" height="8" rx="2" fill="#78350f" opacity={0.8} />
      </Svg>
      {/* Smoke particles */}
      <SmokeParticle delay={0} offsetX={6} />
      <SmokeParticle delay={0.33} offsetX={-6} />
      <SmokeParticle delay={0.66} offsetX={4} />
    </View>
  );
}

// ── AQI badge: a soft orbiting dot on a ring ──
function AqiBadge({ x, y }: { x: number; y: number }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1);
  }, [rot]);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  return (
    <View style={[styles.abs, { left: x, top: y }]} pointerEvents="none">
      <Svg width={62} height={62} viewBox="0 0 62 62">
        <Circle cx={31} cy={31} r={26} stroke="rgba(245, 158, 11, 0.35)" strokeWidth={1} fill="none" />
        <Circle cx={31} cy={31} r={18} stroke="rgba(245, 158, 11, 0.2)" strokeWidth={0.6} fill="none" />
      </Svg>
      <Animated.View style={[styles.aqiOrbit, dotStyle]}>
        <View style={styles.aqiDot} />
      </Animated.View>
    </View>
  );
}

// ── ANALYTICS: a live moving sine "heart-monitor" data trace ──
function AnalyticsWave({ y, width }: { y: number; width: number }) {
  const shift = useSharedValue(0);
  useEffect(() => {
    shift.value = withRepeat(withTiming(width, { duration: 5200, easing: Easing.linear }), -1, false);
  }, [shift, width]);

  const buildPath = (offset: number) => {
    const w = width * 2;
    const amp = 10;
    const pts: string[] = [];
    for (let x = 0; x <= w; x += 6) {
      // primary sine + a subtle secondary harmonic for realism
      const y1 = Math.sin(((x + offset) / w) * Math.PI * 6) * amp;
      const y2 = Math.sin(((x + offset) / w) * Math.PI * 14) * (amp * 0.25);
      pts.push(`${x === 0 ? "M" : "L"}${x} ${y1 + y2}`);
    }
    return pts.join(" ");
  };
  const animatedProps = useAnimatedProps(() => ({ d: buildPath(-shift.value) }));

  return (
    <View pointerEvents="none" style={[styles.abs, { top: y, width: width * 2 }]}>
      <Svg width={width * 2} height={30}>
        <Defs>
          <SvgLG id="waveStroke" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#10b981" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#10b981" stopOpacity={0.85} />
            <Stop offset="1" stopColor="#22d3ee" stopOpacity={0} />
          </SvgLG>
        </Defs>
        <AnimatedPath
          animatedProps={animatedProps}
          stroke="url(#waveStroke)"
          strokeWidth={1.6}
          fill="none"
        />
      </Svg>
    </View>
  );
}

// ── WATER: an aquifer tank with a rising fill level (abstraction) ──
function WaterTank({ x, y }: { x: number; y: number }) {
  const level = useSharedValue(0.35);
  useEffect(() => {
    level.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 4600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: 4600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [level]);

  const fillProps = useAnimatedProps(() => {
    const H = 62;
    const h = H * level.value;
    return { y: H - h, height: h } as any;
  });

  return (
    <View style={[styles.abs, { left: x, top: y }]} pointerEvents="none">
      <Svg width={54} height={74} viewBox="0 0 54 74">
        <Defs>
          <SvgLG id="waterG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#38bdf8" stopOpacity={0.85} />
            <Stop offset="1" stopColor="#0369a1" stopOpacity={0.95} />
          </SvgLG>
        </Defs>
        {/* Tank walls */}
        <Rect x="4" y="8" width="46" height="62" rx="4" stroke="rgba(56, 189, 248, 0.55)" strokeWidth={1.2} fill="none" />
        {/* Animated water fill */}
        <AnimatedRect x={5} width={44} rx={3} fill="url(#waterG)" animatedProps={fillProps} />
        {/* Wave crest lines */}
        <Path d="M6 20 Q16 16 26 20 T50 20" stroke="rgba(255,255,255,0.35)" strokeWidth={1} fill="none" />
        <Path d="M6 24 Q16 20 26 24 T50 24" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} fill="none" />
        {/* Tap / abstraction pipe */}
        <Path d="M2 46 h-3 M-1 46 v6 h5" stroke="#94a3b8" strokeWidth={1.4} fill="none" />
      </Svg>
    </View>
  );
}

// ── SOIL: a horizontal soil cross-section with a pulsing sensor probe ──
function SoilStrip({ y, width }: { y: number; width: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1400 }),
      ),
      -1,
    );
  }, [pulse]);
  const ringProps = useAnimatedProps(() => ({
    r: 3 + 22 * pulse.value,
    opacity: 0.55 * (1 - pulse.value),
  }));

  return (
    <View pointerEvents="none" style={[styles.abs, { top: y, width }]}>
      <Svg width={width} height={64} viewBox={`0 0 ${width} 64`}>
        <Defs>
          <SvgLG id="soilG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7c2d12" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#431407" stopOpacity={0.85} />
          </SvgLG>
        </Defs>
        {/* Ground line */}
        <Path d={`M0 6 L${width} 6`} stroke="rgba(148, 163, 184, 0.35)" strokeWidth={0.8} />
        {/* Two subtle soil layers */}
        <Rect x={0} y={6} width={width} height={22} fill="url(#soilG)" opacity={0.65} />
        <Rect x={0} y={28} width={width} height={36} fill="#3f0f04" opacity={0.55} />
        {/* Tiny "roots" or texture strokes */}
        <G stroke="rgba(190, 118, 60, 0.4)" strokeWidth={0.6}>
          <Line x1={width * 0.15} y1={8} x2={width * 0.13} y2={26} />
          <Line x1={width * 0.4} y1={8} x2={width * 0.42} y2={30} />
          <Line x1={width * 0.65} y1={8} x2={width * 0.66} y2={22} />
          <Line x1={width * 0.88} y1={8} x2={width * 0.86} y2={28} />
        </G>
        {/* Sensor probe stem going down */}
        <Line x1={width * 0.75} y1={-16} x2={width * 0.75} y2={40} stroke="#94a3b8" strokeWidth={1.2} />
        {/* Pulsing probe reading — expanding ring */}
        <AnimatedCircle cx={width * 0.75} cy={40} fill="none" stroke="#10b981" strokeWidth={1.2} animatedProps={ringProps} />
        <Circle cx={width * 0.75} cy={40} r={3} fill="#10b981" />
      </Svg>
    </View>
  );
}

// ── Constellations: a few slow-drifting sensor pinpoints on top layer. ──
function Particle({ x, y, color, size = 3, delay = 0 }: { x: number; y: number; color: string; size?: number; delay?: number }) {
  const op = useSharedValue(0.15);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600 }),
        withTiming(0.15, { duration: 1600 }),
      ),
      -1,
    );
  }, [op, delay]);
  const s = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: x, top: y, width: size * 2, height: size * 2, borderRadius: size, backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6 },
        s,
      ]}
    />
  );
}

export default function LoginHero() {
  const { width, height } = Dimensions.get("window");

  const particles = useMemo(
    () => [
      { x: width * 0.1, y: height * 0.11, color: "#22d3ee", size: 2 },
      { x: width * 0.4, y: height * 0.06, color: "#f59e0b", size: 2 },
      { x: width * 0.65, y: height * 0.14, color: "#10b981", size: 3 },
      { x: width * 0.88, y: height * 0.09, color: "#38bdf8", size: 2 },
      { x: width * 0.18, y: height * 0.42, color: "#22d3ee", size: 2 },
      { x: width * 0.55, y: height * 0.48, color: "#10b981", size: 2 },
    ],
    [width, height],
  );

  const analyticsY = height * 0.55;
  const soilY = height - 90;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Deep-navy night sky */}
      <LinearGradient
        colors={["#03111f", "#0a1e33", "#0f2b46", "#082033"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* Subtle atmospheric colour wash */}
      <LinearGradient
        colors={["rgba(16, 185, 129, 0.10)", "rgba(56, 189, 248, 0.06)", "transparent"]}
        style={[StyleSheet.absoluteFill, { top: 0, height: height * 0.6 }]}
      />

      {/* AIR — smokestack + AQI badge, top left and top right */}
      <AirLayer x={width * 0.06} y={height * 0.12} />
      <AqiBadge x={width * 0.78} y={height * 0.09} />

      {/* Constellation pinpoints (subtle) */}
      {particles.map((p, i) => (
        <Particle key={i} x={p.x} y={p.y} color={p.color} size={p.size} delay={i * 400} />
      ))}

      {/* ANALYTICS — heart-monitor sine wave across mid screen */}
      <AnalyticsWave y={analyticsY} width={width} />
      <AnalyticsWave y={analyticsY + 30} width={width} />

      {/* WATER — tank on lower left */}
      <WaterTank x={width * 0.05} y={height - 190} />

      {/* SOIL — cross-section along the bottom */}
      <SoilStrip y={soilY} width={width} />

      {/* Focus vignette on the card area */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.55)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.35 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  smokeParticle: {
    position: "absolute",
    left: 24,
    top: 22,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(148, 163, 184, 0.55)",
  },
  aqiOrbit: {
    position: "absolute",
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  aqiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fbbf24",
    marginTop: 3,
    shadowColor: "#fbbf24",
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
});
