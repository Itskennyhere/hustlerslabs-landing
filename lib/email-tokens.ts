import "server-only";
import { q } from "./db";
import { randomToken, sha256 } from "./crypto";

// Single-use links sent by email. Only the SHA-256 of a token is stored.

export type Purpose = "verify" | "reset";

export const TOKEN_MINUTES: Record<Purpose, number> = { verify: 24 * 60, reset: 30 };

/** Creates a token and cancels any earlier unused token of the same purpose for this user. */
export async function createEmailToken(userId: number, purpose: Purpose, email: string): Promise<string> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + TOKEN_MINUTES[purpose] * 60_000);
  await q`UPDATE email_tokens SET used_at = now() WHERE user_id = ${userId} AND purpose = ${purpose} AND used_at IS NULL`;
  await q`INSERT INTO email_tokens (user_id, purpose, token_hash, email, expires_at)
          VALUES (${userId}, ${purpose}, ${sha256(token)}, ${email}, ${expires.toISOString()})`;
  return token;
}

export type TokenRow = { id: number; user_id: number; email: string; username: string };

/** Looks a token up without using it. */
export async function peekEmailToken(token: string, purpose: Purpose): Promise<TokenRow | null> {
  if (!token || token.length > 100) return null;
  const rows = await q<TokenRow>`
    SELECT t.id, t.user_id, t.email, u.username
    FROM email_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ${sha256(token)} AND t.purpose = ${purpose}
      AND t.used_at IS NULL AND t.expires_at > now() AND u.disabled_at IS NULL`;
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), user_id: Number(rows[0].user_id) } : null;
}
