import { requireMember } from "@/lib/auth";
import { WORKSPACE_SECTIONS, getAccountType, getWorkspace, workspaceProgress } from "@/lib/onboarding";
import { ProgressBar } from "@/components/WorkspaceChecklist";

export default async function ToolsPage() {
  const s = await requireMember();

  // Projects unlock tools by completing their workspace. Creators and admins are not affected.
  if ((await getAccountType(s.userId)) === "project") {
    const done = workspaceProgress(await getWorkspace(s.userId));
    if (done < WORKSPACE_SECTIONS.length) {
      return (
        <>
          <div className="tag">Tools</div>
          <h1>Tools.</h1>
          <div className="panel locked">
            <h2>Finish your workspace to unlock tools.</h2>
            <ProgressBar done={done} />
            <a className="btn" href="/members/workspace">
              Go to workspace
            </a>
          </div>
        </>
      );
    }
  }

  return (
    <>
      <div className="tag">Tools</div>
      <h1>Tools.</h1>
      <p className="sub">Private tools for members.</p>
      <div className="empty">Nothing here yet.</div>
    </>
  );
}
