import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, generateCode, hashPassword } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { sendVerificationEmail } from "@/lib/mail";
import { signData } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 1. Set cryptographically signed OTP challenge cookie (resilient on Vercel)
    const challengeToken = signData({
      email: cleanEmail,
      hash: hashPassword(code),
      exp: expiresAt,
    });

    const cookieStore = await cookies();
    cookieStore.set("taskit_otp_challenge", challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60, // 10 minutes
      path: "/",
    });

    // 2. Also try saving to Supabase if tables exist
    try {
      await supabase.from("users").upsert(
        {
          email: cleanEmail,
          verification_code: code,
          code_expires_at: expiresAt,
        },
        { onConflict: "email" }
      );
    } catch (sbErr) {
      console.log("[Supabase] send-code upsert:", sbErr);
    }

    // 3. Save to SQLite if available locally
    if (db) {
      try {
        const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
        if (existing) {
          db.prepare(
            "UPDATE users SET verification_code = ?, code_expires_at = ? WHERE email = ?"
          ).run(code, expiresAt, cleanEmail);
        } else {
          db.prepare(
            "INSERT INTO users (email, verification_code, code_expires_at) VALUES (?, ?, ?)"
          ).run(cleanEmail, code, expiresAt);
        }
      } catch (dbErr) {
        console.log("[SQLite] send-code error:", dbErr);
      }
    }

    // 4. Dispatch real verification email
    const mailResult = await sendVerificationEmail({ to: cleanEmail, code });

    if (!mailResult.success && mailResult.error) {
      return NextResponse.json(
        { error: mailResult.error || "Failed to send verification email" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      delivered: mailResult.delivered,
      provider: mailResult.provider,
      testCode: !mailResult.delivered || process.env.NODE_ENV === "development" ? code : undefined,
      message: mailResult.delivered
        ? `Verification code sent to ${cleanEmail}`
        : `Verification code generated for ${cleanEmail}`,
    });
  } catch (err: any) {
    console.error("send-code error:", err);
    return NextResponse.json({ error: err.message || "Failed to send code" }, { status: 500 });
  }
}
