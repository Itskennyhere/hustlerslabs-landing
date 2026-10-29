import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { FEEDBACK_KINDS, FEEDBACK_STATUS, feedbackKindLabel } from "@/lib/feedback-options";
import { PAGE_SIZE, anyOf, fmtDate, offsetFor, pageNumber, pick, searchText, type Search } from "@/lib/list";
import { Empty, FilterSelect, ListSearch, ListTotal, Pager, TableBox, Tabs } from "@/components/list";
import { setFeedbackStatus } from "../actions";

const TABS = ["new", "read", "done", "all"] as const;
const KINDS = anyOf(FEEDBACK_KINDS);

type Row = {
  total: number;
  id: number | null;
  kind: string;
  message: string;
  page: string | null;
  status: string;
  created_at: string;
  user_id: number;
  username: string;
  account_type: string | null;
};

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = pick(sp.tab, TABS, "new");
  const kind = pick(sp.kind, KINDS, "");
  const term = searchText(sp.q);
  const page = pageNumber(sp.page);

  const [counts, rows] = await Promise.all([
    q<Record<string, number>>`
      SELECT count(*)::int AS "all",
             count(*) FILTER (WHERE status = 'new')::int AS new,
             count(*) FILTER (WHERE status = 'read')::int AS read,
             count(*) FILTER (WHERE status = 'done')::int AS done
      FROM feedback`,
    q<Row>`
      WITH f AS (
        SELECT fb.id, fb.kind, fb.message, fb.page, fb.status, fb.created_at,
               fb.user_id, u.username, u.account_type
        FROM feedback fb
        JOIN users u ON u.id = fb.user_id
        WHERE (${tab}::text = 'all' OR fb.status = ${tab}::text)
          AND (${kind}::text = '' OR fb.kind = ${kind}::text)
          AND (${term}::text = ''
               OR position(lower(${term}::text) in lower(fb.message)) > 0
               OR position(lower(${term}::text) in lower(u.username)) > 0)
      ),
      n AS (SELECT count(*)::int AS total FROM f)
      SELECT n.total, pg.* FROM n
      LEFT JOIN LATERAL (
        SELECT * FROM f ORDER BY f.created_at DESC, f.id DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offsetFor(page)}
      ) pg ON true
      ORDER BY pg.created_at DESC, pg.id DESC`,
  ]);
  const total = rows[0]?.total ?? 0;
  const list = rows.filter((r) => r.id !== null);
  const c = counts[0];
  const params = { tab, kind, q: term };

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Feedback.</h1>
      <p className="sub">What members want to see and what they think we can do better. They send it from the Feedback button on their pages.</p>

      <Tabs
        base="/admin/feedback"
        params={params}
        current={tab}
        tabs={[...FEEDBACK_STATUS.map((o) => ({ value: o.value, label: o.label, count: c[o.value] })), { value: "all", label: "All", count: c.all }]}
      />
      <ListSearch base="/admin/feedback" q={term} placeholder="Search feedback or username" keep={{ tab }}>
        <FilterSelect name="kind" label="About" value={kind} options={FEEDBACK_KINDS} />
      </ListSearch>
      <ListTotal total={total} one="note" />

      {list.length === 0 ? (
        <Empty>{term || kind ? "No feedback matches this search." : tab === "new" ? "No new feedback. You're all caught up." : "No feedback here yet."}</Empty>
      ) : (
        <TableBox>
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>About</th>
              <th>Feedback</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>
                  <a href={`/admin/members/${r.user_id}`}>@{r.username}</a>
                  {r.account_type && <div className="note">{r.account_type}</div>}
                </td>
                <td>{feedbackKindLabel(r.kind)}</td>
                <td className="wrap-cell">
                  {r.message}
                  {r.page && <div className="mono note">Sent from {r.page}</div>}
                </td>
                <td>
                  <form action={setFeedbackStatus} className="status-form">
                    <input type="hidden" name="id" value={r.id ?? ""} />
                    <select name="status" defaultValue={r.status} aria-label="Status">
                      {FEEDBACK_STATUS.map((o) => (
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
      <Pager base="/admin/feedback" params={params} page={page} total={total} />
    </>
  );
}
