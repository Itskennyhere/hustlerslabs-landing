"use client";

import { useActionState } from "react";
import { verifyTotp } from "../actions";
import { SubmitButton } from "@/components/ui";

export default function VerifyForm() {
  const [state, action] = useActionState(verifyTotp, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Code
        <input
          name="code"
          className="mono"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={14}
          required
          autoFocus
        />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Checking...">Verify</SubmitButton>
    </form>
  );
}
