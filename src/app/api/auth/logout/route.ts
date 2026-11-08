import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("taskit_session")?.value;

    if (token) {
      try {
        await supabase.from("sessions").delete().eq("token", token);
      } catch (e) {}

      if (db) {
        try {
          db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
        } catch (e) {}
      }
    }

    cookieStore.delete("taskit_session");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}
