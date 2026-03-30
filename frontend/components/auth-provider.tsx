"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import {
  AuthUser,
  clearApiCache,
  getMe,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  registerWithGoogle as apiRegisterWithGoogle,
} from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  googleAuthEnabled: boolean;
  login: (idToken: string, captchaToken: string) => Promise<void>;
  register: (idToken: string, captchaToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const googleAuthEnabled = googleClientId.length > 0;

  const refreshUser = async () => {
    try {
      const userData = await getMe();
      setUser(userData);
    } catch (err) {
      clearApiCache();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (idToken: string, captchaToken: string) => {
    setLoading(true);
    try {
      const response = await apiLoginWithGoogle(idToken, captchaToken);
      setUser(response.user);
    } catch (err) {
      console.error("Login failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (idToken: string, captchaToken: string) => {
    setLoading(true);
    try {
      const response = await apiRegisterWithGoogle(idToken, captchaToken);
      setUser(response.user);
    } catch (err) {
      console.error("Register failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiLogout();
      clearApiCache();
      setUser(null);
      router.push("/");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <AuthContext.Provider value={{ user, loading, googleAuthEnabled, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );

  if (!googleAuthEnabled) {
    return content;
  }

  return <GoogleOAuthProvider clientId={googleClientId}>{content}</GoogleOAuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
