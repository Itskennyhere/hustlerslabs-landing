import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { maskEmail } from "@/lib/mail";
import { ago, plural } from "@/lib/list";
import { EVENT_LABELS, recentEvents, recoveryCodesLeft } from "@/lib/security";
import { getAccountType, getProjectProfile } from "@/lib/onboarding";
import { SettingsRow } from "@/components/list";

export default async function AccountPage() {
  const s = await requireMember();
  const [user, pending, devices, events, codesLeft, type] = await Promise.all([
    q<{ email: string | null; email_verified_at: string | null; password_changed_at: string | null; created_at: string }>`
      SELECT email, email_verified_at, password_changed_at, created_at FROM users WHERE id = ${s.userId}`,
    q<{ email: string }>`
      SELECT email FROM email_tokens
      WHERE user_id = ${s.userId} AND purpose = 'verify' AND used_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`,
    q<{ n: number }>`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${s.userId} AND mfa_verified AND expires_at > now()`,
    recentEvents(s.userId, 1),
    s.totpEnabled ? recoveryCodesLeft(s.userId) : Promise.resolve(0),
    getAccountType(s.userId),
  ]);
  const u = user[0];
  const project = type === "project" ? await getProjectProfile(s.userId) : null;
  const confirmed = u.email_verified_at ? u.email : null;

  const emailStatus = confirmed
    ? `${maskEmail(confirmed)} confirmed`
    : pending[0]
      ? `Waiting for you to confirm ${maskEmail(pending[0].email)}`
      : "No email confirmed yet";
  const last = events[0];

  return (
    <>
      <div className="tag">Account</div>
      <h1>Account.</h1>
      <p className="sub">
        Signed in as <span className="mono">@{s.username}</span>.
      </p>

      <ul className="settings">
        <SettingsRow
          href="/members/account/two-step"
          title="Two-step login"
          status={s.totpEnabled ? `On. ${plural(codesLeft, "recovery code")} left.` : "Off. Anyone with your password can sign in."}
        />
        <SettingsRow href="/members/account/email" title="Email" status={emailStatus} />
        <SettingsRow
          href="/members/account/password"
          title="Password"
          status={u.password_changed_at ? `Last changed ${ago(u.password_changed_at)}` : `Set when you joined, ${ago(u.created_at)}`}
        />
        <SettingsRow href="/members/account/devices" title="Signed-in devices" status={`${plural(devices[0]?.n ?? 0, "device")} signed in`} />
        <SettingsRow
          href="/members/account/activity"
          title="Recent activity"
          status={last ? `Last: ${EVENT_LABELS[last.kind] ?? last.kind}, ${ago(last.created_at)}` : "Nothing yet"}
          action="View"
        />
        {project && <SettingsRow href="/members/account/project" title="Project details" status={project.project_name} />}
      </ul>
    </>
  );
}
