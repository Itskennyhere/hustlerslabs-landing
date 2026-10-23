import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { q } from "./db";
import { randomToken, sha256 } from "./crypto";

const PROD = process.env.NODE_ENV === "production";
// __Host- prefix: cookie is Secure, host-only and path=/, so subdomains cannot set or read it.
export const SESSION_COOKIE = PROD ? "__Host-hl_session" : "hl_session";

const SESSION_DAYS = 7;
const MFA_PENDING_MINUTES = 5;

export type SessionUser = {
  sessionId: number;
  userId: number;
  username: string;
  role: "member" | "admin";
  totpEnabled: boolean;
  mfaVerified: boolean;
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

/** Starts a session. If the user has 2FA on, the session is "pending" until a code is verified. */
export async function createSession(userId: number, mfaVerified: boolean): Promise<void> {
  const token = randomToken(32);
  const minutes = mfaVerified ? SESSION_DAYS * 24 * 60 : MFA_PENDING_MINUTES;
  const expires = new Date(Date.now() + minutes * 60_000);
  await q`INSERT INTO sessions (token_hash, user_id, mfa_verified, expires_at)
          VALUES (${sha256(token)}, ${userId}, ${mfaVerified}, ${expires.toISOString()})`;
  await setCookie(token, expires);
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
  const rows = await q<{
    session_id: number;
    user_id: number;
    username: string;
    role: "member" | "admin";
    totp_enabled: boolean;
    mfa_verified: boolean;
  }>`
    SELECT s.id AS session_id, u.id AS user_id, u.username, u.role, u.totp_enabled, s.mfa_verified
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now() AND u.disabled_at IS NULL
    LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    sessionId: Number(r.session_id),
    userId: Number(r.user_id),
    username: r.username,
    role: r.role,
    totpEnabled: r.totp_enabled,
    mfaVerified: r.mfa_verified,
  };
});

export async function requireMember(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.mfaVerified) redirect("/login/verify");
  return s;
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireMember();
  if (s.role !== "admin") redirect("/members");
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
