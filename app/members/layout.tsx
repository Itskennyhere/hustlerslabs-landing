import { requireMember } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { getAccountType } from "@/lib/onboarding";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  const user = await requireMember();
  const accountType = await getAccountType(user.userId);
  return (
    <Shell user={user} accountType={accountType}>
      {children}
    </Shell>
  );
}
