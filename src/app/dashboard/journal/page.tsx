"use client";

import React, { useState, useEffect, useRef } from "react";
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

export default function JournalPage() {
  const { db, putJournal } = useData();
  const [jd, setJd] = useState(ymd(new Date()));
  const [status, setStatus] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = document.getElementById("page-title");
    if (el) el.textContent = "Journal";
  }, []);

  const currentValue = db.journal[jd] || "";

  const handleChange = (value: string) => {
    putJournal(jd, value);
    setStatus("Saving…");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStatus("Saved");
    }, 400);
  };

  const entries = Object.keys(db.journal)
    .filter((k) => db.journal[k]?.trim())
    .sort()
    .reverse();

  return (
    <>
      {/* Date selector */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <input
          type="date"
          value={jd}
          onChange={(e) => {
            if (e.target.value) setJd(e.target.value);
          }}
          className="rounded-[7px] py-1.5 px-2.5 text-sm outline-none"
          style={{
            background: "var(--bg)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
          aria-label="Journal date"
        />
      </div>

      {/* Textarea */}
      <textarea
        placeholder="Write about your day"
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full min-h-[260px] rounded-[7px] py-1.5 px-2.5 text-sm outline-none resize-y"
        style={{
          background: "var(--bg)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
          lineHeight: 1.6,
          fontFamily: "inherit",
        }}
        aria-label="Journal entry"
      />
      <p className="text-xs mt-1.5 mb-5" style={{ color: "var(--mute)" }}>
        {status || "Saved automatically"}
      </p>

      {/* Previous entries list */}
      <div
        className="rounded-[10px] overflow-hidden"
        style={{ border: "1px solid var(--line)" }}
      >
        {entries.length === 0 ? (
          <div
            className="py-7 text-center text-sm"
            style={{ color: "var(--mute)" }}
          >
            No entries yet
          </div>
        ) : (
          entries.map((k) => {
            const txt = db.journal[k];
            return (
              <div
                key={k}
                className="flex items-center gap-3 py-2.5 px-3.5 cursor-pointer"
                style={{ borderBottom: "1px solid var(--line)" }}
                onClick={() => setJd(k)}
              >
                <span
                  className="flex-1 text-sm"
                  style={{ color: "var(--ink)", overflowWrap: "anywhere" }}
                >
                  {txt.length > 90 ? txt.slice(0, 90) + "…" : txt}
                </span>
                <small className="text-xs" style={{ color: "var(--mute)" }}>
                  {fmt(k)}
                </small>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

