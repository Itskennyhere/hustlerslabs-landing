import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { PAGE_SIZE, fmtDate, fmtDateTime, offsetFor, pageNumber, anyOf, pick, searchText, type Search } from "@/lib/list";
import { BackLink, Empty, FilterSelect, ListSearch, ListTotal, Pager, StatusPill, TableBox } from "@/components/list";

const TYPES = [
  { value: "project", label: "Project" },
  { value: "creator", label: "Creator" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member (no type)" },
] as const;
const STATUSES = [
  { value: "pending", label: "Waiting for approval" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
] as const;
const TFA = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;
const WORKSPACE = [
  { value: "open", label: "Unfinished" },
  { value: "done", label: "Complete" },
] as const;
const SORTS = [
  { value: "joined", label: "Newest joined" },
  { value: "login", label: "Last login" },
] as const;

type Row = {
  total: number;
  id: number | null;
  username: string;
  email: string | null;
  role: string;
  account_type: string | null;
  disabled_at: string | null;
  approved_at: string | null;
  is_owner: boolean;
  totp_enabled: boolean;
  created_at: string;
  last_login_at: string | null;
  project_name: string | null;
  progress: number | null;
};

const typeLabel = (r: Row) => (r.is_owner ? "Owner" : r.role === "admin" ? "Admin" : r.account_type === "project" ? "Project" : r.account_type === "creator" ? "Creator" : "Member");

export default async function MembersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const term = searchText(sp.q);
  const type = pick(sp.type, anyOf(TYPES), "");
  const status = pick(sp.status, anyOf(STATUSES), "");
  const tfa = pick(sp.tfa, anyOf(TFA), "");
  const workspace = pick(sp.workspace, anyOf(WORKSPACE), "");
  const sort = pick(sp.sort, ["joined", "login"] as const, "joined");
  const page = pageNumber(sp.page);

  // One filtered set, counted once and paged in SQL. Every filter is a bound parameter.
  const rows = await q<Row>`
    WITH f AS (
      SELECT u.id, u.username, u.role, u.account_type, u.disabled_at, u.approved_at, u.is_owner, u.totp_enabled, u.created_at, u.last_login_at,
             CASE WHEN u.email_verified_at IS NOT NULL THEN u.email END AS email,
             p.project_name,
             CASE WHEN u.account_type = 'project' THEN
               (w.goals_done_at IS NOT NULL)::int + (w.marketing_done_at IS NOT NULL)::int + (w.buying_done_at IS NOT NULL)::int
             END AS progress
      FROM users u
      LEFT JOIN project_profiles p ON p.user_id = u.id
      LEFT JOIN project_workspace w ON w.user_id = u.id
      WHERE (${term}::text = ''
             OR position(lower(${term}::text) in u.username) > 0
             OR position(lower(${term}::text) in lower(coalesce(u.email, ''))) > 0
             OR position(lower(${term}::text) in lower(coalesce(p.project_name, ''))) > 0)
        AND (${type}::text = ''
             OR (${type}::text = 'admin' AND u.role = 'admin')
             OR (${type}::text = 'member' AND u.role <> 'admin' AND u.account_type IS NULL)
             OR (u.role <> 'admin' AND u.account_type = ${type}::text))
        AND (${status}::text = ''
             OR (${status}::text = 'disabled' AND u.disabled_at IS NOT NULL)
             OR (${status}::text = 'pending' AND u.disabled_at IS NULL AND u.role = 'member' AND u.approved_at IS NULL)
             OR (${status}::text = 'active' AND u.disabled_at IS NULL AND (u.role = 'admin' OR u.approved_at IS NOT NULL)))
        AND (${tfa}::text = '' OR (${tfa}::text = 'on') = u.totp_enabled)
        AND (${workspace}::text = '' OR (u.account_type = 'project' AND
             (${workspace}::text = 'done') = (w.goals_done_at IS NOT NULL AND w.marketing_done_at IS NOT NULL AND w.buying_done_at IS NOT NULL)))
    ),
    n AS (SELECT count(*)::int AS total FROM f)
    SELECT n.total, pg.* FROM n
    LEFT JOIN LATERAL (
      SELECT * FROM f
      ORDER BY CASE WHEN ${sort}::text = 'login' THEN f.last_login_at END DESC NULLS LAST, f.created_at DESC, f.id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offsetFor(page)}
    ) pg ON true
    ORDER BY CASE WHEN ${sort}::text = 'login' THEN pg.last_login_at END DESC NULLS LAST, pg.created_at DESC, pg.id DESC`;
  const total = rows[0]?.total ?? 0;
  const list = rows.filter((r) => r.id !== null);
  const params = { q: term, type, status, tfa, workspace, sort };
  const filtered = Boolean(term || type || status || tfa || workspace);

  return (
    <>
      <BackLink href="/admin/members">Back to members</BackLink>
      <div className="tag">Admin</div>
      <h1>All members.</h1>
      <p className="sub">Open a member to see their answers, sign them out, disable them or verify a creator.</p>

      <ListSearch base="/admin/members/all" q={term} placeholder="Search username, email or project">
        <FilterSelect name="type" label="Type" value={type} options={TYPES} />
        <FilterSelect name="status" label="Status" value={status} options={STATUSES} />
        <FilterSelect name="tfa" label="2FA" value={tfa} options={TFA} />
        <FilterSelect name="workspace" label="Workspace" value={workspace} options={WORKSPACE} />
        <FilterSelect name="sort" label="Sort" value={sort} options={SORTS} any={null} />
      </ListSearch>
      <ListTotal total={total} one="member" />

      {list.length === 0 ? (
        <Empty>
          {filtered ? (
            <>
              No members match. <a href="/admin/members/all">Clear the filters.</a>
            </>
          ) : (
            <>
              No members yet. Share hustlerslabs.com/join: new sign-ups appear here for approval.
            </>
          )}
        </Empty>
      ) : (
        <TableBox>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Type</th>
              <th>Workspace</th>
              <th>Status</th>
              <th>2FA</th>
              <th>Joined</th>
              <th>Last login</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className="row-link">
                <td className="mono">
                  <a href={`/admin/members/${m.id}`}>@{m.username}</a>
                  {Number(m.id) === admin.userId ? " (you)" : ""}
                  {m.project_name && <div className="note">{m.project_name}</div>}
                </td>
                <td className="mono">{m.email ?? "-"}</td>
                <td>{typeLabel(m)}</td>
                <td className="mono">{m.account_type === "project" && m.role !== "admin" ? `${m.progress ?? 0}/3` : "-"}</td>
                <td>
                  <StatusPill on={!m.disabled_at && (m.role === "admin" || Boolean(m.approved_at))}>
                    {m.disabled_at ? "Disabled" : m.role !== "admin" && !m.approved_at ? "Waiting" : "Active"}
                  </StatusPill>
                </td>
                <td>{m.totp_enabled ? "On" : "Off"}</td>
                <td>{fmtDate(m.created_at)}</td>
                <td>{fmtDateTime(m.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
      <Pager base="/admin/members/all" params={params} page={page} total={total} />
    </>
  );
}
