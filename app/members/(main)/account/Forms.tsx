"use client";

import { startTransition, useActionState } from "react";
import { changePassword, confirmTotp, disableTotp, updateProjectDetails, type Msg } from "./actions";
import { SubmitButton } from "@/components/ui";
import ProjectFields, { type ProjectValues } from "@/components/ProjectFields";

function Feedback({ state }: { state: Msg }) {
  if (state?.error && !state.field) return <p className="error" role="alert">{state.error}</p>;
  if (state?.error) return <p className="error">Check the highlighted field above.</p>;
  if (state?.ok) return <p className="note" role="status">{state.ok}</p>;
  return null;
}

function CodeInput() {
  return (
    <label style={{ maxWidth: 220 }}>
      6-digit code
      <input name="code" className="mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
    </label>
  );
}

export function ConfirmTotpForm() {
  const [state, action] = useActionState(confirmTotp, undefined);
  return (
    <form action={action} className="stack" style={{ maxWidth: 400 }}>
      <CodeInput />
      <Feedback state={state} />
      <SubmitButton pending="Checking...">Turn on</SubmitButton>
    </form>
  );
}

export function DisableTotpForm() {
  const [state, action] = useActionState(disableTotp, undefined);
  return (
    <form action={action} className="stack" style={{ maxWidth: 400 }}>
      <CodeInput />
      <Feedback state={state} />
      <SubmitButton className="btn danger" pending="Checking...">Turn off two-step login</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="stack" style={{ maxWidth: 400 }}>
      <label>
        Current password
        <input name="current" type="password" autoComplete="current-password" required maxLength={256} />
      </label>
      <label>
        New password
        <input name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </label>
      <label>
        Confirm new password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </label>
      <Feedback state={state} />
      <SubmitButton pending="Saving...">Update password</SubmitButton>
    </form>
  );
}

export function ProjectDetailsForm({ values }: { values: ProjectValues }) {
  const [state, dispatch, pending] = useActionState(updateProjectDetails, undefined);
  return (
    <form
      className="stack narrow"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => dispatch(data));
      }}
    >
      <ProjectFields values={values} err={state?.error ? state : undefined} />
      <Feedback state={state} />
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Saving..." : "Save project details"}
      </button>
    </form>
  );
}
