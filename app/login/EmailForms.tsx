"use client";

import { useActionState } from "react";
import { confirmEmail, requestReset, resetPassword } from "./email-actions";
import { SubmitButton } from "@/components/ui";

export function ForgotForm() {
  const [state, action] = useActionState(requestReset, undefined);
  if (state?.ok) return <p className="note" role="status">{state.ok}</p>;
  return (
    <form action={action} className="stack">
      <label>
        Username or email
        <input name="ident" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Sending...">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        <span className="note">At least 12 characters. A passphrase works well.</span>
      </label>
      <label>
        Confirm new password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Saving...">Set new password</SubmitButton>
    </form>
  );
}

export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, action] = useActionState(confirmEmail, undefined);
  if (state?.ok) {
    return (
      <>
        <p className="note" role="status">{state.ok}</p>
        <p className="alt"><a className="btn" href="/members">Continue</a></p>
      </>
    );
  }
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Confirming...">Confirm email</SubmitButton>
    </form>
  );
}
