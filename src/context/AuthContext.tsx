"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  userEmail: string;
  loading: boolean;
  loginWithPassword: (email: string, password: string, isSignUp?: boolean) => Promise<{ success: boolean; error?: string }>;
  sendVerificationCode: (email: string) => Promise<{ success: boolean; message?: string; testCode?: string; error?: string }>;
  verifyCode: (email: string, code: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  userEmail: "",
  loading: true,
  loginWithPassword: async () => ({ success: false }),
  sendVerificationCode: async () => ({ success: false }),
  verifyCode: async () => ({ success: false }),
  loginWithGoogle: async () => ({ success: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  // Check current session from the server on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.email) {
            setIsLoggedIn(true);
            setUserEmail(data.user.email);
          } else {
            setIsLoggedIn(false);
            setUserEmail("");
          }
        }
      } catch (err) {
        console.error("Failed to check auth status:", err);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string, isSignUp = false) => {
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, isSignUp }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Authentication failed" };
      }
      setIsLoggedIn(true);
      setUserEmail(data.user.email);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  }, []);

  const sendVerificationCode = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to send code" };
      }
      return {
        success: true,
        message: data.message,
        testCode: data.testCode,
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  }, []);

  const verifyCode = useCallback(async (email: string, code: string, newPassword?: string) => {
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Invalid code" };
      }
      setIsLoggedIn(true);
      setUserEmail(data.user.email);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "google_user@gmail.com" }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Google auth failed" };
      }
      setIsLoggedIn(true);
      setUserEmail(data.user.email);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setIsLoggedIn(false);
      setUserEmail("");
      window.location.href = "/";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        userEmail,
        loading,
        loginWithPassword,
        sendVerificationCode,
        verifyCode,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
