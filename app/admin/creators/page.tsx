import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import type { CreatorProfile } from "@/lib/onboarding";
import { COLLAB_STATUS, CREATOR_AUDIENCE, NICHES, type Option } from "@/lib/onboarding-options";
import CreatorCard from "@/components/CreatorCard";

type Search = Promise<Record<string, string | string[] | undefined>>;

function pick(v: string | string[] | undefined, list: readonly Option[]): string {
  const s = typeof v === "string" ? v : "";
  return list.some((o) => o.value === s) ? s : "";
}

function FilterSelect({ name, label, list, value }: { name: string; label: string; list: readonly Option[]; value: string }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        <option value="">Any</option>
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function CreatorsPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const sp = await searchParams;
  const niche = pick(sp.niche, NICHES);
  const audience = pick(sp.audience, CREATOR_AUDIENCE);
  const collab = pick(sp.collab, COLLAB_STATUS);
  const region = (typeof sp.region === "string" ? sp.region : "").trim().slice(0, 80);

  // Every filter is a bound parameter; empty means "any".
  const creators = await q<CreatorProfile & { username: string; x_username: string | null; x_followers: number | null }>`
    SELECT c.*, u.username, x.username AS x_username, x.followers AS x_followers
    FROM creator_profiles c JOIN users u ON u.id = c.user_id LEFT JOIN x_accounts x ON x.user_id = c.user_id
    WHERE (${niche}::text = '' OR ${niche}::text = ANY(c.niches))
      AND (${audience}::text = '' OR c.audience_band = ${audience}::text)
      AND (${collab}::text = '' OR c.collab_status = ${collab}::text)
      AND (${region}::text = '' OR position(lower(${region}::text) in lower(c.region)) > 0)
    ORDER BY c.verified DESC, c.verified_at DESC NULLS LAST, c.updated_at DESC`;

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Creator roster.</h1>
      <p className="sub">Every creator with a profile. Telegram is visible here only.</p>

      <form className="row filters" method="get">
        <FilterSelect name="niche" label="Niche" list={NICHES} value={niche} />
        <FilterSelect name="audience" label="Audience" list={CREATOR_AUDIENCE} value={audience} />
        <FilterSelect name="collab" label="Collab status" list={COLLAB_STATUS} value={collab} />
        <label>
          Region contains
          <input name="region" defaultValue={region} maxLength={80} />
        </label>
        <button type="submit" className="btn">
          Filter
        </button>
        <a className="btn ghost" href="/admin/creators">
          Clear
        </a>
      </form>

      <p className="note" style={{ margin: "1.5rem 0 1rem" }}>
        {creators.length} {creators.length === 1 ? "creator" : "creators"}
      </p>
      {creators.length === 0 ? (
        <div className="empty">No creators match.</div>
      ) : (
        <div className="card-grid">
          {creators.map((c) => (
            <div key={c.user_id} className="card-cell">
              <CreatorCard c={c} size="compact" xConnected={c.x_username} />
              <p className="note admin-under">
                <span className="mono">
                  TG @{c.telegram}
                  {c.x_followers !== null && ` · X ${c.x_followers.toLocaleString("en-US")}`}
                </span>
                <a href={`/admin/members/${c.user_id}`}>Details</a>
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
