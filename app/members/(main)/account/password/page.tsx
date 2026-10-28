import { requireMember } from "@/lib/auth";
import { BackLink } from "@/components/list";
import { PasswordForm } from "../Forms";

export default async function PasswordPage() {
  const s = await requireMember();
  return (
    <>
      <BackLink href="/members/account">Back to Account</BackLink>
      <div className="tag">Account</div>
      <h1>Password.</h1>
      <p className="sub">
        Changing it signs out every other device.
        {s.totpEnabled && " You also need a code from your authenticator app, or a recovery code."}
      </p>
      <PasswordForm needsCode={s.totpEnabled} />
    </>
  );
}
