import { requireAdmin } from "@/lib/auth";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <Shell user={user}>{children}</Shell>;
}
