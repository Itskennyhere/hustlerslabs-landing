"use client";

import { startTransition, useActionState } from "react";
import { saveBuying, saveGoals, saveMarketing, type SectionState } from "./actions";
import { Pills, SelectField, TextField, type FormErr } from "@/components/fields";
import {
  AUDIENCE_BANDS,
  CHANNELS,
  GOALS,
  MARKETING_OWNERS,
  MAX_GOALS,
  MAX_TOOLS,
  PAYMENT_PREFS,
  TOOLS,
  TRIED,
} from "@/lib/onboarding-options";

type Action = (s: SectionState, f: FormData) => Promise<SectionState>;
type Values = Record<string, string | string[] | null>;

function SectionForm({ action, children }: { action: Action; children: (err: FormErr) => React.ReactNode }) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  return (
    <form
      className="stack narrow"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => dispatch(data));
      }}
    >
      {children(state?.error ? state : undefined)}
      {state?.error && !state.field && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="step-actions">
        <a className="btn ghost" href="/members/workspace">
          Back
        </a>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving..." : "Save section"}
        </button>
      </div>
    </form>
  );
}

const str = (v: string | string[] | null | undefined) => (typeof v === "string" ? v : "");
const arr = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v : []);

export function GoalsForm({ values }: { values: Values }) {
  return (
    <SectionForm action={saveGoals}>
      {(err) => (
        <>
          <Pills name="goals" label="Main goals right now" options={GOALS} max={MAX_GOALS} defaultValue={arr(values.goals)} err={err} />
          <div className="row">
            <TextField name="key_date" label="Key date" type="date" note="Optional. A launch, TGE or deadline." defaultValue={str(values.key_date)} err={err} />
            <TextField name="key_date_note" label="What happens then" max={80} note="Optional." defaultValue={str(values.key_date_note)} err={err} />
          </div>
          <TextField name="blocker" label="Biggest blocker" textarea max={500} defaultValue={str(values.blocker)} err={err} />
          <TextField name="success_90d" label="What does success look like in 90 days?" textarea required max={500} defaultValue={str(values.success_90d)} err={err} />
        </>
      )}
    </SectionForm>
  );
}

export function MarketingForm({ values }: { values: Values }) {
  return (
    <SectionForm action={saveMarketing}>
      {(err) => (
        <>
          <SelectField name="marketing_owner" label="Who handles marketing" required options={MARKETING_OWNERS} defaultValue={str(values.marketing_owner)} err={err} />
          <Pills name="channels" label="Channels you use" required options={CHANNELS} defaultValue={arr(values.channels)} err={err} />
          <SelectField name="x_followers_band" label="X followers" options={AUDIENCE_BANDS} defaultValue={str(values.x_followers_band)} err={err} />
          <SelectField name="community_band" label="Community members" options={AUDIENCE_BANDS} defaultValue={str(values.community_band)} err={err} />
          <Pills name="tried" label="What you have tried" options={TRIED} defaultValue={arr(values.tried)} err={err} />
        </>
      )}
    </SectionForm>
  );
}

export function BuyingForm({ values }: { values: Values }) {
  return (
    <SectionForm action={saveBuying}>
      {(err) => (
        <>
          <Pills name="wanted_tools" label="Tools that would help most" options={TOOLS} max={MAX_TOOLS} defaultValue={arr(values.wanted_tools)} err={err} />
          <Pills
            name="payment_pref"
            label="How would you prefer to pay"
            multiple={false}
            options={PAYMENT_PREFS}
            defaultValue={values.payment_pref ? [str(values.payment_pref)] : []}
            err={err}
          />
        </>
      )}
    </SectionForm>
  );
}
