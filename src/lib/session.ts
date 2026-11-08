import { cookies } from "next/headers";
import { db } from "./db";
import { supabase } from "./supabase";

export interface UserSession {
  email: string;
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("taskit_session")?.value;
  if (!token) return null;

  // 1. Try SQLite
  try {
    const stmt = db.prepare(
      "SELECT user_email, expires_at FROM sessions WHERE token = ?"
    );
    const row = stmt.get(token) as { user_email: string; expires_at: number } | undefined;

    if (row) {
      if (Date.now() > row.expires_at) {
        db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
        return null;
      }
      return { email: row.user_email };
    }
  } catch (err) {
    console.error("Local session lookup error:", err);
  }

  // 2. Try Supabase
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("user_email, expires_at")
      .eq("token", token)
      .single();

    if (!error && data) {
      if (Date.now() > data.expires_at) {
        await supabase.from("sessions").delete().eq("token", token);
        return null;
      }
      return { email: data.user_email };
    }
  } catch (sbErr) {
    console.error("Supabase session lookup error:", sbErr);
  }

  return null;
}
