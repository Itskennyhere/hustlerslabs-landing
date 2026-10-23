import QRCode from "qrcode";
import { TOTP, Secret } from "otpauth";
import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { cancelTotpSetup, startTotp } from "./actions";
import { ConfirmTotpForm, DisableTotpForm, PasswordForm } from "./Forms";

export default async function AccountPage() {
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
        <h2>Change password</h2>
        <PasswordForm />
      </div>
    </>
  );
}
