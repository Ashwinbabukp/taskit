"use client";

import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";

function ymd(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function fmt(s: string): string {
  const p = s.split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TasksPage() {
  const { db, addTask, patchTask, delTask } = useData();
  const [text, setText] = useState("");
  const [date, setDate] = useState(ymd(new Date()));
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const el = document.getElementById("page-title");
    if (el) el.textContent = "Tasks";
  }, []);

  const handleAdd = () => {
    const t = text.trim();
    if (!t || !date) return;
    addTask({ id: Date.now(), t, date, done: false });
    setText("");
  };

  const filtered = db.tasks
    .filter((t) => {
      if (filter === "all") return true;
      if (filter === "done") return t.done;
      return !t.done;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      {/* Toolbar */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Add a task"
          maxLength={140}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          className="flex-1 min-w-[180px] rounded-[7px] py-1.5 px-2.5 text-sm outline-none"
          style={{
            background: "var(--bg)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
          aria-label="Task"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-[7px] py-1.5 px-2.5 text-sm outline-none"
          style={{
            background: "var(--bg)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
          aria-label="Task date"
        />
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-[7px] py-1.5 px-3 text-sm font-medium"
          style={{ background: "var(--btn)", color: "var(--btnt)" }}
        >
          Add task
        </button>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-[7px] py-1.5 px-2.5 text-sm outline-none"
          style={{
            background: "var(--bg)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
          aria-label="Filter"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="done">Completed</option>
        </select>
      </div>

      {/* Task list */}
      <div
        className="rounded-[10px] overflow-hidden"
        style={{ border: "1px solid var(--line)" }}
      >
        {filtered.length === 0 ? (
          <div
            className="py-7 text-center text-sm"
            style={{ color: "var(--mute)" }}
          >
            No tasks yet
          </div>
        ) : (
          filtered.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 py-2.5 px-3.5"
              style={{
                borderBottom: "1px solid var(--line)",
                ...(task.done
                  ? {}
                  : {}),
              }}
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={(e) => patchTask(task, { done: e.target.checked })}
                className="w-4 h-4"
                style={{ accentColor: "var(--btn)" }}
                aria-label="Mark done"
              />
              <span
                className="flex-1 text-sm"
                style={{
                  color: task.done ? "var(--mute)" : "var(--ink)",
                  textDecoration: task.done ? "line-through" : "none",
                  overflowWrap: "anywhere",
                }}
              >
                {task.t}
              </span>
              <small className="text-xs" style={{ color: "var(--mute)" }}>
                {fmt(task.date)}
              </small>
              <button
                onClick={() => delTask(task)}
                className="px-1.5 py-0.5 text-base"
                style={{ color: "var(--mute)" }}
                aria-label="Delete task"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

