import QRCode from "qrcode";
import { TOTP, Secret } from "otpauth";
import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { RECOVERY_CODE_COUNT, recoveryCodesLeft } from "@/lib/security";
import { BackLink } from "@/components/list";
import { cancelTotpSetup, startTotp } from "../actions";
import { ConfirmTotpForm, DisableTotpForm, RecoveryCodesForm } from "../Forms";

export default async function TwoStepPage({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const s = await requireMember();
  const rows = await q<{ totp_secret_enc: string | null; totp_enabled: boolean }>`
    SELECT totp_secret_enc, totp_enabled FROM users WHERE id = ${s.userId}`;
  const { totp_secret_enc, totp_enabled } = rows[0];

  let setup: { qr: string; secret: string } | null = null;
  if (!totp_enabled && totp_secret_enc) {
    const secret = decrypt(totp_secret_enc);
    const uri = new TOTP({ issuer: "Hustlers Labs", label: s.username, secret: Secret.fromBase32(secret) }).toString();
    setup = { qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), secret };
  }
  const codesLeft = totp_enabled ? await recoveryCodesLeft(s.userId) : 0;

  return (
    <>
      <BackLink href="/members/account">Back to Account</BackLink>
      <div className="tag">Account</div>
      <h1>Two-step login.</h1>
      <p className="sub">A code from an authenticator app at every sign-in, so your password alone is not enough.</p>

      {(await searchParams).admin === "1" && !totp_enabled && (
        <p className="error" role="alert" style={{ marginBottom: "1.5rem" }}>
          Admin pages need two-step login. Turn it on below to continue.
        </p>
      )}

      {totp_enabled ? (
        <>
          <p className="note">
            On. You are asked for a code from your authenticator app each time you sign in. Each code works once.
            {s.role === "admin" && " Admins must keep it on."}
          </p>

          <div className="section">
            <h2>Recovery codes</h2>
            <p className={codesLeft <= 2 ? "error" : "note"} style={{ marginBottom: "1rem" }}>
              {codesLeft} of {RECOVERY_CODE_COUNT} left.{" "}
              {codesLeft <= 2
                ? "Make new ones now so you do not get locked out if you lose your phone."
                : "Use one to sign in if you lose your phone."}
            </p>
            <RecoveryCodesForm />
          </div>

          {s.role !== "admin" && (
            <div className="section">
              <h2>Turn off two-step login</h2>
              <p className="note" style={{ marginBottom: "1rem" }}>
                Needs your password and a code. Anyone with your password could then sign in.
              </p>
              <DisableTotpForm />
            </div>
          )}
        </>
      ) : setup ? (
        <>
          <p className="note" style={{ marginBottom: "1rem" }}>
            Scan this with Google Authenticator, 1Password, Authy or similar. Then enter the 6-digit code it shows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="Two-step login QR code" width={220} height={220} className="qr" />
          <p className="note" style={{ margin: "0.75rem 0 1.25rem" }}>
            Can&apos;t scan? Enter this key manually: <span className="mono">{setup.secret.match(/.{1,4}/g)?.join(" ")}</span>
          </p>
          <ConfirmTotpForm />
          <form action={cancelTotpSetup} style={{ marginTop: "0.75rem" }}>
            <button className="btn ghost small" type="submit">
              Cancel setup
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="note" style={{ marginBottom: "1rem" }}>
            Off. {s.role === "admin" ? "Required for admins." : "Strongly recommended: without it, anyone with your password can sign in."}
          </p>
          <form action={startTotp}>
            <button className="btn" type="submit">
              Set up two-step login
            </button>
          </form>
        </>
      )}
    </>
  );
}
