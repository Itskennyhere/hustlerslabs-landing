"use client";

import { useActionState } from "react";
import { claimOwner } from "./actions";
import { SubmitButton } from "@/components/ui";

export default function OwnerForm() {
  const [state, action] = useActionState(claimOwner, undefined);
  return (
    <form action={action} className="stack narrow">
      <label>
        Owner key
        <input name="token" type="password" autoComplete="off" spellCheck={false} required maxLength={200} />
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
