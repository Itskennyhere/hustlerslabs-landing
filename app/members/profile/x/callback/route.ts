import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireMember } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { q } from "@/lib/db";
import { ensureSchema } from "@/lib/migrate";
import { getAccountType } from "@/lib/onboarding";
import { X_COOKIE, X_COOKIE_PATH, fetchXUser, xConfigured, type XUser } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

// X sends the creator back here after they approve (or cancel) "Connect X".
export async function GET(req: NextRequest) {
  await ensureSchema();
  const s = await requireMember({ allowPending: true });
  if ((await getAccountType(s.userId)) !== "creator" || !xConfigured()) redirect("/members/profile");

  const jar = await cookies();
  const saved = jar.get(X_COOKIE)?.value ?? "";
  jar.delete({ name: X_COOKIE, path: X_COOKIE_PATH });

  const [uid, state, verifier] = saved.split(".");
  const params = req.nextUrl.searchParams;
  const code = params.get("code") ?? "";
  const gotState = params.get("state") ?? "";
  if (params.get("error")) redirect("/members/profile?x=cancelled");
  // The state must match the one set for this signed-in user, so a link from someone else cannot connect their X to you.
  if (!saved || Number(uid) !== s.userId || !gotState || !safeEqual(state, gotState) || !code || code.length > 500) {
    redirect("/members/profile?x=failed");
  }

  let x: XUser;
  try {
    x = await fetchXUser(code, verifier);
  } catch (e) {
    console.error("connect X failed", e);
    redirect("/members/profile?x=failed");
  }

  const other = await q`SELECT 1 FROM x_accounts WHERE x_user_id = ${x.id} AND user_id <> ${s.userId}`;
  if (other[0]) redirect("/members/profile?x=taken");

  await q`
    INSERT INTO x_accounts (user_id, x_user_id, username, followers)
    VALUES (${s.userId}, ${x.id}, ${x.username}, ${x.followers})
    ON CONFLICT (user_id) DO UPDATE SET
      x_user_id = EXCLUDED.x_user_id, username = EXCLUDED.username,
      followers = EXCLUDED.followers, connected_at = now()`;
  redirect("/members/profile?x=connected");
}
