import { hrefWith } from "@/lib/list";
import type { StatusCounts } from "@/lib/member-lists";
import { STATUS_LABEL, type MemberStatus } from "./card-parts";
import { Tabs } from "./list";

// Pieces shared by Admin > Members > Projects and Creators.

export const VIEWS = ["cards", "table"] as const;
export type View = (typeof VIEWS)[number];

export function StatusTabs({ base, params, current, counts }: { base: string; params: Record<string, string | number>; current: MemberStatus; counts: StatusCounts }) {
  return (
    <Tabs
      base={base}
      params={params}
      current={current}
      tabs={(["waiting", "approved", "declined", "disabled"] as const).map((t) => ({ value: t, label: STATUS_LABEL[t], count: counts[t] }))}
    />
  );
}

/** Cards / Table switch and the "Preview example card" link. Both keep every other param. */
export function ViewBar({ base, params, view, preview }: { base: string; params: Record<string, string | number>; view: View; preview: boolean }) {
  return (
    <div className="view-bar">
      <nav className="view-switch" aria-label="View">
        {VIEWS.map((v) => (
          <a key={v} href={hrefWith(base, { ...params, view: v === "cards" ? "" : v })} aria-current={view === v ? "page" : undefined}>
            {v === "cards" ? "Cards" : "Table"}
          </a>
        ))}
      </nav>
      <a className="view-preview" href={hrefWith(base, { ...params, preview: preview ? "" : "1" })}>
        {preview ? "Hide example card" : "Preview example card"}
      </a>
    </div>
  );
}

/** A grid of cards where each card links to the member page. */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="card-grid member-cards">{children}</div>;
}

/** The whole card opens the member page. A cover link, because cards already contain links of their own. */
export function CardLink({ id, label, children }: { id: number; label: string; children: React.ReactNode }) {
  return (
    <div className="card-link">
      {children}
      <a className="card-link-cover" href={`/admin/members/${id}`} aria-label={label} />
    </div>
  );
}
