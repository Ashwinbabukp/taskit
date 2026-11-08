import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("taskit_session")?.value;

    if (token) {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    }

    cookieStore.delete("taskit_session");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}

