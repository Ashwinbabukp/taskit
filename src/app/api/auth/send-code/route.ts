import { NextResponse } from "next/server";
import { db, generateCode } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

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

    // Call real email service
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
      message: `Verification code sent to ${cleanEmail}`,
    });
  } catch (err: any) {
    console.error("send-code error:", err);
    return NextResponse.json({ error: err.message || "Failed to send code" }, { status: 500 });
  }
}
