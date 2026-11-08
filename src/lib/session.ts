import { cookies } from "next/headers";
import crypto from "node:crypto";
import { db } from "./db";
import { supabase } from "./supabase";

export interface UserSession {
  email: string;
}

const SESSION_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "taskit-secret-signing-key-2026";

export function signData(data: Record<string, any>): string {
  const json = Buffer.from(JSON.stringify(data)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(json)
    .digest("base64url");
  return `${json}.${hmac}`;
}

export function verifySignedData<T = any>(token: string): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [json, hmac] = parts;
  const expectedHmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(json)
    .digest("base64url");

  if (hmac !== expectedHmac) return null;

  try {
    const data = JSON.parse(Buffer.from(json, "base64url").toString("utf-8"));
    if (data.exp && Date.now() > data.exp) return null;
    return data as T;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("taskit_session")?.value;
  if (!token) return null;

  // 1. Verify cryptographically signed session token (fast, resilient, serverless-ready)
  const signed = verifySignedData<{ email: string }>(token);
  if (signed?.email) {
    return { email: signed.email };
  }

  // 2. Check Supabase sessions table as fallback
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("user_email, expires_at")
      .eq("token", token)
      .single();

    if (!error && data) {
      if (Date.now() > data.expires_at) {
        await supabase.from("sessions").delete().eq("token", token);
        return null;
      }
      return { email: data.user_email };
    }
  } catch (sbErr) {}

  // 3. Check SQLite sessions table as local fallback
  if (db) {
    try {
      const stmt = db.prepare(
        "SELECT user_email, expires_at FROM sessions WHERE token = ?"
      );
      const row = stmt.get(token) as { user_email: string; expires_at: number } | undefined;

      if (row) {
        if (Date.now() > row.expires_at) {
          db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
          return null;
        }
        return { email: row.user_email };
      }
    } catch (err) {}
  }

  return null;
}
