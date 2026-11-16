"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function handleAuth() {
      // 1. Check for errors in search parameters or hash
      const paramError = searchParams.get("error");
      const paramErrorDesc = searchParams.get("error_description");

      // Check URL hash if params don't have errors
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
      const hashError = hashParams.get("error");
      const hashErrorDesc = hashParams.get("error_description");

      const err = paramError || hashError;
      const desc = paramErrorDesc || hashErrorDesc;

      if (err || desc) {
        if (!mounted) return;
        setStatus("error");
        if (err === "unsupported_provider" || (desc && desc.toLowerCase().includes("not enabled"))) {
          setErrorMessage(
            "Google sign-in is not enabled in your Supabase project yet. You can enable it in the Supabase Dashboard (Authentication -> Providers -> Google)."
          );
        } else {
          setErrorMessage(desc || err || "Failed to authenticate with Google.");
        }
        return;
      }

      // 2. Check Supabase session from URL
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (!mounted) return;
          setStatus("error");
          setErrorMessage(sessionError.message);
          return;
        }

        const email = data?.session?.user?.email;

        if (email) {
          // Log into Taskit session backend
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });

          const result = await res.json();
          if (res.ok && result.success) {
            if (!mounted) return;
            setStatus("success");
            router.push("/dashboard");
            return;
          } else {
            if (!mounted) return;
            setStatus("error");
            setErrorMessage(result.error || "Failed to establish user session.");
            return;
          }
        }

        // Wait briefly for hash/PKCE exchange to finish
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user?.email && mounted) {
            const res = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: session.user.email }),
            });
            const result = await res.json();
            if (res.ok && result.success) {
              setStatus("success");
              router.push("/dashboard");
            }
          }
        });

        // Timeout fallback if no session received
        setTimeout(() => {
          if (mounted && status === "loading") {
            setStatus("error");
            setErrorMessage("No authentication details received. Please try again.");
          }
        }, 5000);

        return () => {
          subscription.unsubscribe();
        };
      } catch (err: any) {
        if (!mounted) return;
        setStatus("error");
        setErrorMessage(err.message || "Authentication error occurred.");
      }
    }

    handleAuth();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  const handleManualEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.includes("@")) {
      alert("Please enter a valid Google email address");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: manualEmail }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        router.push("/dashboard");
      } else {
        alert(result.error || "Failed to sign in");
      }
    } catch (err: any) {
      alert(err.message || "Failed to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      data-theme="dark"
      style={{ background: "#000000", color: "#ededed" }}
    >
      <div className="w-full max-w-md p-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md">
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-sm font-medium text-neutral-300">
              Connecting your Google account...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg font-bold">
              ✓
            </div>
            <p className="text-sm font-medium text-neutral-200">
              Signed in successfully! Redirecting to dashboard...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-bold text-neutral-100 mb-1">
                Google Authentication
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {errorMessage}
              </p>
            </div>

            {/* If Supabase provider is not yet turned on in the dashboard, allow user to enter their Google email directly */}
            <form onSubmit={handleManualEmailLogin} className="flex flex-col gap-3 pt-2 border-t border-neutral-800">
              <label className="text-xs font-semibold text-neutral-300">
                Continue with your Google email:
              </label>
              <input
                type="email"
                required
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full rounded-lg py-2.5 px-3.5 text-sm bg-neutral-950 border border-neutral-800 text-neutral-100 outline-none focus:border-neutral-600"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg py-2.5 px-4 text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors"
              >
                {submitting ? "Signing in..." : "Continue to Dashboard"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-xs text-neutral-400 hover:text-white transition-colors text-center"
            >
              ← Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

