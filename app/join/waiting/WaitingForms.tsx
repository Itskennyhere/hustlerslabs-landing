"use client";

import { useActionState } from "react";
import { changeSignupEmail, resendConfirm } from "./actions";
import { SubmitButton } from "@/components/ui";

export function ResendForm() {
  const [state, action] = useActionState(resendConfirm, undefined);
  return (
    <form action={action} className="stack">
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.ok && <p className="note" role="status">{state.ok}</p>}
      <SubmitButton className="btn ghost" pending="Sending...">
        Send the link again
      </SubmitButton>
    </form>
  );
}

export function ChangeEmailForm() {
  const [state, action] = useActionState(changeSignupEmail, undefined);
  return (
    <form action={action} className="stack">
      <label>
        New email
        <input name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>
      <label>
        Your password
        <input name="current_password" type="password" autoComplete="current-password" required maxLength={256} />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.ok && <p className="note" role="status">{state.ok}</p>}
      <SubmitButton className="btn ghost" pending="Sending...">
        Use this email
      </SubmitButton>
    </form>
  );
}
