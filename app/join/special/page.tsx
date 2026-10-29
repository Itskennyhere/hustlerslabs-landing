import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { readInviteTicket } from "@/lib/invite-code";
import { AuthShell } from "@/components/ui";
import { AdminJoinForm, OwnerForm } from "./SpecialForms";

export const dynamic = "force-dynamic";

// Opened only from the Invite code box on the sign-in page.
export default async function SpecialSetupPage() {
  const ticket = await readInviteTicket();
  if (!ticket) redirect("/login");
  if (ticket.kind === "member") redirect("/join");
  if (ticket.kind === "admin" && (await getSession())?.mfaVerified) redirect("/members");

  return (
    <AuthShell>
      <div className="tag">Invite accepted</div>
      {ticket.kind === "owner" ? (
        <>
          <h1>Set up the owner.</h1>
          <p className="sub">
            Sign in with the admin account that should become the owner. The owner is the only admin who can make invite codes
            and manage other admins. This works once.
          </p>
          <OwnerForm />
        </>
      ) : (
        <>
          <h1>Create your admin account.</h1>
          <p className="sub">This invite makes you an admin of Hustlers Labs. You set up two-step login next.</p>
          <AdminJoinForm />
        </>
      )}
      <p className="alt">
        <a href="/login">Back to sign in</a>
      </p>
    </AuthShell>
  );
}
