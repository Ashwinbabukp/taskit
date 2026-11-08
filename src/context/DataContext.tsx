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

  const getStorageKey = useCallback(() => {
    return userEmail ? `taskit_data_${userEmail.toLowerCase().trim()}` : null;
  }, [userEmail]);

  const loadLocalData = useCallback((): AppData => {
    const key = getStorageKey();
    if (!key || typeof window === "undefined") return { tasks: [], journal: {} };
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          journal: parsed.journal && typeof parsed.journal === "object" ? parsed.journal : {},
        };
      }
    } catch (e) {}
    return { tasks: [], journal: {} };
  }, [getStorageKey]);

  const saveLocalData = useCallback(
    (data: AppData) => {
      const key = getStorageKey();
      if (!key || typeof window === "undefined") return;
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {}
    },
    [getStorageKey]
  );

  // Fetch and sync data when user logs in or switches account
  const fetchData = useCallback(async () => {
    if (!isLoggedIn || !userEmail) {
      setDb({ tasks: [], journal: {} });
      return;
    }

    // 1. Immediately load this specific user's saved data from browser storage
    const local = loadLocalData();
    setDb(local);

    // 2. Sync with server/Supabase in the background
    setLoading(true);
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const serverData = await res.json();
        const serverTasks: Task[] = Array.isArray(serverData.tasks) ? serverData.tasks : [];
        const serverJournal: Record<string, string> =
          serverData.journal && typeof serverData.journal === "object" ? serverData.journal : {};

        // Merge: local + server (server updates or local offline additions)
        const taskMap = new Map<string, Task>();
        for (const t of local.tasks) {
          taskMap.set(String(t.id), t);
        }
        for (const t of serverTasks) {
          taskMap.set(String(t.id), t);
        }

        const mergedTasks = Array.from(taskMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
        const mergedJournal = { ...local.journal, ...serverJournal };

        const updatedData: AppData = {
          tasks: mergedTasks,
          journal: mergedJournal,
        };

        setDb(updatedData);
        saveLocalData(updatedData);

        // If local had tasks not yet in server (e.g. Supabase tables were down or just created), sync them up!
        if (serverTasks.length === 0 && local.tasks.length > 0) {
          for (const t of local.tasks) {
            fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(t),
            }).catch(() => {});
          }
        }
        if (Object.keys(serverJournal).length === 0 && Object.keys(local.journal).length > 0) {
          for (const [d, text] of Object.entries(local.journal)) {
            fetch("/api/journal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: d, text }),
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch user data from server:", err);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, userEmail, loadLocalData, saveLocalData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addTask = useCallback(
    async (task: Task) => {
      setDb((prev) => {
        const next: AppData = { ...prev, tasks: [task, ...prev.tasks] };
        saveLocalData(next);
        return next;
      });

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
    [saveLocalData]
  );

  const patchTask = useCallback(
    async (task: Task, patch: Partial<Task>) => {
      setDb((prev) => {
        const next: AppData = {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
        };
        saveLocalData(next);
        return next;
      });

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
    [saveLocalData]
  );

  const delTask = useCallback(
    async (task: Task) => {
      setDb((prev) => {
        const next: AppData = {
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== task.id),
        };
        saveLocalData(next);
        return next;
      });

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
    [saveLocalData]
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
        const next: AppData = { ...prev, journal: nextJournal };
        saveLocalData(next);
        return next;
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
    [saveLocalData]
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
