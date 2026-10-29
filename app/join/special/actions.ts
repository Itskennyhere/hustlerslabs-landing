"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db, q } from "@/lib/db";
import { hashPassword, validateUsername, verifyPassword } from "@/lib/password";
import { clientIp, isLimited, recordFailure } from "@/lib/ratelimit";
import { createSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { appUrl, mailConfigured, sendMail } from "@/lib/mail";
import { checkNewPassword, checkTotp, logEvent } from "@/lib/security";
import { EMAIL_RE } from "@/lib/validate";
import { emailTakenByOther, sendConfirmEmail } from "@/lib/email-confirm";
import { createEmailToken } from "@/lib/email-tokens";
import { clearInviteTicket, readInviteTicket } from "@/lib/invite-code";

export type SpecialState = { error?: string; field?: string } | undefined;

const EXPIRED = "This invite has expired or was already used. Enter the code again on the sign-in page.";
class CodeGone extends Error {}

/** Admin code: creates an admin account. The code is used up in the same transaction. */
export async function joinAdmin(_: SpecialState, form: FormData): Promise<SpecialState> {
  await ensureSchema();
  const ticket = await readInviteTicket();
  if (!ticket || ticket.kind !== "admin") return { error: EXPIRED };
  const bucket = `join-ip:${await clientIp()}`;
  if (await isLimited(bucket, 10)) return { error: "Too many attempts. Try again in 15 minutes." };

  const u = validateUsername(String(form.get("username") ?? ""));
  if (!u.ok) return { error: u.error, field: "username" };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: "Enter a valid email address.", field: "email" };
  const password = String(form.get("password") ?? "");
  const pwErr = await checkNewPassword(password, u.value);
  if (pwErr) return { error: pwErr, field: "password" };
  if (password !== String(form.get("confirm") ?? "")) return { error: "Passwords do not match.", field: "confirm" };
  if ((await q`SELECT 1 FROM users WHERE username = ${u.value}`)[0]) return { error: "That username is taken. Pick another.", field: "username" };
  if (await emailTakenByOther(email, null)) return { error: "That email is already linked to another account.", field: "email" };

  const passwordHash = await hashPassword(password);
  let userId: number;
  try {
    userId = await db().begin(async (sql) => {
      const inv = await sql<{ id: number; created_by: number | null }[]>`
        UPDATE invites SET used_at = now()
        WHERE key_hash = ${ticket.hash} AND kind = 'admin' AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        RETURNING id, created_by`;
      if (!inv[0]) throw new CodeGone();
      const created = await sql<{ id: number }[]>`
        INSERT INTO users (username, password_hash, role, invite_id, approved_at, approved_by)
        VALUES (${u.value}, ${passwordHash}, 'admin', ${inv[0].id}, now(), ${inv[0].created_by})
        RETURNING id`;
      return Number(created[0].id);
    });
  } catch (e) {
    if (e instanceof CodeGone) {
      await clearInviteTicket();
      return { error: EXPIRED };
    }
    if ((e as { code?: string }).code === "23505") return { error: "That username is taken. Pick another.", field: "username" };
    console.error("admin join failed", e);
    return { error: "Something went wrong. Nothing was saved and the code still works. Try again." };
  }
  await clearInviteTicket();

  const confirmToken = await createEmailToken(userId, "verify", email);
  after(async () => {
    try {
      await sendConfirmEmail(u.value, email, confirmToken);
      // Tell the owner a code was used.
      if (!mailConfigured()) return;
      const owner = await q<{ email: string }>`SELECT email FROM users WHERE is_owner AND email_verified_at IS NOT NULL`;
      if (owner[0]) {
        await sendMail(
          owner[0].email,
          `New admin joined: @${u.value}`,
          `@${u.value} used an admin code and is now an admin of Hustlers Labs.\n\nIf you did not expect this, disable them here:\n\n${appUrl(`/admin/members/${userId}`)}\n`,
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

/** Owner key: an existing admin proves who they are (password and app code) and becomes the owner. Works once. */
export async function becomeOwner(_: SpecialState, form: FormData): Promise<SpecialState> {
  await ensureSchema();
  const ticket = await readInviteTicket();
  if (!ticket || ticket.kind !== "owner" || (process.env.OWNER_CLAIM_TOKEN ?? "").length < 24) return { error: EXPIRED };
  const ip = await clientIp();
  const ident = String(form.get("username") ?? "").trim().toLowerCase().slice(0, 254);
  const buckets = [`owner-setup-ip:${ip}`, `owner-setup:${ident}`];
  for (const b of buckets) if (await isLimited(b, 5)) return { error: "Too many attempts. Try again in 15 minutes." };

  const rows = await q<{ id: number; password_hash: string; role: string; totp_enabled: boolean; totp_secret_enc: string | null; disabled_at: string | null }>`
    SELECT id, password_hash, role, totp_enabled, totp_secret_enc, disabled_at FROM users
    WHERE (lower(email) = ${ident} AND email_verified_at IS NOT NULL) OR username = ${ident}
    ORDER BY (lower(email) = ${ident} AND email_verified_at IS NOT NULL) DESC LIMIT 1`;
  const u = rows[0];
  const pwOk = Boolean(u) && (await verifyPassword(u!.password_hash, String(form.get("password") ?? "").slice(0, 256)));
  if (!u || !pwOk || u.role !== "admin" || u.disabled_at) {
    await recordFailure(...buckets);
    return { error: "That is not an admin login. Use your admin email or username and password." };
  }
  if (!u.totp_enabled || !u.totp_secret_enc) return { error: "Turn on two-step login for this admin account first, then try again." };
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!(await checkTotp(Number(u.id), u.totp_secret_enc, code))) {
    await recordFailure(...buckets);
    return { error: "That code did not match, or was already used. Wait for the next code." };
  }

  const claimed = await q`
    UPDATE users SET is_owner = true
    WHERE id = ${u.id} AND role = 'admin' AND NOT EXISTS (SELECT 1 FROM users WHERE is_owner)
    RETURNING id`;
  await clearInviteTicket();
  if (!claimed[0]) return { error: "The owner has already been set. The owner key no longer works." };
  await logEvent(Number(u.id), "owner_claimed");
  redirect("/login?owner=1");
}
