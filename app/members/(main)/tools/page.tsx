import { requireMember } from "@/lib/auth";
import { toolsLockedAt } from "@/lib/tools-access";
import { ProgressBar } from "@/components/WorkspaceChecklist";
import XScanner from "@/components/tools/XScanner";

export default async function ToolsPage() {
  const s = await requireMember();

  const done = await toolsLockedAt(s.userId);
  if (done !== null) {
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

  return (
    <>
      <div className="tag">Tools</div>
      <h1>Tools.</h1>
      <p className="sub">Private tools for members.</p>
      <XScanner />
    </>
  );
}
