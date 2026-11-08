"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useData, Task, RoutineSettings } from "@/context/DataContext";

// --- Date & Time Utilities ---
function ymd(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Start on Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface LayoutTask {
  task: Task;
  startMin: number;
  endMin: number;
  duration: number;
  col: number;
  totalCols: number;
}

// Side-by-side non-overlapping column layout algorithm (Apple Calendar style)
function layoutDayTasks(tasks: Task[]): LayoutTask[] {
  if (tasks.length === 0) return [];

  const items = tasks.map((t) => {
    const startMin = timeToMinutes(t.startTime || "09:00");
    const endMin = timeToMinutes(t.endTime || "10:00");
    const safeEnd = endMin > startMin ? endMin : startMin + 60;
    return {
      task: t,
      startMin,
      endMin: safeEnd,
      duration: Math.max(30, safeEnd - startMin),
      col: 0,
      totalCols: 1,
    };
  }).sort((a, b) => a.startMin - b.startMin || b.duration - a.duration);

  // Group into overlapping clusters
  const clusters: (typeof items)[] = [];
  let currentCluster: typeof items = [];
  let clusterEnd = -1;

  for (const item of items) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      clusterEnd = item.endMin;
    } else if (item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Assign non-colliding sub-columns within each cluster
  const result: LayoutTask[] = [];
  for (const cluster of clusters) {
    const cols: typeof items = [];
    for (const item of cluster) {
      let colIdx = 0;
      while (cols[colIdx] && cols[colIdx].endMin > item.startMin) {
        colIdx++;
      }
      item.col = colIdx;
      cols[colIdx] = item;
    }

    const totalCols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const item of cluster) {
      result.push({
        ...item,
        totalCols,
      });
    }
  }

  return result;
}

const colorStyles: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  blue: {
    bg: "rgba(59, 130, 246, 0.14)",
    border: "#3b82f6",
    text: "inherit",
    badge: "#2563eb",
  },
  green: {
    bg: "rgba(34, 197, 94, 0.14)",
    border: "#22c55e",
    text: "inherit",
    badge: "#16a34a",
  },
  purple: {
    bg: "rgba(168, 85, 247, 0.14)",
    border: "#a855f7",
    text: "inherit",
    badge: "#9333ea",
  },
  orange: {
    bg: "rgba(249, 115, 22, 0.14)",
    border: "#f97316",
    text: "inherit",
    badge: "#ea580c",
  },
  red: {
    bg: "rgba(239, 68, 68, 0.14)",
    border: "#ef4444",
    text: "inherit",
    badge: "#dc2626",
  },
  amber: {
    bg: "rgba(245, 158, 11, 0.14)",
    border: "#f59e0b",
    text: "inherit",
    badge: "#d97706",
  },
};

export default function DailyJourneyPage() {
  const { db, addTask, patchTask, delTask, saveRoutine } = useData();

  // Current selected anchor date
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  // Zoom slider state: hour height in pixels (44px min to 120px max)
  const [hourHeight, setHourHeight] = useState<number>(64);

  // Modals
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // New task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(ymd(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [taskColor, setTaskColor] = useState("blue");

  // Routine form state
  const routine = db.routine || { wakeTime: "06:30", sleepTime: "23:00", configured: false };
  const [wakeInput, setWakeInput] = useState(routine.wakeTime || "06:30");
  const [sleepInput, setSleepInput] = useState(routine.sleepTime || "23:00");

  // Real-time current minute tracking (for red Apple Calendar indicator)
  const [currentMinuteOfDay, setCurrentMinuteOfDay] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.getElementById("page-title");
    if (el) el.textContent = "Daily Journey";
  }, []);

  // Update current time indicator every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinuteOfDay(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check if first-time user needs to configure routine
  useEffect(() => {
    if (!routine.configured) {
      setShowRoutineModal(true);
    }
  }, [routine.configured]);

  // Keep routine inputs synchronized
  useEffect(() => {
    if (routine) {
      setWakeInput(routine.wakeTime || "06:30");
      setSleepInput(routine.sleepTime || "23:00");
    }
  }, [routine]);

  // Auto-scroll to current time on mount in Day/Week views
  useEffect(() => {
    if ((view === "day" || view === "week") && timelineRef.current) {
      const wakeMin = timeToMinutes(routine.wakeTime || "06:30");
      const scrollPos = Math.max(0, (wakeMin / 60) * hourHeight - 60);
      timelineRef.current.scrollTop = scrollPos;
    }
  }, [view, hourHeight, routine.wakeTime]);

  const selectedYMD = ymd(selectedDate);
  const todayYMD = ymd(new Date());
  const isSelectedToday = selectedYMD === todayYMD;

  // Navigate dates
  const handlePrev = () => {
    setSelectedDate((prev) => {
      const n = new Date(prev);
      if (view === "day") n.setDate(n.getDate() - 1);
      else if (view === "week") n.setDate(n.getDate() - 7);
      else n.setMonth(n.getMonth() - 1);
      return n;
    });
  };

  const handleNext = () => {
    setSelectedDate((prev) => {
      const n = new Date(prev);
      if (view === "day") n.setDate(n.getDate() + 1);
      else if (view === "week") n.setDate(n.getDate() + 7);
      else n.setMonth(n.getMonth() + 1);
      return n;
    });
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Open task creator pre-filled for a specific time and date
  const handleOpenAddAtTime = (dateStr: string, hour: number) => {
    setTaskDate(dateStr);
    const startStr = `${String(hour).padStart(2, "0")}:00`;
    const endStr = `${String(Math.min(23, hour + 1)).padStart(2, "0")}:00`;
    setStartTime(startStr);
    setEndTime(endStr);
    setTaskTitle("");
    setShowTaskModal(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDate) return;

    await addTask({
      id: Date.now(),
      t: taskTitle.trim(),
      date: taskDate,
      done: false,
      startTime,
      endTime,
      color: taskColor,
    });

    setShowTaskModal(false);
    setTaskTitle("");
  };

  const handleSaveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    saveRoutine({
      wakeTime: wakeInput || "06:30",
      sleepTime: sleepInput || "23:00",
      configured: true,
    });
    setShowRoutineModal(false);
  };

  // Days for Week View (7 days)
  const weekDays = useMemo(() => {
    const start = getStartOfWeek(selectedDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // Days for Month View (Calendar Matrix)
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prefix days from previous month
    const startDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon = 0
    for (let i = startDayIndex; i > 0; i--) {
      const prevD = new Date(year, month, 1 - i);
      days.push({ date: prevD, isCurrentMonth: false });
    }

    // Days in current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Trailing days from next month to make complete rows
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
    }

    return days;
  }, [selectedDate]);

  // Wake & Sleep minutes calculation
  const wakeMinutes = timeToMinutes(routine.wakeTime || "06:30");
  const sleepMinutes = timeToMinutes(routine.sleepTime || "23:00");

  return (
    <div className="flex flex-col gap-3 flex-1 h-full min-h-0 w-full overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & APPLE CALENDAR CONTROLS */}
      {/* ========================================================================= */}
      <div
        className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl border flex-none"
        style={{ background: "var(--card)", borderColor: "var(--line)" }}
      >
        {/* Date Navigation & Title */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={handlePrev}
              className="px-2.5 py-1.5 hover:opacity-75 transition-opacity"
              style={{ background: "var(--bg)" }}
              aria-label="Previous"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-medium border-x hover:opacity-75 transition-opacity"
              style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="px-2.5 py-1.5 hover:opacity-75 transition-opacity"
              style={{ background: "var(--bg)" }}
              aria-label="Next"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <span className="font-semibold text-sm sm:text-base ml-1" style={{ color: "var(--ink)" }}>
            {view === "day" && formatDisplayDate(selectedYMD)}
            {view === "week" &&
              `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
            {view === "month" &&
              selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
        </div>

        {/* Right Section: View Selector + Zoom Slider + New Task */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Apple Segmented View Switcher */}
          <div
            className="flex p-0.5 rounded-lg border text-xs font-medium"
            style={{ background: "var(--bg)", borderColor: "var(--line)" }}
          >
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                  view === v
                    ? "shadow-sm font-semibold"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  background: view === v ? "var(--btn)" : "transparent",
                  color: view === v ? "var(--btnt)" : "var(--ink)",
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Zoom Slider Control (for Day & Week Views) */}
          {(view === "day" || view === "week") && (
            <div
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs"
              style={{ background: "var(--bg)", borderColor: "var(--line)" }}
              title="Zoom timetable height"
            >
              <button
                onClick={() => setHourHeight((prev) => Math.max(44, prev - 10))}
                className="opacity-60 hover:opacity-100 px-1 font-bold text-sm"
              >
                −
              </button>
              <input
                type="range"
                min="44"
                max="120"
                value={hourHeight}
                onChange={(e) => setHourHeight(Number(e.target.value))}
                className="w-16 h-1.5 accent-blue-500 cursor-pointer"
                aria-label="Zoom scale"
              />
              <button
                onClick={() => setHourHeight((prev) => Math.min(120, prev + 10))}
                className="opacity-60 hover:opacity-100 px-1 font-bold text-sm"
              >
                +
              </button>
              <span className="opacity-50 text-[10px] w-7 text-right">{hourHeight}px</span>
            </div>
          )}

          {/* Routine Settings Button */}
          <button
            onClick={() => setShowRoutineModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:opacity-85 transition-opacity"
            style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
            title="Configure Wake-up and Sleep schedule"
          >
            <span className="text-amber-500">☀️</span>
            <span className="hidden md:inline">{routine.wakeTime || "06:30"}</span>
            <span className="opacity-40">|</span>
            <span className="text-indigo-400">🌙</span>
            <span className="hidden md:inline">{routine.sleepTime || "23:00"}</span>
          </button>

          {/* Add Task Button */}
          <button
            onClick={() => {
              setTaskDate(selectedYMD);
              setShowTaskModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--btn)", color: "var(--btnt)" }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN CALENDAR BODY ACCORDING TO VIEW */}
      {/* ========================================================================= */}

      {/* --- DAY VIEW --- */}
      {view === "day" && (
        <div
          className="rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
          style={{ background: "var(--card)", borderColor: "var(--line)" }}
        >
          {/* Day View Header Banner */}
          <div
            className="p-3 border-b flex items-center justify-between text-xs flex-none"
            style={{ background: "var(--bg)", borderColor: "var(--line)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  isSelectedToday
                    ? "bg-rose-500 text-white"
                    : "opacity-75"
                }`}
              >
                {selectedDate.getDate()}
              </span>
              <span className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                {selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              {isSelectedToday && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-500 font-semibold">
                  TODAY
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] opacity-75">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span> Wake Up: {routine.wakeTime || "06:30"}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Bedtime: {routine.sleepTime || "23:00"}
              </span>
            </div>
          </div>

          {/* Timeline Scroll Area */}
          <div ref={timelineRef} className="flex-1 min-h-0 overflow-y-auto relative select-none">
            <div className="relative" style={{ height: `${24 * hourHeight}px` }}>
              {/* Hour Grid Lines and Labels */}
              {Array.from({ length: 24 }).map((_, h) => {
                const hourMinute = h * 60;
                const isSleep =
                  sleepMinutes > wakeMinutes
                    ? hourMinute < wakeMinutes || hourMinute >= sleepMinutes
                    : hourMinute >= sleepMinutes && hourMinute < wakeMinutes;

                return (
                  <div
                    key={h}
                    className="flex border-b relative group cursor-pointer transition-colors"
                    style={{
                      height: `${hourHeight}px`,
                      borderColor: "var(--line)",
                      background: isSleep ? "rgba(0, 0, 0, 0.03)" : "transparent",
                    }}
                    onClick={() => handleOpenAddAtTime(selectedYMD, h)}
                  >
                    {/* Time Label (Apple Style left column) */}
                    <div
                      className="w-16 flex-none text-right pr-3 -mt-2.5 text-[11px] font-medium opacity-50 select-none"
                      style={{ color: "var(--mute)" }}
                    >
                      {h !== 0 ? formatHour(h) : ""}
                    </div>

                    {/* Timeline Slot */}
                    <div className="flex-1 relative border-l" style={{ borderColor: "var(--line)" }}>
                      {/* Plus icon on hover for quick add */}
                      <span className="absolute right-3 top-2 opacity-0 group-hover:opacity-40 text-xs transition-opacity font-bold">
                        +
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Wake-up Marker Line */}
              <div
                className="absolute left-16 right-0 border-t border-dashed flex items-center justify-end pr-4 z-0 pointer-events-none"
                style={{
                  top: `${(wakeMinutes / 60) * hourHeight}px`,
                  borderColor: "#f59e0b",
                  opacity: 0.85,
                }}
              >
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm flex items-center gap-1">
                  ☀️ Wake Up ({routine.wakeTime || "06:30"})
                </span>
              </div>

              {/* Sleep Marker Line */}
              <div
                className="absolute left-16 right-0 border-t border-dashed flex items-center justify-end pr-4 z-0 pointer-events-none"
                style={{
                  top: `${(sleepMinutes / 60) * hourHeight}px`,
                  borderColor: "#6366f1",
                  opacity: 0.85,
                }}
              >
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-sm flex items-center gap-1">
                  🌙 Bedtime ({routine.sleepTime || "23:00"})
                </span>
              </div>

              {/* Red Current Time Line (Apple Signature) if Today */}
              {isSelectedToday && (
                <div
                  className="absolute left-12 right-0 flex items-center z-20 pointer-events-none"
                  style={{ top: `${(currentMinuteOfDay / 60) * hourHeight}px` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow" />
                  <div className="flex-1 h-[2px] bg-rose-500" />
                </div>
              )}

              {/* Render Scheduled Tasks for Selected Day (with Non-Overlapping Sub-Columns) */}
              {layoutDayTasks(db.tasks.filter((t) => t.date === selectedYMD)).map(
                ({ task, startMin, duration, col, totalCols }) => {
                  const top = (startMin / 60) * hourHeight;
                  const height = (duration / 60) * hourHeight;
                  const cTheme = colorStyles[task.color || "blue"] || colorStyles.blue;
                  const colWidthPct = 100 / totalCols;
                  const leftOffsetPct = col * colWidthPct;

                  return (
                    <div
                      key={task.id}
                      className="absolute rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-start gap-2 border-l-4 shadow-sm transition-all overflow-hidden cursor-pointer z-10"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(4.5rem + (100% - 5.5rem) * ${leftOffsetPct / 100})`,
                        width: `calc((100% - 5.5rem) * ${colWidthPct / 100} - 4px)`,
                        background: `linear-gradient(${cTheme.bg}, ${cTheme.bg}), var(--card)`,
                        borderLeftColor: cTheme.border,
                        borderTop: "1px solid var(--line)",
                        borderRight: "1px solid var(--line)",
                        borderBottom: "1px solid var(--line)",
                        opacity: task.done ? 0.6 : 1,
                      }}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={(e) => {
                          e.stopPropagation();
                          patchTask(task, { done: e.target.checked });
                        }}
                        className="mt-0.5 w-4 h-4 rounded cursor-pointer flex-none"
                        style={{ accentColor: cTheme.border }}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold truncate ${
                              task.done ? "line-through opacity-70" : ""
                            }`}
                            style={{ color: "var(--ink)" }}
                          >
                            {task.t}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              delTask(task);
                            }}
                            className="opacity-40 hover:opacity-100 text-xs px-1"
                            title="Delete task"
                          >
                            ×
                          </button>
                        </div>

                        {height >= 40 && (
                          <div className="flex items-center gap-2 mt-auto text-[10px] opacity-75 font-medium">
                            <span>
                              {task.startTime || "09:00"} – {task.endTime || "10:00"}
                            </span>
                            {task.done && (
                              <span className="text-emerald-500 font-semibold">Done ✓</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* --- WEEK VIEW --- */}
      {view === "week" && (
        <div
          className="rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
          style={{ background: "var(--card)", borderColor: "var(--line)" }}
        >
          {/* Synchronized horizontal scroll wrapper for both header & body */}
          <div className="flex-1 min-h-0 flex flex-col overflow-x-auto">
            <div className="min-w-[700px] flex-1 flex flex-col min-h-0">
              {/* Week Days Header Row */}
              <div
                className="grid border-b text-center text-xs flex-none"
                style={{
                  gridTemplateColumns: "56px repeat(7, 1fr)",
                  background: "var(--bg)",
                  borderColor: "var(--line)",
                }}
              >
                <div className="p-2 border-r" style={{ borderColor: "var(--line)" }} />
                {weekDays.map((d) => {
                  const dYmd = ymd(d);
                  const isToday = dYmd === todayYMD;
                  const isSelected = dYmd === selectedYMD;

                  return (
                    <div
                      key={dYmd}
                      onClick={() => {
                        setSelectedDate(d);
                        setView("day");
                      }}
                      className={`p-2 border-r last:border-r-0 cursor-pointer transition-colors ${
                        isSelected ? "bg-black/5 dark:bg-white/5" : "hover:opacity-85"
                      }`}
                      style={{ borderColor: "var(--line)" }}
                    >
                      <div className="text-[10px] uppercase font-bold opacity-50">
                        {d.toLocaleDateString(undefined, { weekday: "short" })}
                      </div>
                      <div className="mt-1 flex justify-center">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                            isToday
                              ? "bg-rose-500 text-white shadow-sm"
                              : ""
                          }`}
                          style={{ color: isToday ? "#ffffff" : "var(--ink)" }}
                        >
                          {d.getDate()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Week Timeline Columns Scroll Area */}
              <div ref={timelineRef} className="flex-1 min-h-0 overflow-y-auto relative select-none">
                <div
                  className="grid relative"
                  style={{
                    gridTemplateColumns: "56px repeat(7, 1fr)",
                    height: `${24 * hourHeight}px`,
                  }}
                >
              {/* Left Hour Rulers */}
              <div className="border-r relative" style={{ borderColor: "var(--line)" }}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <div
                    key={h}
                    className="border-b text-right pr-2 text-[10px] font-medium opacity-50 -mt-2 select-none"
                    style={{ height: `${hourHeight}px`, borderColor: "var(--line)" }}
                  >
                    {h !== 0 ? formatHour(h) : ""}
                  </div>
                ))}
              </div>

              {/* 7 Day Columns */}
              {weekDays.map((d) => {
                const dayStr = ymd(d);
                const isToday = dayStr === todayYMD;

                return (
                  <div
                    key={dayStr}
                    className="border-r last:border-r-0 relative"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {/* Hour Slots */}
                    {Array.from({ length: 24 }).map((_, h) => {
                      const hourMinute = h * 60;
                      const isSleep =
                        sleepMinutes > wakeMinutes
                          ? hourMinute < wakeMinutes || hourMinute >= sleepMinutes
                          : hourMinute >= sleepMinutes && hourMinute < wakeMinutes;

                      return (
                        <div
                          key={h}
                          onClick={() => handleOpenAddAtTime(dayStr, h)}
                          className="border-b hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer"
                          style={{
                            height: `${hourHeight}px`,
                            borderColor: "var(--line)",
                            background: isSleep ? "rgba(0,0,0,0.02)" : "transparent",
                          }}
                        />
                      );
                    })}

                    {/* Red line if today */}
                    {isToday && (
                      <div
                        className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                        style={{ top: `${(currentMinuteOfDay / 60) * hourHeight}px` }}
                      >
                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow -ml-1" />
                        <div className="flex-1 h-[2px] bg-rose-500" />
                      </div>
                    )}

                    {/* Tasks in this Day Column (with non-overlapping sub-columns) */}
                    {layoutDayTasks(db.tasks.filter((t) => t.date === dayStr)).map(
                      ({ task, startMin, duration, col, totalCols }) => {
                        const top = (startMin / 60) * hourHeight;
                        const height = (duration / 60) * hourHeight;
                        const cTheme = colorStyles[task.color || "blue"] || colorStyles.blue;
                        const colWidthPct = 100 / totalCols;
                        const leftOffsetPct = col * colWidthPct;

                        return (
                          <div
                            key={task.id}
                            className="absolute rounded-md p-1.5 flex items-start gap-1.5 border-l-2 shadow-sm text-[11px] overflow-hidden z-10"
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: `calc(2px + (100% - 4px) * ${leftOffsetPct / 100})`,
                              width: `calc((100% - 4px) * ${colWidthPct / 100} - 2px)`,
                              background: `linear-gradient(${cTheme.bg}, ${cTheme.bg}), var(--card)`,
                              borderLeftColor: cTheme.border,
                              borderTop: "1px solid var(--line)",
                              borderRight: "1px solid var(--line)",
                              borderBottom: "1px solid var(--line)",
                              opacity: task.done ? 0.6 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={(e) => {
                                e.stopPropagation();
                                patchTask(task, { done: e.target.checked });
                              }}
                              className="w-3.5 h-3.5 mt-0.5 rounded cursor-pointer flex-none"
                              style={{ accentColor: cTheme.border }}
                            />
                            <div className="flex-1 min-w-0">
                              <div
                                className={`font-semibold truncate ${
                                  task.done ? "line-through opacity-70" : ""
                                }`}
                                style={{ color: "var(--ink)" }}
                              >
                                {task.t}
                              </div>
                              {height >= 38 && (
                                <div className="text-[9px] opacity-60">
                                  {task.startTime || "09:00"}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* --- MONTH VIEW --- */}
      {view === "month" && (
        <div
          className="rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
          style={{ background: "var(--card)", borderColor: "var(--line)" }}
        >
          {/* Day of Week Headers */}
          <div
            className="grid grid-cols-7 border-b text-center text-xs font-semibold py-2.5 opacity-60 flex-none"
            style={{ background: "var(--bg)", borderColor: "var(--line)" }}
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 flex-1 min-h-0 auto-rows-fr overflow-y-auto">
            {monthDays.map(({ date, isCurrentMonth }, idx) => {
              const dayStr = ymd(date);
              const isToday = dayStr === todayYMD;
              const isSelected = dayStr === selectedYMD;
              const dayTasks = db.tasks.filter((t) => t.date === dayStr);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(date);
                    setView("day");
                  }}
                  className={`min-h-[70px] sm:min-h-0 p-1 sm:p-1.5 border-b border-r last:border-r-0 flex flex-col cursor-pointer transition-colors ${
                    isCurrentMonth ? "" : "opacity-35"
                  } ${isSelected ? "bg-black/5 dark:bg-white/5" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"}`}
                  style={{ borderColor: "var(--line)" }}
                >
                  {/* Date Number Badge */}
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span
                      className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                        isToday ? "bg-rose-500 text-white" : ""
                      }`}
                      style={{ color: isToday ? "#ffffff" : "var(--ink)" }}
                    >
                      {date.getDate()}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-medium opacity-50">
                        {dayTasks.filter((t) => t.done).length}/{dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task Pills */}
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {dayTasks.slice(0, 3).map((task) => {
                      const cTheme = colorStyles[task.color || "blue"] || colorStyles.blue;
                      return (
                        <div
                          key={task.id}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] truncate"
                          style={{
                            background: cTheme.bg,
                            borderLeft: `2px solid ${cTheme.border}`,
                            opacity: task.done ? 0.6 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={(e) => {
                              e.stopPropagation();
                              patchTask(task, { done: e.target.checked });
                            }}
                            className="w-3 h-3 rounded cursor-pointer"
                            style={{ accentColor: cTheme.border }}
                          />
                          <span
                            className={`truncate ${task.done ? "line-through opacity-70" : ""}`}
                            style={{ color: "var(--ink)" }}
                          >
                            {task.startTime ? `${task.startTime} ` : ""}
                            {task.t}
                          </span>
                        </div>
                      );
                    })}

                    {dayTasks.length > 3 && (
                      <span className="text-[9px] px-1 font-semibold opacity-50">
                        +{dayTasks.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL: FIRST TIME / ROUTINE SETTINGS (WAKE UP & SLEEP TIME) */}
      {/* ========================================================================= */}
      {showRoutineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl p-6 border shadow-2xl relative animate-fade-in"
            style={{ background: "var(--card)", borderColor: "var(--line)" }}
          >
            {/* Close button if already configured */}
            {routine.configured && (
              <button
                onClick={() => setShowRoutineModal(false)}
                className="absolute right-4 top-4 text-sm opacity-50 hover:opacity-100 p-1"
              >
                ✕
              </button>
            )}

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md">
              <span className="text-xl">☀️</span>
            </div>

            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--ink)" }}>
              {routine.configured ? "Customize Your Routine" : "Set Your Daily Rhythm"}
            </h2>
            <p className="text-xs mb-5 opacity-70 leading-relaxed" style={{ color: "var(--mute)" }}>
              Like Apple Calendar, setting your wake-up and sleep schedule highlights your active daytime hours so you can manage tasks with clarity.
            </p>

            <form onSubmit={handleSaveRoutine} className="flex flex-col gap-4">
              {/* Wake Up Time */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                  <span className="text-amber-500">☀️</span> What time do you wake up?
                </label>
                <input
                  type="time"
                  required
                  value={wakeInput}
                  onChange={(e) => setWakeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none font-medium"
                  style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                />
              </div>

              {/* Sleep Time */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                  <span className="text-indigo-400">🌙</span> What time do you go to sleep?
                </label>
                <input
                  type="time"
                  required
                  value={sleepInput}
                  onChange={(e) => setSleepInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none font-medium"
                  style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                />
              </div>

              <div className="flex gap-2.5 mt-2">
                {routine.configured && (
                  <button
                    type="button"
                    onClick={() => setShowRoutineModal(false)}
                    className="flex-1 py-2.5 rounded-lg border text-xs font-medium hover:opacity-85"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium shadow transition-opacity hover:opacity-90"
                  style={{ background: "var(--btn)", color: "var(--btnt)" }}
                >
                  Save & Open My Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: CREATE SCHEDULED TASK */}
      {/* ========================================================================= */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl p-6 border shadow-2xl relative animate-fade-in"
            style={{ background: "var(--card)", borderColor: "var(--line)" }}
          >
            <button
              onClick={() => setShowTaskModal(false)}
              className="absolute right-4 top-4 text-sm opacity-50 hover:opacity-100 p-1"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--ink)" }}>
              Schedule a Task
            </h3>

            <form onSubmit={handleCreateTask} className="flex flex-col gap-3.5">
              {/* Task Title */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deep Work, Gym Workout, Project Review"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border text-sm outline-none"
                  style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border text-sm outline-none"
                  style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                />
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--ink)" }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                </div>
              </div>

              {/* Apple Calendar Color Tags */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
                  Tag Color
                </label>
                <div className="flex items-center gap-2.5">
                  {Object.keys(colorStyles).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTaskColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        taskColor === c ? "scale-125 ring-2 ring-offset-2 ring-blue-500" : "hover:scale-110"
                      }`}
                      style={{ background: colorStyles[c].badge }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 mt-3">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 py-2.5 rounded-lg border text-xs font-medium hover:opacity-85"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium shadow hover:opacity-90"
                  style={{ background: "var(--btn)", color: "var(--btnt)" }}
                >
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

