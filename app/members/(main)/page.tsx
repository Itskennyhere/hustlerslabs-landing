import { requireMember } from "@/lib/auth";
import { getAccountType, getCreatorProfile, getProjectProfile, getWorkspace } from "@/lib/onboarding";
import CreatorCard from "@/components/CreatorCard";
import WorkspaceChecklist from "@/components/WorkspaceChecklist";
import { getXAccount } from "@/lib/x-oauth";

export default async function MembersHome() {
  // Each page re-checks too, so no page is ever reachable just because a layout was skipped.
  const user = await requireMember();
  const type = await getAccountType(user.userId);

  if (type === "creator") {
    const [profile, x] = await Promise.all([getCreatorProfile(user.userId), getXAccount(user.userId)]);
    return (
      <>
        <div className="tag">Creator</div>
        <h1>Welcome, {profile?.display_name ?? user.username}.</h1>
        <p className="sub">This is your creator card. Hustlers Labs uses it to match you with projects.</p>
        {profile && (
          <div className="card-solo">
            <CreatorCard c={profile} xConnected={x?.username ?? null} />
            <a className="btn ghost" href="/members/profile">
              Edit profile
            </a>
          </div>
        )}
      </>
    );
  }

  if (type === "project") {
    const [project, w] = await Promise.all([getProjectProfile(user.userId), getWorkspace(user.userId)]);
    return (
      <>
        <div className="tag">Project</div>
        <h1>Welcome, {project?.project_name ?? user.username}.</h1>
        <p className="sub">This is the private side of Hustlers Labs.</p>
        <WorkspaceChecklist w={w} />
        <div className="section">
          <h2>Tools</h2>
          <p className="note" style={{ marginBottom: "1.25rem" }}>Internal tools will live here.</p>
          <a className="btn ghost" href="/members/tools">Open tools</a>
        </div>
      </>
    );
  }

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
