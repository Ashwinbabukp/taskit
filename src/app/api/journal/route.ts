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

    const { date, text } = await req.json();
    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const cleanText = (text || "").trim();

    // 1. Try Supabase
    try {
      if (!cleanText) {
        await supabase
          .from("journals")
          .delete()
          .eq("user_email", user.email)
          .eq("date", date);
      } else {
        await supabase.from("journals").upsert(
          {
            id: `${user.email}_${date}`,
            user_email: user.email,
            date,
            text: cleanText,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_email,date" }
        );
      }
    } catch (e) {
      console.log("[Supabase] Journal upsert error:", e);
    }

    // 2. Always persist to SQLite
    if (!cleanText) {
      db.prepare("DELETE FROM journals WHERE user_email = ? AND date = ?").run(
        user.email,
        date
      );
    } else {
      db.prepare(`
        INSERT INTO journals (id, user_email, date, text, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_email, date) DO UPDATE SET
          text = excluded.text,
          updated_at = CURRENT_TIMESTAMP
      `).run(`${user.email}_${date}`, user.email, date, cleanText);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("journal error:", err);
    return NextResponse.json({ error: "Failed to save journal" }, { status: 500 });
  }
}
