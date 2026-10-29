import { requireOwner } from "@/lib/auth";
import { BackLink } from "@/components/list";
import InviteForm from "./InviteForm";

export default async function NewInvitePage() {
  await requireOwner();
  return (
    <>
      <BackLink href="/admin/invites">Back to invite codes</BackLink>
      <div className="tag">Admin</div>
      <h1>Generate an invite code.</h1>
      <p className="sub">
        Each code works once and is entered in the Invite code box on the sign-in page. A preferred code lets a member skip the
        team review. An admin code creates a new admin, so only give one to someone joining the team. Everyone else signs up
        normally and waits for approval.
      </p>
      <InviteForm />
    </>
  );
}
