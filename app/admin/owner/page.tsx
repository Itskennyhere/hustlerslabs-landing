import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { BackLink } from "@/components/list";
import OwnerForm from "./OwnerForm";

export default async function OwnerClaimPage() {
  await requireAdmin();
  // Once there is an owner, this page is gone for good.
  const owner = await q`SELECT 1 FROM users WHERE is_owner LIMIT 1`;
  if (owner[0] || (process.env.OWNER_CLAIM_TOKEN ?? "").length < 24) notFound();
  return (
    <>
      <BackLink href="/admin">Back to Admin</BackLink>
      <div className="tag">Admin</div>
      <h1>Become the owner.</h1>
      <p className="sub">
        Enter the one-time owner key. The owner is the only admin who can generate admin keys and sign out or disable other
        admins. The key works once.
      </p>
      <OwnerForm />
    </>
  );
}
