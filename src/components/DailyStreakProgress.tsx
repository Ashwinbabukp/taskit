"use client";

import React, { useState } from "react";
import { useData } from "@/context/DataContext";
import { calculateStreak, getOverdueTasks } from "@/lib/analytics";
import OverdueTasksModal from "./OverdueTasksModal";

interface DailyStreakProgressProps {
  className?: string;
  compact?: boolean;
}

export default function DailyStreakProgress({
  className = "",
  compact = false,
}: DailyStreakProgressProps) {
  const { db } = useData();
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  const streak = calculateStreak(db.tasks);
  const overdueTasks = getOverdueTasks(db.tasks);

  return (
    <>
      <div
        className={`rounded-2xl border p-4 flex flex-col gap-3 transition-colors ${className}`}
        style={{
          background: "var(--card)",
          borderColor: "var(--line)",
          color: "var(--ink)",
        }}
      >
        {/* Top Header: Streak badge + Overdue alert */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Streak Badge */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm"
              style={{
                background:
                  streak.currentStreak > 0
                    ? "linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%)"
                    : "var(--hover-color)",
                color: streak.currentStreak > 0 ? "#f97316" : "var(--mute)",
                border:
                  streak.currentStreak > 0
                    ? "1px solid rgba(249, 115, 22, 0.3)"
                    : "1px solid var(--line)",
              }}
              title={`Longest streak: ${streak.longestStreak} days`}
            >
              <span className="text-sm">🔥</span>
              <span>{streak.currentStreak} Day Streak</span>
            </div>

            {streak.longestStreak > streak.currentStreak && (
              <span className="text-xs" style={{ color: "var(--mute)" }}>
                Best: {streak.longestStreak}d
              </span>
            )}
          </div>

          {/* Overdue alert pill if overdue tasks exist */}
          {overdueTasks.length > 0 && (
            <button
              onClick={() => setShowOverdueModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-amber-500 hover:opacity-85 transition-opacity"
              style={{
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
              title="Click to review and reschedule incomplete tasks"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>{overdueTasks.length} Overdue</span>
              <span className="underline ml-0.5">Review</span>
            </button>
          )}
        </div>

        {/* Daily Completion Line & Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium" style={{ color: "var(--mute)" }}>
              Today&apos;s Routine Completion
            </span>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {streak.todayDone} of {streak.todayTotal} tasks ({streak.todayRate}%)
            </span>
          </div>

          {/* Animated Progress Line */}
          <div
            className="w-full h-2.5 rounded-full overflow-hidden relative"
            style={{ background: "var(--hover-color)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${streak.todayRate}%`,
                background:
                  streak.todayRate === 100
                    ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                    : streak.todayRate > 50
                    ? "linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)"
                    : "linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)",
                boxShadow:
                  streak.todayRate > 0
                    ? "0 0 10px rgba(59, 130, 246, 0.4)"
                    : "none",
              }}
            />
          </div>

          {!compact && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--mute)" }}>
              {streak.todayTotal === 0
                ? "No tasks scheduled for today. Add tasks to start today's streak!"
                : streak.isTodayDone
                ? "🎉 All tasks finished for today! Your streak is safely preserved."
                : `${streak.todayTotal - streak.todayDone} tasks remaining today to maintain your streak.`}
            </p>
          )}
        </div>
      </div>

      {/* Overdue modal toggle */}
      {showOverdueModal && (
        <OverdueTasksModal
          forceOpen={true}
          onClose={() => setShowOverdueModal(false)}
        />
      )}
    </>
  );
}
