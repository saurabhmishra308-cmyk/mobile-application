import { useCallback, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.bg, "#0e1620"]}
            style={styles.hero}
          >
            <View style={styles.badge} testID="login-brand">
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>ENVIROLYTICS</Text>
            </View>
            <Text style={styles.title}>Monitor</Text>
            <Text style={styles.subtitle}>
              Real-time environmental compliance monitoring for soil · water · air · biodiversity
            </Text>
          </LinearGradient>

          <View style={styles.card} testID="login-form">
            <Text style={styles.cardHeader}>Sign in to your account</Text>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                placeholder="you@company.com"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              <TouchableOpacity
                onPress={() => setShowPw((v) => !v)}
                hitSlop={10}
                testID="login-toggle-password"
              >
                <Ionicons
                  name={showPw ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textSecondary}
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
                <>
                  <Text style={styles.submitText}>Sign Me In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.footer}>VERSION 1.0 · SECURE LOGIN</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.eco,
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    textTransform: "uppercase",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderColor: "rgba(239, 68, 68, 0.30)",
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  errorText: { color: colors.danger, flex: 1, fontSize: 13 },
  submit: {
    marginTop: spacing.xl,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.eco,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  footer: {
    marginTop: spacing.xl,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: "center",
  },
});
