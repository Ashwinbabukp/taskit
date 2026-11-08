"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const {
    isLoggedIn,
    loading: authLoading,
    loginWithPassword,
    sendVerificationCode,
    verifyCode,
    loginWithGoogle,
  } = useAuth();

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      router.replace("/dashboard");
    }
  }, [isLoggedIn, authLoading, router]);

  const handlePasswordLogin = async () => {
    setError("");

    if (!showPassword) {
      setShowPassword(true);
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password.trim() || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const res = await loginWithPassword(email.trim(), password, isSignUp);
    setLoading(false);

    if (res.success) {
      router.push("/dashboard");
    } else {
      setError(res.error || "Login failed");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    const res = await loginWithGoogle();
    setLoading(false);
    if (res.success) {
      router.push("/dashboard");
    } else {
      setError(res.error || "Google login failed");
    }
  };

  const handleSendOrVerifyCode = async () => {
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (codeSent) {
      // Verify code
      if (!code.trim()) {
        setError("Please enter the verification code");
        return;
      }
      setLoading(true);
      const res = await verifyCode(email.trim(), code.trim());
      setLoading(false);
      if (res.success) {
        showToast("Logged in successfully!");
        router.push("/dashboard");
      } else {
        setError(res.error || "Invalid verification code");
        showToast(res.error || "Invalid verification code", "error");
      }
    } else {
      // Send code
      setLoading(true);
      const res = await sendVerificationCode(email.trim());
      setLoading(false);
      if (res.success) {
        setCodeSent(true);
        setCode("");
        showToast("Verification code sent to your email");
      } else {
        setError(res.error || "Failed to send code");
        showToast(res.error || "Failed to send code", "error");
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div style={{ color: "var(--mute)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo badge with cyan background */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8"
          style={{ background: "#0ea5e9" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18" />
            <path d="M8 12l3 3 5-6" />
          </svg>
        </div>

        {/* Heading */}
        <h1
          className="text-3xl font-bold mb-2 tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          {isSignUp ? "Create your account" : "Log in to your account"}
        </h1>
        <p className="mb-8" style={{ color: "var(--mute)", fontSize: "15px" }}>
          Get started and explore the easiest way to manage your daily tasks and journal
        </p>

        {/* Error message */}
        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ background: "#fee2e2", color: "#b91c1c" }}
          >
            {error}
          </div>
        )}

        {/* Continue with password */}
        <button
          type="button"
          onClick={handlePasswordLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-lg py-3.5 px-4 mb-3 text-sm font-medium transition-colors"
          style={{
            background: "var(--card)",
            color: "var(--ink)",
            border: "none",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="7.5" cy="15.5" r="4.5" />
            <path d="m10.7 12.3 9.8-9.8" />
            <path d="m15.5 7.5 2 2" />
            <path d="m17.5 5.5 2 2" />
          </svg>
          {showPassword
            ? isSignUp
              ? "Create account with password"
              : "Submit password login"
            : "Continue with password"}
        </button>

        {/* Continue with Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-lg py-3.5 px-4 mb-8 text-sm font-medium transition-colors"
          style={{
            background: "var(--card)",
            color: "var(--ink)",
            border: "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Password input when expanded */}
        {showPassword && (
          <div className="mb-5">
            <label
              className="block text-sm mb-1.5 font-medium"
              style={{ color: "var(--ink)" }}
            >
              Password <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password (min 6 chars)"
              className="w-full rounded-lg py-3 px-4 text-sm outline-none"
              style={{
                background: "var(--bg)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePasswordLogin();
              }}
            />
          </div>
        )}

        {/* Email field */}
        <div className="mb-5">
          <label
            className="block text-sm mb-1.5 font-medium"
            style={{ color: "var(--ink)" }}
          >
            Email <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="johndoe@mail.com"
            className="w-full rounded-lg py-3 px-4 text-sm outline-none"
            style={{
              background: "var(--bg)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (showPassword) handlePasswordLogin();
                else handleSendOrVerifyCode();
              }
            }}
          />
        </div>

        {/* Verification code input */}
        {codeSent && (
          <div className="mb-5">
            <label
              className="block text-sm mb-1.5 font-medium"
              style={{ color: "var(--ink)" }}
            >
              Verification Code <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="w-full rounded-lg py-3 px-4 text-sm outline-none tracking-widest font-mono"
              style={{
                background: "var(--bg)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendOrVerifyCode();
              }}
            />
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={showPassword ? handlePasswordLogin : handleSendOrVerifyCode}
          disabled={loading}
          className="w-full rounded-lg py-3.5 px-4 text-sm font-medium transition-colors"
          style={{
            background: "var(--btn)",
            color: "var(--btnt)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? "Processing..."
            : showPassword
            ? isSignUp
              ? "Create account"
              : "Log in"
            : codeSent
            ? "Verify code & enter"
            : "Send verification code"}
        </button>

        {/* Switch between sign in / sign up */}
        <p className="mt-6 text-sm" style={{ color: "var(--ink)" }}>
          {isSignUp ? "Already have an account? " : "New member? "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="underline font-medium"
            style={{ color: "var(--ink)" }}
          >
            {isSignUp ? "Log in here." : "Create a new account."}
          </button>
        </p>
      </div>

      {/* Minimal Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all shadow-lg animate-fade-in"
          style={{
            background: "#18181b",
            color: "#fafafa",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.35)",
          }}
        >
          {toast.type === "error" ? (
            <svg
              className="w-4 h-4 flex-none"
              style={{ color: "#f87171" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 flex-none"
              style={{ color: "#34d399" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
