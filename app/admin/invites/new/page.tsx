import { requireOwner } from "@/lib/auth";
import { BackLink } from "@/components/list";
import InviteForm from "./InviteForm";

export default async function NewInvitePage() {
  await requireOwner();
  return (
    <>
      <BackLink href="/admin/invites">Back to admin keys</BackLink>
      <div className="tag">Admin</div>
      <h1>Generate an admin key.</h1>
      <p className="sub">
        An admin key creates a new admin account. Only give one to someone joining the team. Each key works once. Members and
        creators do not need a key: they sign up at hustlerslabs.com/join and wait for approval.
      </p>
      <InviteForm />
    </>
  );
}
