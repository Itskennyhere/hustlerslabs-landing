"use client";

import { useActionState } from "react";
import { becomeOwner, joinAdmin } from "./actions";
import { TextField } from "@/components/fields";
import { SubmitButton } from "@/components/ui";

export function AdminJoinForm() {
  const [state, action] = useActionState(joinAdmin, undefined);
  const err = state?.error ? state : undefined;
  return (
    <form action={action} className="stack">
      <TextField name="username" label="Username" required max={24} autoComplete="username" note="3 to 24 characters. Letters, numbers, underscores." err={err} />
      <TextField name="email" label="Email" type="email" required max={254} autoComplete="email" err={err} />
      <TextField name="password" label="Password" type="password" required max={128} autoComplete="new-password" note="At least 12 characters." err={err} />
      <TextField name="confirm" label="Confirm password" type="password" required max={128} autoComplete="new-password" err={err} />
      {state?.error && !state.field && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton pending="Creating account...">Create admin account</SubmitButton>
    </form>
  );
}

export function OwnerForm() {
  const [state, action] = useActionState(becomeOwner, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Admin email or username
        <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={256} />
      </label>
      <label>
        6-digit code from your app
        <input name="code" className="mono" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} />
      </label>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton pending="Checking...">Become the owner</SubmitButton>
    </form>
  );
}
