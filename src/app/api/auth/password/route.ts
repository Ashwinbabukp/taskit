import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, hashPassword, verifyPassword, generateSessionToken } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email, password, isSignUp } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(cleanEmail) as
      | { id: number; password_hash: string | null }
      | undefined;

    if (isSignUp) {
      if (user && user.password_hash) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in." },
          { status: 400 }
        );
      }

      const passHash = hashPassword(password);
      if (user) {
        db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passHash, user.id);
      } else {
        db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(cleanEmail, passHash);
      }

      // Sync to Supabase
      try {
        await supabase.from("users").upsert({ email: cleanEmail, password_hash: passHash }, { onConflict: "email" });
      } catch (e) {
        console.log("[Supabase] Sync user error:", e);
      }
    } else {
      // Login mode
      if (!user) {
        // Auto-register if user doesn't exist yet for friendly onboarding
        const passHash = hashPassword(password);
        db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(cleanEmail, passHash);
        try {
          await supabase.from("users").upsert({ email: cleanEmail, password_hash: passHash }, { onConflict: "email" });
        } catch (e) {}
      } else if (!user.password_hash) {
        // Set password for user who signed up with code previously
        const passHash = hashPassword(password);
        db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passHash, user.id);
        try {
          await supabase.from("users").upsert({ email: cleanEmail, password_hash: passHash }, { onConflict: "email" });
        } catch (e) {}
      } else {
        // Verify existing password
        const ok = verifyPassword(password, user.password_hash);
        if (!ok) {
          return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
        }
      }
    }

    // Create session
    const token = generateSessionToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    db.prepare("INSERT INTO sessions (token, user_email, expires_at) VALUES (?, ?, ?)").run(
      token,
      cleanEmail,
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
      user: { email: cleanEmail },
    });
  } catch (err: any) {
    console.error("password auth error:", err);
    return NextResponse.json({ error: err.message || "Authentication failed" }, { status: 500 });
  }
}

