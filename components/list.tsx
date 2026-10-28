import { hrefWith, pageCount, plural } from "@/lib/list";

// Shared building blocks for overview and list pages. Server components, no client JS.

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="back" href={href}>
      <span aria-hidden="true">&larr; </span>
      {children}
    </a>
  );
}

/** Overview tile: a big number that links to its page. */
export function Tile({ href, title, value, note }: { href: string; title: string; value: string | number; note?: string }) {
  return (
    <a className="tile" href={href}>
      <span className="tile-title">{title}</span>
      <span className="tile-value">{value}</span>
      {note && <span className="tile-note">{note}</span>}
    </a>
  );
}

/** Settings row: title, one-line status and a Manage link. */
export function SettingsRow({ href, title, status, action = "Manage" }: { href: string; title: string; status: React.ReactNode; action?: string }) {
  return (
    <li>
      <a className="settings-row" href={href}>
        <span className="settings-text">
          <span className="settings-title">{title}</span>
          <span className="settings-status">{status}</span>
        </span>
        <span className="settings-action">{action}</span>
      </a>
    </li>
  );
}

export function Tabs({
  base,
  params,
  current,
  tabs,
  name = "tab",
}: {
  base: string;
  params: Record<string, string | number>;
  current: string;
  tabs: readonly { value: string; label: string; count?: number }[];
  name?: string;
}) {
  return (
    <nav className="tabs" aria-label="Filter">
      {tabs.map((t) => (
        <a key={t.value} href={hrefWith(base, { ...params, [name]: t.value, page: 1 })} aria-current={t.value === current ? "page" : undefined}>
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </a>
      ))}
    </nav>
  );
}

/**
 * Search box and filters as a plain GET form, so everything lives in the URL.
 * `keep` holds params that are not fields in this form (for example the current tab).
 */
export function ListSearch({
  base,
  q,
  placeholder,
  keep = {},
  children,
}: {
  base: string;
  q: string;
  placeholder: string;
  keep?: Record<string, string>;
  children?: React.ReactNode;
}) {
  return (
    <form className="list-search" method="get" action={base} role="search">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="list-q">
        <span className="sr-only">Search</span>
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} maxLength={80} />
      </label>
      {children}
      <div className="list-buttons">
        <button type="submit" className="btn small">
          Search
        </button>
        <a className="btn ghost small" href={hrefWith(base, keep)}>
          Clear
        </a>
      </div>
    </form>
  );
}

export function FilterSelect({
  name,
  label,
  value,
  options,
  any = "Any",
}: {
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  any?: string | null;
}) {
  return (
    <label className="list-filter">
      {label}
      <select name={name} defaultValue={value}>
        {any !== null && <option value="">{any}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** "142 members", above the table. */
export function ListTotal({ total, one, many }: { total: number; one: string; many?: string }) {
  return (
    <p className="list-total" role="status">
      {plural(total, one, many)}
    </p>
  );
}

/** A table that scrolls sideways inside its own box on small screens. */
export function TableBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Pager({ base, params, page, total }: { base: string; params: Record<string, string | number>; page: number; total: number }) {
  const pages = pageCount(total);
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 ? (
        <a className="btn ghost small" href={hrefWith(base, { ...params, page: page - 1 })} rel="prev">
          Previous
        </a>
      ) : (
        <span className="btn ghost small" aria-disabled="true">
          Previous
        </span>
      )}
      <span className="pager-info">
        Page {Math.min(page, pages)} of {pages}
      </span>
      {page < pages ? (
        <a className="btn ghost small" href={hrefWith(base, { ...params, page: page + 1 })} rel="next">
          Next
        </a>
      ) : (
        <span className="btn ghost small" aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}

export function StatusPill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={`pill ${on ? "on" : "off"}`}>{children}</span>;
}
