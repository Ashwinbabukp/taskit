"use client";

import React, { useState, useEffect } from "react";
import { useData, Task } from "@/context/DataContext";
import { getOverdueTasks, ymd } from "@/lib/analytics";

interface OverdueTasksModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function OverdueTasksModal({
  forceOpen = false,
  onClose,
}: OverdueTasksModalProps) {
  const { db, patchTask, delTask } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(ymd(new Date()));
  const [rescheduleStart, setRescheduleStart] = useState<string>("10:00");
  const [rescheduleEnd, setRescheduleEnd] = useState<string>("11:00");
  const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string | number>>(new Set());

  // Overdue tasks excluding those dismissed in this session
  const allOverdue = getOverdueTasks(db.tasks);
  const activeOverdue = allOverdue.filter((t) => !dismissedTaskIds.has(t.id));

  // Auto-prompt once per session if overdue tasks exist
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    const sessionKey = "taskit_overdue_prompted";
    const alreadyPrompted = sessionStorage.getItem(sessionKey);

    if (activeOverdue.length > 0 && !alreadyPrompted) {
      setIsOpen(true);
      sessionStorage.setItem(sessionKey, "true");
    }
  }, [activeOverdue.length, forceOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedTask(null);
    if (onClose) onClose();
  };

  const handleDismissAll = () => {
    const newDismissed = new Set(dismissedTaskIds);
    activeOverdue.forEach((t) => newDismissed.add(t.id));
    setDismissedTaskIds(newDismissed);
    handleClose();
  };

  const handleMarkDone = async (task: Task) => {
    await patchTask(task, { done: true });
    if (selectedTask?.id === task.id) setSelectedTask(null);
    if (activeOverdue.length <= 1) {
      handleClose();
    }
  };

  const handleCancelTask = async (task: Task) => {
    await delTask(task);
    if (selectedTask?.id === task.id) setSelectedTask(null);
    if (activeOverdue.length <= 1) {
      handleClose();
    }
  };

  const handleQuickRescheduleToday = async (task: Task) => {
    const today = ymd(new Date());
    await patchTask(task, {
      date: today,
      startTime: task.startTime || "10:00",
      endTime: task.endTime || "11:00",
    });
    if (activeOverdue.length <= 1) {
      handleClose();
    }
  };

  const handleQuickRescheduleTomorrow = async (task: Task) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await patchTask(task, {
      date: ymd(tomorrow),
      startTime: task.startTime || "10:00",
      endTime: task.endTime || "11:00",
    });
    if (activeOverdue.length <= 1) {
      handleClose();
    }
  };

  const handleCustomRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    await patchTask(selectedTask, {
      date: rescheduleDate,
      startTime: rescheduleStart,
      endTime: rescheduleEnd,
    });

    setSelectedTask(null);
    if (activeOverdue.length <= 1) {
      handleClose();
    }
  };

  const openRescheduleDetail = (task: Task) => {
    setSelectedTask(task);
    setRescheduleDate(ymd(new Date()));
    setRescheduleStart(task.startTime || "10:00");
    setRescheduleEnd(task.endTime || "11:00");
  };

  if (!isOpen || activeOverdue.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6 flex flex-col gap-4 shadow-2xl animate-fade-in"
        style={{
          background: "var(--card)",
          borderColor: "var(--line)",
          color: "var(--ink)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-amber-400 font-bold"
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight" style={{ color: "var(--ink)" }}>
                Incomplete Tasks Pending
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--mute)" }}>
                {activeOverdue.length === 1
                  ? "1 task was not completed during its scheduled time."
                  : `${activeOverdue.length} tasks were not completed during their scheduled time.`}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:opacity-75 transition-opacity"
            style={{ color: "var(--mute)" }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Custom Reschedule Form if a specific task was selected */}
        {selectedTask ? (
          <form
            onSubmit={handleCustomRescheduleSubmit}
            className="p-4 rounded-xl border flex flex-col gap-3 my-1"
            style={{
              background: "var(--bg)",
              borderColor: "var(--line)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                Reschedule: &quot;{selectedTask.t}&quot;
              </span>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-xs hover:underline"
                style={{ color: "var(--mute)" }}
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block mb-1 font-medium" style={{ color: "var(--mute)" }}>
                  New Date
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-lg border outline-none text-xs"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium" style={{ color: "var(--mute)" }}>
                  Start Time
                </label>
                <input
                  type="time"
                  required
                  value={rescheduleStart}
                  onChange={(e) => setRescheduleStart(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-lg border outline-none text-xs"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium" style={{ color: "var(--mute)" }}>
                  End Time
                </label>
                <input
                  type="time"
                  required
                  value={rescheduleEnd}
                  onChange={(e) => setRescheduleEnd(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-lg border outline-none text-xs"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-1 w-full py-2 rounded-lg text-xs font-semibold transition-opacity"
              style={{
                background: "var(--btn)",
                color: "var(--btnt)",
              }}
            >
              Confirm Reschedule
            </button>
          </form>
        ) : (
          /* Task List */
          <div className="max-h-[320px] overflow-y-auto flex flex-col gap-2.5 pr-1">
            {activeOverdue.map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{
                  background: "var(--bg)",
                  borderColor: "var(--line)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "#ef4444" }}
                    />
                    <h4
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--ink)" }}
                      title={task.t}
                    >
                      {task.t}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1" style={{ color: "var(--mute)" }}>
                    <span>Scheduled: {task.date}</span>
                    {task.startTime && (
                      <>
                        <span>•</span>
                        <span>{task.startTime} - {task.endTime || "End"}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => handleMarkDone(task)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--ink)",
                    }}
                    title="I completed this task"
                  >
                    ✓ Done
                  </button>

                  <button
                    onClick={() => handleQuickRescheduleToday(task)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--ink)",
                    }}
                    title="Reschedule to Today"
                  >
                    Today
                  </button>

                  <button
                    onClick={() => openRescheduleDetail(task)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border hover:opacity-80 transition-opacity"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--ink)",
                    }}
                    title="Pick custom date & time"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleCancelTask(task)}
                    className="p-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete / Cancel task"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: "var(--line)" }}>
          <button
            type="button"
            onClick={handleDismissAll}
            className="hover:underline"
            style={{ color: "var(--mute)" }}
          >
            Dismiss for now
          </button>

          {activeOverdue.length > 1 && (
            <button
              type="button"
              onClick={async () => {
                const today = ymd(new Date());
                for (const t of activeOverdue) {
                  await patchTask(t, { date: today });
                }
                handleClose();
              }}
              className="px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              style={{
                background: "var(--btn)",
                color: "var(--btnt)",
              }}
            >
              Move All to Today
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
