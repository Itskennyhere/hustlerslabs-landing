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
  }>`
    SELECT s.id AS session_id, u.id AS user_id, u.username, u.role, u.totp_enabled, s.mfa_verified, s.stage,
           (u.email_verified_at IS NOT NULL) AS email_ok
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
  };
});

export async function requireMember(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.mfaVerified) redirect(s.stage === "email" ? "/login/email-code" : "/login/verify");
  return s;
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireMember();
  if (s.role !== "admin") redirect("/members");
  // Admin pages need two-step login on.
  if (!s.totpEnabled) redirect("/members/account?admin2fa=1");
  // ...and a confirmed email, which gets a code at every admin sign-in.
  if (mailConfigured() && !s.emailConfirmed) redirect("/members/account?adminemail=1");
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
