import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Try Supabase first
    try {
      const [tasksRes, journalRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, t, date, done")
          .eq("user_email", user.email)
          .order("date", { ascending: false }),
        supabase
          .from("journals")
          .select("date, text")
          .eq("user_email", user.email),
      ]);

      if (!tasksRes.error && !journalRes.error) {
        const journal: Record<string, string> = {};
        for (const row of journalRes.data || []) {
          journal[row.date] = row.text;
        }

        return NextResponse.json({
          tasks: tasksRes.data || [],
          journal,
          source: "supabase",
        });
      }
    } catch (sbErr) {
      console.log("[Supabase] Reading fallback to SQLite:", sbErr);
    }

    // 2. Fallback to SQLite
    const tasks = db
      .prepare(
        "SELECT id, t, date, done FROM tasks WHERE user_email = ? ORDER BY date DESC, created_at DESC"
      )
      .all(user.email) as Array<{ id: string; t: string; date: string; done: number }>;

    const formattedTasks = tasks.map((t) => ({
      id: Number(t.id) || t.id,
      t: t.t,
      date: t.date,
      done: Boolean(t.done),
    }));

    const journalRows = db
      .prepare("SELECT date, text FROM journals WHERE user_email = ?")
      .all(user.email) as Array<{ date: string; text: string }>;

    const journal: Record<string, string> = {};
    for (const row of journalRows) {
      journal[row.date] = row.text;
    }

    return NextResponse.json({
      tasks: formattedTasks,
      journal,
      source: "sqlite",
    });
  } catch (err: any) {
    console.error("fetch data error:", err);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
