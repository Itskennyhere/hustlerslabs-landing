import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getAccountType, getWorkspace } from "@/lib/onboarding";
import WorkspaceChecklist from "@/components/WorkspaceChecklist";

export default async function WorkspacePage() {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "project") redirect("/members");
  const w = await getWorkspace(s.userId);
  return (
    <>
      <div className="tag">Workspace</div>
      <h1>Your workspace.</h1>
      <p className="sub">Tell us where you are and where you want to go, so we can set up the right tools.</p>
      <WorkspaceChecklist w={w} />
    </>
  );
}
