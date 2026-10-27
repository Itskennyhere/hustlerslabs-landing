"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db, q } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { ensureSchema } from "@/lib/migrate";
import { appUrl, mailConfigured, sendMail } from "@/lib/mail";
import { TOKEN_MINUTES, createEmailToken, peekEmailToken } from "@/lib/email-tokens";
import { hashPassword, validatePassword } from "@/lib/password";
import { clearFailures, clientIp, isLimited, recordFailure } from "@/lib/ratelimit";

export type EmailFormState = { error?: string; ok?: string } | undefined;

// ---------- Forgot password ----------

export async function requestReset(_: EmailFormState, form: FormData): Promise<EmailFormState> {
  await ensureSchema();
  if (!mailConfigured()) return { error: "Password reset by email is not set up yet. Contact Hustlers Labs." };

  const ip = await clientIp();
  const ipBucket = `forgot-ip:${ip}`;
  if (await isLimited(ipBucket, 5)) return { error: "Too many requests. Try again in 15 minutes." };
  await recordFailure(ipBucket); // counts every request

  const ident = String(form.get("ident") ?? "").trim().toLowerCase().slice(0, 254);
  const done: EmailFormState = {
    ok: `If that matches an account with a confirmed email, we have sent a reset link to it. The link expires in ${TOKEN_MINUTES.reset} minutes.`,
  };
  if (!ident) return done;

  // The lookup and the email happen after the response is sent, so the reply looks and takes
  // the same whether or not the account exists.
  after(async () => {
    const rows = await q<{ id: number; username: string; email: string }>`
      SELECT id, username, email FROM users
      WHERE (username = ${ident} OR lower(email) = ${ident})
        AND email_verified_at IS NOT NULL AND disabled_at IS NULL
      ORDER BY (username = ${ident}) DESC LIMIT 1`;
    const u = rows[0];
    if (!u) return;
    const userBucket = `forgot-user:${u.id}`;
    if (await isLimited(userBucket, 3, 60)) return;
    await recordFailure(userBucket);
    const token = await createEmailToken(Number(u.id), "reset", u.email);
    try {
      await sendMail(
        u.email,
        "Reset your Hustlers Labs password",
        `Hi @${u.username},\n\nSomeone asked to reset the password for your Hustlers Labs account. To choose a new password, open:\n\n${appUrl(`/login/reset?token=${token}`)}\n\nThe link works once and expires in ${TOKEN_MINUTES.reset} minutes. If you did not ask for this, ignore this email. Your password stays the same.\n`,
      );
    } catch (e) {
      console.error("reset email failed", e);
    }
  });
  return done;
}

// ---------- Reset password ----------

export async function resetPassword(_: EmailFormState, form: FormData): Promise<EmailFormState> {
  await ensureSchema();
  const token = String(form.get("token") ?? "");
  const t = await peekEmailToken(token, "reset");
  if (!t) return { error: "This reset link is invalid, used or expired. Ask for a new one." };

  const password = String(form.get("password") ?? "");
  const err = validatePassword(password, t.username);
  if (err) return { error: err };
  if (password !== String(form.get("confirm") ?? "")) return { error: "Passwords do not match." };
  const hash = await hashPassword(password);

  // Use the token, set the password and sign out every device, together.
  const ok = await db().begin(async (sql) => {
    const used = await sql<{ user_id: number }[]>`
      UPDATE email_tokens SET used_at = now()
      WHERE token_hash = ${sha256(token)} AND purpose = 'reset' AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`;
    if (!used[0]) return false;
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${used[0].user_id}`;
    await sql`DELETE FROM sessions WHERE user_id = ${used[0].user_id}`;
    return true;
  });
  if (!ok) return { error: "This reset link is invalid, used or expired. Ask for a new one." };

  await clearFailures(`login-user:${t.username}`);
  after(async () => {
    try {
      await sendMail(
        t.email,
        "Your Hustlers Labs password was changed",
        `Hi @${t.username},\n\nYour Hustlers Labs password was just reset and every device was signed out.\n\nIf this was not you, contact Hustlers Labs straight away.\n`,
      );
    } catch (e) {
      console.error("reset notice failed", e);
    }
  });
  redirect("/login?reset=1");
}

// ---------- Confirm email ----------

export async function confirmEmail(_: EmailFormState, form: FormData): Promise<EmailFormState> {
  await ensureSchema();
  const token = String(form.get("token") ?? "");
  const t = await peekEmailToken(token, "verify");
  if (!t) return { error: "This link is invalid, used or expired. Send a new one from Account." };

  try {
    const ok = await db().begin(async (sql) => {
      const used = await sql`
        UPDATE email_tokens SET used_at = now()
        WHERE token_hash = ${sha256(token)} AND purpose = 'verify' AND used_at IS NULL AND expires_at > now()
        RETURNING id`;
      if (!used[0]) return false;
      await sql`UPDATE users SET email = ${t.email}, email_verified_at = now() WHERE id = ${t.user_id}`;
      return true;
    });
    if (!ok) return { error: "This link is invalid, used or expired. Send a new one from Account." };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "That email is already linked to another account." };
    throw e;
  }
  return { ok: `${t.email} is confirmed. You can use it to reset your password.` };
}
