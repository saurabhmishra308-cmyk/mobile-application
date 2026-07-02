import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Index() {
  const router = useRouter();
  const { ready, token } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (token) router.replace("/(tabs)/dashboard");
    else router.replace("/login");
  }, [ready, token, router]);

  return (
    <View style={styles.container} testID="app-boot-screen">
      <ActivityIndicator color={colors.eco} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
