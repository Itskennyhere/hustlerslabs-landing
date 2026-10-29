import { requireAdmin } from "@/lib/auth";
import { COLLAB_BADGE, COLLAB_STATUS, CREATOR_AUDIENCE, NICHES, labelOf } from "@/lib/onboarding-options";
import { anyOf, fmtDate, pageNumber, pick, searchText, type Search } from "@/lib/list";
import { STATUS_TABS, listCreators, type CreatorRow } from "@/lib/member-lists";
import { SAMPLE_CREATOR } from "@/lib/sample-cards";
import CreatorCard, { creatorNo, type CreatorCardData } from "@/components/CreatorCard";
import { ExampleFrame, StatusChip } from "@/components/card-parts";
import { CardGrid, CardLink, StatusTabs, VIEWS, ViewBar } from "@/components/admin-members";
import { BackLink, Empty, FilterSelect, ListSearch, ListTotal, Pager, TableBox } from "@/components/list";

const BASE = "/admin/members/creators";
const VERIFIED = [
  { value: "yes", label: "Verified" },
  { value: "no", label: "Not verified" },
] as const;

/** A creator who has not saved a card yet still gets a card, so the grid stays even. */
function cardData(r: CreatorRow): CreatorCardData {
  return {
    creator_no: r.creator_no,
    created_at: r.created_at,
    display_name: r.display_name ?? `@${r.username}`,
    bio: r.has_card ? (r.bio ?? "") : "No creator card yet.",
    platforms: r.platforms ?? [],
    main_handle: r.main_handle ?? "",
    main_platform: r.main_platform ?? "",
    niches: r.niches ?? [],
    audience_band: r.audience_band ?? "",
    region: r.region ?? "",
    languages: r.languages ?? "",
    collab_status: r.collab_status ?? "",
    verified: Boolean(r.verified),
  };
}

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = {
    tab: pick(sp.tab, STATUS_TABS, "waiting"),
    term: searchText(sp.q),
    niche: pick(sp.niche, anyOf(NICHES), ""),
    audience: pick(sp.audience, anyOf(CREATOR_AUDIENCE), ""),
    collab: pick(sp.collab, anyOf(COLLAB_STATUS), ""),
    verified: pick(sp.verified, anyOf(VERIFIED), ""),
    page: pageNumber(sp.page),
  };
  const view = pick(sp.view, VIEWS, "cards");
  const preview = sp.preview === "1";
  const { rows, counts } = await listCreators(f);
  const params = { tab: f.tab, q: f.term, niche: f.niche, audience: f.audience, collab: f.collab, verified: f.verified, view: view === "cards" ? "" : view, preview: preview ? "1" : "" };
  const filtered = Boolean(f.term || f.niche || f.audience || f.collab || f.verified);
  const example = (
    <ExampleFrame>
      <CreatorCard c={SAMPLE_CREATOR} status="approved" />
    </ExampleFrame>
  );

  if (counts.everyone === 0) {
    return (
      <>
        <BackLink href="/admin/members">Back to members</BackLink>
        <div className="tag">Members</div>
        <h1>Creators.</h1>
        <div className="empty-type">
          <p>
            <strong>No creators yet.</strong> They sign up at hustlerslabs.com/join and appear here for approval.
          </p>
        </div>
        <div className="example-solo">{example}</div>
      </>
    );
  }

  return (
    <>
      <BackLink href="/admin/members">Back to members</BackLink>
      <div className="tag">Members</div>
      <h1>Creators.</h1>
      <p className="sub">Open a card to approve, decline, verify, sign out or disable. Telegram shows only in the table and on the member page.</p>

      <StatusTabs base={BASE} params={params} current={f.tab} counts={counts} />
      <ListSearch base={BASE} q={f.term} placeholder="Search name, username, email or handle" keep={{ tab: f.tab, view: params.view, preview: params.preview }}>
        <FilterSelect name="niche" label="Niche" value={f.niche} options={NICHES} />
        <FilterSelect name="audience" label="Audience" value={f.audience} options={CREATOR_AUDIENCE} />
        <FilterSelect name="collab" label="Collab status" value={f.collab} options={COLLAB_STATUS} />
        <FilterSelect name="verified" label="Verified" value={f.verified} options={VERIFIED} />
      </ListSearch>
      <ViewBar base={BASE} params={params} view={view} preview={preview} />
      {preview && <div className="example-solo">{example}</div>}
      <ListTotal total={counts[f.tab]} one="creator" />

      {rows.length === 0 ? (
        <Empty>
          {filtered ? (
            <>
              No creators match. <a href={`${BASE}?tab=${f.tab}`}>Clear the filters.</a>
            </>
          ) : (
            "No creators in this tab."
          )}
        </Empty>
      ) : view === "table" ? (
        <TableBox>
          <thead>
            <tr>
              <th>Creator</th>
              <th>No.</th>
              <th>Email</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Collab</th>
              <th>Audience</th>
              <th>Telegram</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={`/admin/members/${r.id}`}>{r.display_name ?? `@${r.username}`}</a>
                  <div className="note mono">@{r.username}</div>
                </td>
                <td className="mono">{r.creator_no ? creatorNo(r.creator_no).replace("No. ", "") : "-"}</td>
                <td className="mono">{r.email ?? "-"}</td>
                <td>
                  <StatusChip status={r.status} />
                </td>
                <td>{r.has_card ? (r.verified ? "Yes" : "Pending") : "No card"}</td>
                <td>{r.collab_status ? COLLAB_BADGE[r.collab_status] : "-"}</td>
                <td>
                  {r.audience_band ? labelOf(CREATOR_AUDIENCE, r.audience_band) : "-"}
                  {r.x_followers !== null && <div className="note mono">X {r.x_followers.toLocaleString("en-US")}</div>}
                </td>
                <td className="mono">{r.telegram ? `@${r.telegram}` : "-"}</td>
                <td>{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      ) : (
        <CardGrid>
          {rows.map((r) => (
            <CardLink key={r.id} id={r.id} label={`Open ${r.display_name ?? r.username}`}>
              <CreatorCard c={cardData(r)} size="compact" xConnected={r.x_username} status={r.status} />
            </CardLink>
          ))}
        </CardGrid>
      )}
      <Pager base={BASE} params={params} page={f.page} total={counts[f.tab]} />
    </>
  );
}
