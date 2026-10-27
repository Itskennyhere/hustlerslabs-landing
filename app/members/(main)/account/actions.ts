"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Secret } from "otpauth";
import { q } from "@/lib/db";
import { requireMember, SESSION_COOKIE, type SessionUser } from "@/lib/auth";
import { encrypt, sha256 } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isLimited, recordFailure } from "@/lib/ratelimit";
import { getAccountType, parseProjectProfile, type ProjectProfile } from "@/lib/onboarding";
import { EMAIL_RE, FieldError } from "@/lib/validate";
import { mailConfigured } from "@/lib/mail";
import { emailTakenByOther, startEmailConfirm } from "@/lib/email-confirm";
import { checkNewPassword, checkTotp, logEvent, newRecoveryCodes } from "@/lib/security";

export type Msg = { error?: string; ok?: string; field?: string; codes?: string[] } | undefined;

const SLOW = "Too many attempts. Try again in 15 minutes.";

/** Sensitive changes need the current password, so a stolen or unattended session cannot make them. */
async function passwordOk(s: SessionUser, form: FormData, field = "current_password"): Promise<boolean> {
  const bucket = `reauth:${s.userId}`;
  if (await isLimited(bucket, 5)) return false;
  const rows = await q<{ password_hash: string }>`SELECT password_hash FROM users WHERE id = ${s.userId}`;
  const ok = Boolean(rows[0]) && (await verifyPassword(rows[0].password_hash, String(form.get(field) ?? "").slice(0, 256)));
  if (!ok) await recordFailure(bucket);
  return ok;
}

async function totpOk(s: SessionUser, form: FormData): Promise<boolean> {
  const bucket = `totp-user:${s.userId}`;
  if (await isLimited(bucket, 10)) return false;
  const rows = await q<{ totp_secret_enc: string | null }>`SELECT totp_secret_enc FROM users WHERE id = ${s.userId}`;
  const enc = rows[0]?.totp_secret_enc;
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const ok = Boolean(enc) && (await checkTotp(s.userId, enc!, code));
  if (!ok) await recordFailure(bucket);
  return ok;
}

export async function startTotp(): Promise<void> {
  const s = await requireMember();
  if (s.totpEnabled) return;
  const secret = new Secret({ size: 20 }).base32;
  await q`UPDATE users SET totp_secret_enc = ${encrypt(secret)}, totp_last_step = NULL WHERE id = ${s.userId} AND totp_enabled = false`;
  revalidatePath("/members/account");
}

export async function confirmTotp(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  if (s.totpEnabled) return { error: "Two-step login is already on." };
  const bucket = `totp-setup:${s.userId}`;
  if (await isLimited(bucket, 10)) return { error: SLOW };
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const rows = await q<{ totp_secret_enc: string | null }>`SELECT totp_secret_enc FROM users WHERE id = ${s.userId}`;
  const enc = rows[0]?.totp_secret_enc;
  if (!enc) return { error: "Start the setup first." };
  if (!(await checkTotp(s.userId, enc, code))) {
    await recordFailure(bucket);
    return { error: "That code did not match. Check your phone's time is set automatically and try the newest code." };
  }
  await q`UPDATE users SET totp_enabled = true WHERE id = ${s.userId}`;
  const codes = await newRecoveryCodes(s.userId);
  await logEvent(s.userId, "totp_on");
  // No revalidate here: the page would re-render and hide the codes before they are saved.
  return { ok: "Two-step login is on.", codes };
}

export async function cancelTotpSetup(): Promise<void> {
  const s = await requireMember();
  await q`UPDATE users SET totp_secret_enc = NULL WHERE id = ${s.userId} AND totp_enabled = false`;
  revalidatePath("/members/account");
}

export async function disableTotp(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  if (s.role === "admin") return { error: "Admins must keep two-step login on." };
  if (!(await passwordOk(s, form))) return { error: "Password is wrong, or too many attempts.", field: "current_password" };
  if (!(await totpOk(s, form))) return { error: "That code did not match, or was already used." };
  await q`UPDATE users SET totp_enabled = false, totp_secret_enc = NULL, totp_last_step = NULL WHERE id = ${s.userId}`;
  await q`DELETE FROM recovery_codes WHERE user_id = ${s.userId}`;
  await logEvent(s.userId, "totp_off");
  revalidatePath("/members/account");
  return { ok: "Two-step login is off." };
}

export async function regenerateRecoveryCodes(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  if (!s.totpEnabled) return { error: "Turn on two-step login first." };
  if (!(await passwordOk(s, form))) return { error: "Password is wrong, or too many attempts.", field: "current_password" };
  if (!(await totpOk(s, form))) return { error: "That code did not match, or was already used." };
  const codes = await newRecoveryCodes(s.userId);
  await logEvent(s.userId, "recovery_regenerated");
  return { ok: "New recovery codes made. Your old codes no longer work.", codes };
}

export async function changePassword(_: Msg, form: FormData): Promise<Msg> {
  const s = await requireMember();
  const bucket = `pw-change:${s.userId}`;
  if (await isLimited(bucket, 5)) return { error: SLOW };

  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const rows = await q<{ password_hash: string }>`SELECT password_hash FROM users WHERE id = ${s.userId}`;
  if (!rows[0] || !(await verifyPassword(rows[0].password_hash, current))) {
    await recordFailure(bucket);
    return { error: "Current password is wrong." };
  }
  const err = await checkNewPassword(next, s.username);
  if (err) return { error: err };
  if (next !== confirm) return { error: "New passwords do not match." };

  await q`UPDATE users SET password_hash = ${await hashPassword(next)} WHERE id = ${s.userId}`;
  // Sign out every other device; keep this one.
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await q`DELETE FROM sessions WHERE user_id = ${s.userId} AND token_hash <> ${sha256(token)}`;
  await logEvent(s.userId, "password_changed");
  revalidatePath("/members/account");
  return { ok: "Password updated. Other devices have been signed out." };
}

export async function revokeSession(form: FormData): Promise<void> {
  const s = await requireMember();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id) || id === s.sessionId) return;
  // user_id in the WHERE: a member can only ever sign out their own devices.
  const gone = await q`DELETE FROM sessions WHERE id = ${id} AND user_id = ${s.userId} RETURNING id`;
  if (gone[0]) await logEvent(s.userId, "session_revoked");
  revalidatePath("/members/account");
}

export async function signOutOtherDevices(): Promise<void> {
  const s = await requireMember();
  const gone = await q`DELETE FROM sessions WHERE user_id = ${s.userId} AND id <> ${s.sessionId} RETURNING id`;
  if (gone.length) await logEvent(s.userId, "sessions_revoked");
  revalidatePath("/members/account");
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
  if (!(await passwordOk(s, form))) return { error: "Password is wrong, or too many attempts.", field: "current_password" };

  const bucket = `email-link:${s.userId}`;
  if (await isLimited(bucket, 5, 60)) return { error: "Too many emails sent. Try again in an hour." };

  const rows = await q<{ email: string | null; email_verified_at: string | null }>`
    SELECT email, email_verified_at FROM users WHERE id = ${s.userId}`;
  if (rows[0]?.email_verified_at && rows[0].email === email) return { ok: "That email is already confirmed." };
  if (await emailTakenByOther(email, s.userId)) return { error: "That email is already linked to another account.", field: "email" };

  await recordFailure(bucket); // counts sends, successful or not
  try {
    await startEmailConfirm(s.userId, s.username, email);
  } catch (e) {
    console.error("email link send failed", e);
    return { error: "Could not send the email. Try again in a few minutes." };
  }
  revalidatePath("/members", "layout");
  return { ok: `Confirmation link sent to ${email}. It expires in 24 hours.` };
}
