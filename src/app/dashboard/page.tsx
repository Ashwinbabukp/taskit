"use client";

import React, { useState, useEffect, useCallback } from "react";
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

function ago(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

function xPos(i: number, n: number): number {
  return 52 + i * (530 / Math.max(n - 1, 1));
}

export default function DashboardPage() {
  const { db } = useData();
  const [range, setRange] = useState(30);

  useEffect(() => {
    const el = document.getElementById("page-title");
    if (el) el.textContent = "Dashboard";
  }, []);

  const days: string[] = [];
  for (let i = range - 1; i >= 0; i--) days.push(ago(i));

  const ts = db.tasks.filter((t) => days.includes(t.date));
  const dn = ts.filter((t) => t.done).length;
  const je = days.filter((d) => db.journal[d]?.trim()).length;

  const kpis: [string, string | number][] = [
    ["Total tasks", ts.length],
    ["Completed", dn],
    ["Pending", ts.length - dn],
    ["Completion rate", ts.length ? Math.round((dn / ts.length) * 100) + "%" : "0%"],
    ["Journal entries", je],
  ];

  // Chart helper: grid lines
  const renderGrid = (max: number) => {
    const elements: React.ReactNode[] = [];
    const step = Math.ceil(days.length / 6);
    for (let i = 0; i <= 4; i++) {
      const y = 20 + i * 45;
      elements.push(
        <line
          key={`gl-${i}`}
          x1={44}
          x2={590}
          y1={y}
          y2={y}
          stroke="var(--line)"
        />
      );
      elements.push(
        <text
          key={`gt-${i}`}
          x={36}
          y={y + 3}
          textAnchor="end"
          fill="var(--mute)"
          fontSize={10}
        >
          {Math.round((max * (4 - i)) / 4 * 10) / 10}
        </text>
      );
    }
    days.forEach((d, i) => {
      if (i % step === 0) {
        elements.push(
          <text
            key={`gd-${i}`}
            x={xPos(i, days.length)}
            y={218}
            textAnchor="middle"
            fill="var(--mute)"
            fontSize={10}
          >
            {d.slice(5)}
          </text>
        );
      }
    });
    return elements;
  };

  // Task trend chart
  const taskMax = Math.max(
    1,
    ...days.map((d) => db.tasks.filter((t) => t.date === d).length)
  );
  const plannedPoints = days
    .map(
      (d, i) =>
        `${xPos(i, days.length)},${200 - (db.tasks.filter((t) => t.date === d).length / taskMax) * 180}`
    )
    .join(" ");
  const completedPoints = days
    .map(
      (d, i) =>
        `${xPos(i, days.length)},${200 - (db.tasks.filter((t) => t.date === d && t.done).length / taskMax) * 180}`
    )
    .join(" ");

  // Journal activity chart
  const barW = Math.max(3, Math.min(18, 500 / days.length - 3));

  return (
    <>
      {/* Date range selector */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <select
          className="rounded-[7px] py-1.5 px-2.5 text-sm outline-none"
          style={{
            background: "var(--bg)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          aria-label="Date range"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={60}>Last 60 Days</option>
        </select>
      </div>

      {/* KPI cards */}
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}
      >
        {kpis.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[10px] py-4 px-4.5"
            style={{ background: "var(--card)" }}
          >
            <span className="text-sm" style={{ color: "var(--mute)" }}>
              {label}
            </span>
            <b
              className="block text-2xl font-semibold mt-1.5"
              style={{ color: "var(--ink)" }}
            >
              {value}
            </b>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-4">
        {/* Task trend */}
        <div className="rounded-[10px] py-4 px-4.5" style={{ background: "var(--card)" }}>
          <h2 className="text-sm font-semibold m-0" style={{ color: "var(--ink)" }}>
            Task trend
          </h2>
          <p className="text-sm mt-0.5 mb-2.5" style={{ color: "var(--mute)" }}>
            Tasks planned and completed each day
          </p>
          {ts.length === 0 ? (
            <div
              className="h-[200px] grid place-items-center"
              style={{ color: "var(--mute)" }}
            >
              No data to show
            </div>
          ) : (
            <>
              <svg viewBox="0 0 600 230" className="w-full h-auto block">
                {renderGrid(taskMax)}
                <polyline
                  points={plannedPoints}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <polyline
                  points={completedPoints}
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              </svg>
              <div
                className="flex gap-3.5 justify-center mt-2"
                style={{ color: "var(--mute)" }}
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <i
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: "var(--b1)" }}
                  />
                  Planned
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  <i
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: "var(--b2)" }}
                  />
                  Completed
                </span>
              </div>
            </>
          )}
        </div>

        {/* Journal activity */}
        <div className="rounded-[10px] py-4 px-4.5" style={{ background: "var(--card)" }}>
          <h2 className="text-sm font-semibold m-0" style={{ color: "var(--ink)" }}>
            Journal activity
          </h2>
          <p className="text-sm mt-0.5 mb-2.5" style={{ color: "var(--mute)" }}>
            Days you wrote a journal entry
          </p>
          {je === 0 ? (
            <div
              className="h-[200px] grid place-items-center"
              style={{ color: "var(--mute)" }}
            >
              No data to show
            </div>
          ) : (
            <>
              <svg viewBox="0 0 600 230" className="w-full h-auto block">
                {renderGrid(1)}
                {days.map((d, i) =>
                  db.journal[d]?.trim() ? (
                    <rect
                      key={d}
                      x={xPos(i, days.length) - barW / 2}
                      y={20}
                      width={barW}
                      height={180}
                      rx={2}
                      fill="#3b82f6"
                      opacity={0.85}
                    />
                  ) : null
                )}
              </svg>
              <div
                className="flex gap-3.5 justify-center mt-2"
                style={{ color: "var(--mute)" }}
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <i
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: "var(--b1)" }}
                  />
                  Entry written
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

