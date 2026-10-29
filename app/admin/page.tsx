import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { ago } from "@/lib/list";
import { Tile } from "@/components/list";

type Counts = {
  members: number;
  waiting: number;
  has_owner: boolean;
  members_week: number;
  keys_active: number;
  intros_new: number;
  creators_pending: number;
  projects_open: number;
};
type Attention = { kind: "approval" | "intro" | "creator" | "key"; ref: number; label: string; at: string };

const ATTENTION_TEXT: Record<Attention["kind"], (a: Attention) => string> = {
  approval: (a) => `New sign-up to approve: ${a.label}`,
  intro: (a) => `New intro request: ${a.label}`,
  creator: (a) => `Creator to verify: ${a.label}`,
  key: (a) => `Invite code ${a.label} expires within 24 hours`,
};
const ATTENTION_HREF: Record<Attention["kind"], (a: Attention) => string> = {
  approval: (a) => `/admin/members/${a.ref}`,
  intro: () => "/admin/intros?tab=new",
  creator: (a) => `/admin/members/${a.ref}`,
  key: () => "/admin/invites",
};

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const admin = await requireAdmin();
  const [counts, attention] = await Promise.all([
    q<Counts>`
      SELECT
        (SELECT count(*)::int FROM users) AS members,
        (SELECT count(*)::int FROM users WHERE role = 'member' AND approved_at IS NULL AND disabled_at IS NULL) AS waiting,
        EXISTS (SELECT 1 FROM users WHERE is_owner) AS has_owner,
        (SELECT count(*)::int FROM users WHERE created_at > now() - interval '7 days') AS members_week,
        (SELECT count(*)::int FROM invites WHERE kind IN ('admin', 'member') AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()) AS keys_active,
        (SELECT count(*)::int FROM intro_requests WHERE status = 'new') AS intros_new,
        (SELECT count(*)::int FROM creator_profiles c JOIN users u ON u.id = c.user_id
          WHERE NOT c.verified AND u.disabled_at IS NULL) AS creators_pending,
        (SELECT count(*)::int FROM users u JOIN project_workspace w ON w.user_id = u.id
          WHERE u.account_type = 'project' AND u.disabled_at IS NULL
            AND (w.goals_done_at IS NULL OR w.marketing_done_at IS NULL OR w.buying_done_at IS NULL)) AS projects_open`,
    q<Attention>`
      SELECT * FROM (
        (SELECT 'approval' AS kind, u.id AS ref,
                '@' || u.username || coalesce(' (' || initcap(u.account_type) || ')', '') AS label, u.created_at AS at
         FROM users u
         WHERE u.role = 'member' AND u.approved_at IS NULL AND u.disabled_at IS NULL
         ORDER BY u.created_at LIMIT 2)
        UNION ALL
        (SELECT 'intro' AS kind, r.id AS ref,
                coalesce(p.project_name, pu.username) || ' wants to meet ' || coalesce(c.display_name, cu.username) AS label,
                r.created_at AS at
         FROM intro_requests r
         JOIN users pu ON pu.id = r.project_user_id LEFT JOIN project_profiles p ON p.user_id = r.project_user_id
         JOIN users cu ON cu.id = r.creator_user_id LEFT JOIN creator_profiles c ON c.user_id = r.creator_user_id
         WHERE r.status = 'new' ORDER BY r.created_at DESC LIMIT 2)
        UNION ALL
        (SELECT 'creator', c.user_id, c.display_name, c.created_at
         FROM creator_profiles c JOIN users u ON u.id = c.user_id
         WHERE NOT c.verified AND u.disabled_at IS NULL ORDER BY c.created_at DESC LIMIT 2)
        UNION ALL
        (SELECT 'key', i.id, coalesce('for ' || i.label, 'without a name'), i.expires_at
         FROM invites i
         WHERE ${admin.isOwner}::boolean AND i.kind IN ('admin', 'member') AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() AND i.expires_at < now() + interval '24 hours'
         ORDER BY i.expires_at LIMIT 2)
      ) a
      ORDER BY (kind = 'approval') DESC, (kind = 'key') DESC, at DESC
      LIMIT 5`,
  ]);
  const c = counts[0];

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Overview.</h1>
      <p className="sub">Who has access, what needs a reply, and what projects ask for.</p>

      {(await searchParams).owner === "1" && admin.isOwner && (
        <p className="banner-inline" role="status">
          You are now the owner. You can generate invite codes and manage other admins.
        </p>
      )}
      {!c.has_owner && (process.env.OWNER_CLAIM_TOKEN ?? "").length >= 24 && (
        <p className="banner-inline" role="status">
          No owner yet. Sign out, enter the one-time owner key in the Invite code box on the sign-in page, and sign in with your admin login.
        </p>
      )}

      <div className="tiles">
        <Tile href="/admin/members" title="Members" value={c.members} note={`${c.members_week} new this week`} />
        <Tile href="/admin/members?status=pending" title="Waiting for approval" value={c.waiting} note="New sign-ups" />
        <Tile href="/admin/intros?tab=new" title="Intro requests" value={c.intros_new} note="New" />
        <Tile href="/admin/creators?status=pending" title="Creators" value={c.creators_pending} note="Pending review" />
        <Tile href="/admin/members?type=project&workspace=open" title="Projects" value={c.projects_open} note="Workspace unfinished" />
        <Tile href="/admin/insights" title="Insights" value="View" note="What projects ask for" />
        {admin.isOwner && <Tile href="/admin/invites" title="Invite codes" value={c.keys_active} note="Active" />}
      </div>

      <div className="section">
        <h2>Needs attention</h2>
        {attention.length === 0 ? (
          <div className="empty">Nothing needs attention right now.</div>
        ) : (
          <ul className="settings">
            {attention.map((a) => (
              <li key={`${a.kind}-${a.ref}`}>
                <a className="settings-row" href={ATTENTION_HREF[a.kind](a)}>
                  <span className="settings-text">
                    <span className="settings-title">{ATTENTION_TEXT[a.kind](a)}</span>
                    <span className="settings-status">{a.kind === "key" ? `Expires ${new Date(a.at).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}` : ago(a.at)}</span>
                  </span>
                  <span className="settings-action">Open</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
