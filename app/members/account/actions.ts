"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { TOTP, Secret } from "otpauth";
import { q } from "@/lib/db";
import { requireMember, SESSION_COOKIE } from "@/lib/auth";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";
import { isLimited, recordFailure } from "@/lib/ratelimit";

export type Msg = { error?: string; ok?: string } | undefined;

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
