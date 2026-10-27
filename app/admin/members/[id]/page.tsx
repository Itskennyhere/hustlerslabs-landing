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
import { setCreatorVerified } from "../../actions";
import { getXAccount } from "@/lib/x-oauth";
import { EVENT_LABELS, describeDevice, recentEvents } from "@/lib/security";

type UserRow = { id: number; username: string; role: string; account_type: string | null; created_at: string; disabled_at: string | null };

const fmt = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" }) : "-";

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
  await requireAdmin();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const rows = await q<UserRow>`SELECT id, username, role, account_type, created_at, disabled_at FROM users WHERE id = ${id}`;
  const u = rows[0];
  if (!u) notFound();

  const type = u.role === "admin" ? "Admin" : u.account_type === "project" ? "Project" : u.account_type === "creator" ? "Creator" : "Member";

  return (
    <>
      <div className="tag">
        <a href="/admin">Admin</a> / {type}
      </div>
      <h1>@{u.username}.</h1>
      <p className="sub">
        {type}. Joined {fmt(u.created_at)}.{u.disabled_at ? " Disabled." : ""}
      </p>
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
                {fmt(e.created_at)} · {describeDevice(e.user_agent)} · <span className="mono">{e.ip ?? "IP unknown"}</span>
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
        <h3 className="answers-title">Goals {w?.goals_done_at ? `(done ${fmt(w.goals_done_at)})` : "(not done)"}</h3>
        <Answers
          rows={[
            ["Goals", labelsOf(GOALS, w?.goals)],
            ["Key date", w?.key_date ? `${w.key_date}${w.key_date_note ? `. ${w.key_date_note}` : ""}` : null],
            ["Biggest blocker", w?.blocker],
            ["Success in 90 days", w?.success_90d],
          ]}
        />
        <h3 className="answers-title">Current marketing {w?.marketing_done_at ? `(done ${fmt(w.marketing_done_at)})` : "(not done)"}</h3>
        <Answers
          rows={[
            ["Who handles marketing", w?.marketing_owner ? labelOf(MARKETING_OWNERS, w.marketing_owner) : null],
            ["Channels", labelsOf(CHANNELS, w?.channels)],
            ["X followers", w?.x_followers_band ? labelOf(AUDIENCE_BANDS, w.x_followers_band) : null],
            ["Community members", w?.community_band ? labelOf(AUDIENCE_BANDS, w.community_band) : null],
            ["Tried", labelsOf(TRIED, w?.tried)],
          ]}
        />
        <h3 className="answers-title">Tools and payment {w?.buying_done_at ? `(done ${fmt(w.buying_done_at)})` : "(not done)"}</h3>
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
            ["Verified", c.verified ? `Yes, ${fmt(c.verified_at)}` : "No"],
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
