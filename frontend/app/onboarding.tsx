// First-launch onboarding — a 2-slide swipeable intro shown before the login
// form the very first time the app is opened. Each slide highlights a core
// value prop: live monitoring and compliance-ready reports. Persists a
// `envirolytics.onboarding_seen = "1"` flag so returning users never see it.

import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import LoginHero from "@/src/components/LoginHero";
import { markOnboardingSeen } from "@/src/utils/biometric";
import { colors, spacing } from "@/src/theme";

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "live",
    icon: "pulse-outline",
    color: "#10b981",
    title: "Live Field Monitoring",
    body: "See water abstraction, air quality, STP effluent and soil health straight from your sensors — updated the moment your IoT devices report.",
  },
  {
    key: "compliance",
    icon: "shield-checkmark-outline",
    color: "#38bdf8",
    title: "Compliance-Ready Reports",
    body: "One tap to download or email CGWA · SGWA · CPCB / SPCB reports in Excel and PDF. Weekly and monthly schedules keep your inspector happy.",
  },
];

const { width } = Dimensions.get("window");

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index !== null && first?.index !== undefined) {
        setIndex(first.index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const finish = useCallback(async () => {
    await markOnboardingSeen();
    router.replace("/login");
  }, [router]);

  const next = useCallback(() => {
    if (index < SLIDES.length - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      listRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    } else {
      finish();
    }
  }, [index, finish]);

  return (
    <View style={styles.root}>
      <LoginHero />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <TouchableOpacity
            testID="onboarding-skip"
            onPress={finish}
            hitSlop={12}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => (
            <View style={styles.slide} testID={`onboarding-slide-${item.key}`}>
              <View style={[styles.iconWrap, { backgroundColor: `${item.color}22`, borderColor: `${item.color}55` }]}>
                <LinearGradient
                  colors={[`${item.color}55`, `${item.color}11`]}
                  style={styles.iconGradient}
                >
                  <Ionicons name={item.icon} size={64} color={item.color} />
                </LinearGradient>
              </View>
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideBody}>{item.body}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index && { width: 22, backgroundColor: colors.eco },
                ]}
              />
            ))}
          </View>
          <TouchableOpacity
            testID="onboarding-next"
            onPress={next}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#10b981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>
                {index < SLIDES.length - 1 ? "Next" : "Get started"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#f0fdf4" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#03111f" },
  top: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  skipText: { color: "#94a3b8", fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },

  slide: {
    width,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingBottom: 40,
  },
  iconWrap: {
    width: 168,
    height: 168,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  iconGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  slideTitle: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  slideBody: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(148,163,184,0.35)",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#10b981",
    shadowOpacity: 0.6,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaText: {
    color: "#f0fdf4",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
