import { requireAdmin } from "@/lib/auth";
import { BackLink } from "@/components/list";
import InviteForm from "./InviteForm";

export default async function NewInvitePage() {
  await requireAdmin();
  return (
    <>
      <BackLink href="/admin/invites">Back to invite keys</BackLink>
      <div className="tag">Admin</div>
      <h1>Generate a key.</h1>
      <p className="sub">
        Each key works once. Send it to the new member privately. They choose their own username and password at hustlerslabs.com/join.
      </p>
      <InviteForm />
    </>
  );
}
