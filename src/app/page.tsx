"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "signup" | "forgot";

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

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
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

  // --- Login with Email & Password ---
  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password.trim() || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const res = await loginWithPassword(email.trim(), password, false);
    setLoading(false);

    if (res.success) {
      showToast("Logged in successfully!");
      router.push("/dashboard");
    } else {
      setError(res.error || "Login failed. Please check your credentials.");
      showToast(res.error || "Login failed", "error");
    }
  };

  // --- Send OTP Code (for Signup or Forgot Password) ---
  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (mode === "signup" && (!password.trim() || password.length < 6)) {
      setError("Please create a password (at least 6 characters)");
      return;
    }

    setLoading(true);
    const res = await sendVerificationCode(email.trim());
    setLoading(false);

    if (res.success) {
      setCodeSent(true);
      if (res.testCode) {
        setCode(res.testCode);
        showToast(`Code: ${res.testCode} (auto-filled for testing)`);
      } else {
        setCode("");
        showToast("Verification code sent to your email");
      }
    } else {
      setError(res.error || "Failed to send verification code");
      showToast(res.error || "Failed to send code", "error");
    }
  };

  // --- Verify Signup OTP & Create Account ---
  const handleVerifySignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!code.trim() || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    if (!password.trim() || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const res = await verifyCode(email.trim(), code.trim(), password.trim());
    setLoading(false);

    if (res.success) {
      showToast("Account created successfully! Welcome to taskit.");
      router.push("/dashboard");
    } else {
      setError(res.error || "Invalid verification code");
      showToast(res.error || "Invalid verification code", "error");
    }
  };

  // --- Reset Password using OTP ---
  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!code.trim() || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const res = await verifyCode(email.trim(), code.trim(), newPassword.trim());
    setLoading(false);

    if (res.success) {
      showToast("Password updated successfully! Welcome back.");
      router.push("/dashboard");
    } else {
      setError(res.error || "Failed to reset password. Check your code.");
      showToast(res.error || "Failed to reset password", "error");
    }
  };

  // --- Google OAuth ---
  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    const res = await loginWithGoogle();
    setLoading(false);
    if (res.success) {
      showToast("Signed in with Google!");
      router.push("/dashboard");
    } else {
      setError(res.error || "Google login failed");
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setCodeSent(false);
    setCode("");
    setPassword("");
    setNewPassword("");
  };

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div style={{ color: "var(--mute)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      data-theme="dark"
      style={{ background: "#020204", color: "#ededed" }}
    >
      {/* ========================================================================= */}
      {/* DYNAMIC HORIZON GLOW GRADIENT BACKGROUNDS (Cross-fade between modes) */}
      {/* ========================================================================= */}
      
      {/* 1. LOGIN BACKGROUND: Dark to Ultra-Violet / Purple Horizon Glow */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-700 ease-in-out"
        style={{
          opacity: mode === "login" ? 1 : 0,
          background: `
            radial-gradient(130% 40% at 50% 100%, rgba(147, 51, 234, 0.35) 0%, rgba(87, 54, 169, 0.2) 35%, transparent 70%),
            linear-gradient(180deg, #020204 0%, #020204 42%, #06040f 58%, #150b2e 70%, #2f1866 82%, #4c1d95 90%, #6d28d9 95%, #7c3aed 98%, #8b5cf6 100%)
          `,
        }}
      />

      {/* 2. SIGNUP BACKGROUND: Dark to Deep Sapphire / Electric Cyan Glow */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-700 ease-in-out"
        style={{
          opacity: mode === "signup" ? 1 : 0,
          background: `
            radial-gradient(130% 40% at 50% 100%, rgba(14, 165, 233, 0.35) 0%, rgba(2, 132, 199, 0.2) 35%, transparent 70%),
            linear-gradient(180deg, #020204 0%, #020204 42%, #030814 58%, #081d38 70%, #0e3b6e 82%, #0369a1 90%, #0284c7 95%, #0ea5e9 98%, #38bdf8 100%)
          `,
        }}
      />

      {/* 3. FORGOT PASSWORD BACKGROUND: Dark to Warm Amber Sunset Glow */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-700 ease-in-out"
        style={{
          opacity: mode === "forgot" ? 1 : 0,
          background: `
            radial-gradient(130% 40% at 50% 100%, rgba(245, 158, 11, 0.35) 0%, rgba(180, 83, 9, 0.2) 35%, transparent 70%),
            linear-gradient(180deg, #020204 0%, #020204 42%, #100602 58%, #2a1106 70%, #5a2609 82%, #78350f 90%, #b45309 95%, #d97706 98%, #f59e0b 100%)
          `,
        }}
      />

      {/* Main Auth Card Container */}
      <div
        className="w-full max-w-md relative z-10 p-6 sm:p-8 rounded-2xl border transition-all duration-300"
        style={{
          background: "rgba(10, 10, 15, 0.72)",
          borderColor:
            mode === "login"
              ? "rgba(180, 135, 254, 0.2)"
              : mode === "signup"
              ? "rgba(91, 192, 248, 0.2)"
              : "rgba(245, 158, 11, 0.2)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
        }}
      >
        {/* ========================================================================= */}
        {/* DISTINCT LOGOS ACCORDING TO AUTH FLOW */}
        {/* ========================================================================= */}
        {mode === "login" && (
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-md border transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(87, 54, 169, 0.3) 0%, rgba(47, 24, 102, 0.5) 100%)",
              borderColor: "rgba(180, 135, 254, 0.4)",
              boxShadow: "0 0 20px rgba(138, 96, 232, 0.2)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#cfa2ff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        )}

        {mode === "signup" && (
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-md border transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(20, 100, 170, 0.3) 0%, rgba(14, 59, 110, 0.5) 100%)",
              borderColor: "rgba(91, 192, 248, 0.4)",
              boxShadow: "0 0 20px rgba(34, 153, 235, 0.2)",
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5bc0f8"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18" />
              <path d="M8 12l3 3 5-6" />
            </svg>
          </div>
        )}

        {mode === "forgot" && (
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-md border transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(147, 66, 13, 0.3) 0%, rgba(90, 38, 9, 0.5) 100%)",
              borderColor: "rgba(245, 158, 11, 0.4)",
              boxShadow: "0 0 20px rgba(245, 158, 11, 0.2)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="m10.7 12.3 9.8-9.8" />
              <path d="m15.5 7.5 2 2" />
              <path d="m17.5 5.5 2 2" />
            </svg>
          </div>
        )}

        {/* Heading & Subtitle */}
        <h1
          className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          {mode === "login" && "Log in to your account"}
          {mode === "signup" && "Create your account"}
          {mode === "forgot" && "Reset your password"}
        </h1>

        <p className="mb-6 text-sm" style={{ color: "var(--mute)" }}>
          {mode === "login" && "Enter your email and password to access your routine and tasks"}
          {mode === "signup" && "Sign up seamlessly using an instant email verification code"}
          {mode === "forgot" && "Enter your email and we'll send a code to reset your password"}
        </p>

        {/* Error notification */}
        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm border"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              borderColor: "rgba(239, 68, 68, 0.25)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. LOGIN MODE: EMAIL & PASSWORD ONLY */}
        {/* ========================================================================= */}
        {mode === "login" && (
          <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                Email <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.com"
                className="w-full rounded-lg py-2.5 px-3.5 text-sm outline-none transition-colors border"
                style={{
                  background: "var(--bg)",
                  color: "var(--ink)",
                  borderColor: "var(--line)",
                }}
              />
            </div>

            {/* Password Field with Eye Toggle & Forgot Link */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  Password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs hover:underline transition-opacity opacity-75 hover:opacity-100 font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg py-2.5 pl-3.5 pr-10 text-sm outline-none transition-colors border"
                  style={{
                    background: "var(--bg)",
                    color: "var(--ink)",
                    borderColor: "var(--line)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-sm opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: "var(--ink)" }}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 px-4 text-sm font-semibold transition-opacity mt-1 shadow-sm"
              style={{
                background: "var(--btn)",
                color: "var(--btnt)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in..." : "Log in"}
            </button>
          </form>
        )}

        {/* ========================================================================= */}
        {/* 2. SIGNUP MODE: EMAIL, PASSWORD & OTP VERIFICATION */}
        {/* ========================================================================= */}
        {mode === "signup" && (
          <form
            onSubmit={codeSent ? handleVerifySignup : handleSendCode}
            className="flex flex-col gap-4"
          >
            {/* Email Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  Email Address <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {codeSent && (
                  <button
                    type="button"
                    onClick={() => setCodeSent(false)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Change email
                  </button>
                )}
              </div>

              <input
                type="email"
                required
                disabled={codeSent}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.com"
                className="w-full rounded-lg py-2.5 px-3.5 text-sm outline-none transition-colors border"
                style={{
                  background: "var(--bg)",
                  color: "var(--ink)",
                  borderColor: "var(--line)",
                  opacity: codeSent ? 0.7 : 1,
                }}
              />
            </div>

            {/* Create Password Field with Eye Toggle */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                {codeSent ? "Account Password" : "Create Password"}{" "}
                <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg py-2.5 pl-3.5 pr-10 text-sm outline-none transition-colors border"
                  style={{
                    background: "var(--bg)",
                    color: "var(--ink)",
                    borderColor: "var(--line)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-sm opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: "var(--ink)" }}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* OTP Code Input (when sent) */}
            {codeSent && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                  6-Digit Verification Code <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-lg py-2.5 px-3.5 text-base tracking-widest font-mono text-center outline-none transition-colors border font-bold"
                  style={{
                    background: "var(--bg)",
                    color: "var(--ink)",
                    borderColor: "var(--line)",
                  }}
                />
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span style={{ color: "var(--mute)" }}>We sent a code to your email</span>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading}
                    className="hover:underline font-medium text-blue-500"
                  >
                    Resend code
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 px-4 text-sm font-semibold transition-opacity mt-1 shadow-sm"
              style={{
                background: "var(--btn)",
                color: "var(--btnt)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? "Processing..."
                : codeSent
                ? "Verify Code & Create Account"
                : "Send Verification Code"}
            </button>
          </form>
        )}

        {/* ========================================================================= */}
        {/* 3. FORGOT PASSWORD MODE */}
        {/* ========================================================================= */}
        {mode === "forgot" && (
          <form
            onSubmit={codeSent ? handleResetPassword : handleSendCode}
            className="flex flex-col gap-4"
          >
            {/* Email Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  Account Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {codeSent && (
                  <button
                    type="button"
                    onClick={() => setCodeSent(false)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Change email
                  </button>
                )}
              </div>

              <input
                type="email"
                required
                disabled={codeSent}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.com"
                className="w-full rounded-lg py-2.5 px-3.5 text-sm outline-none transition-colors border"
                style={{
                  background: "var(--bg)",
                  color: "var(--ink)",
                  borderColor: "var(--line)",
                  opacity: codeSent ? 0.7 : 1,
                }}
              />
            </div>

            {/* When code sent: Code Input + New Password */}
            {codeSent && (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                    Verification Code <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-lg py-2.5 px-3.5 text-base tracking-widest font-mono text-center outline-none transition-colors border font-bold"
                    style={{
                      background: "var(--bg)",
                      color: "var(--ink)",
                      borderColor: "var(--line)",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                    New Password <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-lg py-2.5 pl-3.5 pr-10 text-sm outline-none transition-colors border"
                      style={{
                        background: "var(--bg)",
                        color: "var(--ink)",
                        borderColor: "var(--line)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-sm opacity-50 hover:opacity-100 transition-opacity"
                      style={{ color: "var(--ink)" }}
                      title={showNewPassword ? "Hide password" : "Show password"}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 px-4 text-sm font-semibold transition-opacity mt-1 shadow-sm"
              style={{
                background: "var(--btn)",
                color: "var(--btnt)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? "Processing..."
                : codeSent
                ? "Reset Password & Log in"
                : "Send Reset Code"}
            </button>

            {/* Back to login */}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="w-full py-2 text-xs font-medium hover:underline text-center"
              style={{ color: "var(--mute)" }}
            >
              ← Back to log in
            </button>
          </form>
        )}

        {/* ========================================================================= */}
        {/* GOOGLE SOCIAL AUTH (for Login & Signup modes) */}
        {/* ========================================================================= */}
        {mode !== "forgot" && (
          <>
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "var(--line)" }} />
              </div>
              <span
                className="relative px-3 text-xs uppercase font-medium"
                style={{ background: "#0e0e14", color: "var(--mute)" }}
              >
                or
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-lg py-2.5 px-4 text-sm font-medium transition-colors border hover:opacity-90 shadow-sm"
              style={{
                background: "var(--card)",
                color: "var(--ink)",
                borderColor: "var(--line)",
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
          </>
        )}

        {/* ========================================================================= */}
        {/* BOTTOM MODE SWITCHER */}
        {/* ========================================================================= */}
        {mode === "login" && (
          <p className="mt-6 text-sm text-center" style={{ color: "var(--ink)" }}>
            New member?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="underline font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Create an account.
            </button>
          </p>
        )}

        {mode === "signup" && (
          <p className="mt-6 text-sm text-center" style={{ color: "var(--ink)" }}>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="underline font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Log in here.
            </button>
          </p>
        )}
      </div>

      {/* Minimal Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all shadow-lg animate-toast"
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
