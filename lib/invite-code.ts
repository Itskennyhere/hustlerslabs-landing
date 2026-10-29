import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { q } from "./db";
import { normalizeInviteKey, safeEqual, sha256 } from "./crypto";

// Invite codes are entered on the sign-in page and open a special setup page:
// - "owner": the one-time OWNER_CLAIM_TOKEN, makes an existing admin the owner.
// - "admin": an admin code from the owner, creates an admin account.
// - "member": a preferred code from the owner, a normal sign-up that skips the team review.
// A valid code is carried to the setup page in a short-lived signed cookie, and checked again when used.

export type InviteKind = "owner" | "admin" | "member";
export type InviteTicket = { kind: InviteKind; hash: string; exp: number };

const COOKIE = process.env.NODE_ENV === "production" ? "__Host-hl_invite" : "hl_invite";
const MINUTES = 20;

function sign(body: string): string {
  return createHmac("sha256", `hl-invite:${process.env.AUTH_SECRET ?? ""}`).update(body).digest("base64url");
}

/** What a typed code is, or null. Does not use it up. */
export async function checkInviteCode(raw: string): Promise<InviteTicket | null> {
  const code = raw.trim().slice(0, 200);
  if (!code) return null;
  const exp = Date.now() + MINUTES * 60_000;

  const owner = process.env.OWNER_CLAIM_TOKEN ?? "";
  if (owner.length >= 24 && safeEqual(sha256(code), sha256(owner))) {
    const taken = await q`SELECT 1 FROM users WHERE is_owner LIMIT 1`;
    return taken[0] ? null : { kind: "owner", hash: "owner", exp };
  }

  const key = normalizeInviteKey(code);
  if (!key) return null;
  const hash = sha256(key);
  const rows = await q<{ kind: string }>`
    SELECT kind FROM invites
    WHERE key_hash = ${hash} AND kind IN ('admin', 'member') AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;
  const kind = rows[0]?.kind;
  return kind === "admin" || kind === "member" ? { kind, hash, exp } : null;
}

export async function setInviteTicket(t: InviteTicket): Promise<void> {
  const body = Buffer.from(JSON.stringify(t)).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MINUTES * 60,
  });
}

/** The ticket from the cookie if it is ours and not expired. The code itself is checked again before use. */
export async function readInviteTicket(): Promise<InviteTicket | null> {
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [body, mac] = raw.split(".");
  if (!body || !mac || !safeEqual(mac, sign(body))) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as InviteTicket;
    if (!["owner", "admin", "member"].includes(t.kind) || typeof t.hash !== "string" || t.exp < Date.now()) return null;
    return t;
  } catch {
    return null;
  }
}

export async function clearInviteTicket(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
