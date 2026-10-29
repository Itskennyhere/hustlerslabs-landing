"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { getAccountType, parseBuying, parseGoals, parseMarketing } from "@/lib/onboarding";
import { FieldError } from "@/lib/validate";

export type SectionState = { error?: string; field?: string } | undefined;

/** Signed-in project only. Returns the user id; every write below uses it, never an id from the form. */
async function requireProject(): Promise<number> {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "project") redirect("/members");
  return s.userId;
}

function done() {
  revalidatePath("/members");
  revalidatePath("/members/workspace");
  revalidatePath("/members/tools");
  redirect("/members/workspace");
}

function fieldError(e: unknown): SectionState {
  if (e instanceof FieldError) return { error: e.message, field: e.field };
  throw e;
}

export async function saveGoals(_: SectionState, form: FormData): Promise<SectionState> {
  const userId = await requireProject();
  let v: ReturnType<typeof parseGoals>;
  try {
    v = parseGoals(form);
  } catch (e) {
    return fieldError(e);
  }
  await q`
    INSERT INTO project_workspace (user_id, goals, key_date, key_date_note, blocker, success_90d, goals_done_at)
    VALUES (${userId}, ${v.goals}::text[], ${v.key_date}::date, ${v.key_date_note}, ${v.blocker}, ${v.success_90d}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      goals = EXCLUDED.goals, key_date = EXCLUDED.key_date, key_date_note = EXCLUDED.key_date_note,
      blocker = EXCLUDED.blocker, success_90d = EXCLUDED.success_90d,
      goals_done_at = COALESCE(project_workspace.goals_done_at, now()), updated_at = now()`;
  done();
}

export async function saveMarketing(_: SectionState, form: FormData): Promise<SectionState> {
  const userId = await requireProject();
  let v: ReturnType<typeof parseMarketing>;
  try {
    v = parseMarketing(form);
  } catch (e) {
    return fieldError(e);
  }
  await q`
    INSERT INTO project_workspace (user_id, marketing_owner, channels, x_followers_band, community_band, tried, marketing_done_at)
    VALUES (${userId}, ${v.marketing_owner}, ${v.channels}::text[], ${v.x_followers_band}, ${v.community_band}, ${v.tried}::text[], now())
    ON CONFLICT (user_id) DO UPDATE SET
      marketing_owner = EXCLUDED.marketing_owner, channels = EXCLUDED.channels,
      x_followers_band = EXCLUDED.x_followers_band, community_band = EXCLUDED.community_band, tried = EXCLUDED.tried,
      marketing_done_at = COALESCE(project_workspace.marketing_done_at, now()), updated_at = now()`;
  done();
}

export async function saveBuying(_: SectionState, form: FormData): Promise<SectionState> {
  const userId = await requireProject();
  let v: ReturnType<typeof parseBuying>;
  try {
    v = parseBuying(form);
  } catch (e) {
    return fieldError(e);
  }
  await q`
    INSERT INTO project_workspace (user_id, wanted_tools, payment_pref, buying_done_at)
    VALUES (${userId}, ${v.wanted_tools}::text[], ${v.payment_pref}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      wanted_tools = EXCLUDED.wanted_tools, payment_pref = EXCLUDED.payment_pref,
      buying_done_at = COALESCE(project_workspace.buying_done_at, now()), updated_at = now()`;
  done();
}
