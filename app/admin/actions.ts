"use server";

import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireAdmin, destroyAllSessionsFor } from "@/lib/auth";
import { generateInviteKey, sha256 } from "@/lib/crypto";

export type InviteState = { key?: string; label?: string; expiresAt?: string; error?: string } | undefined;

const ALLOWED_HOURS = new Set([24, 48, 168]);

export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  if (!admin.totpEnabled) return { error: "Turn on two-step login in Account before generating invite keys." };

  const label = String(form.get("label") ?? "").trim().slice(0, 60) || null;
  const hours = Number(form.get("hours"));
  if (!ALLOWED_HOURS.has(hours)) return { error: "Pick a valid expiry." };

  const key = generateInviteKey();
  const expires = new Date(Date.now() + hours * 3_600_000);
  await q`INSERT INTO invites (key_hash, label, created_by, expires_at)
          VALUES (${sha256(key)}, ${label}, ${admin.userId}, ${expires.toISOString()})`;
  revalidatePath("/admin");
  // The plain key is returned exactly once. Only its hash is stored.
  return { key, label: label ?? undefined, expiresAt: expires.toISOString() };
}

export async function revokeInvite(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id)) return;
  await q`UPDATE invites SET revoked_at = now() WHERE id = ${id} AND used_at IS NULL AND revoked_at IS NULL`;
  revalidatePath("/admin");
}

export async function setMemberDisabled(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  const disable = form.get("disable") === "1";
  if (!Number.isSafeInteger(id) || id === admin.userId) return; // never lock yourself out
  if (disable) {
    await q`UPDATE users SET disabled_at = now() WHERE id = ${id} AND role = 'member'`;
    await destroyAllSessionsFor(id); // kicks them out immediately
  } else {
    await q`UPDATE users SET disabled_at = NULL WHERE id = ${id}`;
  }
  revalidatePath("/admin");
}

export async function signOutMember(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id) || id === admin.userId) return;
  await destroyAllSessionsFor(id);
  revalidatePath("/admin");
}
