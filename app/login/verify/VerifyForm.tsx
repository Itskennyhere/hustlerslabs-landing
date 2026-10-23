"use client";

import { useActionState } from "react";
import { verifyTotp } from "../actions";
import { SubmitButton } from "@/components/ui";

export default function VerifyForm() {
  const [state, action] = useActionState(verifyTotp, undefined);
  return (
    <form action={action} className="stack">
      <label>
        6-digit code
        <input
          name="code"
          className="mono"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
        />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Checking...">Verify</SubmitButton>
    </form>
  );
}
