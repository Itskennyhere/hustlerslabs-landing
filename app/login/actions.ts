"use server";

import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { clientIp, clearFailures, isLimited, recordFailure } from "@/lib/ratelimit";
import { completeMfa, createSession, destroySession, getSession, type SessionUser } from "@/lib/auth";
import { checkTotp, logEvent, useRecoveryCode } from "@/lib/security";
import { checkEmailCode, emailStepAddress, sendEmailCode } from "@/lib/email-step";

export type FormState = { error?: string; ok?: string } | undefined;

const GENERIC = "Invalid email or password.";

export async function login(_: FormState, form: FormData): Promise<FormState> {
  // Sign in with the confirmed email. The username still works for accounts that have no confirmed email yet.
  const ident = String(form.get("username") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(form.get("password") ?? "").slice(0, 256);
  if (!ident || !password) return { error: GENERIC };

  const ip = await clientIp();
  const ipBucket = `login-ip:${ip}`;
  const userBucket = `login-user:${ident}`;
  if ((await isLimited(ipBucket, 20)) || (await isLimited(userBucket, 5))) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  const rows = await q<{ id: number; password_hash: string; totp_enabled: boolean; disabled_at: string | null }>`
    SELECT id, password_hash, totp_enabled, disabled_at FROM users
    WHERE (lower(email) = ${ident} AND email_verified_at IS NOT NULL) OR username = ${ident}
    ORDER BY (lower(email) = ${ident} AND email_verified_at IS NOT NULL) DESC
    LIMIT 1`;
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

  const id = Number(user.id);
  await clearFailures(userBucket);
  await q`UPDATE users SET last_login_at = now() WHERE id = ${id}`;

  if (user.totp_enabled) {
    await createSession(id, false, "totp");
    redirect("/login/verify");
  }
  const address = await emailStepAddress(id);
  if (address) {
    const sessionId = await createSession(id, false, "email");
    const sent = await sendEmailCode(sessionId, id, address);
    redirect(sent === "sent" ? "/login/email-code" : "/login/email-code?send=failed");
  }
  await createSession(id, true);
  await logEvent(id, "login");
  redirect("/members");
}

/** After the app code: admins go on to the email code, everyone else is signed in. */
async function afterAppCode(s: SessionUser): Promise<never> {
  const address = await emailStepAddress(s.userId);
  if (address) {
    const sent = await sendEmailCode(s.sessionId, s.userId, address);
    redirect(sent === "sent" ? "/login/email-code" : "/login/email-code?send=failed");
  }
  await completeMfa(s.sessionId, s.userId);
  await logEvent(s.userId, "login");
  redirect("/members");
}

export async function verifyTotp(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/members");
  if (s.stage === "email") redirect("/login/email-code");

  const input = String(form.get("code") ?? "").trim().slice(0, 32);
  const code = input.replace(/\s/g, "");
  const attempts = await q<{ mfa_attempts: number }>`
    UPDATE sessions SET mfa_attempts = mfa_attempts + 1 WHERE id = ${s.sessionId} RETURNING mfa_attempts`;
  // Per account as well as per session: signing in again with the password does not reset the count.
  const userBucket = `totp-user:${s.userId}`;
  if ((attempts[0]?.mfa_attempts ?? 99) > 5 || (await isLimited(userBucket, 10))) {
    await destroySession();
    redirect("/login?locked=1");
  }

  const rows = await q<{ totp_secret_enc: string | null }>`SELECT totp_secret_enc FROM users WHERE id = ${s.userId}`;
  const enc = rows[0]?.totp_secret_enc;
  if (!enc) return { error: "Two-step login is not set up for this account." };

  if (/^\d{6}$/.test(code)) {
    if (!(await checkTotp(s.userId, enc, code))) {
      await recordFailure(userBucket);
      return { error: "That code did not match, or was already used. Wait for the next code." };
    }
  } else {
    if (!(await useRecoveryCode(s.userId, code))) {
      await recordFailure(userBucket);
      return { error: "Enter the 6-digit code from your app, or one of your recovery codes." };
    }
    await logEvent(s.userId, "login_recovery");
  }
  return afterAppCode(s);
}

export async function verifyEmailCode(_: FormState, form: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/members");
  if (s.stage !== "email") redirect("/login/verify");

  const code = String(form.get("code") ?? "").replace(/\s/g, "").slice(0, 12);
  const attempts = await q<{ mfa_attempts: number }>`
    UPDATE sessions SET mfa_attempts = mfa_attempts + 1 WHERE id = ${s.sessionId} RETURNING mfa_attempts`;
  const userBucket = `email-code-user:${s.userId}`;
  if ((attempts[0]?.mfa_attempts ?? 99) > 5 || (await isLimited(userBucket, 10))) {
    await destroySession();
    redirect("/login?locked=1");
  }
  if (!(await checkEmailCode(s.sessionId, code))) {
    await recordFailure(userBucket);
    return { error: "That code did not match or has expired. Check the newest email, or send a new code." };
  }
  await completeMfa(s.sessionId, s.userId);
  await logEvent(s.userId, "login");
  redirect("/members");
}

export async function resendEmailCode(_: FormState): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/members");
  if (s.stage !== "email") redirect("/login/verify");
  const address = await emailStepAddress(s.userId);
  if (!address) return { error: "Could not send a code. Sign in again." };
  const sent = await sendEmailCode(s.sessionId, s.userId, address);
  if (sent === "limit") return { error: "Too many codes sent for this sign-in. Sign in again." };
  if (sent === "failed") return { error: "Could not send the email. Try again in a minute." };
  return { ok: "New code sent. Earlier codes no longer work." };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
