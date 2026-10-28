import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { ensureSchema } from "@/lib/migrate";
import { getAccountType, getCreatorProfile } from "@/lib/onboarding";
import { logout } from "@/app/login/actions";
import { AuthShell } from "@/components/ui";
import { ChangeEmailForm, ResendForm } from "./WaitingForms";

export const dynamic = "force-dynamic";

export default async function WaitingPage() {
  await ensureSchema();
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.mfaVerified) redirect("/login/verify");
  const needsEmail = mailConfigured() && !s.emailConfirmed;
  if (s.role === "admin" || (s.approved && !needsEmail)) redirect("/members");

  const [pending, type] = await Promise.all([
    q<{ email: string }>`
      SELECT email FROM email_tokens WHERE user_id = ${s.userId} AND purpose = 'verify' ORDER BY created_at DESC LIMIT 1`,
    getAccountType(s.userId),
  ]);
  const card = type === "creator" && !needsEmail ? await getCreatorProfile(s.userId) : null;

  return (
    <AuthShell>
      <div className="tag">Almost there</div>
      <h1>{needsEmail ? "Check your email." : "Waiting for approval."}</h1>
      <p className="sub">
        Every new account is reviewed by a member of the Hustlers Labs team. Signed in as <span className="mono">@{s.username}</span>.
      </p>

      <ol className="checklist waiting">
        <li>
          <span className={`check${needsEmail ? "" : " on"}`} aria-hidden="true">
            {needsEmail ? "" : "✓"}
          </span>
          <span>
            <strong>Confirm your email</strong>
            <span className="note">
              {!mailConfigured()
                ? " Not needed right now."
                : needsEmail
                  ? pending[0]
                    ? ` We sent a link to ${pending[0].email}. Click it to continue.`
                    : " Add your email below."
                  : " Done."}
            </span>
          </span>
        </li>
        <li>
          <span className={`check${s.approved ? " on" : ""}`} aria-hidden="true">
            {s.approved ? "✓" : ""}
          </span>
          <span>
            <strong>Team approval</strong>
            <span className="note">
              {s.approved ? " Done." : needsEmail ? " Starts once your email is confirmed." : " A team member is reviewing your account. We will email you when you are in."}
            </span>
          </span>
        </li>
      </ol>

      {needsEmail && (
        <>
          <ResendForm />
          <details className="alt">
            <summary>Wrong email?</summary>
            <ChangeEmailForm />
          </details>
        </>
      )}

      {type === "creator" && !needsEmail && !s.approved && (
        <div className="panel" style={{ marginTop: "1.5rem" }}>
          <p className="note" style={{ marginBottom: "0.75rem" }}>
            {card ? "Your creator card is saved. The team sees it when reviewing you." : "While you wait, set up your creator card. The team sees it when reviewing you."}
          </p>
          <a className="btn" href="/members/profile">
            {card ? "Edit your card" : "Set up your card"}
          </a>
        </div>
      )}

      <form action={logout} className="alt">
        <button type="submit" className="btn ghost small">
          Sign out
        </button>
      </form>
    </AuthShell>
  );
}
