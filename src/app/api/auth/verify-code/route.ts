import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, generateSessionToken } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare(
      "SELECT id, verification_code, code_expires_at FROM users WHERE email = ?"
    ).get(cleanEmail) as { id: number; verification_code: string; code_expires_at: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: "User not found. Please request a new code." }, { status: 404 });
    }

    if (!user.verification_code || user.verification_code !== code.trim()) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    if (Date.now() > user.code_expires_at) {
      return NextResponse.json({ error: "Verification code expired. Please request a new one." }, { status: 400 });
    }

    // Clear code
    db.prepare("UPDATE users SET verification_code = NULL, code_expires_at = NULL WHERE id = ?").run(user.id);

    // Create session (valid for 30 days)
    const token = generateSessionToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    db.prepare("INSERT INTO sessions (token, user_email, expires_at) VALUES (?, ?, ?)").run(
      token,
      cleanEmail,
      expiresAt
    );

    try {
      await supabase.from("sessions").insert({ token, user_email: cleanEmail, expires_at: expiresAt });
      await supabase.from("users").upsert({ email: cleanEmail }, { onConflict: "email" });
    } catch (e) {}

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
      user: { email: cleanEmail },
    });
  } catch (err: any) {
    console.error("verify-code error:", err);
    return NextResponse.json({ error: err.message || "Failed to verify code" }, { status: 500 });
  }
}

