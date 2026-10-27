import "server-only";
import { createHash } from "node:crypto";
import { q } from "./db";
import { appUrl } from "./mail";

// "Connect X" for creators: OAuth 2.0 with PKCE. We only read who the user is
// (id, username, follower count) and revoke the X token straight away.

export const X_COOKIE = "hl_x_oauth";
export const X_COOKIE_PATH = "/members/profile/x";

const AUTH_BASE = () => process.env.X_AUTH_BASE ?? "https://x.com";
const API_BASE = () => process.env.X_API_BASE ?? "https://api.x.com";
const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/;
const ID_RE = /^\d{1,25}$/;

export function xConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

export const xRedirectUri = () => appUrl("/members/profile/x/callback");

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authorizeUrl(state: string, verifier: string): string {
  const u = new URL("/i/oauth2/authorize", AUTH_BASE());
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: xRedirectUri(),
    scope: "users.read tweet.read",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  return u.toString();
}

const basicAuth = () =>
  "Basic " + Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");

export type XUser = { id: string; username: string; followers: number | null };

/** Swaps the code for a token, reads the user, then revokes the token. */
export async function fetchXUser(code: string, verifier: string): Promise<XUser> {
  const tokenRes = await fetch(new URL("/2/oauth2/token", API_BASE()), {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: xRedirectUri(), code_verifier: verifier }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new Error(`X token exchange failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("X token exchange returned no token");

  try {
    const meRes = await fetch(new URL("/2/users/me?user.fields=public_metrics", API_BASE()), {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!meRes.ok) throw new Error(`X user lookup failed: ${meRes.status}`);
    const { data } = (await meRes.json()) as {
      data?: { id?: string; username?: string; public_metrics?: { followers_count?: number } };
    };
    if (!data?.id || !ID_RE.test(data.id) || !data.username || !USERNAME_RE.test(data.username)) {
      throw new Error("X returned an unexpected user");
    }
    const f = data.public_metrics?.followers_count;
    return { id: data.id, username: data.username, followers: Number.isSafeInteger(f) ? f! : null };
  } finally {
    // We do not keep X access, so give the token back.
    await fetch(new URL("/2/oauth2/revoke", API_BASE()), {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: access_token, token_type_hint: "access_token" }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  }
}

export type XAccount = { username: string; followers: number | null; connected_at: string };

export async function getXAccount(userId: number): Promise<XAccount | null> {
  const rows = await q<XAccount>`SELECT username, followers, connected_at FROM x_accounts WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}
