"use server";

import { redirect } from "next/navigation";
import { TOTP, Secret } from "otpauth";
import { q } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { clientIp, clearFailures, isLimited, recordFailure } from "@/lib/ratelimit";
import { completeMfa, createSession, destroySession, getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

export type FormState = { error?: string } | undefined;

const GENERIC = "Invalid username or password.";

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase().slice(0, 64);
  const password = String(form.get("password") ?? "").slice(0, 256);
  if (!username || !password) return { error: GENERIC };

  const ip = await clientIp();
  const ipBucket = `login-ip:${ip}`;
  const userBucket = `login-user:${username}`;
  if ((await isLimited(ipBucket, 20)) || (await isLimited(userBucket, 5))) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  const rows = await q<{ id: number; password_hash: string; totp_enabled: boolean; disabled_at: string | null }>`
    SELECT id, password_hash, totp_enabled, disabled_at FROM users WHERE username = ${username} LIMIT 1`;
  const user = rows[0];

  if (!user) {
    await burnPasswordCheck(password);
    await recordFailure(ipBucket, userBucket);
    return { error: GENERIC };
  }
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok || user.disabled_at) {
    await recordFailure(ipBucket, userBucket);
    return { error: GENERIC };
  }

  await clearFailures(userBucket);
  await q`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
  await createSession(Number(user.id), !user.totp_enabled);
  redirect(user.totp_enabled ? "/login/verify" : "/members");
}

export async function verifyTotp(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/members");

  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const attempts = await q<{ mfa_attempts: number }>`
    UPDATE sessions SET mfa_attempts = mfa_attempts + 1 WHERE id = ${s.sessionId} RETURNING mfa_attempts`;
  if ((attempts[0]?.mfa_attempts ?? 99) > 5) {
    await destroySession();
    redirect("/login");
  }

  const rows = await q<{ totp_secret_enc: string | null }>`SELECT totp_secret_enc FROM users WHERE id = ${s.userId}`;
  const enc = rows[0]?.totp_secret_enc;
  if (!enc || !/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };

  const totp = new TOTP({ secret: Secret.fromBase32(decrypt(enc)), digits: 6, period: 30 });
  if (totp.validate({ token: code, window: 1 }) === null) {
    return { error: "That code did not match. Try the newest code." };
  }

  await completeMfa(s.sessionId, s.userId);
  redirect("/members");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
