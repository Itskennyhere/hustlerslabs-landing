import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { q } from "./db";
import { randomToken, sha256 } from "./crypto";
import { ensureSchema } from "./migrate";
import { requestInfo } from "./security";
import { mailConfigured } from "./mail";

const PROD = process.env.NODE_ENV === "production";
// __Host- prefix: cookie is Secure, host-only and path=/, so subdomains cannot set or read it.
export const SESSION_COOKIE = PROD ? "__Host-hl_session" : "hl_session";

const SESSION_DAYS = 7;
// Admins can change everyone's access, so their sessions are short.
const ADMIN_SESSION_HOURS = 12;
// Time to finish the code steps after the password (the admin email code can take a minute to arrive).
const MFA_PENDING_MINUTES = 15;

export type SessionUser = {
  sessionId: number;
  userId: number;
  username: string;
  role: "member" | "admin";
  totpEnabled: boolean;
  mfaVerified: boolean;
  /** Pending sessions only: the sign-in step still to do. */
  stage: "totp" | "email" | null;
  emailConfirmed: boolean;
  /** Members need a team member's approval before they are let in. Admins always are. */
  approved: boolean;
  /** The one admin with full control (admin keys, managing other admins). */
  isOwner: boolean;
};

async function setCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Starts a session. Until every code step is done the session is "pending" and opens nothing. Returns its id. */
export async function createSession(userId: number, mfaVerified: boolean, stage: "totp" | "email" | null = null): Promise<number> {
  await ensureSchema();
  const token = randomToken(32);
  const role = (await q<{ role: string }>`SELECT role FROM users WHERE id = ${userId}`)[0]?.role;
  const minutes = !mfaVerified ? MFA_PENDING_MINUTES : role === "admin" ? ADMIN_SESSION_HOURS * 60 : SESSION_DAYS * 24 * 60;
  const expires = new Date(Date.now() + minutes * 60_000);
  const { ip, ua } = await requestInfo();
  const rows = await q<{ id: number }>`
    INSERT INTO sessions (token_hash, user_id, mfa_verified, expires_at, ip, user_agent, last_seen_at, stage)
    VALUES (${sha256(token)}, ${userId}, ${mfaVerified}, ${expires.toISOString()}, ${ip}, ${ua}, now(), ${mfaVerified ? null : stage})
    RETURNING id`;
  await setCookie(token, expires);
  return Number(rows[0].id);
}

/** Upgrades a pending 2FA session to a full one, rotating the token. */
export async function completeMfa(sessionId: number, userId: number): Promise<void> {
  await q`DELETE FROM sessions WHERE id = ${sessionId}`;
  await createSession(userId, true);
}

/** Reads the session cookie and validates it against the database. Cached per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  await ensureSchema();
  const rows = await q<{
    session_id: number;
    user_id: number;
    username: string;
    role: "member" | "admin";
    totp_enabled: boolean;
    mfa_verified: boolean;
    stage: "totp" | "email" | null;
    email_ok: boolean;
    approved: boolean;
    is_owner: boolean;
  }>`
    SELECT s.id AS session_id, u.id AS user_id, u.username, u.role, u.totp_enabled, s.mfa_verified, s.stage,
           (u.email_verified_at IS NOT NULL) AS email_ok, (u.role = 'admin' OR u.approved_at IS NOT NULL) AS approved,
           (u.role = 'admin' AND u.is_owner) AS is_owner
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now() AND u.disabled_at IS NULL
    LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  // Keeps "last active" on the device list roughly current without a write on every request.
  await q`UPDATE sessions SET last_seen_at = now()
          WHERE id = ${r.session_id} AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes')`;
  return {
    sessionId: Number(r.session_id),
    userId: Number(r.user_id),
    username: r.username,
    role: r.role,
    totpEnabled: r.totp_enabled,
    mfaVerified: r.mfa_verified,
    stage: r.stage,
    emailConfirmed: r.email_ok,
    approved: r.approved,
    isOwner: r.is_owner,
  };
});

/**
 * A signed-in member who has finished every sign-in step, confirmed their email (when email is set up)
 * and been approved. `allowPending` lets an unapproved member through, for the creator card they can
 * fill in while they wait.
 */
export async function requireMember({ allowPending = false }: { allowPending?: boolean } = {}): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.mfaVerified) redirect(s.stage === "email" ? "/login/email-code" : "/login/verify");
  // New members wait outside until they confirm their email (when email is set up) and a team member approves them.
  if (s.role !== "admin" && ((!s.approved && !allowPending) || (mailConfigured() && !s.emailConfirmed))) redirect("/join/waiting");
  return s;
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireMember();
  if (s.role !== "admin") redirect("/members");
  // Admin pages need two-step login on.
  // A confirmed email is not required here, so the admin can never be locked out by email setup.
  // Once one is confirmed (and email is set up), every admin sign-in also needs an emailed code.
  if (!s.totpEnabled) redirect("/members/account/two-step?admin=1");
  return s;
}

/** The owner only. Other admins are sent back to the admin overview. */
export async function requireOwner(): Promise<SessionUser> {
  const s = await requireAdmin();
  if (!s.isOwner) redirect("/admin");
  return s;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessionsFor(userId: number): Promise<void> {
  await q`DELETE FROM sessions WHERE user_id = ${userId}`;
}
