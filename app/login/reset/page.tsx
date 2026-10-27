import { AuthShell } from "@/components/ui";
import { ensureSchema } from "@/lib/migrate";
import { peekEmailToken } from "@/lib/email-tokens";
import { ResetForm } from "../EmailForms";

export const dynamic = "force-dynamic";

// Opening the link only shows the form. The token is used when the form is submitted,
// so email scanners that open links cannot use it up.
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await ensureSchema();
  const token = String((await searchParams).token ?? "");
  const t = await peekEmailToken(token, "reset");
  return (
    <AuthShell>
      <div className="tag">Password reset</div>
      {t ? (
        <>
          <h1>Choose a new password.</h1>
          <p className="sub">
            For <span className="mono">@{t.username}</span>. Every device will be signed out. If you use two-step login, you will
            still need your code to sign in.
          </p>
          <ResetForm token={token} />
        </>
      ) : (
        <>
          <h1>Link expired.</h1>
          <p className="sub">This reset link is invalid, already used or expired.</p>
          <a className="btn" href="/login/forgot">Ask for a new link</a>
        </>
      )}
    </AuthShell>
  );
}
