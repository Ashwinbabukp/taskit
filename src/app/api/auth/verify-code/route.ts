import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, verifyPassword } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { signData, verifySignedData } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const cookieStore = await cookies();

    let verified = false;

    // 1. Check cryptographically signed OTP challenge cookie (instant, reliable on Vercel)
    const challengeCookie = cookieStore.get("taskit_otp_challenge")?.value;
    if (challengeCookie) {
      const challenge = verifySignedData<{ email: string; hash: string; exp: number }>(challengeCookie);
      if (challenge && challenge.email === cleanEmail) {
        if (Date.now() > challenge.exp) {
          return NextResponse.json(
            { error: "Verification code expired. Please request a new one." },
            { status: 400 }
          );
        }
        if (verifyPassword(cleanCode, challenge.hash)) {
          verified = true;
        }
      }
    }

    // 2. Check Supabase users table as secondary verification
    if (!verified) {
      try {
        const { data } = await supabase
          .from("users")
          .select("verification_code, code_expires_at")
          .eq("email", cleanEmail)
          .single();

        if (data?.verification_code) {
          if (Date.now() > Number(data.code_expires_at || 0)) {
            return NextResponse.json(
              { error: "Verification code expired. Please request a new one." },
              { status: 400 }
            );
          }
          if (data.verification_code === cleanCode) {
            verified = true;
          }
        }
      } catch (e) {}
    }

    // 3. Check SQLite as local fallback
    if (!verified && db) {
      try {
        const user = db.prepare(
          "SELECT verification_code, code_expires_at FROM users WHERE email = ?"
        ).get(cleanEmail) as { verification_code: string; code_expires_at: number } | undefined;

        if (user?.verification_code) {
          if (Date.now() > user.code_expires_at) {
            return NextResponse.json(
              { error: "Verification code expired. Please request a new one." },
              { status: 400 }
            );
          }
          if (user.verification_code === cleanCode) {
            verified = true;
          }
        }
      } catch (e) {}
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid verification code. Please check your email or request a new code." },
        { status: 400 }
      );
    }

    // Clear the challenge cookie
    cookieStore.delete("taskit_otp_challenge");

    // Clear code from Supabase & SQLite
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

    // Create session (valid for 30 days) with signed token
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const sessionToken = signData({
      email: cleanEmail,
      exp: expiresAt,
    });

    try {
      await supabase.from("sessions").insert({
        token: sessionToken,
        user_email: cleanEmail,
        expires_at: expiresAt,
      });
      await supabase.from("users").upsert({ email: cleanEmail }, { onConflict: "email" });
    } catch (e) {}

    if (db) {
      try {
        db.prepare("INSERT INTO sessions (token, user_email, expires_at) VALUES (?, ?, ?)").run(
          sessionToken,
          cleanEmail,
          expiresAt
        );
      } catch (e) {}
    }

    cookieStore.set("taskit_session", sessionToken, {
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
