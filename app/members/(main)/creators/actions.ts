"use server";

import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { getAccountType, workspaceComplete } from "@/lib/onboarding";
import { INTRO_NOTE_MAX, INTROS_PER_DAY } from "@/lib/onboarding-options";
import { FieldError, text } from "@/lib/validate";

export type IntroState = { ok?: boolean; error?: string } | undefined;

export async function requestIntro(_: IntroState, form: FormData): Promise<IntroState> {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "project") return { error: "Only project accounts can request intros." };
  if (!(await workspaceComplete(s.userId))) return { error: "Finish your workspace to request intros." };

  const creator = Number(form.get("creator"));
  if (!Number.isSafeInteger(creator) || creator <= 0) return { error: "That creator is not available." };
  let note: string | null;
  try {
    note = text(form, "note", "Note", INTRO_NOTE_MAX, false);
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message };
    throw e;
  }

  // Only creators a project can see in the roster: verified, taking collabs, not disabled.
  const visible = await q`
    SELECT 1 FROM creator_profiles c JOIN users u ON u.id = c.user_id
    WHERE c.user_id = ${creator} AND c.verified AND c.collab_status IN ('yes', 'case_by_case') AND u.disabled_at IS NULL`;
  if (!visible[0]) return { error: "That creator is not available." };

  const today = await q<{ n: number }>`
    SELECT count(*)::int AS n FROM intro_requests
    WHERE project_user_id = ${s.userId} AND created_at > now() - interval '1 day'`;
  if ((today[0]?.n ?? 0) >= INTROS_PER_DAY) {
    return { error: `You can request up to ${INTROS_PER_DAY} intros a day. Try again tomorrow.` };
  }

  // The project id always comes from the session. One request per project and creator.
  await q`
    INSERT INTO intro_requests (project_user_id, creator_user_id, note)
    VALUES (${s.userId}, ${creator}, ${note})
    ON CONFLICT (project_user_id, creator_user_id) DO NOTHING`;
  revalidatePath("/members/creators");
  return { ok: true };
}
