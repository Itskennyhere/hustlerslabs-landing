import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { getCreatorProfile, getProjectProfile, getWorkspace, workspaceProgress } from "@/lib/onboarding";
import {
  AUDIENCE_BANDS,
  BUDGETS,
  CHAINS,
  CHANNELS,
  FUNDING,
  GOALS,
  MARKETING_OWNERS,
  PAYMENT_PREFS,
  PROJECT_CATEGORIES,
  STAGES,
  TEAM_SIZES,
  TOOLS,
  TRIED,
  labelOf,
  labelsOf,
} from "@/lib/onboarding-options";
import CreatorCard from "@/components/CreatorCard";
import { ProgressBar } from "@/components/WorkspaceChecklist";
import { approveMember, setCreatorVerified, setMemberDisabled, signOutMember } from "../../actions";
import { BackLink } from "@/components/list";
import { fmtDate } from "@/lib/list";
import { getXAccount } from "@/lib/x-oauth";
import { EVENT_LABELS, describeDevice, recentEvents } from "@/lib/security";

type UserRow = {
  id: number;
  username: string;
  role: string;
  account_type: string | null;
  created_at: string;
  disabled_at: string | null;
  email: string | null;
  last_login_at: string | null;
  approved_at: string | null;
  is_owner: boolean;
};


function Answers({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="answers">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === "" ? "-" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id: raw } = await params;
  // Numeric ids only: /admin/members/abc is a 404, not a lookup.
  if (!/^[1-9]\d{0,15}$/.test(raw)) notFound();
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const rows = await q<UserRow>`SELECT id, username, role, account_type, created_at, disabled_at, last_login_at, approved_at, is_owner,
           CASE WHEN email_verified_at IS NOT NULL THEN email END AS email
    FROM users WHERE id = ${id}`;
  const u = rows[0];
  if (!u) notFound();

  const type = u.is_owner ? "Owner" : u.role === "admin" ? "Admin" : u.account_type === "project" ? "Project" : u.account_type === "creator" ? "Creator" : "Member";

  const self = Number(u.id) === admin.userId;
  // Members can be managed by any admin; other admins only by the owner; the owner by nobody.
  const canManage = !self && !u.is_owner && (u.role === "member" || admin.isOwner);
  const waiting = u.role === "member" && !u.approved_at && !u.disabled_at;
  return (
    <>
      <BackLink href="/admin/members">Back to members</BackLink>
      <div className="tag">{type}</div>
      <h1>@{u.username}.</h1>
      <p className="sub">
        {type}. Joined {fmtDate(u.created_at)}. Last login {fmtDate(u.last_login_at)}.{u.email ? ` Email ${u.email}.` : ""}
        {u.disabled_at ? " Disabled." : ""}
        {waiting ? " Waiting for approval." : ""}
      </p>
      {waiting && (
        <div className="panel member-actions">
          <p className="note" style={{ marginBottom: "0.75rem" }}>
            {u.email ? "Email confirmed." : "Email not confirmed yet."} Review their answers below, then approve to let them in. Decline disables the account.
          </p>
          <div className="row">
            <form action={approveMember}>
              <input type="hidden" name="id" value={u.id} />
              <button className="btn" type="submit">
                Approve
              </button>
            </form>
            <form action={setMemberDisabled}>
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="disable" value="1" />
              <button className="btn danger" type="submit">
                Decline
              </button>
            </form>
          </div>
        </div>
      )}
      {canManage && !waiting && (
        <div className="row member-actions">
          <form action={signOutMember}>
            <input type="hidden" name="id" value={u.id} />
            <button className="btn ghost small" type="submit">
              Sign out everywhere
            </button>
          </form>
          <form action={setMemberDisabled}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="disable" value={u.disabled_at ? "0" : "1"} />
            <button className={`btn small ${u.disabled_at ? "ghost" : "danger"}`} type="submit">
              {u.disabled_at ? "Enable" : "Disable"}
            </button>
          </form>
        </div>
      )}
      {u.account_type === "project" && <ProjectDetail id={id} />}
      {u.account_type === "creator" && <CreatorDetail id={id} />}
      <SecurityActivity id={id} />
    </>
  );
}

async function SecurityActivity({ id }: { id: number }) {
  const [events, sessions] = await Promise.all([
    recentEvents(id, 15),
    q<{ n: number; totp: boolean }>`
      SELECT (SELECT count(*)::int FROM sessions WHERE user_id = ${id} AND mfa_verified AND expires_at > now()) AS n,
             (SELECT totp_enabled FROM users WHERE id = ${id}) AS totp`,
  ]);
  return (
    <div className="section">
      <h2>Security</h2>
      <Answers
        rows={[
          ["Two-step login", sessions[0]?.totp ? "On" : "Off"],
          ["Signed-in devices", String(sessions[0]?.n ?? 0)],
        ]}
      />
      <ul className="devices">
        {events.map((e, i) => (
          <li key={i}>
            <div>
              <strong>{EVENT_LABELS[e.kind] ?? e.kind}</strong>
              <div className="note">
                {fmtDate(e.created_at)} · {describeDevice(e.user_agent)} · <span className="mono">{e.ip ?? "IP unknown"}</span>
              </div>
            </div>
          </li>
        ))}
        {events.length === 0 && <li className="note">No activity recorded yet.</li>}
      </ul>
    </div>
  );
}

async function ProjectDetail({ id }: { id: number }) {
  const [p, w] = await Promise.all([getProjectProfile(id), getWorkspace(id)]);
  return (
    <>
      <div className="section">
        <h2>Sign-up answers</h2>
        {p ? (
          <Answers
            rows={[
              ["Project name", p.project_name],
              ["Website", p.website],
              ["X handle", `@${p.x_handle}`],
              ["Category", labelOf(PROJECT_CATEGORIES, p.category)],
              ["Chains", labelsOf(CHAINS, p.chains)],
              ["Stage", labelOf(STAGES, p.stage)],
              ["Token contract", p.token_contract ? <span className="mono wrap">{p.token_contract}</span> : null],
              ["Funding stage", labelOf(FUNDING, p.funding_stage)],
              ["Backers or partners", p.backers],
              ["Team size", labelOf(TEAM_SIZES, p.team_size)],
              ["Monthly budget (USD)", labelOf(BUDGETS, p.budget_band)],
              ["Decision maker", `${p.contact_name}, ${p.contact_role}`],
              ["Email", p.contact_email],
              ["Telegram", `@${p.contact_telegram}`],
            ]}
          />
        ) : (
          <div className="empty">No project details.</div>
        )}
      </div>

      <div className="section">
        <h2>Workspace</h2>
        <ProgressBar done={workspaceProgress(w)} />
        <h3 className="answers-title">Goals {w?.goals_done_at ? `(done ${fmtDate(w.goals_done_at)})` : "(not done)"}</h3>
        <Answers
          rows={[
            ["Goals", labelsOf(GOALS, w?.goals)],
            ["Key date", w?.key_date ? `${w.key_date}${w.key_date_note ? `. ${w.key_date_note}` : ""}` : null],
            ["Biggest blocker", w?.blocker],
            ["Success in 90 days", w?.success_90d],
          ]}
        />
        <h3 className="answers-title">Current marketing {w?.marketing_done_at ? `(done ${fmtDate(w.marketing_done_at)})` : "(not done)"}</h3>
        <Answers
          rows={[
            ["Who handles marketing", w?.marketing_owner ? labelOf(MARKETING_OWNERS, w.marketing_owner) : null],
            ["Channels", labelsOf(CHANNELS, w?.channels)],
            ["X followers", w?.x_followers_band ? labelOf(AUDIENCE_BANDS, w.x_followers_band) : null],
            ["Community members", w?.community_band ? labelOf(AUDIENCE_BANDS, w.community_band) : null],
            ["Tried", labelsOf(TRIED, w?.tried)],
          ]}
        />
        <h3 className="answers-title">Tools and payment {w?.buying_done_at ? `(done ${fmtDate(w.buying_done_at)})` : "(not done)"}</h3>
        <Answers
          rows={[
            ["Tools wanted", labelsOf(TOOLS, w?.wanted_tools)],
            ["Payment preference", w?.payment_pref ? labelOf(PAYMENT_PREFS, w.payment_pref) : null],
          ]}
        />
      </div>
    </>
  );
}

async function CreatorDetail({ id }: { id: number }) {
  const [c, x] = await Promise.all([getCreatorProfile(id), getXAccount(id)]);
  if (!c) {
    return (
      <div className="section">
        <div className="empty">Profile not set up yet.</div>
      </div>
    );
  }
  return (
    <div className="section">
      <h2>Creator card</h2>
      <div className="card-solo">
        <CreatorCard c={c} xConnected={x?.username ?? null} />
        <Answers
          rows={[
            ["Telegram (admin only)", <span key="tg" className="mono">@{c.telegram}</span>],
            ["X connected", x ? `@${x.username}${x.followers !== null ? `, ${x.followers.toLocaleString("en-US")} followers` : ""}` : "No"],
            ["Languages", c.languages],
            ["Verified", c.verified ? `Yes, ${fmtDate(c.verified_at)}` : "No"],
          ]}
        />
        <form action={setCreatorVerified}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="verify" value={c.verified ? "0" : "1"} />
          <button type="submit" className={`btn${c.verified ? " ghost" : ""}`}>
            {c.verified ? "Unverify" : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}
