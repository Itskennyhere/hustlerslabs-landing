import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { toolsLockedAt } from "@/lib/tools-access";
import { parseHandle } from "@/lib/xscan/handle";
import { scanProfile } from "@/lib/xscan/scan";
import { getQuota, runScan } from "@/lib/xscan/service";
import { pgScanStore } from "@/lib/xscan/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Same rules as requireMember on every members page, plus the project workspace lock on tools. */
async function authorise(): Promise<{ user: SessionUser } | { res: NextResponse }> {
  const user = await getSession();
  if (!user || !user.mfaVerified) return { res: json({ error: "Sign in to use the scanner." }, 401) };
  if (user.role !== "admin" && (!user.approved || (mailConfigured() && !user.emailConfirmed))) {
    return { res: json({ error: "Your account is waiting for approval." }, 403) };
  }
  if ((await toolsLockedAt(user.userId)) !== null) {
    return { res: json({ error: "Finish your workspace to unlock tools." }, 403) };
  }
  return { user };
}

/** Scans left today for the signed in account, shown before scanning. */
export async function GET() {
  const auth = await authorise();
  if ("res" in auth) return auth.res;
  return json({ quota: await getQuota(pgScanStore, auth.user.userId, auth.user.role === "admin") });
}

export async function POST(req: Request) {
  const auth = await authorise();
  if ("res" in auth) return auth.res;

  const body = (await req.json().catch(() => ({}))) as { handle?: unknown };
  const handle = parseHandle(String(body.handle ?? ""));
  if (!handle) return json({ error: "Enter a valid X handle, like @name or an x.com profile link." }, 400);

  const { status, body: payload } = await runScan({
    store: pgScanStore,
    userId: auth.user.userId,
    isAdmin: auth.user.role === "admin",
    handle,
    scan: scanProfile,
  });
  return json(payload, status);
}
