"use client";

import { useActionState } from "react";
import { login, redeemInviteCode } from "./actions";
import { SubmitButton } from "@/components/ui";

export default function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Email or username
        <input
          name="username"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
        />
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

export function InviteCodeForm() {
  const [state, action] = useActionState(redeemInviteCode, undefined);
  return (
    <form action={action} className="invite-code">
      <label>
        Invite code
        <span className="invite-row">
          <input name="invite_code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={200} />
          <SubmitButton className="btn ghost" pending="Checking...">
            Confirm
          </SubmitButton>
        </span>
      </label>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
