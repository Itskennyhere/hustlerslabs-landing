import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { INTRO_STATUS } from "@/lib/onboarding-options";
import { setIntroStatus } from "../actions";

type Row = {
  id: number;
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

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" });

export default async function IntrosPage() {
  await requireAdmin();
  const rows = await q<Row>`
    SELECT r.id, r.note, r.status, r.created_at,
           r.project_user_id, p.project_name, pu.username AS project_username,
           r.creator_user_id, c.display_name AS creator_name, cu.username AS creator_username, c.telegram
    FROM intro_requests r
    JOIN users pu ON pu.id = r.project_user_id
    LEFT JOIN project_profiles p ON p.user_id = r.project_user_id
    JOIN users cu ON cu.id = r.creator_user_id
    LEFT JOIN creator_profiles c ON c.user_id = r.creator_user_id
    ORDER BY (r.status = 'new') DESC, r.created_at DESC`;
  const fresh = rows.filter((r) => r.status === "new").length;

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Intro requests.</h1>
      <p className="sub">
        {fresh} new. Projects asked to meet these creators. Contact the creator on Telegram, then update the status.
      </p>

      {rows.length === 0 ? (
        <div className="empty">No intro requests yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmt(r.created_at)}</td>
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
                      <input type="hidden" name="id" value={r.id} />
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
          </table>
        </div>
      )}
    </>
  );
}
