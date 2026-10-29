"use client";

import { useState } from "react";
import type { Option } from "@/lib/onboarding-options";

// Small form controls shared by sign-up, profile and workspace forms.
// Each keeps its own state from `defaultValue` and reports changes through `onChange`,
// so a parent can remember values while steps mount and unmount.

export type FormErr = { field?: string; error?: string } | undefined;

function FieldError({ name, err }: { name: string; err: FormErr }) {
  if (!err?.error || err.field !== name) return null;
  return (
    <span className="error" role="alert">
      {err.error}
    </span>
  );
}

export function TextField({
  name,
  label,
  defaultValue = "",
  onChange,
  err,
  required = false,
  max,
  type = "text",
  placeholder,
  note,
  textarea = false,
  counter = false,
  autoComplete = "off",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  err?: FormErr;
  required?: boolean;
  max?: number;
  type?: string;
  placeholder?: string;
  note?: string;
  textarea?: boolean;
  counter?: boolean;
  autoComplete?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const props = {
    name,
    value,
    required,
    maxLength: max,
    placeholder,
    autoComplete,
    "aria-invalid": err?.field === name || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value);
      onChange?.(e.target.value);
    },
  };
  return (
    <label>
      <span>
        {label}
        {required && " *"}
      </span>
      {textarea ? <textarea rows={3} {...props} /> : <input type={type} {...props} />}
      {(note || (counter && max)) && (
        <span className="note field-note">
          <span>{note}</span>
          {counter && max && (
            <span className="mono">
              {value.length}/{max}
            </span>
          )}
        </span>
      )}
      <FieldError name={name} err={err} />
    </label>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue = "",
  onChange,
  err,
  required = false,
}: {
  name: string;
  label: string;
  options: readonly Option[];
  defaultValue?: string;
  onChange?: (v: string) => void;
  err?: FormErr;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label>
      <span>
        {label}
        {required && " *"}
      </span>
      <select
        name={name}
        value={value}
        required={required}
        aria-invalid={err?.field === name || undefined}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
      >
        <option value="">{required ? "Choose one" : "Not specified"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError name={name} err={err} />
    </label>
  );
}

/** Pill-style checkboxes (multiple) or radios (single). */
export function Pills({
  name,
  label,
  options,
  defaultValue = [],
  onChange,
  err,
  multiple = true,
  max,
  required = false,
  note,
}: {
  name: string;
  label: string;
  options: readonly Option[];
  defaultValue?: string[];
  onChange?: (v: string[]) => void;
  err?: FormErr;
  multiple?: boolean;
  max?: number;
  required?: boolean;
  note?: string;
}) {
  const [value, setValue] = useState<string[]>(defaultValue);
  const full = multiple && max !== undefined && value.length >= max;
  function toggle(v: string) {
    const next = multiple ? (value.includes(v) ? value.filter((x) => x !== v) : [...value, v]) : [v];
    setValue(next);
    onChange?.(next);
  }
  return (
    <fieldset className="pills-field" aria-invalid={err?.field === name || undefined}>
      <legend>
        {label}
        {required && " *"}
        {max !== undefined && multiple && <span className="note"> (max {max})</span>}
      </legend>
      <div className="pills">
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label key={o.value} className={`choice-pill${checked ? " on" : ""}`}>
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                checked={checked}
                disabled={!checked && full}
                onChange={() => toggle(o.value)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {note && <span className="note">{note}</span>}
      <FieldError name={name} err={err} />
    </fieldset>
  );
}
