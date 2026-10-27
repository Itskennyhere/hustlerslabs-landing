import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { q } from "./db";
import { safeEqual } from "./crypto";
import { mailConfigured, sendMail } from "./mail";
import { describeDevice, requestInfo } from "./security";

// Admins finish every sign-in with a 6-digit code sent to their confirmed email,
// after the password and the authenticator app code.

export const EMAIL_CODE_MINUTES = 10;
const MAX_SENDS = 4; // first code plus three resends per sign-in

function codeHash(sessionId: number, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHmac("sha256", `hl-email-code:${secret}`).update(`${sessionId}:${code}`).digest("hex");
}

/** The confirmed email to send the admin code to, or null when this user has no email step. */
export async function emailStepAddress(userId: number): Promise<string | null> {
  if (!mailConfigured()) return null;
  const rows = await q<{ role: string; email: string | null; email_verified_at: string | null }>`
    SELECT role, email, email_verified_at FROM users WHERE id = ${userId}`;
  const u = rows[0];
  return u && u.role === "admin" && u.email_verified_at && u.email ? u.email : null;
}

export function maskAddress(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * Moves a pending session to the email step and sends a fresh code. Earlier codes for this
 * sign-in stop working. Returns false if the send limit is reached or the email could not be sent.
 */
export async function sendEmailCode(sessionId: number, userId: number, email: string): Promise<"sent" | "limit" | "failed"> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const updated = await q<{ id: number }>`
    UPDATE sessions SET stage = 'email', email_code_hash = ${codeHash(sessionId, code)},
      email_code_expires_at = now() + make_interval(mins => ${EMAIL_CODE_MINUTES}),
      email_code_sends = email_code_sends + 1, mfa_attempts = 0
    WHERE id = ${sessionId} AND user_id = ${userId} AND NOT mfa_verified AND email_code_sends < ${MAX_SENDS}
    RETURNING id`;
  if (!updated[0]) return "limit";
  const { ip, ua } = await requestInfo();
  try {
    await sendMail(
      email,
      `${code} is your Hustlers Labs admin sign-in code`,
      `Your Hustlers Labs admin sign-in code is:\n\n${code}\n\nIt expires in ${EMAIL_CODE_MINUTES} minutes and works once.\n\n` +
        `Device: ${describeDevice(ua)}\nIP address: ${ip}\n\n` +
        `If you are not signing in right now, someone has your password and your authenticator code. Change your password straight away and sign out every other device from Account.\n`,
    );
    return "sent";
  } catch (e) {
    console.error("admin email code failed", e);
    return "failed";
  }
}

/** Checks the code for this sign-in. A correct code is used up straight away. */
export async function checkEmailCode(sessionId: number, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const rows = await q<{ email_code_hash: string | null }>`
    SELECT email_code_hash FROM sessions
    WHERE id = ${sessionId} AND stage = 'email' AND email_code_expires_at > now()`;
  const stored = rows[0]?.email_code_hash;
  if (!stored || !safeEqual(stored, codeHash(sessionId, code))) return false;
  const used = await q`UPDATE sessions SET email_code_hash = NULL WHERE id = ${sessionId} AND email_code_hash = ${stored} RETURNING id`;
  return Boolean(used[0]);
}
