import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { headers } from "next/headers";
import { TOTP, Secret } from "otpauth";
import { q } from "./db";
import { decrypt, sha256 } from "./crypto";
import { clientIp } from "./ratelimit";
import { appUrl, mailConfigured, sendMail } from "./mail";
import { validatePassword } from "./password";

// ---------- Who is making this request ----------

export async function requestInfo(): Promise<{ ip: string; ua: string }> {
  const ua = ((await headers()).get("user-agent") ?? "").slice(0, 300);
  return { ip: (await clientIp()).slice(0, 64), ua };
}

/** "Chrome on Windows" from a user agent string. Only for display. */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone or iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "unknown system";
  return `${browser} on ${os}`;
}

// ---------- Activity log and alert emails ----------

export const EVENT_LABELS: Record<string, string> = {
  account_created: "Account created",
  login: "Signed in",
  login_recovery: "Signed in with a recovery code",
  password_changed: "Password changed",
  password_reset: "Password reset by email",
  totp_on: "Two-step login turned on",
  totp_off: "Two-step login turned off",
  recovery_regenerated: "New recovery codes made",
  email_changed: "Email changed",
  sessions_revoked: "Signed out other devices",
  session_revoked: "Signed out a device",
};

const ALERTS: Record<string, string> = {
  login: "New sign-in to your Hustlers Labs account",
  login_recovery: "A recovery code was used on your Hustlers Labs account",
  password_changed: "Your Hustlers Labs password was changed",
  totp_on: "Two-step login is on for your Hustlers Labs account",
  totp_off: "Two-step login was turned off on your Hustlers Labs account",
  recovery_regenerated: "New recovery codes for your Hustlers Labs account",
  email_changed: "The email on your Hustlers Labs account was changed",
};

/**
 * Records a security event for the user. For important events, emails the user's confirmed
 * address (or `alertTo`) after the response is sent. A sign-in only alerts when it comes from a
 * device and network this account has not used before.
 */
export async function logEvent(userId: number, kind: keyof typeof EVENT_LABELS, opts: { alertTo?: string } = {}): Promise<void> {
  const { ip, ua } = await requestInfo();
  let alert = kind in ALERTS;
  if (kind === "login") {
    const seen = await q`
      SELECT 1 FROM security_events
      WHERE user_id = ${userId} AND kind IN ('login', 'login_recovery', 'account_created') AND ip = ${ip} AND user_agent = ${ua}
      LIMIT 1`;
    alert = !seen[0];
  }
  await q`INSERT INTO security_events (user_id, kind, ip, user_agent) VALUES (${userId}, ${kind}, ${ip}, ${ua})`;
  if (!alert || !mailConfigured()) return;

  after(async () => {
    try {
      const rows = await q<{ username: string; email: string | null; email_verified_at: string | null }>`
        SELECT username, email, email_verified_at FROM users WHERE id = ${userId}`;
      const u = rows[0];
      const to = opts.alertTo ?? (u?.email_verified_at ? u.email : null);
      if (!u || !to) return;
      const when = new Date().toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
      await sendMail(
        to,
        ALERTS[kind],
        `Hi @${u.username},\n\n${EVENT_LABELS[kind]} on your Hustlers Labs account.\n\nWhen: ${when} UTC\nDevice: ${describeDevice(ua)}\nIP address: ${ip}\n\n` +
          `If this was you, there is nothing to do.\n\nIf this was not you, reset your password straight away at ${appUrl("/login/forgot")}, then sign out every other device from Account. Contact Hustlers Labs if you need help.\n`,
      );
    } catch (e) {
      console.error("security alert failed", e);
    }
  });
}

export async function recentEvents(userId: number, limit = 10) {
  return q<{ kind: string; ip: string | null; user_agent: string | null; created_at: string }>`
    SELECT kind, ip, user_agent, created_at FROM security_events
    WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
}

// ---------- Two-step codes ----------

/**
 * Checks a 6-digit code and makes sure it is never accepted twice: each 30-second step can
 * be used once, and only steps newer than the last one used are accepted.
 */
export async function checkTotp(userId: number, encSecret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = new TOTP({ secret: Secret.fromBase32(decrypt(encSecret)), digits: 6, period: 30 });
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) return false;
  const step = totp.counter() + delta;
  const ok = await q`
    UPDATE users SET totp_last_step = ${step}
    WHERE id = ${userId} AND (totp_last_step IS NULL OR totp_last_step < ${step})
    RETURNING id`;
  return Boolean(ok[0]);
}

// ---------- Recovery codes ----------

const RC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export const RECOVERY_CODE_COUNT = 10;

function normalizeRecoveryCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 10 ? clean : "";
}

/** Replaces the user's recovery codes. Returns the new codes; only their hashes are stored. */
export async function newRecoveryCodes(userId: number): Promise<string[]> {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const b = randomBytes(10);
    let c = "";
    for (let j = 0; j < 10; j++) c += RC_ALPHABET[b[j] & 31];
    codes.push(`${c.slice(0, 5)}-${c.slice(5)}`);
  }
  await q`DELETE FROM recovery_codes WHERE user_id = ${userId}`;
  for (const c of codes) {
    await q`INSERT INTO recovery_codes (user_id, code_hash) VALUES (${userId}, ${sha256(normalizeRecoveryCode(c))})`;
  }
  return codes;
}

/** Uses up one recovery code. True if it was valid and unused. */
export async function useRecoveryCode(userId: number, raw: string): Promise<boolean> {
  const code = normalizeRecoveryCode(raw);
  if (!code) return false;
  const used = await q`
    UPDATE recovery_codes SET used_at = now()
    WHERE id = (SELECT id FROM recovery_codes WHERE user_id = ${userId} AND code_hash = ${sha256(code)} AND used_at IS NULL LIMIT 1)
    RETURNING id`;
  return Boolean(used[0]);
}

export async function recoveryCodesLeft(userId: number): Promise<number> {
  const r = await q<{ n: number }>`SELECT count(*)::int AS n FROM recovery_codes WHERE user_id = ${userId} AND used_at IS NULL`;
  return r[0]?.n ?? 0;
}

// ---------- New passwords ----------

/** True if the password appears in a known data breach (Have I Been Pwned, k-anonymity: only 5 hash characters leave the server). */
async function breached(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const base = (process.env.PWNED_API_BASE ?? "https://api.pwnedpasswords.com").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const suffix = hash.slice(5);
    return (await res.text()).split("\n").some((line) => {
      const [s, n] = line.trim().split(":");
      return s === suffix && Number(n) > 0;
    });
  } catch {
    return false; // never block sign-up because the check service is down
  }
}

/** Rules for every new password: length and variety, then the breach check. */
export async function checkNewPassword(password: string, username: string): Promise<string | null> {
  const err = validatePassword(password, username);
  if (err) return err;
  if (await breached(password)) {
    return "This password has appeared in a data breach, so attackers try it first. Choose a different one.";
  }
  return null;
}
