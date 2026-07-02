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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import LoginScene from "@/src/components/LoginScene";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card entrance animation (matches web's fade+slide-up feel).
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(24);
  const badgeOpacity = useSharedValue(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    cardOpacity.value = withDelay(150, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    cardY.value = withDelay(150, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
    badgeOpacity.value = withDelay(60, withTiming(1, { duration: 600 }));
  }, [cardOpacity, cardY, badgeOpacity]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badgeOpacity.value }));

  const onSubmit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Animated scenic backdrop */}
      <LoginScene />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.card, cardStyle]} testID="login-form">
            <Animated.View style={[styles.brand, badgeStyle]} testID="login-brand">
              <Text style={styles.brandTitle}>ENVIROLYTICS</Text>
              <Text style={styles.brandSubtitle}>
                SUSTAINABILITY · PRIVATE · LIMITED
              </Text>
            </Animated.View>

            <Text style={styles.heading}>Sign in to your account</Text>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              placeholder="admin@envirolytics.com"
              placeholderTextColor="#94a3b8"
              returnKeyType="next"
            />

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.pwWrap}>
              <TextInput
                testID="login-password-input"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              <TouchableOpacity
                testID="login-toggle-password"
                onPress={() => setShowPw((v) => !v)}
                hitSlop={10}
                style={styles.pwToggle}
              >
                <Ionicons
                  name={showPw ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox} testID="login-error">
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              testID="login-submit-button"
              activeOpacity={0.85}
              style={[styles.submit, loading && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Sign Me In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="policies-link"
              onPress={() => Linking.openURL("https://monitor.envirolytics.in/policies")}
              style={styles.policyRow}
              hitSlop={8}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.text} />
              <Text style={styles.policyText}>Policies</Text>
            </TouchableOpacity>

            <Text style={styles.footer}>VERSION 1.0 · SECURE LOGIN</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#8ec5e8" },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  card: {
    padding: spacing.xl,
    backgroundColor: "rgba(26, 35, 50, 0.94)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    // Subtle glow to lift the card off the busy scene.
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  brand: { alignItems: "center", marginBottom: spacing.lg },
  brandTitle: {
    color: "#4aa3d8",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 6,
  },
  brandSubtitle: {
    color: "#cbd5e1",
    fontSize: 10.5,
    letterSpacing: 3,
    marginTop: 4,
  },
  heading: {
    color: "#f8fafc",
    fontSize: 18,
    textAlign: "center",
    marginVertical: spacing.md,
    fontWeight: "600",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 4,
  },
  pwWrap: { flexDirection: "row", alignItems: "center" },
  pwToggle: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  errorText: { color: "#fecaca", flex: 1, fontSize: 12.5 },
  submit: {
    marginTop: spacing.xl,
    alignSelf: "center",
    minWidth: 160,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    // Warm glow like the web button.
    shadowColor: "#f59e0b",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  policyRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  policyText: { color: "#f8fafc", fontSize: 13 },
  footer: {
    marginTop: spacing.md,
    color: "#94a3b8",
    fontSize: 10,
    letterSpacing: 2,
    textAlign: "center",
  },
});
