import { requireMember } from "@/lib/auth";

export default async function MembersHome() {
  // Each page re-checks too, so no page is ever reachable just because a layout was skipped.
  const user = await requireMember();
  return (
    <>
      <div className="tag">Members area</div>
      <h1>Welcome, {user.username}.</h1>
      <p className="sub">This is the private side of Hustlers Labs.</p>

      <div className="section">
        <h2>Tools</h2>
        <p className="note" style={{ marginBottom: "1.25rem" }}>Internal tools will live here.</p>
        <a className="btn ghost" href="/members/tools">Open tools</a>
      </div>
    </>
  );
}
