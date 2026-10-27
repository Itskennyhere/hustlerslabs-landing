import QRCode from "qrcode";
import { TOTP, Secret } from "otpauth";
import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { cancelTotpSetup, removeEmail, startTotp } from "./actions";
import { ConfirmTotpForm, DisableTotpForm, EmailForm, PasswordForm, ProjectDetailsForm } from "./Forms";
import { getAccountType, getProjectProfile } from "@/lib/onboarding";

export default async function AccountPage() {
  const s = await requireMember();
  const rows = await q<{ totp_secret_enc: string | null; totp_enabled: boolean; email: string | null; email_verified_at: string | null }>`
    SELECT totp_secret_enc, totp_enabled, email, email_verified_at FROM users WHERE id = ${s.userId}`;
  const { totp_secret_enc, totp_enabled } = rows[0];
  const email = rows[0].email_verified_at ? rows[0].email : null;
  const pending = await q<{ email: string }>`
    SELECT email FROM email_tokens
    WHERE user_id = ${s.userId} AND purpose = 'verify' AND used_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1`;
  const project = (await getAccountType(s.userId)) === "project" ? await getProjectProfile(s.userId) : null;

  let setup: { qr: string; secret: string } | null = null;
  if (!totp_enabled && totp_secret_enc) {
    const secret = decrypt(totp_secret_enc);
    const uri = new TOTP({ issuer: "Hustlers Labs", label: s.username, secret: Secret.fromBase32(secret) }).toString();
    setup = { qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), secret };
  }

  return (
    <>
      <div className="tag">Account</div>
      <h1>Security.</h1>
      <p className="sub">Signed in as <span className="mono">@{s.username}</span>.</p>

      <div className="section">
        <h2>Two-step login</h2>
        {totp_enabled ? (
          <>
            <p className="note" style={{ marginBottom: "1rem" }}>
              On. You will be asked for a code from your authenticator app each time you sign in.
            </p>
            <DisableTotpForm />
          </>
        ) : setup ? (
          <>
            <p className="note" style={{ marginBottom: "1rem" }}>
              Scan this with Google Authenticator, 1Password, Authy or similar. Then enter the 6-digit code it shows.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Two-step login QR code" width={220} height={220} style={{ border: "1px solid #e8e8e8" }} />
            <p className="note" style={{ margin: "0.75rem 0 1.25rem" }}>
              Can&apos;t scan? Enter this key manually: <span className="mono">{setup.secret.match(/.{1,4}/g)?.join(" ")}</span>
            </p>
            <ConfirmTotpForm />
            <form action={cancelTotpSetup} style={{ marginTop: "0.75rem" }}>
              <button className="btn ghost small" type="submit">Cancel setup</button>
            </form>
          </>
        ) : (
          <>
            <p className="note" style={{ marginBottom: "1rem" }}>
              Off. {s.role === "admin" ? "Required for admins before generating invite keys." : "Recommended."}
            </p>
            <form action={startTotp}>
              <button className="btn" type="submit">Set up two-step login</button>
            </form>
          </>
        )}
      </div>

      <div className="section">
        <h2>Email</h2>
        <p className="note" style={{ marginBottom: "1rem" }}>
          {email ? (
            <>
              Confirmed: <span className="mono">{email}</span>. If you forget your password, use &quot;Forgot password?&quot; on the
              sign-in page and we will email you a reset link.
            </>
          ) : (
            <>No email linked. Link one so you can reset your password if you forget it.</>
          )}
          {pending[0] && pending[0].email !== email && (
            <>
              {" "}Waiting for you to confirm <span className="mono">{pending[0].email}</span>. Check your inbox.
            </>
          )}
        </p>
        <EmailForm current={email} />
        {email && (
          <form action={removeEmail} style={{ marginTop: "0.75rem" }}>
            <button className="btn ghost small" type="submit">Remove email</button>
          </form>
        )}
      </div>

      <div className="section">
        <h2>Change password</h2>
        <PasswordForm />
      </div>

      {project && (
        <div className="section">
          <h2>Project details</h2>
          <p className="note" style={{ marginBottom: "1rem" }}>The answers you gave at sign-up. Keep them up to date.</p>
          <ProjectDetailsForm values={project} />
        </div>
      )}
    </>
  );
}
