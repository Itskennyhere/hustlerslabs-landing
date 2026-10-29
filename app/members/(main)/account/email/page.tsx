import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { BackLink } from "@/components/list";
import { EmailForm } from "../Forms";

export default async function EmailPage() {
  const s = await requireMember();
  const [user, pending] = await Promise.all([
    q<{ email: string | null; email_verified_at: string | null }>`SELECT email, email_verified_at FROM users WHERE id = ${s.userId}`,
    q<{ email: string }>`
      SELECT email FROM email_tokens
      WHERE user_id = ${s.userId} AND purpose = 'verify' AND used_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`,
  ]);
  const email = user[0].email_verified_at ? user[0].email : null;

  return (
    <>
      <BackLink href="/members/account">Back to Account</BackLink>
      <div className="tag">Account</div>
      <h1>Email.</h1>
      <p className="sub">
        {email ? (
          <>
            Confirmed: <span className="mono">{email}</span>. You can sign in with it, and we send security alerts and password
            reset links here.
            {s.role === "admin" && " As an admin, every sign-in also needs a code we send here."}
          </>
        ) : (
          <>No confirmed email yet. Confirm one to sign in with it, get security alerts and reset your password if you forget it.</>
        )}
      </p>
      {pending[0] && pending[0].email !== email && (
        <p className="note" role="status" style={{ marginBottom: "1.5rem" }}>
          Waiting for you to confirm <span className="mono">{pending[0].email}</span>. Check your inbox, or send the link again below.
        </p>
      )}
      {mailConfigured() ? (
        <EmailForm current={email} needsCode={s.totpEnabled} />
      ) : (
        <p className="note">Email sending is not set up yet, so emails cannot be confirmed. {s.role === "admin" ? "Add SMTP_USER and SMTP_PASS in Vercel." : "Ask an admin."}</p>
      )}
    </>
  );
}
