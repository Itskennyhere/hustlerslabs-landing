import { AuthShell } from "@/components/ui";
import { ensureSchema } from "@/lib/migrate";
import { peekEmailToken } from "@/lib/email-tokens";
import { ConfirmEmailForm } from "../EmailForms";

export const dynamic = "force-dynamic";

// Opening the link only shows a button; the email is confirmed when it is pressed.
export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await ensureSchema();
  const token = String((await searchParams).token ?? "");
  const t = await peekEmailToken(token, "verify");
  return (
    <AuthShell>
      <div className="tag">Email</div>
      {t ? (
        <>
          <h1>Confirm your email.</h1>
          <p className="sub">
            Link <span className="mono">{t.email}</span> to <span className="mono">@{t.username}</span> for password resets.
          </p>
          <ConfirmEmailForm token={token} />
        </>
      ) : (
        <>
          <h1>Link expired.</h1>
          <p className="sub">This link is invalid, already used or expired. Send a new one from Account.</p>
          <a className="btn" href="/members/account">Go to Account</a>
        </>
      )}
    </AuthShell>
  );
}
