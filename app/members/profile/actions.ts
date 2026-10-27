"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { getAccountType, parseCreatorProfile, type CreatorInput } from "@/lib/onboarding";
import { FieldError } from "@/lib/validate";

export type ProfileState = { error?: string; field?: string } | undefined;

export async function saveProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "creator") return { error: "Only creator accounts have a creator profile." };

  let p: CreatorInput;
  try {
    p = parseCreatorProfile(form);
  } catch (e) {
    if (e instanceof FieldError) return { error: e.message, field: e.field };
    throw e;
  }

  // Always the signed-in user's own row. Verification is left as it is.
  await q`
    INSERT INTO creator_profiles (
      user_id, display_name, bio, platforms, main_handle, main_platform, niches, audience_band,
      region, languages, collab_status, telegram)
    VALUES (
      ${s.userId}, ${p.display_name}, ${p.bio}, ${JSON.stringify(p.platforms)}::text::jsonb, ${p.main_handle}, ${p.main_platform},
      ${p.niches}::text[], ${p.audience_band}, ${p.region}, ${p.languages}, ${p.collab_status}, ${p.telegram})
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name, bio = EXCLUDED.bio, platforms = EXCLUDED.platforms,
      main_handle = EXCLUDED.main_handle, main_platform = EXCLUDED.main_platform, niches = EXCLUDED.niches,
      audience_band = EXCLUDED.audience_band, region = EXCLUDED.region, languages = EXCLUDED.languages,
      collab_status = EXCLUDED.collab_status, telegram = EXCLUDED.telegram, updated_at = now()`;
  revalidatePath("/members");
  redirect("/members");
}

export async function disconnectX(): Promise<void> {
  const s = await requireMember();
  await q`DELETE FROM x_accounts WHERE user_id = ${s.userId}`;
  revalidatePath("/members", "layout");
  redirect("/members/profile");
}
