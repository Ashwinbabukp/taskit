import { Task } from "@/context/DataContext";

export function ymd(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function parseMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if a task is overdue / incomplete:
 * - date is strictly in the past (< today) AND done is false, OR
 * - date is today AND task has an endTime AND current time is past endTime AND done is false.
 */
export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.done) return false;

  const todayStr = ymd(now);
  if (task.date < todayStr) {
    return true;
  }

  if (task.date === todayStr && task.endTime) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const taskEndMinutes = parseMinutes(task.endTime);
    // If past end time by at least 1 minute
    if (nowMinutes > taskEndMinutes) {
      return true;
    }
  }

  return false;
}

export function getOverdueTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks.filter((t) => isTaskOverdue(t, now));
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  todayTotal: number;
  todayDone: number;
  todayRate: number;
  isTodayDone: boolean;
}

/**
 * Calculates user daily completion streak.
 * A day is considered a "streak day" if it had at least 1 task and all tasks were completed (or >= 80%).
 */
export function calculateStreak(tasks: Task[], now: Date = new Date()): StreakInfo {
  const todayStr = ymd(now);
  const todayTasks = tasks.filter((t) => t.date === todayStr);
  const todayTotal = todayTasks.length;
  const todayDone = todayTasks.filter((t) => t.done).length;
  const todayRate = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const isTodayDone = todayTotal > 0 && todayDone === todayTotal;

  // Group tasks by date
  const tasksByDate = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    const cur = tasksByDate.get(t.date) || { total: 0, done: 0 };
    cur.total += 1;
    if (t.done) cur.done += 1;
    tasksByDate.set(t.date, cur);
  }

  // Calculate current streak
  let currentStreak = 0;
  const checkDate = new Date(now);

  // If today is completed, start from today. Otherwise start from yesterday.
  if (isTodayDone) {
    currentStreak += 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // If today is not completed yet, check if yesterday was completed
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Walk backward day by day
  for (let i = 0; i < 365; i++) {
    const dStr = ymd(checkDate);
    const dayStats = tasksByDate.get(dStr);

    if (dayStats && dayStats.total > 0 && dayStats.done === dayStats.total) {
      currentStreak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak calculation across all recorded days
  const allDates = Array.from(tasksByDate.keys()).sort();
  let longestStreak = currentStreak;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dStr of allDates) {
    const stats = tasksByDate.get(dStr);
    const isCompleted = stats && stats.total > 0 && stats.done === stats.total;
    const curDate = new Date(dStr);

    if (isCompleted) {
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak += 1;
        } else {
          tempStreak = 1;
        }
      }
      prevDate = curDate;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
      prevDate = null;
    }
  }

  return {
    currentStreak,
    longestStreak,
    todayTotal,
    todayDone,
    todayRate,
    isTodayDone,
  };
}

export interface DayAnalysis {
  date: string;
  dayName: string;
  total: number;
  completed: number;
  incomplete: number;
  rate: number;
  isToday: boolean;
  isPast: boolean;
}

export interface WeeklyAnalysis {
  weekLabel: string;
  startDate: string;
  endDate: string;
  days: DayAnalysis[];
  totalTasks: number;
  totalCompleted: number;
  totalIncomplete: number;
  weeklyRate: number;
  bestDay: string;
}

export function getWeeklyAnalysis(tasks: Task[], referenceDate: Date = new Date()): WeeklyAnalysis {
  const d = new Date(referenceDate);
  const day = d.getDay();
  // Monday is day 1, Sunday is day 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(d);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const days: DayAnalysis[] = [];
  const now = new Date();
  const todayStr = ymd(now);

  let totalTasks = 0;
  let totalCompleted = 0;
  let bestDayName = "None";
  let maxCompleted = -1;

  for (let i = 0; i < 7; i++) {
    const curDate = new Date(startOfWeek);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = ymd(curDate);
    const dayName = curDate.toLocaleDateString(undefined, { weekday: "short" });

    const dayTasks = tasks.filter((t) => t.date === dateStr);
    const completed = dayTasks.filter((t) => t.done).length;
    const total = dayTasks.length;
    const incomplete = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    totalTasks += total;
    totalCompleted += completed;

    if (completed > maxCompleted && completed > 0) {
      maxCompleted = completed;
      bestDayName = curDate.toLocaleDateString(undefined, { weekday: "long" });
    }

    days.push({
      date: dateStr,
      dayName,
      total,
      completed,
      incomplete,
      rate,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  const totalIncomplete = totalTasks - totalCompleted;
  const weeklyRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const weekLabel = `${startOfWeek.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${endOfWeek.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

  return {
    weekLabel,
    startDate: ymd(startOfWeek),
    endDate: ymd(endOfWeek),
    days,
    totalTasks,
    totalCompleted,
    totalIncomplete,
    weeklyRate,
    bestDay: bestDayName,
  };
}
