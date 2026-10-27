"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { join } from "./actions";
import { TextField } from "@/components/fields";
import ProjectFields, { PROJECT_FIELD_NAMES, type ProjectValues } from "@/components/ProjectFields";

type Type = "project" | "creator" | "";
const ACCOUNT_FIELDS = ["invite", "username", "password", "confirm"];

function stepForField(field: string | undefined): number | null {
  if (!field) return null;
  if (field === "account_type") return 1;
  if (ACCOUNT_FIELDS.includes(field)) return 2;
  return 3;
}

function Hidden({ values }: { values: Record<string, string | string[] | null | undefined> }) {
  return (
    <>
      {Object.entries(values).flatMap(([name, v]) =>
        (Array.isArray(v) ? v : v ? [v] : []).map((x, i) => <input key={`${name}-${i}`} type="hidden" name={name} value={x} />),
      )}
    </>
  );
}

export default function JoinForm() {
  const [state, dispatch, pending] = useActionState(join, undefined);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<Type>("");
  const [account, setAccount] = useState<Record<string, string>>({});
  const [project, setProject] = useState<ProjectValues>({});

  const totalSteps = type === "creator" ? 2 : 3;
  const last = step === totalSteps;

  // On a server error, go back to the step that holds the bad field.
  useEffect(() => {
    const s = stepForField(state?.field);
    if (s) setStep(s);
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!last) {
      setStep(step + 1);
      return;
    }
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  }

  const err = state?.error ? state : undefined;
  const setA = (n: string) => (v: string) => setAccount((a) => ({ ...a, [n]: v }));

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="steps" aria-label={`Step ${step} of ${totalSteps}`}>
        <span className="mono">
          Step {step} of {totalSteps}
        </span>
        <div className="progress">
          <span style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>

      {step === 1 ? (
        <fieldset className="choices">
          <legend>Which best describes you?</legend>
          <button
            type="button"
            className={`choice-card${type === "project" ? " on" : ""}`}
            aria-pressed={type === "project"}
            onClick={() => {
              setType("project");
              setStep(2);
            }}
          >
            <strong>I&apos;m building a project</strong>
            <span>For founders and teams. Set up a workspace and unlock tools.</span>
          </button>
          <button
            type="button"
            className={`choice-card${type === "creator" ? " on" : ""}`}
            aria-pressed={type === "creator"}
            onClick={() => {
              setType("creator");
              setStep(2);
            }}
          >
            <strong>I&apos;m a creator or KOL</strong>
            <span>Free. Build your creator card and get matched with projects.</span>
          </button>
          {state?.field === "account_type" && <p className="error" role="alert">{state.error}</p>}
        </fieldset>
      ) : (
        <input type="hidden" name="account_type" value={type} />
      )}

      {step === 2 ? (
        <>
          <h2 className="step-title">Your account</h2>
          <TextField name="invite" label="Invite key" required max={40} placeholder="HL-XXXX-XXXX-XXXX-XXXX" defaultValue={account.invite} onChange={setA("invite")} err={err} />
          <TextField
            name="username"
            label="Username"
            required
            max={24}
            autoComplete="username"
            note="3 to 24 characters. Letters, numbers, underscores."
            defaultValue={account.username}
            onChange={setA("username")}
            err={err}
          />
          <TextField
            name="password"
            label="Password"
            type="password"
            required
            max={128}
            autoComplete="new-password"
            note="At least 12 characters. A passphrase works well."
            defaultValue={account.password}
            onChange={setA("password")}
            err={err}
          />
          <TextField name="confirm" label="Confirm password" type="password" required max={128} autoComplete="new-password" defaultValue={account.confirm} onChange={setA("confirm")} err={err} />
        </>
      ) : (
        <Hidden values={Object.fromEntries(ACCOUNT_FIELDS.map((n) => [n, account[n]]))} />
      )}

      {type === "project" &&
        (step === 3 ? (
          <>
            <h2 className="step-title">Tell us about your project</h2>
            <ProjectFields values={project} onChange={(n, v) => setProject((p) => ({ ...p, [n]: v }))} err={err} />
          </>
        ) : (
          <Hidden values={Object.fromEntries(PROJECT_FIELD_NAMES.map((n) => [n, project[n]]))} />
        ))}

      {state?.error && !state.field && <p className="error" role="alert">{state.error}</p>}

      {step > 1 && (
        <div className="step-actions">
          <button type="button" className="btn ghost" onClick={() => setStep(step - 1)} disabled={pending}>
            Back
          </button>
          <button type="submit" className="btn" disabled={pending}>
            {last ? (pending ? "Creating account..." : "Create account") : "Continue"}
          </button>
        </div>
      )}
    </form>
  );
}
