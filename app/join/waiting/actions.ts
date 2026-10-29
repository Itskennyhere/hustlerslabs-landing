"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { isLimited, recordFailure } from "@/lib/ratelimit";
import { mailConfigured } from "@/lib/mail";
import { EMAIL_RE } from "@/lib/validate";
import { emailTakenByOther, startEmailConfirm } from "@/lib/email-confirm";

export type WaitState = { error?: string; ok?: string } | undefined;

// These work for a signed-in member who is still waiting. They never touch another account.
async function waitingMember() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.mfaVerified) redirect("/login/verify");
  return s;
}

/** The address waiting to be confirmed: the newest open link, or the account's email. */
async function pendingEmail(userId: number): Promise<string | null> {
  const rows = await q<{ email: string }>`
    SELECT email FROM email_tokens WHERE user_id = ${userId} AND purpose = 'verify' ORDER BY created_at DESC LIMIT 1`;
  return rows[0]?.email ?? null;
}

export async function resendConfirm(_: WaitState): Promise<WaitState> {
  const s = await waitingMember();
  if (s.emailConfirmed) return { ok: "Your email is already confirmed." };
  if (!mailConfigured()) return { error: "Email sending is not set up yet." };
  const bucket = `email-link:${s.userId}`;
  if (await isLimited(bucket, 5, 60)) return { error: "Too many emails sent. Try again in an hour." };
  const email = await pendingEmail(s.userId);
  if (!email) return { error: "Enter your email below." };
  await recordFailure(bucket);
  try {
    await startEmailConfirm(s.userId, s.username, email);
  } catch (e) {
    console.error("resend confirm failed", e);
    return { error: "Could not send the email. Try again in a few minutes." };
  }
  return { ok: `Sent a new link to ${email}.` };
}

export async function changeSignupEmail(_: WaitState, form: FormData): Promise<WaitState> {
  const s = await waitingMember();
  if (s.emailConfirmed) return { error: "Your email is already confirmed. Change it from Account once you are in." };
  if (!mailConfigured()) return { error: "Email sending is not set up yet." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const pwBucket = `reauth:${s.userId}`;
  if (await isLimited(pwBucket, 5)) return { error: "Too many attempts. Try again in 15 minutes." };
  const rows = await q<{ password_hash: string }>`SELECT password_hash FROM users WHERE id = ${s.userId}`;
  if (!rows[0] || !(await verifyPassword(rows[0].password_hash, String(form.get("current_password") ?? "").slice(0, 256)))) {
    await recordFailure(pwBucket);
    return { error: "Password is wrong." };
  }
  const bucket = `email-link:${s.userId}`;
  if (await isLimited(bucket, 5, 60)) return { error: "Too many emails sent. Try again in an hour." };
  if (await emailTakenByOther(email, s.userId)) return { error: "That email is already linked to another account." };
  await recordFailure(bucket);
  try {
    await startEmailConfirm(s.userId, s.username, email);
  } catch (e) {
    console.error("change signup email failed", e);
    return { error: "Could not send the email. Try again in a few minutes." };
  }
  revalidatePath("/join/waiting");
  return { ok: `Sent a link to ${email}.` };
}
