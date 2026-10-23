"use client";

import { useActionState } from "react";
import { runSetup } from "./actions";
import { SubmitButton } from "@/components/ui";

export default function SetupForm() {
  const [state, action] = useActionState(runSetup, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Setup token
        <input name="token" type="password" className="mono" autoComplete="off" required />
      </label>
      <label>
        Admin username
        <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={24} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </label>
      <label>
        Confirm password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Setting up...">Create admin</SubmitButton>
    </form>
  );
}
