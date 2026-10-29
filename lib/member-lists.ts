import "server-only";
import { q } from "./db";
import { PAGE_SIZE, offsetFor } from "./list";
import type { MemberStatus } from "@/components/card-parts";

// Admin > Members > Projects and Creators. One filtered set per type, counted per status tab and paged in SQL.
// Status comes from the account: waiting (not approved), approved, declined (disabled before approval), disabled.

export const STATUS_TABS = ["waiting", "approved", "declined", "disabled"] as const;
export type StatusCounts = Record<MemberStatus, number> & { everyone: number };

type Common = { total_waiting: number; total_approved: number; total_declined: number; total_disabled: number; everyone: number };

function counts(r: Common | undefined): StatusCounts {
  return {
    waiting: r?.total_waiting ?? 0,
    approved: r?.total_approved ?? 0,
    declined: r?.total_declined ?? 0,
    disabled: r?.total_disabled ?? 0,
    everyone: r?.everyone ?? 0,
  };
}

export type ProjectRow = {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
  status: MemberStatus;
  project_name: string;
  x_handle: string;
  category: string;
  chains: string[];
  stage: string;
  budget_band: string;
  team_size: string;
  contact_name: string;
  contact_role: string;
  contact_telegram: string;
  progress: number;
};

export async function listProjects(f: {
  tab: MemberStatus;
  term: string;
  category: string;
  stage: string;
  budget: string;
  workspace: string;
  page: number;
}): Promise<{ rows: ProjectRow[]; counts: StatusCounts }> {
  const rows = await q<Common & Partial<ProjectRow>>`
    WITH base AS (
      SELECT u.id, u.username, u.created_at,
             CASE WHEN u.email_verified_at IS NOT NULL THEN u.email END AS email,
             CASE WHEN u.disabled_at IS NOT NULL AND u.approved_at IS NULL THEN 'declined'
                  WHEN u.disabled_at IS NOT NULL THEN 'disabled'
                  WHEN u.approved_at IS NULL THEN 'waiting' ELSE 'approved' END AS status,
             p.project_name, p.x_handle, p.category, p.chains, p.stage, p.budget_band, p.team_size,
             p.contact_name, p.contact_role, p.contact_telegram,
             (w.goals_done_at IS NOT NULL)::int + (w.marketing_done_at IS NOT NULL)::int + (w.buying_done_at IS NOT NULL)::int AS progress
      FROM users u
      JOIN project_profiles p ON p.user_id = u.id
      LEFT JOIN project_workspace w ON w.user_id = u.id
      WHERE u.role = 'member' AND u.account_type = 'project'
    ),
    f AS (
      SELECT * FROM base
      WHERE (${f.term}::text = ''
             OR position(lower(${f.term}::text) in lower(project_name)) > 0
             OR position(lower(${f.term}::text) in username) > 0
             OR position(lower(${f.term}::text) in lower(coalesce(email, ''))) > 0
             OR position(lower(${f.term}::text) in lower(contact_name)) > 0)
        AND (${f.category}::text = '' OR category = ${f.category}::text)
        AND (${f.stage}::text = '' OR stage = ${f.stage}::text)
        AND (${f.budget}::text = '' OR budget_band = ${f.budget}::text)
        AND (${f.workspace}::text = '' OR progress::text = ${f.workspace}::text)
    ),
    n AS (
      SELECT count(*) FILTER (WHERE status = 'waiting')::int AS total_waiting,
             count(*) FILTER (WHERE status = 'approved')::int AS total_approved,
             count(*) FILTER (WHERE status = 'declined')::int AS total_declined,
             count(*) FILTER (WHERE status = 'disabled')::int AS total_disabled,
             (SELECT count(*)::int FROM base) AS everyone
      FROM f
    )
    SELECT n.*, pg.* FROM n
    LEFT JOIN LATERAL (
      SELECT * FROM f WHERE status = ${f.tab}::text
      ORDER BY created_at DESC, id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offsetFor(f.page)}
    ) pg ON true
    ORDER BY pg.created_at DESC, pg.id DESC`;
  return { rows: rows.filter((r) => r.id != null) as ProjectRow[], counts: counts(rows[0]) };
}

export type CreatorRow = {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
  status: MemberStatus;
  has_card: boolean;
  creator_no: number | null;
  display_name: string | null;
  bio: string | null;
  platforms: { platform: string; handle: string }[] | null;
  main_handle: string | null;
  main_platform: string | null;
  niches: string[] | null;
  audience_band: string | null;
  region: string | null;
  languages: string | null;
  collab_status: string | null;
  telegram: string | null;
  verified: boolean | null;
  x_username: string | null;
  x_followers: number | null;
};

export async function listCreators(f: {
  tab: MemberStatus;
  term: string;
  niche: string;
  audience: string;
  collab: string;
  verified: string;
  page: number;
}): Promise<{ rows: CreatorRow[]; counts: StatusCounts }> {
  const rows = await q<Common & Partial<CreatorRow>>`
    WITH base AS (
      SELECT u.id, u.username, u.created_at,
             CASE WHEN u.email_verified_at IS NOT NULL THEN u.email END AS email,
             CASE WHEN u.disabled_at IS NOT NULL AND u.approved_at IS NULL THEN 'declined'
                  WHEN u.disabled_at IS NOT NULL THEN 'disabled'
                  WHEN u.approved_at IS NULL THEN 'waiting' ELSE 'approved' END AS status,
             (c.user_id IS NOT NULL) AS has_card,
             c.creator_no, c.display_name, c.bio, c.platforms, c.main_handle, c.main_platform, c.niches,
             c.audience_band, c.region, c.languages, c.collab_status, c.telegram, c.verified,
             x.username AS x_username, x.followers AS x_followers
      FROM users u
      LEFT JOIN creator_profiles c ON c.user_id = u.id
      LEFT JOIN x_accounts x ON x.user_id = u.id
      WHERE u.role = 'member' AND u.account_type = 'creator'
    ),
    f AS (
      SELECT * FROM base
      WHERE (${f.term}::text = ''
             OR position(lower(${f.term}::text) in lower(coalesce(display_name, ''))) > 0
             OR position(lower(${f.term}::text) in username) > 0
             OR position(lower(${f.term}::text) in lower(coalesce(email, ''))) > 0
             OR position(lower(${f.term}::text) in lower(coalesce(main_handle, ''))) > 0)
        AND (${f.niche}::text = '' OR ${f.niche}::text = ANY(coalesce(niches, '{}')))
        AND (${f.audience}::text = '' OR audience_band = ${f.audience}::text)
        AND (${f.collab}::text = '' OR collab_status = ${f.collab}::text)
        AND (${f.verified}::text = '' OR (${f.verified}::text = 'yes') = coalesce(verified, false))
    ),
    n AS (
      SELECT count(*) FILTER (WHERE status = 'waiting')::int AS total_waiting,
             count(*) FILTER (WHERE status = 'approved')::int AS total_approved,
             count(*) FILTER (WHERE status = 'declined')::int AS total_declined,
             count(*) FILTER (WHERE status = 'disabled')::int AS total_disabled,
             (SELECT count(*)::int FROM base) AS everyone
      FROM f
    )
    SELECT n.*, pg.* FROM n
    LEFT JOIN LATERAL (
      SELECT * FROM f WHERE status = ${f.tab}::text
      ORDER BY created_at DESC, id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offsetFor(f.page)}
    ) pg ON true
    ORDER BY pg.created_at DESC, pg.id DESC`;
  return { rows: rows.filter((r) => r.id != null) as CreatorRow[], counts: counts(rows[0]) };
}

/** Numbers for the Members chooser tiles. */
export async function memberTypeCounts() {
  const r = await q<{
    projects: number;
    projects_waiting: number;
    projects_finished: number;
    creators: number;
    creators_waiting: number;
    creators_pending_review: number;
  }>`
    SELECT
      count(*) FILTER (WHERE u.account_type = 'project')::int AS projects,
      count(*) FILTER (WHERE u.account_type = 'project' AND u.approved_at IS NULL AND u.disabled_at IS NULL)::int AS projects_waiting,
      count(*) FILTER (WHERE u.account_type = 'project' AND w.goals_done_at IS NOT NULL AND w.marketing_done_at IS NOT NULL
                       AND w.buying_done_at IS NOT NULL)::int AS projects_finished,
      count(*) FILTER (WHERE u.account_type = 'creator')::int AS creators,
      count(*) FILTER (WHERE u.account_type = 'creator' AND u.approved_at IS NULL AND u.disabled_at IS NULL)::int AS creators_waiting,
      count(*) FILTER (WHERE u.account_type = 'creator' AND c.user_id IS NOT NULL AND NOT c.verified AND u.disabled_at IS NULL)::int
        AS creators_pending_review
    FROM users u
    LEFT JOIN project_workspace w ON w.user_id = u.id
    LEFT JOIN creator_profiles c ON c.user_id = u.id
    WHERE u.role = 'member'`;
  return r[0];
}
