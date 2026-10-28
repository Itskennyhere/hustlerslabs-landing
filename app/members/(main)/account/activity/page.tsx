import { requireMember } from "@/lib/auth";
import { fmtDateTime } from "@/lib/list";
import { EVENT_LABELS, describeDevice, recentEvents } from "@/lib/security";
import { BackLink, Empty } from "@/components/list";

export default async function ActivityPage() {
  const s = await requireMember();
  const events = await recentEvents(s.userId, 25);
  return (
    <>
      <BackLink href="/members/account">Back to Account</BackLink>
      <div className="tag">Account</div>
      <h1>Recent activity.</h1>
      <p className="sub">
        Your last 25 security events. Something you do not recognise? <a href="/members/account/password">Change your password</a>{" "}
        and <a href="/members/account/devices">sign out other devices</a>.
      </p>
      {events.length === 0 ? (
        <Empty>Nothing yet. Sign-ins and security changes will show here.</Empty>
      ) : (
        <ul className="devices">
          {events.map((e, i) => (
            <li key={i}>
              <div>
                <strong>{EVENT_LABELS[e.kind] ?? e.kind}</strong>
                <div className="note">
                  {fmtDateTime(e.created_at)} · {describeDevice(e.user_agent)} · <span className="mono">{e.ip ?? "IP unknown"}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
