"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { FEEDBACK_KINDS, FEEDBACK_MAX, FEEDBACK_PER_DAY } from "@/lib/feedback-options";
import { emailFeedback } from "@/lib/feedback";
import { getAccountType } from "@/lib/onboarding";
import { FieldError, one, text } from "@/lib/validate";

export type FeedbackState = { ok?: boolean; error?: string } | undefined;

export async function sendFeedback(_: FeedbackState, form: FormData): Promise<FeedbackState> {
  // Members waiting for approval can send feedback too, from the creator card page.
  const s = await requireMember({ allowPending: true });
  let kind: string | null;
  let message: string | null;
  try {
    kind = one(form, "kind", "What it's about", FEEDBACK_KINDS);
    message = text(form, "message", "Your feedback", FEEDBACK_MAX);
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message };
    throw e;
  }
  // The page it was sent from, so the team has context. Only a path on this site.
  const raw = String(form.get("page") ?? "");
  const page = raw.startsWith("/") && !raw.startsWith("//") ? raw.slice(0, 200) : null;

  const today = await q<{ n: number }>`
    SELECT count(*)::int AS n FROM feedback WHERE user_id = ${s.userId} AND created_at > now() - interval '1 day'`;
  if ((today[0]?.n ?? 0) >= FEEDBACK_PER_DAY) {
    return { error: `You can send up to ${FEEDBACK_PER_DAY} notes a day. Thank you for all of them. Try again tomorrow.` };
  }

  await q`INSERT INTO feedback (user_id, kind, message, page) VALUES (${s.userId}, ${kind}, ${message}, ${page})`;
  // Also emailed to the team inbox, after the reply so the member isn't kept waiting.
  after(async () => emailFeedback({ username: s.username, accountType: await getAccountType(s.userId), kind: kind!, message: message!, page }));
  revalidatePath("/admin", "layout");
  return { ok: true };
}
