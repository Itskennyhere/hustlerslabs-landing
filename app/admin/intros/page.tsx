import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { INTRO_STATUS } from "@/lib/onboarding-options";
import { PAGE_SIZE, fmtDate, offsetFor, pageNumber, pick, searchText, type Search } from "@/lib/list";
import { Empty, ListSearch, ListTotal, Pager, TableBox, Tabs } from "@/components/list";
import { setIntroStatus } from "../actions";

const TABS = ["all", "new", "contacted", "introduced", "declined"] as const;

type Row = {
  total: number;
  id: number | null;
  note: string | null;
  status: string;
  created_at: string;
  project_user_id: number;
  project_name: string | null;
  project_username: string;
  creator_user_id: number;
  creator_name: string | null;
  creator_username: string;
  telegram: string | null;
};

export default async function IntrosPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = pick(sp.tab, TABS, "all");
  const term = searchText(sp.q);
  const page = pageNumber(sp.page);

  const [counts, rows] = await Promise.all([
    q<Record<string, number>>`
      SELECT count(*)::int AS "all",
             count(*) FILTER (WHERE status = 'new')::int AS new,
             count(*) FILTER (WHERE status = 'contacted')::int AS contacted,
             count(*) FILTER (WHERE status = 'introduced')::int AS introduced,
             count(*) FILTER (WHERE status = 'declined')::int AS declined
      FROM intro_requests`,
    q<Row>`
      WITH f AS (
        SELECT r.id, r.note, r.status, r.created_at,
               r.project_user_id, p.project_name, pu.username AS project_username,
               r.creator_user_id, c.display_name AS creator_name, cu.username AS creator_username, c.telegram
        FROM intro_requests r
        JOIN users pu ON pu.id = r.project_user_id
        LEFT JOIN project_profiles p ON p.user_id = r.project_user_id
        JOIN users cu ON cu.id = r.creator_user_id
        LEFT JOIN creator_profiles c ON c.user_id = r.creator_user_id
        WHERE (${tab}::text = 'all' OR r.status = ${tab}::text)
          AND (${term}::text = ''
               OR position(lower(${term}::text) in lower(coalesce(p.project_name, pu.username))) > 0
               OR position(lower(${term}::text) in lower(coalesce(c.display_name, cu.username))) > 0)
      ),
      n AS (SELECT count(*)::int AS total FROM f)
      SELECT n.total, pg.* FROM n
      LEFT JOIN LATERAL (
        SELECT * FROM f ORDER BY (f.status = 'new') DESC, f.created_at DESC, f.id DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offsetFor(page)}
      ) pg ON true
      ORDER BY (pg.status = 'new') DESC, pg.created_at DESC, pg.id DESC`,
  ]);
  const total = rows[0]?.total ?? 0;
  const list = rows.filter((r) => r.id !== null);
  const c = counts[0];
  const params = { tab, q: term };

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Intro requests.</h1>
      <p className="sub">Projects asked to meet these creators. Contact the creator on Telegram, then update the status.</p>

      <Tabs
        base="/admin/intros"
        params={params}
        current={tab}
        tabs={[{ value: "all", label: "All", count: c.all }, ...INTRO_STATUS.map((o) => ({ value: o.value, label: o.label, count: c[o.value] }))]}
      />
      <ListSearch base="/admin/intros" q={term} placeholder="Search project or creator" keep={{ tab }} />
      <ListTotal total={total} one="request" />

      {list.length === 0 ? (
        <Empty>
          {term ? "No requests match this search." : "No intro requests here yet. Projects send them from the creator roster."}
        </Empty>
      ) : (
        <TableBox>
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Creator</th>
              <th>Note</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>
                  <a href={`/admin/members/${r.project_user_id}`}>{r.project_name ?? `@${r.project_username}`}</a>
                </td>
                <td>
                  <a href={`/admin/members/${r.creator_user_id}`}>{r.creator_name ?? `@${r.creator_username}`}</a>
                  {r.telegram && <div className="mono note">TG @{r.telegram}</div>}
                </td>
                <td className="wrap-cell">{r.note || "-"}</td>
                <td>
                  <form action={setIntroStatus} className="status-form">
                    <input type="hidden" name="id" value={r.id ?? ""} />
                    <select name="status" defaultValue={r.status} aria-label="Status">
                      {INTRO_STATUS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn ghost small">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
      <Pager base="/admin/intros" params={params} page={page} total={total} />
    </>
  );
}
