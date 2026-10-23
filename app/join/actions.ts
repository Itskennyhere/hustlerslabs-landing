"use server";

import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { normalizeInviteKey, sha256 } from "@/lib/crypto";
import { hashPassword, validatePassword, validateUsername } from "@/lib/password";
import { clientIp, isLimited, recordFailure } from "@/lib/ratelimit";
import { createSession } from "@/lib/auth";

export type JoinState = { error?: string; field?: string; values?: { invite: string; username: string } } | undefined;

export async function join(_: JoinState, form: FormData): Promise<JoinState> {
  const values = { invite: String(form.get("invite") ?? "").slice(0, 40), username: String(form.get("username") ?? "").slice(0, 24) };
  const ip = await clientIp();
  const bucket = `join-ip:${ip}`;
  if (await isLimited(bucket, 10)) return { error: "Too many attempts. Try again in 15 minutes.", values };

  const key = normalizeInviteKey(String(form.get("invite") ?? ""));
  const u = validateUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!key) {
    await recordFailure(bucket);
    return { error: "That invite key is not valid.", field: "invite", values };
  }
  if (!u.ok) return { error: u.error, field: "username", values };
  const pwErr = validatePassword(password, u.value);
  if (pwErr) return { error: pwErr, field: "password", values };
  if (password !== confirm) return { error: "Passwords do not match.", field: "confirm", values };

  const keyHash = sha256(key);

  // Check the key first (without consuming it) so a typo in the username doesn't burn the invite.
  const valid = await q<{ id: number }>`
    SELECT id FROM invites
    WHERE key_hash = ${keyHash} AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;
  if (!valid[0]) {
    await recordFailure(bucket);
    return { error: "That invite key is not valid, has expired or has already been used.", field: "invite", values };
  }
  const taken = await q`SELECT 1 FROM users WHERE username = ${u.value}`;
  if (taken[0]) return { error: "That username is taken. Pick another.", field: "username", values };

  const passwordHash = await hashPassword(password);

  // One atomic statement: burn the invite and create the user together.
  // If either part fails (e.g. two people race for the same key or username), nothing is written.
  let created: { id: number }[];
  try {
    created = await q<{ id: number }>`
      WITH inv AS (
        UPDATE invites SET used_at = now()
        WHERE key_hash = ${keyHash} AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        RETURNING id
      )
      INSERT INTO users (username, password_hash, role, invite_id)
      SELECT ${u.value}, ${passwordHash}, 'member', id FROM inv
      RETURNING id`;
  } catch {
    return { error: "That username is taken. Pick another.", field: "username", values };
  }
  if (!created[0]) {
    return { error: "That invite key is not valid, has expired or has already been used.", field: "invite", values };
  }

  await createSession(Number(created[0].id), true);
  redirect("/members");
}
