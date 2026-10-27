"use client";

import { useActionState } from "react";
import { resendEmailCode, verifyEmailCode } from "../actions";
import { SubmitButton } from "@/components/ui";

export default function EmailCodeForm() {
  const [state, action] = useActionState(verifyEmailCode, undefined);
  const [resent, resend] = useActionState(resendEmailCode, undefined);
  return (
    <>
      <form action={action} className="stack">
        <label>
          Email code
          <input
            name="code"
            className="mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            autoFocus
          />
        </label>
        {state?.error && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}
        <SubmitButton pending="Checking...">Verify</SubmitButton>
      </form>
      <form action={resend} className="alt">
        {resent?.error && (
          <p className="error" role="alert">
            {resent.error}
          </p>
        )}
        {resent?.ok && (
          <p className="note" role="status">
            {resent.ok}
          </p>
        )}
        <SubmitButton className="btn ghost small" pending="Sending...">
          Send a new code
        </SubmitButton>
      </form>
    </>
  );
}
