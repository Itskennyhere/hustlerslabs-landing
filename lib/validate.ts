import "server-only";
import type { Option } from "./onboarding-options";

// Server-side form validation. Client-side checks are only a convenience; these are the real ones.

export class FieldError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

export const LIMITS = { name: 80, bio: 160, text: 500, handle: 40 } as const;

// Deliberately strict: plain addresses only, no comments, quotes or unicode tricks.
export const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
export const HANDLE_RE = /^[A-Za-z0-9_.]{1,40}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function raw(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function text(form: FormData, name: string, label: string, max: number, required = true): string | null {
  const v = raw(form, name);
  if (!v) {
    if (required) throw new FieldError(name, `${label} is required.`);
    return null;
  }
  if (v.length > max) throw new FieldError(name, `${label} must be ${max} characters or fewer.`);
  return v;
}

export function one(form: FormData, name: string, label: string, list: readonly Option[], required = true): string | null {
  const v = raw(form, name);
  if (!v) {
    if (required) throw new FieldError(name, `Choose ${label.toLowerCase()}.`);
    return null;
  }
  if (!list.some((o) => o.value === v)) throw new FieldError(name, `Pick a valid option for ${label.toLowerCase()}.`);
  return v;
}

export function many(
  form: FormData,
  name: string,
  label: string,
  list: readonly Option[],
  { min = 0, max = list.length }: { min?: number; max?: number } = {},
): string[] {
  const values = form.getAll(name).map((v) => (typeof v === "string" ? v.trim() : ""));
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.some((v) => !list.some((o) => o.value === v))) {
    throw new FieldError(name, `Pick valid options for ${label.toLowerCase()}.`);
  }
  if (unique.length < min) throw new FieldError(name, `Choose at least ${min} for ${label.toLowerCase()}.`);
  if (unique.length > max) throw new FieldError(name, `Choose up to ${max} for ${label.toLowerCase()}.`);
  return unique;
}

export function email(form: FormData, name: string, label: string): string {
  const v = text(form, name, label, LIMITS.name)!;
  if (!EMAIL_RE.test(v)) throw new FieldError(name, `${label} must be a valid email address.`);
  return v.toLowerCase();
}

export function httpsUrl(form: FormData, name: string, label: string): string {
  const v = text(form, name, label, 200)!;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new FieldError(name, `${label} must be a full https:// link.`);
  }
  if (u.protocol !== "https:" || !u.hostname.includes(".")) {
    throw new FieldError(name, `${label} must be a full https:// link.`);
  }
  return u.toString();
}

/** A social handle, stored without a leading @. */
export function handleValue(v: string, field: string, label: string): string {
  const clean = v.trim().replace(/^@/, "");
  if (!HANDLE_RE.test(clean)) {
    throw new FieldError(field, `${label} can only use letters, numbers, underscores and dots (max 40).`);
  }
  return clean;
}

export function handle(form: FormData, name: string, label: string): string {
  const v = raw(form, name);
  if (!v) throw new FieldError(name, `${label} is required.`);
  return handleValue(v, name, label);
}

export function contract(form: FormData, name: string): string | null {
  const v = raw(form, name);
  if (!v) return null;
  if (!EVM_RE.test(v) && !BASE58_RE.test(v)) {
    throw new FieldError(name, "Token contract must be a 0x address or a Solana-style base58 address.");
  }
  return v;
}

export function date(form: FormData, name: string, label: string): string | null {
  const v = raw(form, name);
  if (!v) return null;
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v))) throw new FieldError(name, `${label} must be a valid date.`);
  return v;
}
