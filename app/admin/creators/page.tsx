import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { COLLAB_BADGE, COLLAB_STATUS, CREATOR_AUDIENCE, NICHES, labelOf } from "@/lib/onboarding-options";
import { PAGE_SIZE, fmtDate, offsetFor, pageNumber, anyOf, pick, searchText, type Search } from "@/lib/list";
import { creatorNo } from "@/components/CreatorCard";
import { Empty, FilterSelect, ListSearch, ListTotal, Pager, StatusPill, TableBox } from "@/components/list";

const STATUS = [
  { value: "pending", label: "Pending review" },
  { value: "verified", label: "Verified" },
] as const;

type Row = {
  total: number;
  user_id: number | null;
  creator_no: number;
  display_name: string;
  main_handle: string;
  verified: boolean;
  collab_status: string;
  audience_band: string;
  region: string;
  telegram: string;
  created_at: string;
  x_followers: number | null;
};

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const term = searchText(sp.q);
  const status = pick(sp.status, anyOf(STATUS), "");
  const niche = pick(sp.niche, anyOf(NICHES), "");
  const audience = pick(sp.audience, anyOf(CREATOR_AUDIENCE), "");
  const collab = pick(sp.collab, anyOf(COLLAB_STATUS), "");
  const page = pageNumber(sp.page);

  const rows = await q<Row>`
    WITH f AS (
      SELECT c.user_id, c.creator_no, c.display_name, c.main_handle, c.verified, c.verified_at, c.collab_status,
             c.audience_band, c.region, c.telegram, c.created_at, x.followers AS x_followers
      FROM creator_profiles c JOIN users u ON u.id = c.user_id LEFT JOIN x_accounts x ON x.user_id = c.user_id
      WHERE (${term}::text = ''
             OR position(lower(${term}::text) in lower(c.display_name)) > 0
             OR position(lower(${term}::text) in lower(c.main_handle)) > 0
             OR position(lower(${term}::text) in lower(c.region)) > 0
             OR position(lower(${term}::text) in u.username) > 0)
        AND (${status}::text = '' OR (${status}::text = 'verified') = c.verified)
        AND (${niche}::text = '' OR ${niche}::text = ANY(c.niches))
        AND (${audience}::text = '' OR c.audience_band = ${audience}::text)
        AND (${collab}::text = '' OR c.collab_status = ${collab}::text)
    ),
    n AS (SELECT count(*)::int AS total FROM f)
    SELECT n.total, pg.* FROM n
    LEFT JOIN LATERAL (
      SELECT * FROM f ORDER BY f.verified, f.verified_at DESC NULLS LAST, f.created_at DESC, f.user_id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offsetFor(page)}
    ) pg ON true
    ORDER BY pg.verified, pg.verified_at DESC NULLS LAST, pg.created_at DESC, pg.user_id DESC`;
  const total = rows[0]?.total ?? 0;
  const list = rows.filter((r) => r.user_id !== null);
  const params = { q: term, status, niche, audience, collab };

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Creators.</h1>
      <p className="sub">Pending creators first. Open one to see their card and Telegram, and to verify them.</p>

      <ListSearch base="/admin/creators" q={term} placeholder="Search name, handle or region">
        <FilterSelect name="status" label="Status" value={status} options={STATUS} />
        <FilterSelect name="niche" label="Niche" value={niche} options={NICHES} />
        <FilterSelect name="audience" label="Audience" value={audience} options={CREATOR_AUDIENCE} />
        <FilterSelect name="collab" label="Collab status" value={collab} options={COLLAB_STATUS} />
      </ListSearch>
      <ListTotal total={total} one="creator" />

      {list.length === 0 ? (
        <Empty>
          {term || status || niche || audience || collab ? (
            <>
              No creators match. <a href="/admin/creators">Clear the filters.</a>
            </>
          ) : (
            <>
              No creator profiles yet. They appear here once a creator saves their card. <a href="/admin/invites/new">Invite a creator.</a>
            </>
          )}
        </Empty>
      ) : (
        <TableBox>
          <thead>
            <tr>
              <th>Creator</th>
              <th>No.</th>
              <th>Status</th>
              <th>Collab</th>
              <th>Audience</th>
              <th>Region</th>
              <th>Telegram</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.user_id} className="row-link">
                <td>
                  <a href={`/admin/members/${c.user_id}`}>{c.display_name}</a>
                  <div className="note mono">@{c.main_handle}</div>
                </td>
                <td className="mono">{creatorNo(c.creator_no).replace("No. ", "")}</td>
                <td>
                  <StatusPill on={c.verified}>{c.verified ? "Verified" : "Pending"}</StatusPill>
                </td>
                <td>{COLLAB_BADGE[c.collab_status] ?? "-"}</td>
                <td>
                  {labelOf(CREATOR_AUDIENCE, c.audience_band)}
                  {c.x_followers !== null && <div className="note mono">X {c.x_followers.toLocaleString("en-US")}</div>}
                </td>
                <td>{c.region}</td>
                <td className="mono">@{c.telegram}</td>
                <td>{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
      <Pager base="/admin/creators" params={params} page={page} total={total} />
    </>
  );
}
