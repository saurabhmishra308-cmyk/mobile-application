// Central helpers for biometric quick-unlock + onboarding flags.
// The mobile app stores nothing sensitive in plain AsyncStorage — the saved
// password lives ONLY in expo-secure-store (keychain / EncryptedSharedPreferences)
// and is gated behind the device biometric prompt before being used.

import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { storage } from "@/src/utils/storage";

export const BIOMETRIC_ENABLED_KEY = "envirolytics.biometric_enabled";
export const BIOMETRIC_EMAIL_KEY = "envirolytics.biometric_email";
export const BIOMETRIC_PASSWORD_KEY = "envirolytics.biometric_password";
export const ONBOARDING_SEEN_KEY = "envirolytics.onboarding_seen";

export type BiometricSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  supported: boolean;
  types: LocalAuthentication.AuthenticationType[];
  faceId: boolean;
  fingerprint: boolean;
};

// Some device labels reported inconsistently across Android OEMs; use icons.
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") {
    return {
      hasHardware: false,
      isEnrolled: false,
      supported: false,
      types: [],
      faceId: false,
      fingerprint: false,
    };
  }
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return {
    hasHardware,
    isEnrolled,
    supported: hasHardware && isEnrolled,
    types,
    faceId: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
    fingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
  };
}

// Prompts the OS biometric sheet. Resolves true only if the user succeeded.
export async function authenticate(reason: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use password",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}

// Persist opt-in + encrypted credentials so next launch can biometric-unlock.
export async function enableBiometric(email: string, password: string): Promise<void> {
  await storage.secureSet(BIOMETRIC_EMAIL_KEY, email);
  await storage.secureSet(BIOMETRIC_PASSWORD_KEY, password);
  await storage.setItem(BIOMETRIC_ENABLED_KEY, "1");
}

export async function disableBiometric(): Promise<void> {
  await storage.secureRemove(BIOMETRIC_EMAIL_KEY);
  await storage.secureRemove(BIOMETRIC_PASSWORD_KEY);
  await storage.removeItem(BIOMETRIC_ENABLED_KEY);
}

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await storage.getItem<string>(BIOMETRIC_ENABLED_KEY, "");
  return v === "1";
}

export async function getStoredCredentials(): Promise<{ email: string; password: string } | null> {
  const email = await storage.secureGet<string>(BIOMETRIC_EMAIL_KEY, "");
  const password = await storage.secureGet<string>(BIOMETRIC_PASSWORD_KEY, "");
  if (email && password) return { email, password };
  return null;
}

export async function hasSeenOnboarding(): Promise<boolean> {
  const v = await storage.getItem<string>(ONBOARDING_SEEN_KEY, "");
  return v === "1";
}

export async function markOnboardingSeen(): Promise<void> {
  await storage.setItem(ONBOARDING_SEEN_KEY, "1");
}
