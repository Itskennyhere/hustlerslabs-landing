import QRCode from "qrcode";
import { TOTP, Secret } from "otpauth";
import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { EVENT_LABELS, RECOVERY_CODE_COUNT, describeDevice, recentEvents, recoveryCodesLeft } from "@/lib/security";
import { cancelTotpSetup, revokeSession, signOutOtherDevices, startTotp } from "./actions";
import { ConfirmTotpForm, DisableTotpForm, EmailForm, PasswordForm, ProjectDetailsForm, RecoveryCodesForm } from "./Forms";
import { getAccountType, getProjectProfile } from "@/lib/onboarding";

const fmt = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ admin2fa?: string }> }) {
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
  const [codesLeft, devices, events] = await Promise.all([
    totp_enabled ? recoveryCodesLeft(s.userId) : Promise.resolve(0),
    q<{ id: number; ip: string | null; user_agent: string | null; created_at: string; last_seen_at: string | null }>`
      SELECT id, ip, user_agent, created_at, last_seen_at FROM sessions
      WHERE user_id = ${s.userId} AND mfa_verified AND expires_at > now()
      ORDER BY coalesce(last_seen_at, created_at) DESC`,
    recentEvents(s.userId, 10),
  ]);
  const others = devices.filter((d) => Number(d.id) !== s.sessionId).length;

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

      {(await searchParams).admin2fa === "1" && !totp_enabled && (
        <p className="error" role="alert" style={{ marginTop: "1.5rem" }}>
          Admin pages need two-step login. Turn it on below to continue.
        </p>
      )}

      <div className="section">
        <h2>Two-step login</h2>
        {totp_enabled ? (
          <>
            <p className="note" style={{ marginBottom: "1rem" }}>
              On. You will be asked for a code from your authenticator app each time you sign in. Each code works once.
            </p>
            {s.role === "admin" ? (
              <p className="note">Admins must keep two-step login on.</p>
            ) : (
              <details className="fold">
                <summary>Turn off two-step login</summary>
                <DisableTotpForm />
              </details>
            )}
            <h3 className="answers-title">Recovery codes</h3>
            <p className={codesLeft <= 2 ? "error" : "note"} style={{ marginBottom: "1rem" }}>
              {codesLeft} of {RECOVERY_CODE_COUNT} left.{" "}
              {codesLeft <= 2
                ? "Make new ones now so you do not get locked out if you lose your phone."
                : "Use one to sign in if you lose your phone."}
            </p>
            <details className="fold">
              <summary>Make new recovery codes</summary>
              <RecoveryCodesForm />
            </details>
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
              Off. {s.role === "admin" ? "Required for admins." : "Strongly recommended: without it, anyone with your password can sign in."}
            </p>
            <form action={startTotp}>
              <button className="btn" type="submit">Set up two-step login</button>
            </form>
          </>
        )}
      </div>

      <div className="section">
        <h2>Signed-in devices</h2>
        <ul className="devices">
          {devices.map((d) => (
            <li key={d.id}>
              <div>
                <strong>{describeDevice(d.user_agent)}</strong>
                {Number(d.id) === s.sessionId && <span className="this-device">This device</span>}
                <div className="note">
                  <span className="mono">{d.ip ?? "IP unknown"}</span> · Signed in {fmt(d.created_at)} · Last active{" "}
                  {fmt(d.last_seen_at ?? d.created_at)}
                </div>
              </div>
              {Number(d.id) !== s.sessionId && (
                <form action={revokeSession}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="btn ghost small">Sign out</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {others > 0 && (
          <form action={signOutOtherDevices} style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn danger">Sign out all other devices</button>
          </form>
        )}
      </div>

      <div className="section">
        <h2>Email</h2>
        <p className="note" style={{ marginBottom: "1rem" }}>
          {email ? (
            <>
              Confirmed: <span className="mono">{email}</span>. We email you here about new sign-ins and security changes, and
              send password reset links here.
            </>
          ) : (
            <>No confirmed email yet. Confirm one so you get security alerts and can reset your password if you forget it.</>
          )}
          {pending[0] && pending[0].email !== email && (
            <>
              {" "}Waiting for you to confirm <span className="mono">{pending[0].email}</span>. Check your inbox.
            </>
          )}
        </p>
        <EmailForm current={email} />
      </div>

      <div className="section">
        <h2>Change password</h2>
        <PasswordForm />
      </div>

      <div className="section">
        <h2>Recent security activity</h2>
        <p className="note" style={{ marginBottom: "1rem" }}>
          Something here you do not recognise? Change your password and sign out all other devices.
        </p>
        <ul className="devices">
          {events.map((e, i) => (
            <li key={i}>
              <div>
                <strong>{EVENT_LABELS[e.kind] ?? e.kind}</strong>
                <div className="note">
                  {fmt(e.created_at)} · {describeDevice(e.user_agent)} · <span className="mono">{e.ip ?? "IP unknown"}</span>
                </div>
              </div>
            </li>
          ))}
          {events.length === 0 && <li className="note">Nothing yet.</li>}
        </ul>
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
