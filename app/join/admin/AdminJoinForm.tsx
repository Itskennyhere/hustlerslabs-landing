"use client";

import { useActionState } from "react";
import { joinAdmin } from "./actions";
import { TextField } from "@/components/fields";
import { SubmitButton } from "@/components/ui";

export default function AdminJoinForm() {
  const [state, action] = useActionState(joinAdmin, undefined);
  const err = state?.error ? state : undefined;
  return (
    <form action={action} className="stack">
      <TextField name="key" label="Admin key" required max={40} placeholder="HL-XXXX-XXXX-XXXX-XXXX" err={err} />
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
