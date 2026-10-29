"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db, q } from "@/lib/db";
import { normalizeInviteKey, sha256 } from "@/lib/crypto";
import { hashPassword, validateUsername } from "@/lib/password";
import { clientIp, isLimited, recordFailure } from "@/lib/ratelimit";
import { createSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { appUrl, mailConfigured, sendMail } from "@/lib/mail";
import { checkNewPassword, logEvent } from "@/lib/security";
import { EMAIL_RE } from "@/lib/validate";
import { emailTakenByOther, sendConfirmEmail } from "@/lib/email-confirm";
import { createEmailToken } from "@/lib/email-tokens";

export type AdminJoinState = { error?: string; field?: string } | undefined;

class KeyGone extends Error {}

/** Creates an admin account with an admin key from the owner. The key works once. */
export async function joinAdmin(_: AdminJoinState, form: FormData): Promise<AdminJoinState> {
  await ensureSchema();
  const bucket = `join-ip:${await clientIp()}`;
  if (await isLimited(bucket, 10)) return { error: "Too many attempts. Try again in 15 minutes." };

  const key = normalizeInviteKey(String(form.get("key") ?? ""));
  if (!key) {
    await recordFailure(bucket);
    return { error: "That admin key is not valid.", field: "key" };
  }
  const u = validateUsername(String(form.get("username") ?? ""));
  if (!u.ok) return { error: u.error, field: "username" };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: "Enter a valid email address.", field: "email" };
  const password = String(form.get("password") ?? "");
  const pwErr = await checkNewPassword(password, u.value);
  if (pwErr) return { error: pwErr, field: "password" };
  if (password !== String(form.get("confirm") ?? "")) return { error: "Passwords do not match.", field: "confirm" };

  // Only keys the owner made as admin keys. Older invite keys have no kind and never work here.
  const keyHash = sha256(key);
  const valid = await q`
    SELECT 1 FROM invites WHERE key_hash = ${keyHash} AND kind = 'admin' AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;
  if (!valid[0]) {
    await recordFailure(bucket);
    return { error: "That admin key is not valid, has expired or has already been used.", field: "key" };
  }
  if ((await q`SELECT 1 FROM users WHERE username = ${u.value}`)[0]) return { error: "That username is taken. Pick another.", field: "username" };
  if (await emailTakenByOther(email, null)) return { error: "That email is already linked to another account.", field: "email" };

  const passwordHash = await hashPassword(password);
  let userId: number;
  try {
    userId = await db().begin(async (sql) => {
      const inv = await sql<{ id: number; created_by: number | null }[]>`
        UPDATE invites SET used_at = now()
        WHERE key_hash = ${keyHash} AND kind = 'admin' AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        RETURNING id, created_by`;
      if (!inv[0]) throw new KeyGone();
      const created = await sql<{ id: number }[]>`
        INSERT INTO users (username, password_hash, role, invite_id, approved_at, approved_by)
        VALUES (${u.value}, ${passwordHash}, 'admin', ${inv[0].id}, now(), ${inv[0].created_by})
        RETURNING id`;
      return Number(created[0].id);
    });
  } catch (e) {
    if (e instanceof KeyGone) return { error: "That admin key is not valid, has expired or has already been used.", field: "key" };
    if ((e as { code?: string }).code === "23505") return { error: "That username is taken. Pick another.", field: "username" };
    console.error("admin join failed", e);
    return { error: "Something went wrong. Nothing was saved and the key still works. Try again." };
  }

  const confirmToken = await createEmailToken(userId, "verify", email);
  after(async () => {
    try {
      await sendConfirmEmail(u.value, email, confirmToken);
      // Tell the owner a key was used.
      if (!mailConfigured()) return;
      const owner = await q<{ email: string }>`SELECT email FROM users WHERE is_owner AND email_verified_at IS NOT NULL`;
      if (owner[0]) {
        await sendMail(
          owner[0].email,
          `New admin joined: @${u.value}`,
          `@${u.value} used an admin key and is now an admin of Hustlers Labs.\n\nIf you did not expect this, disable them here:\n\n${appUrl(`/admin/members/${userId}`)}\n`,
        );
      }
    } catch (e) {
      console.error("admin join emails failed", e);
    }
  });

  await createSession(userId, true);
  await logEvent(userId, "account_created");
  // Admins must turn on two-step login before Admin opens.
  redirect("/members/account/two-step?admin=1");
}
