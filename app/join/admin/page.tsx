import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/ui";
import AdminJoinForm from "./AdminJoinForm";

export const dynamic = "force-dynamic";

export default async function AdminJoinPage() {
  const s = await getSession();
  if (s?.mfaVerified) redirect("/members");
  return (
    <AuthShell>
      <div className="tag">Team</div>
      <h1>Join as an admin.</h1>
      <p className="sub">For the Hustlers Labs team. You need an admin key from the owner. It works once.</p>
      <AdminJoinForm />
      <p className="alt">
        Not on the team? <a href="/join">Create a member account.</a>
      </p>
    </AuthShell>
  );
}
