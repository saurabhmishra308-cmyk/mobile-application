import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import LoginHero from "@/src/components/LoginHero";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing } from "@/src/theme";
import {
  BiometricSupport,
  authenticate,
  disableBiometric,
  enableBiometric,
  getBiometricSupport,
  getStoredCredentials,
  isBiometricEnabled,
} from "@/src/utils/biometric";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "pulse-outline", label: "Real-time data" },
  { icon: "time-outline", label: "24 × 7" },
  { icon: "shield-checkmark-outline", label: "CGWA ready" },
  { icon: "shield-checkmark-outline", label: "SGWA ready" },
  { icon: "shield-checkmark-outline", label: "CPCB / SPCB ready" },
];

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"email" | "pw" | null>(null);
  const [bioSupport, setBioSupport] = useState<BiometricSupport | null>(null);
  const [bioSaved, setBioSaved] = useState<boolean>(false);
  const [bioAuthing, setBioAuthing] = useState<boolean>(false);
  const [bioAutoRan, setBioAutoRan] = useState<boolean>(false);

  // Detect biometric support + whether user has previously opted-in.
  useEffect(() => {
    (async () => {
      const [sup, saved] = await Promise.all([
        getBiometricSupport(),
        isBiometricEnabled(),
      ]);
      setBioSupport(sup);
      setBioSaved(saved);
    })();
  }, []);

  const bioIcon: keyof typeof Ionicons.glyphMap = bioSupport?.faceId
    ? "scan-outline"
    : "finger-print-outline";
  const bioLabel = bioSupport?.faceId ? "Unlock with Face ID" : "Unlock with fingerprint";

  // ── Entrance animation ──
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(32);
  const brandOpacity = useSharedValue(0);
  const brandScale = useSharedValue(0.94);
  const featOpacity = useSharedValue(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // Brand fades + subtly scales in first.
    brandOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    brandScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    // Card lifts up after the brand settles.
    cardOpacity.value = withDelay(220, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    cardY.value = withDelay(220, withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) }));
    // Feature chips fade in last.
    featOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
  }, [brandOpacity, brandScale, cardOpacity, cardY, featOpacity]);

  // ── Continuous CTA breathing glow ──
  const ctaGlow = useSharedValue(0.7);
  // ── Heartbeat pulse for the wordmark (thump-thump … thump-thump) ──
  const heartScale = useSharedValue(1);
  const heartGlow = useSharedValue(0.35);
  useEffect(() => {
    ctaGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.7, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    // Heartbeat rhythm — quick double-beat then rest ~ 800ms.
    heartScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 110, easing: Easing.in(Easing.quad) }),
        withTiming(1.055, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 130, easing: Easing.in(Easing.quad) }),
        withTiming(1.0, { duration: 800 }), // rest
      ),
      -1,
    );
    heartGlow.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0.45, { duration: 110 }),
        withTiming(1.0, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 130 }),
        withTiming(0.35, { duration: 800 }), // rest
      ),
      -1,
    );
  }, [ctaGlow, heartScale, heartGlow]);

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ scale: brandScale.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));
  const featStyle = useAnimatedStyle(() => ({ opacity: featOpacity.value }));
  const ctaShadowStyle = useAnimatedStyle(() => ({ shadowOpacity: ctaGlow.value }));
  const heartbeatStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    shadowOpacity: heartGlow.value,
  }));
  const heartHaloStyle = useAnimatedStyle(() => ({
    opacity: heartGlow.value,
    transform: [{ scale: 1 + (heartScale.value - 1) * 2 }],
  }));

  const promptEnableBiometric = useCallback(
    (email: string, password: string) => {
      const title = bioSupport?.faceId ? "Enable Face ID?" : "Enable fingerprint unlock?";
      const msg = "Sign in next time with a single tap. Your credentials stay encrypted on this device only.";
      const doEnable = async () => {
        const ok = await authenticate(bioSupport?.faceId ? "Confirm Face ID" : "Confirm fingerprint");
        if (!ok) return;
        await enableBiometric(email, password);
        setBioSaved(true);
      };
      if (Platform.OS === "web") return; // browser preview doesn't have biometric
      Alert.alert(title, msg, [
        { text: "Not now", style: "cancel" },
        { text: "Enable", onPress: doEnable },
      ]);
    },
    [bioSupport?.faceId],
  );

  const onSubmit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // Offer to enable biometric on the very first successful login only.
      if (bioSupport?.supported && !bioSaved) {
        promptEnableBiometric(email.trim(), password);
      }
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, router, bioSupport?.supported, bioSaved, promptEnableBiometric]);

  const onBiometric = useCallback(async () => {
    if (bioAuthing) return;
    setBioAuthing(true);
    setError(null);
    try {
      const ok = await authenticate(bioLabel);
      if (!ok) return;
      const creds = await getStoredCredentials();
      if (!creds) {
        // stored creds gone; reset biometric state
        await disableBiometric();
        setBioSaved(false);
        setError("Please sign in with your password once more to re-enable biometric.");
        return;
      }
      setLoading(true);
      await signIn(creds.email, creds.password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.message || "Biometric sign-in failed. Please use your password.");
      // If the upstream password is no longer valid, purge stored creds.
      const status = (e && (e as any).status) as number | undefined;
      if (status === 401) {
        await disableBiometric();
        setBioSaved(false);
      }
    } finally {
      setBioAuthing(false);
      setLoading(false);
    }
  }, [bioAuthing, bioLabel, signIn, router]);

  // Auto-prompt biometric on cold-start once state is settled and user opted-in.
  useEffect(() => {
    if (bioAutoRan) return;
    if (!bioSupport || !bioSupport.supported || !bioSaved) return;
    setBioAutoRan(true);
    const t = setTimeout(() => onBiometric(), 900);
    return () => clearTimeout(t);
  }, [bioSupport, bioSaved, bioAutoRan, onBiometric]);

  return (
    <View style={styles.root}>
      {/* Cinematic animated backdrop */}
      <LoginHero />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Brand mark & hero copy ── */}
            <Animated.View style={[styles.brand, brandStyle]} testID="login-brand">
              <View style={styles.markWrap}>
                <View style={styles.markHalo} />
                <Image
                  source={require("../assets/images/envirolytics-logo.png")}
                  style={styles.markImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.wordmarkWrap}>
                <Animated.View style={[styles.wordmarkHalo, heartHaloStyle]} />
                <Animated.Image
                  source={require("../assets/images/envirolytics-wordmark.png")}
                  style={[styles.wordmark, heartbeatStyle]}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandTagline}>
                Environmental intelligence, in your pocket.
              </Text>
            </Animated.View>

            {/* ── Glassmorphism sign-in card ── */}
            <Animated.View style={[styles.cardWrap, cardStyle]} testID="login-form">
              {Platform.OS === "ios" ? (
                <BlurView intensity={30} tint="dark" style={styles.blur} />
              ) : (
                <View style={styles.blurFallback} />
              )}

              <View style={styles.cardInner}>
                <Text style={styles.cardTitle}>Welcome back</Text>
                <Text style={styles.cardSub}>Sign in to your monitoring workspace</Text>

                {/* Email */}
                <View
                  style={[
                    styles.inputWrap,
                    focusedField === "email" && styles.inputWrapFocus,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={focusedField === "email" ? colors.eco : "#94a3b8"}
                  />
                  <TextInput
                    testID="login-email-input"
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    placeholder="you@company.com"
                    placeholderTextColor="#64748b"
                    returnKeyType="next"
                  />
                </View>

                {/* Password */}
                <View
                  style={[
                    styles.inputWrap,
                    focusedField === "pw" && styles.inputWrapFocus,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={focusedField === "pw" ? colors.eco : "#94a3b8"}
                  />
                  <TextInput
                    testID="login-password-input"
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField("pw")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPw}
                    placeholder="Your password"
                    placeholderTextColor="#64748b"
                    returnKeyType="go"
                    onSubmitEditing={onSubmit}
                  />
                  <TouchableOpacity
                    testID="login-toggle-password"
                    onPress={() => setShowPw((v) => !v)}
                    hitSlop={12}
                  >
                    <Ionicons
                      name={showPw ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>

                {error ? (
                  <View style={styles.errorBox} testID="login-error">
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText} numberOfLines={2}>
                      {error}
                    </Text>
                  </View>
                ) : null}

                {/* CTA */}
                <Animated.View style={ctaShadowStyle}>
                  <TouchableOpacity
                    testID="login-submit-button"
                    activeOpacity={0.9}
                    onPress={onSubmit}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={
                        loading
                          ? ["#334155", "#1e293b"]
                          : ["#10b981", "#059669"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.submit}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.submitText}>Sign in</Text>
                          <Ionicons name="arrow-forward" size={18} color="#f0fdf4" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                {/* Biometric quick-unlock (shown only when device supports it and user opted-in) */}
                {bioSupport?.supported && bioSaved ? (
                  <TouchableOpacity
                    testID="login-biometric-button"
                    activeOpacity={0.85}
                    onPress={onBiometric}
                    disabled={bioAuthing || loading}
                    style={styles.bioBtn}
                  >
                    {bioAuthing ? (
                      <ActivityIndicator color={colors.eco} size="small" />
                    ) : (
                      <Ionicons name={bioIcon} size={18} color={colors.eco} />
                    )}
                    <Text style={styles.bioBtnText}>{bioLabel}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  testID="policies-link"
                  onPress={() => Linking.openURL("https://monitor.envirolytics.in/policies")}
                  style={styles.policyRow}
                  hitSlop={12}
                >
                  <Ionicons name="shield-outline" size={13} color="#94a3b8" />
                  <Text style={styles.policyText}>Privacy & Policies</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ── Feature chips ── */}
            <Animated.View style={[styles.features, featStyle]}>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.featChip}>
                  <Ionicons name={f.icon} size={12} color={colors.eco} />
                  <Text style={styles.featText}>{f.label}</Text>
                </View>
              ))}
            </Animated.View>

            <Text style={styles.footer}>v1.0.1 · Envirolytics Sustainability Pvt. Ltd.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#03111f" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: "center",
  },

  // ── Brand ──
  brand: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  markWrap: {
    marginBottom: spacing.md,
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
  },
  markHalo: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    shadowColor: "#10b981",
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  markImage: {
    width: 96,
    height: 96,
  },
  wordmarkWrap: {
    marginTop: 6,
    width: 300,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkHalo: {
    position: "absolute",
    width: 300,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    shadowColor: "#10b981",
    shadowOpacity: 0.75,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  wordmark: {
    width: 280,
    height: 62,
    // Green heartbeat glow so the wordmark subtly pulses.
    shadowColor: "#10b981",
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  brandTitle: {
    color: "#f0fdf4",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 5,
    marginTop: 4,
  },
  brandTagline: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    letterSpacing: 0.2,
  },

  // ── Card ──
  cardWrap: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    // A dark base so Android (no BlurView) still looks premium.
    backgroundColor: "rgba(6, 20, 36, 0.85)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  blur: { ...StyleSheet.absoluteFillObject },
  blurFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 30, 50, 0.55)",
  },
  cardInner: {
    padding: spacing.xl,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  cardSub: {
    color: "#94a3b8",
    fontSize: 12.5,
    marginTop: 6,
    marginBottom: spacing.lg,
    letterSpacing: 0.3,
  },

  // ── Inputs ──
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    marginBottom: 12,
  },
  inputWrapFocus: {
    borderColor: "rgba(16, 185, 129, 0.55)",
    backgroundColor: "rgba(16, 185, 129, 0.06)",
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14.5,
    paddingVertical: 0,
    fontWeight: "500",
  },

  // ── Error ──
  errorBox: {
    marginTop: 4,
    padding: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { color: "#fecaca", flex: 1, fontSize: 12.5, fontWeight: "500" },

  // ── CTA ──
  submit: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#10b981",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  submitText: {
    color: "#f0fdf4",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  bioBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  bioBtnText: {
    color: colors.eco,
    fontSize: 13.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  policyRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  policyText: { color: "#94a3b8", fontSize: 12, letterSpacing: 0.3 },

  // ── Feature chips ──
  features: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: spacing.xl,
  },
  featChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.28)",
  },
  featText: {
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  footer: {
    marginTop: spacing.lg,
    textAlign: "center",
    color: "#475569",
    fontSize: 10,
    letterSpacing: 1.4,
  },
});
