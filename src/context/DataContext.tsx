"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";

export interface Task {
  id: number | string;
  t: string;
  date: string;
  done: boolean;
}

export interface AppData {
  tasks: Task[];
  journal: Record<string, string>;
}

interface DataContextType {
  db: AppData;
  loading: boolean;
  addTask: (task: Task) => Promise<void>;
  patchTask: (task: Task, patch: Partial<Task>) => Promise<void>;
  delTask: (task: Task) => Promise<void>;
  putJournal: (date: string, value: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType>({
  db: { tasks: [], journal: {} },
  loading: false,
  addTask: async () => {},
  patchTask: async () => {},
  delTask: async () => {},
  putJournal: async () => {},
  refresh: async () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, userEmail } = useAuth();
  const [db, setDb] = useState<AppData>({ tasks: [], journal: {} });
  const [loading, setLoading] = useState(false);

  // Fetch data from database when user is logged in
  const fetchData = useCallback(async () => {
    if (!isLoggedIn) {
      setDb({ tasks: [], journal: {} });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const data = await res.json();
        setDb({
          tasks: data.tasks || [],
          journal: data.journal || {},
        });
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addTask = useCallback(
    async (task: Task) => {
      // Optimistic update
      setDb((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      try {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });
      } catch (err) {
        console.error("Failed to add task to db:", err);
      }
    },
    []
  );

  const patchTask = useCallback(
    async (task: Task, patch: Partial<Task>) => {
      setDb((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
      }));
      try {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, ...patch }),
        });
      } catch (err) {
        console.error("Failed to update task in db:", err);
      }
    },
    []
  );

  const delTask = useCallback(
    async (task: Task) => {
      setDb((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== task.id),
      }));
      try {
        await fetch("/api/tasks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id }),
        });
      } catch (err) {
        console.error("Failed to delete task from db:", err);
      }
    },
    []
  );

  const putJournal = useCallback(
    async (date: string, value: string) => {
      setDb((prev) => {
        const nextJournal = { ...prev.journal };
        if (value.trim()) {
          nextJournal[date] = value;
        } else {
          delete nextJournal[date];
        }
        return { ...prev, journal: nextJournal };
      });
      try {
        await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, text: value }),
        });
      } catch (err) {
        console.error("Failed to save journal to db:", err);
      }
    },
    []
  );

  return (
    <DataContext.Provider
      value={{
        db,
        loading,
        addTask,
        patchTask,
        delTask,
        putJournal,
        refresh: fetchData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
