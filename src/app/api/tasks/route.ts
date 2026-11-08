import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, t, date } = await req.json();
    if (!t || !date) {
      return NextResponse.json({ error: "Task content and date required" }, { status: 400 });
    }

    const taskId = String(id || Date.now());

    // 1. Try Supabase
    try {
      await supabase.from("tasks").insert({
        id: taskId,
        user_email: user.email,
        t: t.trim(),
        date,
        done: false,
      });
    } catch (e) {
      console.log("[Supabase] Insert task error:", e);
    }

    // 2. Always persist to SQLite
    db.prepare("INSERT OR REPLACE INTO tasks (id, user_email, t, date, done) VALUES (?, ?, ?, ?, 0)").run(
      taskId,
      user.email,
      t.trim(),
      date
    );

    return NextResponse.json({
      success: true,
      task: { id: taskId, t: t.trim(), date, done: false },
    });
  } catch (err: any) {
    console.error("create task error:", err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, done, t } = await req.json();
    const taskId = String(id);

    // 1. Try Supabase
    try {
      const updateData: Record<string, any> = {};
      if (done !== undefined) updateData.done = Boolean(done);
      if (t !== undefined) updateData.t = t;

      await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("user_email", user.email);
    } catch (e) {
      console.log("[Supabase] Update task error:", e);
    }

    // 2. Always persist to SQLite
    if (done !== undefined) {
      db.prepare("UPDATE tasks SET done = ? WHERE id = ? AND user_email = ?").run(
        done ? 1 : 0,
        taskId,
        user.email
      );
    }

    if (t !== undefined) {
      db.prepare("UPDATE tasks SET t = ? WHERE id = ? AND user_email = ?").run(
        t,
        taskId,
        user.email
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("patch task error:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    const taskId = String(id);

    // 1. Try Supabase
    try {
      await supabase.from("tasks").delete().eq("id", taskId).eq("user_email", user.email);
    } catch (e) {
      console.log("[Supabase] Delete task error:", e);
    }

    // 2. Always persist to SQLite
    db.prepare("DELETE FROM tasks WHERE id = ? AND user_email = ?").run(
      taskId,
      user.email
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("delete task error:", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
