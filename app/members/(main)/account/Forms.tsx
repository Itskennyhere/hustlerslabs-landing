"use client";

import { startTransition, useActionState, useState } from "react";
import {
  changePassword,
  confirmTotp,
  disableTotp,
  regenerateRecoveryCodes,
  sendEmailLink,
  updateProjectDetails,
  type Msg,
} from "./actions";
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

function CurrentPassword() {
  return (
    <label>
      Current password
      <input name="current_password" type="password" autoComplete="current-password" required maxLength={256} />
    </label>
  );
}

function Plain({ state }: { state: Msg }) {
  if (state?.error) return <p className="error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="note" role="status">{state.ok}</p>;
  return null;
}

/** Shown once, right after the codes are made. Only their hashes are stored. */
export function RecoveryCodes({ codes, done }: { codes: string[]; done?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="codes-box" role="status">
      <p className="codes-title">Save these recovery codes now</p>
      <p className="note">
        If you lose your phone, each code lets you sign in once. Keep them somewhere safe, like a password manager. You will
        not see them again.
      </p>
      <ol className="codes mono">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="row">
        <button
          type="button"
          className="btn ghost small"
          onClick={() => navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true), () => {})}
        >
          {copied ? "Copied" : "Copy codes"}
        </button>
        {done && (
          <a className="btn small" href="/members/account">
            I have saved them
          </a>
        )}
      </div>
    </div>
  );
}

export function ConfirmTotpForm() {
  const [state, action] = useActionState(confirmTotp, undefined);
  if (state?.codes) {
    return (
      <>
        <p className="note" role="status" style={{ marginBottom: "1rem" }}>{state.ok}</p>
        <RecoveryCodes codes={state.codes} done />
      </>
    );
  }
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
      <CurrentPassword />
      <CodeInput />
      <Plain state={state} />
      <SubmitButton className="btn danger" pending="Checking...">Turn off two-step login</SubmitButton>
    </form>
  );
}

export function RecoveryCodesForm() {
  const [state, action] = useActionState(regenerateRecoveryCodes, undefined);
  return (
    <>
      {state?.codes && <RecoveryCodes codes={state.codes} />}
      <form action={action} className="stack" style={{ maxWidth: 400 }}>
        <CurrentPassword />
        <CodeInput />
        <Plain state={state} />
        <SubmitButton className="btn ghost" pending="Making codes...">Make new recovery codes</SubmitButton>
      </form>
    </>
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

export function EmailForm({ current }: { current: string | null }) {
  const [state, action] = useActionState(sendEmailLink, undefined);
  return (
    <form action={action} className="stack" style={{ maxWidth: 400 }}>
      <label>
        {current ? "New email" : "Email"}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          aria-invalid={state?.field === "email" || undefined}
        />
      </label>
      <CurrentPassword />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.ok && <p className="note" role="status">{state.ok}</p>}
      <SubmitButton pending="Sending...">Send confirmation link</SubmitButton>
    </form>
  );
}
