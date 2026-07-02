import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { storage } from "@/src/utils/storage";
import {
  TOKEN_KEY,
  USER_KEY,
  UserProfile,
  api,
  loginRequest,
} from "@/src/api/client";

type AuthState = {
  ready: boolean;
  token: string | null;
  user: UserProfile | null;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  refreshUser: (u: UserProfile) => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet<string>(TOKEN_KEY, "");
      const uRaw = await storage.getItem<string>(USER_KEY, "");
      if (t) setToken(t);
      if (uRaw) {
        try {
          setUser(JSON.parse(uRaw));
        } catch {}
      }
      setReady(true);
      // Refresh the full profile in the background if we already had a token.
      if (t) {
        try {
          const me = await api.me();
          await storage.setItem(USER_KEY, JSON.stringify(me));
          setUser(me);
        } catch {}
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password);
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setToken(res.access_token);
    // Fetch full profile (auth/login returns a subset — missing location/username/is_active).
    let profile: UserProfile = res.user;
    try {
      profile = await api.me();
    } catch {}
    await storage.setItem(USER_KEY, JSON.stringify(profile));
    setUser(profile);
    return profile;
  }, []);

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (u: UserProfile) => {
    await storage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, token, user, signIn, signOut, refreshUser }),
    [ready, token, user, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
