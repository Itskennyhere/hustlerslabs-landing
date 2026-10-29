import { requireMember } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDateTime } from "@/lib/list";
import { describeDevice } from "@/lib/security";
import { BackLink } from "@/components/list";
import { revokeSession, signOutOtherDevices } from "../actions";

export default async function DevicesPage() {
  const s = await requireMember();
  const devices = await q<{ id: number; ip: string | null; user_agent: string | null; created_at: string; last_seen_at: string | null }>`
    SELECT id, ip, user_agent, created_at, last_seen_at FROM sessions
    WHERE user_id = ${s.userId} AND mfa_verified AND expires_at > now()
    ORDER BY coalesce(last_seen_at, created_at) DESC
    LIMIT 50`;
  const others = devices.filter((d) => Number(d.id) !== s.sessionId).length;

  return (
    <>
      <BackLink href="/members/account">Back to Account</BackLink>
      <div className="tag">Account</div>
      <h1>Signed-in devices.</h1>
      <p className="sub">Do not recognise one? Sign it out, then change your password.</p>

      <ul className="devices">
        {devices.map((d) => (
          <li key={d.id}>
            <div>
              <strong>{describeDevice(d.user_agent)}</strong>
              {Number(d.id) === s.sessionId && <span className="this-device">This device</span>}
              <div className="note">
                <span className="mono">{d.ip ?? "IP unknown"}</span> · Signed in {fmtDateTime(d.created_at)} · Last active{" "}
                {fmtDateTime(d.last_seen_at ?? d.created_at)}
              </div>
            </div>
            {Number(d.id) !== s.sessionId && (
              <form action={revokeSession}>
                <input type="hidden" name="id" value={d.id} />
                <button type="submit" className="btn ghost small">
                  Sign out
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {others > 0 && (
        <form action={signOutOtherDevices} style={{ marginTop: "1rem" }}>
          <button type="submit" className="btn danger">
            Sign out all other devices
          </button>
        </form>
      )}
    </>
  );
}
