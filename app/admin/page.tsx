import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { revokeInvite, setMemberDisabled, signOutMember } from "./actions";
import InviteForm from "./InviteForm";

type InviteRow = {
  id: number;
  label: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  used_by: string | null;
};
type MemberRow = {
  id: number;
  username: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  disabled_at: string | null;
  totp_enabled: boolean;
  account_type: "project" | "creator" | null;
  email: string | null;
  progress: number | null;
};

function typeLabel(m: MemberRow): string {
  if (m.role === "admin") return "Admin";
  if (m.account_type === "project") return "Project";
  if (m.account_type === "creator") return "Creator";
  return "Member";
}

const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

function inviteStatus(i: InviteRow): { text: string; cls: string } {
  if (i.used_at) return { text: "Used", cls: "off" };
  if (i.revoked_at) return { text: "Revoked", cls: "off" };
  if (new Date(i.expires_at) < new Date()) return { text: "Expired", cls: "off" };
  return { text: "Active", cls: "on" };
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [invites, members] = await Promise.all([
    q<InviteRow>`
      SELECT i.id, i.label, i.created_at, i.expires_at, i.used_at, i.revoked_at, u.username AS used_by
      FROM invites i LEFT JOIN users u ON u.invite_id = i.id
      ORDER BY i.created_at DESC LIMIT 50`,
    q<MemberRow>`
      SELECT u.id, u.username, u.role, u.created_at, u.last_login_at, u.disabled_at, u.totp_enabled, u.account_type,
             CASE WHEN u.email_verified_at IS NOT NULL THEN u.email END AS email,
             CASE WHEN u.account_type = 'project' THEN
               ((w.goals_done_at IS NOT NULL)::int + (w.marketing_done_at IS NOT NULL)::int + (w.buying_done_at IS NOT NULL)::int)
             END AS progress
      FROM users u LEFT JOIN project_workspace w ON w.user_id = u.id
      ORDER BY u.created_at DESC`,
  ]);

  return (
    <>
      <div className="tag">Admin</div>
      <h1>Master control.</h1>
      <p className="sub">Generate invite keys and manage who has access.</p>

      <div className="section">
        <h2>New invite key</h2>
        {!admin.totpEnabled ? (
          <p className="error">
            Turn on two-step login in <a href="/members/account">Account</a> before generating invite keys.
          </p>
        ) : (
          <>
            <p className="note" style={{ marginBottom: "1rem" }}>
              Each key works once. Send it to the new member privately. They will set their own username and password.
            </p>
            <InviteForm />
          </>
        )}
      </div>

      <div className="section">
        <h2>Invite keys</h2>
        {invites.length === 0 ? (
          <div className="empty">No keys generated yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>For</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Used by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const st = inviteStatus(i);
                  return (
                    <tr key={i.id}>
                      <td>{i.label ?? "-"}</td>
                      <td><span className={`pill ${st.cls}`}>{st.text}</span></td>
                      <td>{fmt(i.created_at)}</td>
                      <td>{fmt(i.expires_at)}</td>
                      <td className="mono">{i.used_by ? `@${i.used_by}` : "-"}</td>
                      <td>
                        {st.text === "Active" && (
                          <form action={revokeInvite}>
                            <input type="hidden" name="id" value={i.id} />
                            <button className="btn danger small" type="submit">Revoke</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2>Members</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Type</th>
                <th>Workspace</th>
                <th>Status</th>
                <th>2FA</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Last login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const self = Number(m.id) === admin.userId;
                return (
                  <tr key={m.id}>
                    <td className="mono">
                      <a href={`/admin/members/${m.id}`}>@{m.username}</a>
                      {self ? " (you)" : ""}
                    </td>
                    <td>{typeLabel(m)}</td>
                    <td className="mono">{m.account_type === "project" && m.role !== "admin" ? `${m.progress ?? 0}/3` : "-"}</td>
                    <td>
                      <span className={`pill ${m.disabled_at ? "off" : "on"}`}>{m.disabled_at ? "Disabled" : "Active"}</span>
                    </td>
                    <td>{m.totp_enabled ? "On" : "Off"}</td>
                    <td className="mono">{m.email ?? "-"}</td>
                    <td>{fmt(m.created_at)}</td>
                    <td>{fmt(m.last_login_at)}</td>
                    <td>
                      {!self && m.role !== "admin" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <form action={signOutMember}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="btn ghost small" type="submit">Sign out</button>
                          </form>
                          <form action={setMemberDisabled}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="disable" value={m.disabled_at ? "0" : "1"} />
                            <button className={`btn small ${m.disabled_at ? "ghost" : "danger"}`} type="submit">
                              {m.disabled_at ? "Enable" : "Disable"}
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
