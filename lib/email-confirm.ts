import "server-only";
import { q } from "./db";
import { createEmailToken } from "./email-tokens";
import { appUrl, mailConfigured, sendMail } from "./mail";

/** True if another account has already confirmed this email. */
export async function emailTakenByOther(email: string, userId: number | null): Promise<boolean> {
  const rows = await q`
    SELECT 1 FROM users
    WHERE lower(email) = ${email} AND email_verified_at IS NOT NULL AND (${userId}::bigint IS NULL OR id <> ${userId}::bigint)`;
  return Boolean(rows[0]);
}

/**
 * Records `email` as waiting for confirmation and emails the confirm link.
 * The pending address is kept even if email is not configured yet, so Account can show it.
 */
export async function startEmailConfirm(userId: number, username: string, email: string): Promise<void> {
  const token = await createEmailToken(userId, "verify", email);
  await sendConfirmEmail(username, email, token);
}

export async function sendConfirmEmail(username: string, email: string, token: string): Promise<void> {
  if (!mailConfigured()) return;
  await sendMail(
    email,
    "Confirm your email for Hustlers Labs",
    `Hi @${username},\n\nConfirm this email to use it for password resets on Hustlers Labs:\n\n${appUrl(`/login/confirm-email?token=${token}`)}\n\nThe link works once and expires in 24 hours. If you did not ask for this, ignore this email.\n`,
  );
}

export type EmailStatus = { confirmed: boolean; pending: string | null };

export async function getEmailStatus(userId: number): Promise<EmailStatus> {
  const rows = await q<{ confirmed: boolean; pending: string | null }>`
    SELECT u.email_verified_at IS NOT NULL AS confirmed,
           (SELECT t.email FROM email_tokens t
            WHERE t.user_id = u.id AND t.purpose = 'verify' AND t.used_at IS NULL AND t.expires_at > now()
            ORDER BY t.created_at DESC LIMIT 1) AS pending
    FROM users u WHERE u.id = ${userId}`;
  return rows[0] ?? { confirmed: false, pending: null };
}
