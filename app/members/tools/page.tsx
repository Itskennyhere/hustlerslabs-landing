import { requireMember } from "@/lib/auth";

export default async function ToolsPage() {
  await requireMember();
  return (
    <>
      <div className="tag">Tools</div>
      <h1>Tools.</h1>
      <p className="sub">Private tools for members.</p>
      <div className="empty">Nothing here yet.</div>
    </>
  );
}
