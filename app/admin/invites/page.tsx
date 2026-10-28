import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { PAGE_SIZE, fmtDateTime, offsetFor, pageNumber, pick, searchText, type Search } from "@/lib/list";
import { Empty, ListSearch, ListTotal, Pager, StatusPill, TableBox, Tabs } from "@/components/list";
import { revokeInvite } from "../actions";

const TABS = ["active", "used", "expired", "revoked"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { active: "Active", used: "Used", expired: "Expired", revoked: "Revoked" };
const EMPTY: Record<Tab, React.ReactNode> = {
  active: (
    <>
      No active keys. <a href="/admin/invites/new">Generate one.</a>
    </>
  ),
  used: "No keys have been used yet.",
  expired: "No expired keys.",
  revoked: "No revoked keys.",
};

type Row = { id: number; label: string | null; created_at: string; expires_at: string; used_by: string | null; used_by_id: number | null };

export default async function InvitesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = pick(sp.tab, TABS, "active");
  const term = searchText(sp.q);
  const page = pageNumber(sp.page);

  // One status per key. The tab and search are bound parameters.
  const [counts, rows] = await Promise.all([
    q<Record<Tab, number>>`
      SELECT count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now())::int AS active,
             count(*) FILTER (WHERE used_at IS NOT NULL)::int AS used,
             count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at <= now())::int AS expired,
             count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NOT NULL)::int AS revoked
      FROM invites
      WHERE (${term}::text = '' OR position(lower(${term}::text) in lower(coalesce(label, ''))) > 0)`,
    q<Row>`
      WITH f AS (
        SELECT i.id, i.label, i.created_at, i.expires_at, u.username AS used_by, u.id AS used_by_id
        FROM invites i LEFT JOIN users u ON u.invite_id = i.id
        WHERE (${term}::text = '' OR position(lower(${term}::text) in lower(coalesce(i.label, ''))) > 0)
          AND CASE ${tab}::text
                WHEN 'active' THEN i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
                WHEN 'used' THEN i.used_at IS NOT NULL
                WHEN 'expired' THEN i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at <= now()
                ELSE i.used_at IS NULL AND i.revoked_at IS NOT NULL
              END
      )
      SELECT * FROM f
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offsetFor(page)}`,
  ]);
  const total = counts[0][tab];
  const params = { tab, q: term };

  return (
    <>
      <div className="list-head">
        <div>
          <div className="tag">Admin</div>
          <h1>Invite keys.</h1>
        </div>
        <a className="btn" href="/admin/invites/new">
          Generate key
        </a>
      </div>

      <Tabs base="/admin/invites" params={params} current={tab} tabs={TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts[0][t] }))} />
      <ListSearch base="/admin/invites" q={term} placeholder="Search by who it is for" keep={{ tab }} />
      <ListTotal total={total} one={`${TAB_LABEL[tab].toLowerCase()} key`} />

      {rows.length === 0 ? (
        <Empty>{term ? "No keys match this search." : EMPTY[tab]}</Empty>
      ) : (
        <TableBox>
          <thead>
            <tr>
              <th>For</th>
              <th>Status</th>
              <th>Created</th>
              <th>Expires</th>
              <th>Used by</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>{i.label ?? "-"}</td>
                <td>
                  <StatusPill on={tab === "active"}>{TAB_LABEL[tab]}</StatusPill>
                </td>
                <td>{fmtDateTime(i.created_at)}</td>
                <td>{fmtDateTime(i.expires_at)}</td>
                <td className="mono">{i.used_by ? <a href={`/admin/members/${i.used_by_id}`}>@{i.used_by}</a> : "-"}</td>
                <td>
                  {tab === "active" && (
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn danger small" type="submit">
                        Revoke
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
      <Pager base="/admin/invites" params={params} page={page} total={total} />
    </>
  );
}
