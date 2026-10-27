import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { getAccountType, getWorkspace, workspaceProgress, WORKSPACE_SECTIONS } from "@/lib/onboarding";
import { CREATOR_AUDIENCE, NICHES, ROSTER_COLLAB, type Option } from "@/lib/onboarding-options";
import CreatorCard, { type CreatorCardData } from "@/components/CreatorCard";
import { ProgressBar } from "@/components/WorkspaceChecklist";
import IntroButton from "./IntroButton";

type Search = Promise<Record<string, string | string[] | undefined>>;
type Row = CreatorCardData & { user_id: number; x_username: string | null; requested: boolean };

function pick(v: string | string[] | undefined, list: readonly Option[]): string {
  const s = typeof v === "string" ? v : "";
  return list.some((o) => o.value === s) ? s : "";
}

function FilterSelect({ name, label, list, value, any = "Any" }: { name: string; label: string; list: readonly Option[]; value: string; any?: string | null }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        {any !== null && <option value="">{any}</option>}
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function CreatorRosterPage({ searchParams }: { searchParams: Search }) {
  const s = await requireMember();
  const type = await getAccountType(s.userId);
  const isAdmin = s.role === "admin";
  if (!isAdmin && type !== "project") notFound();

  // Same lock as tools: a project must finish its workspace first.
  if (type === "project") {
    const done = workspaceProgress(await getWorkspace(s.userId));
    if (done < WORKSPACE_SECTIONS.length) {
      return (
        <>
          <div className="tag">Find creators</div>
          <h1>Creator roster.</h1>
          <div className="panel locked">
            <h2>Finish your workspace to unlock tools.</h2>
            <ProgressBar done={done} />
            <a className="btn" href="/members/workspace">
              Go to workspace
            </a>
          </div>
        </>
      );
    }
  }

  const sp = await searchParams;
  const niche = pick(sp.niche, NICHES);
  const audience = pick(sp.audience, CREATOR_AUDIENCE);
  const collab = pick(sp.collab, ROSTER_COLLAB);

  // Projects only ever see verified creators who take collabs. No Telegram or contact details are selected.
  const regions = (
    await q<{ region: string }>`
      SELECT min(c.region) AS region FROM creator_profiles c JOIN users u ON u.id = c.user_id
      WHERE c.verified AND c.collab_status IN ('yes', 'case_by_case') AND u.disabled_at IS NULL
      GROUP BY lower(c.region) ORDER BY 1`
  ).map((r) => ({ value: r.region, label: r.region }));
  const region = pick(sp.region, regions);

  const creators = await q<Row>`
    SELECT c.user_id, c.creator_no, c.created_at, c.display_name, c.bio, c.platforms, c.main_handle, c.main_platform,
           c.niches, c.audience_band, c.region, c.languages, c.collab_status, c.verified,
           x.username AS x_username,
           EXISTS (SELECT 1 FROM intro_requests r WHERE r.project_user_id = ${s.userId} AND r.creator_user_id = c.user_id) AS requested
    FROM creator_profiles c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN x_accounts x ON x.user_id = c.user_id
    WHERE c.verified AND c.collab_status IN ('yes', 'case_by_case') AND u.disabled_at IS NULL
      AND (${niche}::text = '' OR ${niche}::text = ANY(c.niches))
      AND (${audience}::text = '' OR c.audience_band = ${audience}::text)
      AND (${collab}::text = '' OR c.collab_status = ${collab}::text)
      AND (${region}::text = '' OR lower(c.region) = lower(${region}::text))
    ORDER BY c.verified_at DESC NULLS LAST, c.user_id DESC`;

  return (
    <>
      <div className="roster-head">
        <div>
          <div className="tag">Find creators</div>
          <h1>Creator roster.</h1>
          <p className="sub">Every creator is vetted by Hustlers Labs. Request an intro and we connect you.</p>
        </div>
        <p className="count" role="status">
          {creators.length} {creators.length === 1 ? "creator" : "creators"}
        </p>
      </div>

      <form method="get">
        <div className="filter-grid">
          <FilterSelect name="niche" label="Niche" list={NICHES} value={niche} />
          <FilterSelect name="audience" label="Audience" list={CREATOR_AUDIENCE} value={audience} />
          <FilterSelect name="collab" label="Collab status" list={ROSTER_COLLAB} value={collab} any={null} />
          <FilterSelect name="region" label="Region" list={regions} value={region} />
        </div>
        <div className="filter-actions">
          <button type="submit" className="btn small">
            Apply filters
          </button>
          <a className="btn ghost small" href="/members/creators">
            Clear
          </a>
        </div>
      </form>

      {creators.length === 0 ? (
        <div className="empty">No creators match these filters yet.</div>
      ) : (
        <div className="card-grid">
          {creators.map((c) => (
            <CreatorCard
              key={c.user_id}
              c={c}
              size="compact"
              xConnected={c.x_username}
              action={type === "project" ? <IntroButton creatorId={Number(c.user_id)} requested={c.requested} /> : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
