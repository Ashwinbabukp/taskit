import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, hashPassword, verifyPassword } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { signData } from "@/lib/session";

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
    let existingPasswordHash: string | null = null;
    let userExists = false;

    // 1. Check Supabase
    try {
      const { data, error } = await supabase
        .from("users")
        .select("password_hash")
        .eq("email", cleanEmail)
        .single();

      if (!error && data) {
        userExists = true;
        existingPasswordHash = data.password_hash;
      }
    } catch (e) {}

    // 2. Check SQLite
    if (!userExists && db) {
      try {
        const user = db.prepare("SELECT password_hash FROM users WHERE email = ?").get(cleanEmail) as
          | { password_hash: string | null }
          | undefined;

        if (user) {
          userExists = true;
          existingPasswordHash = user.password_hash;
        }
      } catch (e) {}
    }

    if (isSignUp) {
      if (userExists && existingPasswordHash) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in." },
          { status: 400 }
        );
      }

      const passHash = hashPassword(password);

      // Save to Supabase
      try {
        await supabase
          .from("users")
          .upsert({ email: cleanEmail, password_hash: passHash }, { onConflict: "email" });
      } catch (e) {}

      // Save to SQLite
      if (db) {
        try {
          db.prepare("INSERT OR REPLACE INTO users (email, password_hash) VALUES (?, ?)").run(
            cleanEmail,
            passHash
          );
        } catch (e) {}
      }
    } else {
      // Login mode
      if (!userExists || !existingPasswordHash) {
        // Auto-register password for seamless login
        const passHash = hashPassword(password);
        try {
          await supabase
            .from("users")
            .upsert({ email: cleanEmail, password_hash: passHash }, { onConflict: "email" });
        } catch (e) {}
        if (db) {
          try {
            db.prepare("INSERT OR REPLACE INTO users (email, password_hash) VALUES (?, ?)").run(
              cleanEmail,
              passHash
            );
          } catch (e) {}
        }
      } else {
        // Verify existing password
        const ok = verifyPassword(password, existingPasswordHash);
        if (!ok) {
          return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
        }
      }
    }

    // Create session (valid for 30 days)
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const token = signData({
      email: cleanEmail,
      exp: expiresAt,
    });

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
    console.error("password auth error:", err);
    return NextResponse.json({ error: err.message || "Authentication failed" }, { status: 500 });
  }
}
