import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { ensureSchema } from "@/lib/migrate";
import { getAccountType } from "@/lib/onboarding";
import { X_COOKIE, X_COOKIE_PATH, authorizeUrl, xConfigured } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

// Starts "Connect X". Route handlers skip layouts, so every check is repeated here.
export async function GET() {
  await ensureSchema();
  const s = await requireMember({ allowPending: true });
  if ((await getAccountType(s.userId)) !== "creator" || !xConfigured()) redirect("/members/profile");

  const state = randomToken(16);
  const verifier = randomToken(48);
  (await cookies()).set(X_COOKIE, `${s.userId}.${state}.${verifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the redirect back from x.com
    path: X_COOKIE_PATH,
    maxAge: 600,
  });
  redirect(authorizeUrl(state, verifier));
}
