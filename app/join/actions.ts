"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { db, q } from "@/lib/db";
import { hashPassword, validateUsername } from "@/lib/password";
import { checkNewPassword, logEvent } from "@/lib/security";
import { clientIp, isLimited, recordFailure } from "@/lib/ratelimit";
import { createSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { mailConfigured } from "@/lib/mail";
import { parseAccountType, parseProjectProfile, type AccountType, type ProjectProfile } from "@/lib/onboarding";
import { EMAIL_RE, FieldError } from "@/lib/validate";
import { emailTakenByOther, sendConfirmEmail } from "@/lib/email-confirm";
import { createEmailToken } from "@/lib/email-tokens";
import { notifyAdminsOfSignup } from "@/lib/approval";
import { clearInviteTicket, readInviteTicket } from "@/lib/invite-code";

export type JoinState = { error?: string; field?: string } | undefined;

// Anyone can sign up. New accounts confirm their email, then wait for a team member to approve them.
const SIGNUPS_PER_HOUR = 5;

export async function join(_: JoinState, form: FormData): Promise<JoinState> {
  await ensureSchema();
  const ip = await clientIp();
  const bucket = `join-ip:${ip}`;
  const signupBucket = `signup-ip:${ip}`;
  if ((await isLimited(bucket, 10)) || (await isLimited(signupBucket, SIGNUPS_PER_HOUR, 60))) {
    return { error: "Too many sign-ups from this network. Try again in an hour." };
  }

  let accountType: AccountType;
  let project: ProjectProfile | null = null;
  try {
    accountType = parseAccountType(form);
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message, field: e.field };
    throw e;
  }

  const u = validateUsername(String(form.get("username") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!u.ok) {
    await recordFailure(bucket);
    return { error: u.error, field: "username" };
  }
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: "Enter a valid email address.", field: "email" };
  const pwErr = await checkNewPassword(password, u.value);
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

  const taken = await q`SELECT 1 FROM users WHERE username = ${u.value}`;
  if (taken[0]) return { error: "That username is taken. Pick another.", field: "username" };
  if (await emailTakenByOther(email, null)) return { error: "That email is already linked to another account.", field: "email" };

  const passwordHash = await hashPassword(password);
  // A preferred code from the owner skips the team review. It is used up in the same transaction.
  const ticket = await readInviteTicket();
  const preferred = ticket?.kind === "member" ? ticket.hash : null;

  // One transaction: the user and their project rows, or nothing.
  let userId: number;
  try {
    userId = await db().begin(async (sql) => {
      let inviteId: number | null = null;
      if (preferred) {
        const inv = await sql<{ id: number }[]>`
          UPDATE invites SET used_at = now()
          WHERE key_hash = ${preferred} AND kind = 'member' AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
          RETURNING id`;
        inviteId = inv[0] ? Number(inv[0].id) : null; // an expired code just means the normal review
      }
      const created = await sql<{ id: number }[]>`
        INSERT INTO users (username, password_hash, role, account_type, invite_id, approved_at)
        VALUES (${u.value}, ${passwordHash}, 'member', ${accountType}, ${inviteId}, ${inviteId ? new Date() : null})
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
    if ((e as { code?: string }).code === "23505") {
      return { error: "That username is taken. Pick another.", field: "username" };
    }
    console.error("join failed", e);
    return { error: "Something went wrong. Nothing was saved. Try again." };
  }
  await recordFailure(signupBucket); // counts successful sign-ups per network
  if (preferred) await clearInviteTicket();

  // Saved now so the waiting page can show it; the email goes out after the response.
  const confirmToken = await createEmailToken(userId, "verify", email);
  after(async () => {
    try {
      await sendConfirmEmail(u.value, email, confirmToken);
    } catch (e) {
      console.error("join confirm email failed", e);
    }
  });
  // Without email the account cannot be confirmed, so the team hears about it straight away.
  if (!mailConfigured()) after(() => notifyAdminsOfSignup(userId));

  await createSession(userId, true);
  await logEvent(userId, "account_created");
  redirect("/join/waiting");
}
