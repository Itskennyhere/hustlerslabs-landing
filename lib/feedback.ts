import { q } from "./db";
import { appUrl, mailConfigured, sendMail } from "./mail";
import { feedbackKindLabel } from "./feedback-options";

export async function newFeedbackCount(): Promise<number> {
  const r = await q<{ n: number }>`SELECT count(*)::int AS n FROM feedback WHERE status = 'new'`;
  return r[0]?.n ?? 0;
}

/** Where feedback is emailed. FEEDBACK_EMAIL in Vercel changes it. */
export const FEEDBACK_TO = process.env.FEEDBACK_EMAIL || "hello@hustlerslabs.com";

/** Emails one piece of feedback to the team inbox. Never throws; the note is already saved in Admin > Feedback. */
export async function emailFeedback(f: { username: string; accountType: string | null; kind: string; message: string; page: string | null }): Promise<void> {
  if (!mailConfigured()) return;
  try {
    const who = `@${f.username}${f.accountType ? ` (${f.accountType})` : ""}`;
    await sendMail(
      FEEDBACK_TO,
      `Feedback from ${who}: ${feedbackKindLabel(f.kind)}`,
      `${who} sent feedback${f.page ? ` from ${f.page}` : ""}.\n\n${feedbackKindLabel(f.kind)}\n\n${f.message}\n\nSee all feedback: ${appUrl("/admin/feedback")}\n`,
    );
  } catch (e) {
    console.error("feedback email failed", e);
  }
}
