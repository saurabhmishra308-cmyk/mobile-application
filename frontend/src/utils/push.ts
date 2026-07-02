// Best-effort push registration. Only runs on native builds.
// Silently no-ops on web / Expo Go / when permission is denied.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import { registerPushOnBackend } from "@/src/api/client";

export async function registerForPush(userId: string, envirolyticsToken?: string) {
  try {
    if (Platform.OS === "web") return;
    if (!Device.isDevice) return; // simulator / emulator

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    if (!tokenResp?.data) return;

    await registerPushOnBackend({
      user_id: userId,
      platform: Platform.OS,
      device_token: String(tokenResp.data),
      envirolytics_token: envirolyticsToken,
    });
  } catch {
    // Non-fatal: push isn't required for the app to work in Expo Go.
  }
}
