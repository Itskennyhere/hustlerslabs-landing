"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { safeEqual, sha256 } from "@/lib/crypto";
import { clientIp, isLimited, recordFailure } from "@/lib/ratelimit";
import { logEvent } from "@/lib/security";

export type OwnerState = { error?: string } | undefined;

/** One-time: the first admin to enter OWNER_CLAIM_TOKEN becomes the owner. Once there is an owner it never works again. */
export async function claimOwner(_: OwnerState, form: FormData): Promise<OwnerState> {
  const s = await requireAdmin();
  const expected = process.env.OWNER_CLAIM_TOKEN ?? "";
  if (expected.length < 24) return { error: "The owner key is not set up on this deployment." };

  const buckets = [`owner-claim:${s.userId}`, `owner-claim-ip:${await clientIp()}`];
  for (const b of buckets) if (await isLimited(b, 5)) return { error: "Too many attempts. Try again in 15 minutes." };

  const token = String(form.get("token") ?? "").trim().slice(0, 200);
  if (!safeEqual(sha256(token), sha256(expected))) {
    await recordFailure(...buckets);
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return { error: "That owner key is wrong." };
  }

  const claimed = await q`
    UPDATE users SET is_owner = true
    WHERE id = ${s.userId} AND role = 'admin' AND NOT EXISTS (SELECT 1 FROM users WHERE is_owner)
    RETURNING id`;
  if (!claimed[0]) return { error: "The owner has already been set. The owner key no longer works." };
  await logEvent(s.userId, "owner_claimed");
  revalidatePath("/admin", "layout");
  // This page is gone now that there is an owner, so go to Admin.
  redirect("/admin?owner=1");
}
