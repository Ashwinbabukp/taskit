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
    const cleanCode = code.trim();

    let userCode: string | null = null;
    let codeExpiresAt: number = 0;
    let userFound = false;

    // 1. Look up verification code in Supabase
    try {
      const { data, error } = await supabase
        .from("users")
        .select("verification_code, code_expires_at")
        .eq("email", cleanEmail)
        .single();

      if (!error && data) {
        userFound = true;
        userCode = data.verification_code;
        codeExpiresAt = Number(data.code_expires_at) || 0;
      }
    } catch (sbErr) {
      console.log("[Supabase] verify-code error:", sbErr);
    }

    // 2. Fallback to SQLite if not found in Supabase
    if (!userCode && db) {
      try {
        const user = db.prepare(
          "SELECT verification_code, code_expires_at FROM users WHERE email = ?"
        ).get(cleanEmail) as { verification_code: string; code_expires_at: number } | undefined;

        if (user) {
          userFound = true;
          userCode = user.verification_code;
          codeExpiresAt = user.code_expires_at;
        }
      } catch (dbErr) {
        console.log("[SQLite] verify-code error:", dbErr);
      }
    }

    if (!userFound || !userCode) {
      return NextResponse.json(
        { error: "No active verification code found. Please request a new one." },
        { status: 404 }
      );
    }

    if (userCode !== cleanCode) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    if (Date.now() > codeExpiresAt) {
      return NextResponse.json(
        { error: "Verification code expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Clear verification code
    try {
      await supabase
        .from("users")
        .update({ verification_code: null, code_expires_at: null })
        .eq("email", cleanEmail);
    } catch (e) {}

    if (db) {
      try {
        db.prepare(
          "UPDATE users SET verification_code = NULL, code_expires_at = NULL WHERE email = ?"
        ).run(cleanEmail);
      } catch (e) {}
    }

    // Create session (valid for 30 days)
    const token = generateSessionToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    try {
      await supabase.from("sessions").insert({
        token,
        user_email: cleanEmail,
        expires_at: expiresAt,
      });
      await supabase.from("users").upsert({ email: cleanEmail }, { onConflict: "email" });
    } catch (e) {}

    if (db) {
      try {
        db.prepare("INSERT INTO sessions (token, user_email, expires_at) VALUES (?, ?, ?)").run(
          token,
          cleanEmail,
          expiresAt
        );
      } catch (e) {}
    }

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
