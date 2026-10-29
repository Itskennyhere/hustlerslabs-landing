// Query-string helpers for list pages. Every value is checked against an allowlist or capped,
// and goes into SQL only as a bound parameter.

export const PAGE_SIZE = 25;
const MAX_PAGE = 400;

export type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** One of `allowed`, or `fallback`. */
export function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const s = one(v) as T;
  return allowed.includes(s) ? s : fallback;
}

/** Allowed values for an optional filter: "" (any) plus every option value. */
export const anyOf = <T extends { value: string }>(list: readonly T[]) => ["", ...list.map((o) => o.value)] as T["value"][];

/** Free-text search: trimmed, at most 80 characters. */
export function searchText(v: string | string[] | undefined): string {
  return one(v).trim().slice(0, 80);
}

/** Page number from 1 to MAX_PAGE. */
export function pageNumber(v: string | string[] | undefined): number {
  const n = Number.parseInt(one(v), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_PAGE) : 1;
}

export const offsetFor = (page: number) => (page - 1) * PAGE_SIZE;
export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));

/** Link to `base` with `params`, minus empty values. Page 1 is left out. */
export function hrefWith(base: string, params: Record<string, string | number>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === "" || (k === "page" && Number(v) === 1)) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

const DATE_OPTS: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" };
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", DATE_OPTS) : "-");
export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-GB", { ...DATE_OPTS, year: undefined, hour: "2-digit", minute: "2-digit" }) : "-";

/** "3 days ago", "just now". */
export function ago(d: string | Date | null | undefined): string {
  if (!d) return "never";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [secs, name] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
