"use client";

import { useActionState } from "react";
import { join } from "./actions";
import { SubmitButton } from "@/components/ui";

export default function JoinForm() {
  const [state, action] = useActionState(join, undefined);
  return (
    <form action={action} className="stack" key={JSON.stringify(state?.values ?? {})}>
      <label>
        Invite key
        <input
          name="invite"
          defaultValue={state?.values?.invite}
          className="mono"
          placeholder="HL-XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          maxLength={40}
          aria-invalid={state?.field === "invite"}
        />
      </label>
      <label>
        Username
        <input
          name="username"
          defaultValue={state?.values?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={24}
          pattern="[a-zA-Z0-9_]{3,24}"
          aria-invalid={state?.field === "username"}
        />
        <span className="note">3 to 24 characters. Letters, numbers, underscores.</span>
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          aria-invalid={state?.field === "password"}
        />
        <span className="note">At least 12 characters. A passphrase works well.</span>
      </label>
      <label>
        Confirm password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          aria-invalid={state?.field === "confirm"}
        />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton pending="Creating account...">Create account</SubmitButton>
    </form>
  );
}
