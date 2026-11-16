"use client";

import React, { useState } from "react";
import { useData } from "@/context/DataContext";
import { getWeeklyAnalysis } from "@/lib/analytics";

export default function WeeklyAnalysisView() {
  const { db } = useData();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + weekOffset * 7);

  const analysis = getWeeklyAnalysis(db.tasks, targetDate);

  return (
    <div className="flex flex-col gap-5">
      {/* Week Selector & Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
            Weekly Performance Analysis
          </h2>
          <p className="text-xs" style={{ color: "var(--mute)" }}>
            Review your weekly task execution, completion trends, and productivity.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border p-1" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-1.5 rounded-lg hover:opacity-75 transition-opacity"
            style={{ color: "var(--ink)" }}
            title="Previous Week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <span className="text-xs font-semibold px-2" style={{ color: "var(--ink)" }}>
            {weekOffset === 0 ? "This Week" : analysis.weekLabel}
          </span>

          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-1.5 rounded-lg hover:opacity-75 transition-opacity"
            style={{ color: "var(--ink)" }}
            title="Next Week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs px-2 py-0.5 rounded-md font-medium ml-1"
              style={{ background: "var(--hover-color)", color: "var(--ink)" }}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--line)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--mute)" }}>
            Weekly Completion
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              {analysis.weeklyRate}%
            </span>
            <span className="text-xs font-medium" style={{ color: analysis.weeklyRate >= 70 ? "#10b981" : "#f59e0b" }}>
              {analysis.totalCompleted}/{analysis.totalTasks} tasks
            </span>
          </div>
        </div>

        <div
          className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--line)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--mute)" }}>
            Completed Tasks
          </span>
          <span className="text-2xl font-bold text-emerald-500">
            {analysis.totalCompleted}
          </span>
        </div>

        <div
          className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--line)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--mute)" }}>
            Incomplete / Missed
          </span>
          <span className="text-2xl font-bold text-rose-500">
            {analysis.totalIncomplete}
          </span>
        </div>

        <div
          className="p-4 rounded-xl border flex flex-col gap-1 shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--line)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--mute)" }}>
            Peak Day
          </span>
          <span className="text-lg font-bold truncate mt-1" style={{ color: "var(--ink)" }}>
            {analysis.bestDay}
          </span>
        </div>
      </div>

      {/* Day-by-Day Cards Grid */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--ink)" }}>
          Day-by-Day Breakdown ({analysis.weekLabel})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2.5">
          {analysis.days.map((day) => {
            const isFinished = day.total > 0 && day.completed === day.total;
            const hasMissed = day.isPast && day.incomplete > 0;

            return (
              <div
                key={day.date}
                className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                  day.isToday ? "ring-2 ring-blue-500" : ""
                }`}
                style={{
                  background: day.isToday ? "var(--hover-color)" : "var(--card)",
                  borderColor: "var(--line)",
                }}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold block" style={{ color: "var(--ink)" }}>
                      {day.dayName}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--mute)" }}>
                      {day.date.slice(5)}
                    </span>
                  </div>

                  {day.isToday && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white uppercase tracking-wider">
                      Today
                    </span>
                  )}
                </div>

                {/* Day Stats */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: "var(--mute)" }}>Tasks:</span>
                    <span className="font-semibold" style={{ color: "var(--ink)" }}>
                      {day.completed}/{day.total}
                    </span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-1.5 rounded-full overflow-hidden bg-neutral-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${day.rate}%`,
                        background: isFinished
                          ? "#10b981"
                          : hasMissed
                          ? "#ef4444"
                          : "#3b82f6",
                      }}
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mt-auto pt-1 text-[11px]">
                  {day.total === 0 ? (
                    <span className="text-neutral-500">No tasks</span>
                  ) : isFinished ? (
                    <span className="text-emerald-400 font-medium">✓ 100% Done</span>
                  ) : hasMissed ? (
                    <span className="text-rose-400 font-medium">✕ {day.incomplete} missed</span>
                  ) : (
                    <span className="text-amber-400 font-medium">{day.rate}% done</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
