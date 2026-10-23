import { requireMember } from "@/lib/auth";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMember();
  return <Shell user={user}>{children}</Shell>;
}
