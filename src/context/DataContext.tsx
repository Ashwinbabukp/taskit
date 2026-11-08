"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";

export interface Task {
  id: number | string;
  t: string;
  date: string;
  done: boolean;
  startTime?: string; // "09:00" (24h format)
  endTime?: string;   // "10:30" (24h format)
  color?: string;     // "blue" | "green" | "purple" | "orange" | "red" | "amber"
}

export interface RoutineSettings {
  wakeTime: string;  // e.g. "06:30"
  sleepTime: string; // e.g. "23:00"
  configured: boolean;
}

export interface AppData {
  tasks: Task[];
  journal: Record<string, string>;
  routine?: RoutineSettings;
}

interface DataContextType {
  db: AppData;
  loading: boolean;
  addTask: (task: Task) => Promise<void>;
  patchTask: (task: Task, patch: Partial<Task>) => Promise<void>;
  delTask: (task: Task) => Promise<void>;
  putJournal: (date: string, value: string) => Promise<void>;
  saveRoutine: (routine: RoutineSettings) => void;
  refresh: () => Promise<void>;
}

const defaultRoutine: RoutineSettings = {
  wakeTime: "06:30",
  sleepTime: "23:00",
  configured: false,
};

const DataContext = createContext<DataContextType>({
  db: { tasks: [], journal: {}, routine: defaultRoutine },
  loading: false,
  addTask: async () => {},
  patchTask: async () => {},
  delTask: async () => {},
  putJournal: async () => {},
  saveRoutine: () => {},
  refresh: async () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, userEmail } = useAuth();
  const [db, setDb] = useState<AppData>({ tasks: [], journal: {}, routine: defaultRoutine });
  const [loading, setLoading] = useState(false);

  const getStorageKey = useCallback(() => {
    return userEmail ? `taskit_data_${userEmail.toLowerCase().trim()}` : null;
  }, [userEmail]);

  const loadLocalData = useCallback((): AppData => {
    const key = getStorageKey();
    if (!key || typeof window === "undefined") {
      return { tasks: [], journal: {}, routine: defaultRoutine };
    }
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          journal: parsed.journal && typeof parsed.journal === "object" ? parsed.journal : {},
          routine: parsed.routine || defaultRoutine,
        };
      }
    } catch (e) {}
    return { tasks: [], journal: {}, routine: defaultRoutine };
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
      setDb({ tasks: [], journal: {}, routine: defaultRoutine });
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

        // Merge tasks
        const taskMap = new Map<string, Task>();
        for (const t of local.tasks) {
          taskMap.set(String(t.id), t);
        }
        for (const t of serverTasks) {
          // If local has extra fields like startTime/color, preserve them
          const existing = taskMap.get(String(t.id));
          taskMap.set(String(t.id), {
            ...t,
            startTime: existing?.startTime || (t as any).startTime,
            endTime: existing?.endTime || (t as any).endTime,
            color: existing?.color || (t as any).color,
          });
        }

        const mergedTasks = Array.from(taskMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
        const mergedJournal = { ...local.journal, ...serverJournal };

        // Restore routine from server journal if present
        let routine = local.routine || defaultRoutine;
        if (serverJournal["__routine_settings__"]) {
          try {
            routine = JSON.parse(serverJournal["__routine_settings__"]);
          } catch (e) {}
        }

        const updatedData: AppData = {
          tasks: mergedTasks,
          journal: mergedJournal,
          routine,
        };

        setDb(updatedData);
        saveLocalData(updatedData);

        // Background sync: push local tasks not yet on server
        if (serverTasks.length === 0 && local.tasks.length > 0) {
          for (const t of local.tasks) {
            fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(t),
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

  const saveRoutine = useCallback(
    (routine: RoutineSettings) => {
      setDb((prev) => {
        const next: AppData = { ...prev, routine };
        saveLocalData(next);
        return next;
      });

      // Sync routine to server
      fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "__routine_settings__", text: JSON.stringify(routine) }),
      }).catch(() => {});
    },
    [saveLocalData]
  );

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
        saveRoutine,
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
