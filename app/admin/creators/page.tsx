import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

// Moved to Admin > Members > Creators.
export default async function OldCreatorsPage() {
  await requireAdmin();
  redirect("/admin/members/creators");
}
