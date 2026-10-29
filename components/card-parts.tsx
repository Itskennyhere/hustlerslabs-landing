// Shared pieces of the ID cards (creator, project, investor). Server-safe, no client JS.

export type MemberStatus = "waiting" | "approved" | "declined" | "disabled";

export const STATUS_LABEL: Record<MemberStatus, string> = {
  waiting: "Waiting for approval",
  approved: "Approved",
  declined: "Declined",
  disabled: "Disabled",
};

/** No. 0042 */
export const cardNo = (n: number | null | undefined) => (n ? `No. ${String(n).padStart(4, "0")}` : "No. ----");

const monthYear = (d: string | Date | null | undefined) =>
  new Date(d ?? Date.now()).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export const since = (d: string | Date | null | undefined) => `Since ${monthYear(d)}`;
export const joined = (d: string | Date | null | undefined) =>
  `Joined ${new Date(d ?? Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;

export function Mark() {
  return (
    <svg width="14" height="14" viewBox="0 0 160 160" aria-hidden="true">
      <rect x="10" y="10" width="18" height="140" rx="3" fill="#0a0a0a" />
      <rect x="132" y="10" width="18" height="140" rx="3" fill="#0a0a0a" />
      <polygon points="28,68 150,50 150,72 28,90" fill="#5BDD2F" />
    </svg>
  );
}

/** "HUSTLERS LABS <TYPE>" and the number. */
export function CardStrip({ type, no }: { type: string; no: string }) {
  return (
    <header className="ccard-strip">
      <span className="ccard-brand">
        <Mark />
        Hustlers Labs {type}
      </span>
      <span>{no}</span>
    </header>
  );
}

export function VerifiedTick() {
  return (
    <span className="verified" role="img" aria-label="Verified by Hustlers Labs" title="Verified by Hustlers Labs">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="#5BDD2F" />
        <path d="M4.5 8.2 7 10.5l4.5-5" stroke="#0a0a0a" strokeWidth="1.6" fill="none" />
      </svg>
    </span>
  );
}

/** Admin views only: where the account stands. */
export function StatusChip({ status }: { status: MemberStatus }) {
  return <span className={`status-chip ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Stats({ cells }: { cells: [string, string][] }) {
  return (
    <dl className="ccard-stats">
      {cells.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="ccard-tags">
      {tags.map((t) => (
        <span key={t} className="tagchip">
          {t}
        </span>
      ))}
    </div>
  );
}

/** Example cards: a diagonal EXAMPLE label and a caption. Never a link. */
export function ExampleFrame({ children }: { children: React.ReactNode }) {
  return (
    <figure className="example-card">
      <div className="example-inner">
        <span className="example-ribbon" aria-hidden="true">
          Example
        </span>
        {children}
      </div>
      <figcaption className="note">Example only. Not a real member.</figcaption>
    </figure>
  );
}
