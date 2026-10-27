"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { SubmitButton } from "@/components/ui";

export default function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Email
        <input
          name="username"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          placeholder="you@example.com"
        />
        <span className="field-note">No confirmed email yet? Use your username.</span>
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={256} />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Signing in...">Sign in</SubmitButton>
    </form>
  );
}
