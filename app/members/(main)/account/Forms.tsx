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

const BACK = "/members/account";

function Feedback({ state }: { state: Msg }) {
  if (state?.error) return <p className="error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="note" role="status">{state.ok}</p>;
  return null;
}

/** App code, or a recovery code where `recovery` is set. */
function CodeInput({ recovery = false }: { recovery?: boolean }) {
  return (
    <label>
      {recovery ? "6-digit code from your app, or a recovery code" : "6-digit code from your app"}
      <input
        name="code"
        className="mono"
        inputMode={recovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={recovery ? 14 : 7}
        required
      />
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

function Done({ state }: { state: Msg }) {
  return (
    <div className="stack">
      <p className="note" role="status">
        {state?.ok}
      </p>
      <a className="btn ghost" href={BACK}>
        Back to Account
      </a>
    </div>
  );
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
          <a className="btn small" href="/members/account/two-step">
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
        <p className="note" role="status" style={{ marginBottom: "1rem" }}>
          {state.ok}
        </p>
        <RecoveryCodes codes={state.codes} done />
      </>
    );
  }
  return (
    <form action={action} className="stack narrow">
      <CodeInput />
      <Feedback state={state} />
      <SubmitButton pending="Checking...">Turn on</SubmitButton>
    </form>
  );
}

export function DisableTotpForm() {
  const [state, action] = useActionState(disableTotp, undefined);
  if (state?.ok) return <Done state={state} />;
  return (
    <form action={action} className="stack narrow">
      <CurrentPassword />
      <CodeInput recovery />
      <Feedback state={state} />
      <SubmitButton className="btn danger" pending="Checking...">
        Turn off two-step login
      </SubmitButton>
    </form>
  );
}

export function RecoveryCodesForm() {
  const [state, action] = useActionState(regenerateRecoveryCodes, undefined);
  return (
    <>
      {state?.codes && <RecoveryCodes codes={state.codes} />}
      <form action={action} className="stack narrow">
        <CurrentPassword />
        <CodeInput />
        <Feedback state={state} />
        <SubmitButton className="btn ghost" pending="Making codes...">
          Make new recovery codes
        </SubmitButton>
      </form>
    </>
  );
}

export function PasswordForm({ needsCode }: { needsCode: boolean }) {
  const [state, action] = useActionState(changePassword, undefined);
  if (state?.ok) return <Done state={state} />;
  return (
    <form action={action} className="stack narrow">
      <CurrentPassword />
      <label>
        New password
        <input name="new_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        <span className="note">At least 12 characters. Passwords found in known data breaches are refused.</span>
      </label>
      <label>
        Confirm new password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </label>
      {needsCode && <CodeInput recovery />}
      <Feedback state={state} />
      <SubmitButton pending="Saving...">Update password</SubmitButton>
    </form>
  );
}

export function EmailForm({ current, needsCode }: { current: string | null; needsCode: boolean }) {
  const [state, action] = useActionState(sendEmailLink, undefined);
  return (
    <form action={action} className="stack narrow">
      <label>
        {current ? "New email" : "Email"}
        <input name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={state?.field === "email" || undefined} />
      </label>
      <CurrentPassword />
      {needsCode && <CodeInput recovery />}
      <Feedback state={state} />
      <SubmitButton pending="Sending...">Send confirmation link</SubmitButton>
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
      {state?.error && state.field ? <p className="error">Check the highlighted field above.</p> : <Feedback state={state} />}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Saving..." : "Save project details"}
      </button>
    </form>
  );
}
