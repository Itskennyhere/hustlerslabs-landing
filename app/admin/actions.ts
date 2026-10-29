"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireAdmin, requireOwner, destroyAllSessionsFor, type SessionUser } from "@/lib/auth";
import { generateInviteKey, sha256 } from "@/lib/crypto";
import { verifyPassword } from "@/lib/password";
import { isLimited, recordFailure } from "@/lib/ratelimit";
import { checkTotp, logEvent } from "@/lib/security";
import { sendApprovedEmail } from "@/lib/approval";
import { INTRO_STATUS } from "@/lib/onboarding-options";
import { FEEDBACK_STATUS } from "@/lib/feedback-options";

export type InviteState = { key?: string; kind?: string; label?: string; expiresAt?: string; error?: string } | undefined;

const ALLOWED_HOURS = new Set([24, 48, 168]);

/**
 * Invite codes: admin codes create admin accounts, preferred codes skip the team review.
 * Only the owner makes them, and only after re-entering password and code.
 */
export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const owner = await requireOwner();
  const bucket = `reauth:${owner.userId}`;
  if (await isLimited(bucket, 5)) return { error: "Too many attempts. Try again in 15 minutes." };
  const rows = await q<{ password_hash: string; totp_secret_enc: string | null }>`
    SELECT password_hash, totp_secret_enc FROM users WHERE id = ${owner.userId}`;
  const pwOk = Boolean(rows[0]) && (await verifyPassword(rows[0].password_hash, String(form.get("current_password") ?? "").slice(0, 256)));
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!pwOk || !rows[0].totp_secret_enc || !(await checkTotp(owner.userId, rows[0].totp_secret_enc, code))) {
    await recordFailure(bucket);
    return { error: "Password or code is wrong." };
  }

  const kind = String(form.get("kind") ?? "");
  if (kind !== "admin" && kind !== "member") return { error: "Pick what the code is for." };
  const label = String(form.get("label") ?? "").trim().slice(0, 60) || null;
  const hours = Number(form.get("hours"));
  if (!ALLOWED_HOURS.has(hours)) return { error: "Pick a valid expiry." };

  const key = generateInviteKey();
  const expires = new Date(Date.now() + hours * 3_600_000);
  await q`INSERT INTO invites (key_hash, label, created_by, expires_at, kind)
          VALUES (${sha256(key)}, ${label}, ${owner.userId}, ${expires.toISOString()}, ${kind})`;
  await logEvent(owner.userId, "admin_key_created");
  revalidatePath("/admin", "layout");
  // The plain key is returned exactly once. Only its hash is stored.
  return { key, kind, label: label ?? undefined, expiresAt: expires.toISOString() };
}

export async function revokeInvite(form: FormData): Promise<void> {
  await requireOwner();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id)) return;
  await q`UPDATE invites SET revoked_at = now() WHERE id = ${id} AND kind IN ('admin', 'member') AND used_at IS NULL AND revoked_at IS NULL`;
  revalidatePath("/admin", "layout");
}

/**
 * Who an admin may act on: never themselves or the owner. Members, by any admin.
 * Other admins, by the owner only.
 */
async function mayManage(admin: SessionUser, id: number): Promise<boolean> {
  if (!Number.isSafeInteger(id) || id === admin.userId) return false;
  const rows = await q<{ role: string; is_owner: boolean }>`SELECT role, is_owner FROM users WHERE id = ${id}`;
  const t = rows[0];
  if (!t || t.is_owner) return false;
  return t.role === "member" || admin.isOwner;
}

export async function setMemberDisabled(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (!(await mayManage(admin, id))) return;
  if (form.get("disable") === "1") {
    await q`UPDATE users SET disabled_at = now() WHERE id = ${id} AND NOT is_owner`;
    await destroyAllSessionsFor(id); // kicks them out immediately
  } else {
    await q`UPDATE users SET disabled_at = NULL WHERE id = ${id}`;
  }
  revalidatePath("/admin", "layout");
}

export async function signOutMember(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (!(await mayManage(admin, id))) return;
  await destroyAllSessionsFor(id);
  revalidatePath("/admin", "layout");
}

/** Lets a new member in. Declining is Disable on the same page. */
export async function approveMember(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const done = await q`
    UPDATE users SET approved_at = now(), approved_by = ${admin.userId}
    WHERE id = ${id} AND role = 'member' AND approved_at IS NULL AND disabled_at IS NULL
    RETURNING id`;
  if (!done[0]) return;
  await q`INSERT INTO security_events (user_id, kind) VALUES (${id}, 'account_approved')`;
  after(() => sendApprovedEmail(id));
  revalidatePath("/admin", "layout");
}

export async function setCreatorVerified(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const verify = form.get("verify") === "1";
  if (!Number.isSafeInteger(id)) return;
  await q`UPDATE creator_profiles SET verified = ${verify}, verified_at = ${verify ? new Date().toISOString() : null}, updated_at = now()
          WHERE user_id = ${id}`;
  revalidatePath("/admin", "layout");
  revalidatePath("/members/creators");
}

export async function setIntroStatus(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const status = String(form.get("status") ?? "");
  if (!Number.isSafeInteger(id) || !INTRO_STATUS.some((o) => o.value === status)) return;
  await q`UPDATE intro_requests SET status = ${status}, updated_at = now() WHERE id = ${id}`;
  revalidatePath("/admin", "layout");
}

export async function setFeedbackStatus(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get("id"));
  const status = String(form.get("status") ?? "");
  if (!Number.isSafeInteger(id) || !FEEDBACK_STATUS.some((o) => o.value === status)) return;
  await q`UPDATE feedback SET status = ${status} WHERE id = ${id}`;
  revalidatePath("/admin", "layout");
}
