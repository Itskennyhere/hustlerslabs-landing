"use client";

import { useState } from "react";
import { BUDGETS, CHAINS, FUNDING, PROJECT_CATEGORIES, STAGES, TEAM_SIZES } from "@/lib/onboarding-options";
import { Pills, SelectField, TextField, type FormErr } from "./fields";

export type ProjectValues = Record<string, string | string[] | null | undefined>;

export const PROJECT_FIELD_NAMES = [
  "project_name", "website", "x_handle", "category", "chains", "stage", "token_contract", "funding_stage",
  "backers", "team_size", "budget_band", "contact_name", "contact_role", "contact_email", "contact_telegram",
];

/** Sign-up project questions. Used in /join step 3 and in Account > Project details. */
export default function ProjectFields({
  values,
  onChange,
  err,
}: {
  values: ProjectValues;
  onChange?: (name: string, v: string | string[]) => void;
  err?: FormErr;
}) {
  const [stage, setStage] = useState(String(values.stage ?? ""));
  const s = (n: string) => (typeof values[n] === "string" ? (values[n] as string) : "");
  const set = (n: string) => (v: string | string[]) => onChange?.(n, v);

  return (
    <>
      <TextField name="project_name" label="Project name" required max={80} defaultValue={s("project_name")} onChange={set("project_name")} err={err} />
      <TextField name="website" label="Website" required type="url" max={200} placeholder="https://" defaultValue={s("website")} onChange={set("website")} err={err} />
      <TextField name="x_handle" label="X handle" required max={41} placeholder="@yourproject" defaultValue={s("x_handle")} onChange={set("x_handle")} err={err} />
      <SelectField name="category" label="Category" required options={PROJECT_CATEGORIES} defaultValue={s("category")} onChange={set("category")} err={err} />
      <Pills name="chains" label="Chains" required options={CHAINS} defaultValue={(values.chains as string[]) ?? []} onChange={set("chains")} err={err} />
      <SelectField
        name="stage"
        label="Stage"
        required
        options={STAGES}
        defaultValue={stage}
        onChange={(v) => {
          setStage(v);
          onChange?.("stage", v);
        }}
        err={err}
      />
      {stage === "token_live" && (
        <TextField
          name="token_contract"
          label="Token contract address"
          max={44}
          note="Optional. A 0x address or a Solana address."
          defaultValue={s("token_contract")}
          onChange={set("token_contract")}
          err={err}
        />
      )}
      <SelectField name="funding_stage" label="Funding stage" required options={FUNDING} defaultValue={s("funding_stage")} onChange={set("funding_stage")} err={err} />
      <TextField name="backers" label="Notable backers or partners" max={500} note="Optional." defaultValue={s("backers")} onChange={set("backers")} err={err} />
      <SelectField name="team_size" label="Team size" required options={TEAM_SIZES} defaultValue={s("team_size")} onChange={set("team_size")} err={err} />
      <SelectField name="budget_band" label="Monthly marketing budget (USD)" required options={BUDGETS} defaultValue={s("budget_band")} onChange={set("budget_band")} err={err} />

      <fieldset className="group">
        <legend>Decision maker</legend>
        <TextField name="contact_name" label="Name" required max={80} defaultValue={s("contact_name")} onChange={set("contact_name")} err={err} />
        <TextField name="contact_role" label="Role" required max={80} defaultValue={s("contact_role")} onChange={set("contact_role")} err={err} />
        <TextField name="contact_email" label="Email" required type="email" max={80} defaultValue={s("contact_email")} onChange={set("contact_email")} err={err} />
        <TextField name="contact_telegram" label="Telegram" required max={41} placeholder="@handle" defaultValue={s("contact_telegram")} onChange={set("contact_telegram")} err={err} />
      </fieldset>
    </>
  );
}
