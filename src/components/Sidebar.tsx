"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    path: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/dashboard/tasks",
    path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8 12l3 3 5-6",
  },
  {
    id: "journal",
    label: "Journal",
    href: "/dashboard/journal",
    path: "M6 3h9l4 4v14H6zM9 12h7M9 16h7",
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { userEmail, logout } = useAuth();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10 md:hidden"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-20 h-screen w-60 flex flex-col
          border-r p-2.5 transition-transform duration-200
          md:sticky md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background: "var(--side)",
          borderColor: "var(--line)",
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 p-1.5">
          <span
            className="w-8 h-8 rounded-lg grid place-items-center"
            style={{ background: "var(--btn)", color: "var(--btnt)" }}
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
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8 12l3 3 5-6" />
            </svg>
          </span>
          <span className="overflow-hidden">
            <b className="block font-semibold text-sm" style={{ color: "var(--ink)" }}>
              Daily Routine
            </b>
            <small
              className="text-xs truncate block"
              style={{ color: "var(--mute)" }}
              title={userEmail || "Ashwin K P"}
            >
              {userEmail || "Ashwin K P"}
            </small>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 mt-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-2.5 py-1.5 px-2 rounded-[7px] no-underline text-sm transition-colors"
                style={{
                  color: "var(--ink)",
                  background: isActive ? "var(--act)" : "transparent",
                  boxShadow: isActive
                    ? "0 0 0 1px var(--line), 0 1px 2px rgba(0,0,0,0.06)"
                    : "none",
                }}
              >
                <svg
                  className="w-4 h-4 flex-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.path} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto p-2 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--mute)" }}>
            <span className="truncate max-w-[130px]" title={userEmail}>
              {userEmail ? "Logged in" : "Guest"}
            </span>
            <button
              onClick={() => logout()}
              className="hover:underline font-medium"
              style={{ color: "#ef4444" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
