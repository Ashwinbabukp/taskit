"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isJourney = pathname?.startsWith("/dashboard/journey");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/");
    }
  }, [isLoggedIn, loading, router]);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      return next;
    });
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)", color: "var(--mute)" }}
      >
        Loading...
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <div
      className={`flex ${isJourney ? "h-screen overflow-hidden" : "min-h-screen"}`}
      style={{ background: "var(--bg)" }}
    >
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <div
          className="h-[52px] flex-none flex items-center gap-2.5 px-5 sticky top-0 z-10"
          style={{
            borderBottom: "1px solid var(--line)",
            background: "var(--bg)",
          }}
        >
          {/* Mobile menu button */}
          <button
            className="flex items-center gap-1.5 rounded-[7px] py-1.5 px-3 md:hidden"
            style={{ background: "var(--hover-color)", color: "var(--ink)" }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1
            className="text-base font-semibold flex-1 m-0"
            style={{ color: "var(--ink)" }}
            id="page-title"
          />

          <button
            className="flex items-center gap-1.5 rounded-[7px] py-1.5 px-3 text-sm"
            style={{ background: "var(--hover-color)", color: "var(--ink)" }}
            onClick={toggleTheme}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
            Theme
          </button>
        </div>

        {/* Content area */}
        {isJourney ? (
          <div className="p-3 sm:p-5 flex-1 min-h-0 flex flex-col w-full overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="p-5 max-w-[1100px] w-full flex-1 overflow-y-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
