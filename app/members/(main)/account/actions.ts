"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { TOTP, Secret } from "otpauth";
import { q } from "@/lib/db";
import { requireMember, SESSION_COOKIE } from "@/lib/auth";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";
import { isLimited, recordFailure } from "@/lib/ratelimit";
import { getAccountType, parseProjectProfile, type ProjectProfile } from "@/lib/onboarding";
import { EMAIL_RE, FieldError } from "@/lib/validate";
import { appUrl, mailConfigured, sendMail } from "@/lib/mail";
import { createEmailToken } from "@/lib/email-tokens";

export type Msg = { error?: string; ok?: string; field?: string } | undefined;

function totpFor(secretB32: string, username: string) {
  return new TOTP({ issuer: "Hustlers Labs", label: username, secret: Secret.fromBase32(secretB32), digits: 6, period: 30 });
}

export async function startTotp(): Promise<void> {
  const s = await requireMember();
  if (s.totpEnabled) return;
  const secret = new Secret({ size: 20 }).base32;
  await q`UPDATE users SET totp_secret_enc = ${encrypt(secret)} WHERE id = ${s.userId} AND totp_enabled = false`;
  revalidatePath("/members/account");
}

export async function confirmTotp(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  const bucket = `totp-setup:${s.userId}`;
  if (await isLimited(bucket, 10)) return { error: "Too many attempts. Try again in 15 minutes." };
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const rows = await q<{ totp_secret_enc: string | null }>`SELECT totp_secret_enc FROM users WHERE id = ${s.userId}`;
  const enc = rows[0]?.totp_secret_enc;
  if (!enc) return { error: "Start the setup first." };
  if (!/^\d{6}$/.test(code) || totpFor(decrypt(enc), s.username).validate({ token: code, window: 1 }) === null) {
    await recordFailure(bucket);
    return { error: "That code did not match. Check your phone's time is set automatically and try the newest code." };
  }
  await q`UPDATE users SET totp_enabled = true WHERE id = ${s.userId}`;
  revalidatePath("/members/account");
  return { ok: "Two-step login is on." };
}

export async function cancelTotpSetup(): Promise<void> {
  const s = await requireMember();
  await q`UPDATE users SET totp_secret_enc = NULL WHERE id = ${s.userId} AND totp_enabled = false`;
  revalidatePath("/members/account");
}

export async function disableTotp(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  const bucket = `totp-disable:${s.userId}`;
  if (await isLimited(bucket, 5)) return { error: "Too many attempts. Try again in 15 minutes." };
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const rows = await q<{ totp_secret_enc: string | null }>`SELECT totp_secret_enc FROM users WHERE id = ${s.userId}`;
  const enc = rows[0]?.totp_secret_enc;
  if (!enc || !/^\d{6}$/.test(code) || totpFor(decrypt(enc), s.username).validate({ token: code, window: 1 }) === null) {
    await recordFailure(bucket);
    return { error: "That code did not match." };
  }
  await q`UPDATE users SET totp_enabled = false, totp_secret_enc = NULL WHERE id = ${s.userId}`;
  revalidatePath("/members/account");
  return { ok: "Two-step login is off." };
}

export async function changePassword(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  const bucket = `pw-change:${s.userId}`;
  if (await isLimited(bucket, 5)) return { error: "Too many attempts. Try again in 15 minutes." };

  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const rows = await q<{ password_hash: string }>`SELECT password_hash FROM users WHERE id = ${s.userId}`;
  if (!rows[0] || !(await verifyPassword(rows[0].password_hash, current))) {
    await recordFailure(bucket);
    return { error: "Current password is wrong." };
  }
  const err = validatePassword(next, s.username);
  if (err) return { error: err };
  if (next !== confirm) return { error: "New passwords do not match." };

  await q`UPDATE users SET password_hash = ${await hashPassword(next)} WHERE id = ${s.userId}`;
  // Sign out every other device; keep this one.
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await q`DELETE FROM sessions WHERE user_id = ${s.userId} AND token_hash <> ${sha256(token)}`;
  return { ok: "Password updated. Other devices have been signed out." };
}

export async function updateProjectDetails(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "project") return { error: "Only project accounts have project details." };
  let p: ProjectProfile;
  try {
    p = parseProjectProfile(form);
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message, field: e.field };
    throw e;
  }
  await q`
    UPDATE project_profiles SET
      project_name = ${p.project_name}, website = ${p.website}, x_handle = ${p.x_handle}, category = ${p.category},
      chains = ${p.chains}::text[], stage = ${p.stage}, token_contract = ${p.token_contract},
      funding_stage = ${p.funding_stage}, backers = ${p.backers}, team_size = ${p.team_size},
      budget_band = ${p.budget_band}, contact_name = ${p.contact_name}, contact_role = ${p.contact_role},
      contact_email = ${p.contact_email}, contact_telegram = ${p.contact_telegram}, updated_at = now()
    WHERE user_id = ${s.userId}`;
  revalidatePath("/members/account");
  return { ok: "Project details saved." };
}

export async function sendEmailLink(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: "Enter a valid email address.", field: "email" };
  if (!mailConfigured()) return { error: "Email sending is not set up yet. Ask Hustlers Labs to finish the email setup." };

  const bucket = `email-link:${s.userId}`;
  if (await isLimited(bucket, 5, 60)) return { error: "Too many emails sent. Try again in an hour." };

  const rows = await q<{ email: string | null; email_verified_at: string | null }>`
    SELECT email, email_verified_at FROM users WHERE id = ${s.userId}`;
  if (rows[0]?.email_verified_at && rows[0].email === email) return { ok: "That email is already confirmed." };
  const other = await q`SELECT 1 FROM users WHERE lower(email) = ${email} AND email_verified_at IS NOT NULL AND id <> ${s.userId}`;
  if (other[0]) return { error: "That email is already linked to another account.", field: "email" };

  await recordFailure(bucket); // counts sends, successful or not
  const token = await createEmailToken(s.userId, "verify", email);
  try {
    await sendMail(
      email,
      "Confirm your email for Hustlers Labs",
      `Hi @${s.username},\n\nConfirm this email to use it for password resets on Hustlers Labs:\n\n${appUrl(`/login/confirm-email?token=${token}`)}\n\nThe link works once and expires in 24 hours. If you did not ask for this, ignore this email.\n`,
    );
  } catch (e) {
    console.error("email link send failed", e);
    return { error: "Could not send the email. Try again in a few minutes." };
  }
  revalidatePath("/members/account");
  return { ok: `Confirmation link sent to ${email}. It expires in 24 hours.` };
}

export async function removeEmail(): Promise<void> {
  const s = await requireMember();
  await q`UPDATE users SET email = NULL, email_verified_at = NULL WHERE id = ${s.userId}`;
  await q`UPDATE email_tokens SET used_at = now() WHERE user_id = ${s.userId} AND used_at IS NULL`;
  revalidatePath("/members/account");
}
