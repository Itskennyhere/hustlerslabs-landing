"use server";

import { redirect } from "next/navigation";
import { db, q } from "@/lib/db";
import { normalizeInviteKey, sha256 } from "@/lib/crypto";
import { hashPassword, validatePassword, validateUsername } from "@/lib/password";
import { clientIp, isLimited, recordFailure } from "@/lib/ratelimit";
import { createSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { parseAccountType, parseProjectProfile, type AccountType, type ProjectProfile } from "@/lib/onboarding";
import { FieldError } from "@/lib/validate";

export type JoinState = { error?: string; field?: string } | undefined;

class InviteGone extends Error {}

export async function join(_: JoinState, form: FormData): Promise<JoinState> {
  await ensureSchema();
  const ip = await clientIp();
  const bucket = `join-ip:${ip}`;
  if (await isLimited(bucket, 10)) return { error: "Too many attempts. Try again in 15 minutes." };

  let accountType: AccountType;
  let project: ProjectProfile | null = null;
  try {
    accountType = parseAccountType(form);
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message, field: e.field };
    throw e;
  }

  const key = normalizeInviteKey(String(form.get("invite") ?? ""));
  const u = validateUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!key) {
    await recordFailure(bucket);
    return { error: "That invite key is not valid.", field: "invite" };
  }
  if (!u.ok) return { error: u.error, field: "username" };
  const pwErr = validatePassword(password, u.value);
  if (pwErr) return { error: pwErr, field: "password" };
  if (password !== confirm) return { error: "Passwords do not match.", field: "confirm" };

  if (accountType === "project") {
    try {
      project = parseProjectProfile(form);
    } catch (e) {
      if (e instanceof FieldError) return { error: e.message, field: e.field };
      throw e;
    }
  }

  const keyHash = sha256(key);

  // Check the key first (without consuming it) so a typo elsewhere doesn't burn the invite.
  const valid = await q<{ id: number }>`
    SELECT id FROM invites
    WHERE key_hash = ${keyHash} AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;
  if (!valid[0]) {
    await recordFailure(bucket);
    return { error: "That invite key is not valid, has expired or has already been used.", field: "invite" };
  }
  const taken = await q`SELECT 1 FROM users WHERE username = ${u.value}`;
  if (taken[0]) return { error: "That username is taken. Pick another.", field: "username" };

  const passwordHash = await hashPassword(password);

  // One transaction: burn the invite, create the user, create the profile row.
  // If any part fails (e.g. two people race for the same key or username), nothing is written.
  let userId: number;
  try {
    userId = await db().begin(async (sql) => {
      const inv = await sql<{ id: number }[]>`
        UPDATE invites SET used_at = now()
        WHERE key_hash = ${keyHash} AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        RETURNING id`;
      if (!inv[0]) throw new InviteGone();
      const created = await sql<{ id: number }[]>`
        INSERT INTO users (username, password_hash, role, invite_id, account_type)
        VALUES (${u.value}, ${passwordHash}, 'member', ${inv[0].id}, ${accountType})
        RETURNING id`;
      const id = Number(created[0].id);
      if (project) {
        const p = project;
        await sql`
          INSERT INTO project_profiles (
            user_id, project_name, website, x_handle, category, chains, stage, token_contract, funding_stage,
            backers, team_size, budget_band, contact_name, contact_role, contact_email, contact_telegram)
          VALUES (
            ${id}, ${p.project_name}, ${p.website}, ${p.x_handle}, ${p.category}, ${p.chains}::text[], ${p.stage},
            ${p.token_contract}, ${p.funding_stage}, ${p.backers}, ${p.team_size}, ${p.budget_band},
            ${p.contact_name}, ${p.contact_role}, ${p.contact_email}, ${p.contact_telegram})`;
        await sql`INSERT INTO project_workspace (user_id) VALUES (${id})`;
      }
      return id;
    });
  } catch (e) {
    if (e instanceof InviteGone) {
      return { error: "That invite key is not valid, has expired or has already been used.", field: "invite" };
    }
    if ((e as { code?: string }).code === "23505") {
      return { error: "That username is taken. Pick another.", field: "username" };
    }
    console.error("join failed", e);
    return { error: "Something went wrong. Nothing was saved and your invite key still works. Try again." };
  }

  await createSession(userId, true);
  redirect(accountType === "creator" ? "/members/profile" : "/members");
}
