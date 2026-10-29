import "server-only";
import { q } from "./db";
import { appUrl, mailConfigured, sendMail } from "./mail";

/** Emails every admin with a confirmed email that a new member is waiting for approval. Never throws. */
export async function notifyAdminsOfSignup(userId: number): Promise<void> {
  if (!mailConfigured()) return;
  try {
    const rows = await q<{ username: string; account_type: string | null }>`
      SELECT username, account_type FROM users WHERE id = ${userId} AND approved_at IS NULL AND role = 'member'`;
    const u = rows[0];
    if (!u) return;
    const admins = await q<{ email: string }>`
      SELECT email FROM users WHERE role = 'admin' AND email_verified_at IS NOT NULL AND disabled_at IS NULL`;
    const type = u.account_type === "project" ? "project" : u.account_type === "creator" ? "creator" : "member";
    for (const a of admins) {
      await sendMail(
        a.email,
        `New ${type} waiting for approval: @${u.username}`,
        `@${u.username} signed up as a ${type} and confirmed their email.\n\nReview and approve or decline them here:\n\n${appUrl(`/admin/members/${userId}`)}\n`,
      );
    }
  } catch (e) {
    console.error("signup notice failed", e);
  }
}

/** Tells a member they are in. Never throws. */
export async function sendApprovedEmail(userId: number): Promise<void> {
  if (!mailConfigured()) return;
  try {
    const rows = await q<{ username: string; email: string | null; email_verified_at: string | null }>`
      SELECT username, email, email_verified_at FROM users WHERE id = ${userId}`;
    const u = rows[0];
    if (!u?.email || !u.email_verified_at) return;
    await sendMail(
      u.email,
      "You're in: your Hustlers Labs account is approved",
      `Hi @${u.username},\n\nA member of the Hustlers Labs team approved your account. Sign in here:\n\n${appUrl("/login")}\n`,
    );
  } catch (e) {
    console.error("approved email failed", e);
  }
}

export async function pendingApprovals(): Promise<number> {
  const r = await q<{ n: number }>`
    SELECT count(*)::int AS n FROM users WHERE role = 'member' AND approved_at IS NULL AND disabled_at IS NULL`;
  return r[0]?.n ?? 0;
}
