import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, generateSessionToken } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "user@gmail.com").trim().toLowerCase();

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!existing) {
      db.prepare("INSERT INTO users (email) VALUES (?)").run(email);
    }

    const token = generateSessionToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    db.prepare("INSERT INTO sessions (token, user_email, expires_at) VALUES (?, ?, ?)").run(
      token,
      email,
      expiresAt
    );

    const cookieStore = await cookies();
    cookieStore.set("taskit_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: { email },
    });
  } catch (err: any) {
    console.error("google auth error:", err);
    return NextResponse.json({ error: "Failed to authenticate" }, { status: 500 });
  }
}

