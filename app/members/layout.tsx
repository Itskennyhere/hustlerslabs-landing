import { requireMember } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { getAccountType, newIntroCount } from "@/lib/onboarding";
import { getEmailStatus } from "@/lib/email-confirm";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  const user = await requireMember();
  const [accountType, email, newIntros] = await Promise.all([
    getAccountType(user.userId),
    getEmailStatus(user.userId),
    user.role === "admin" ? newIntroCount() : Promise.resolve(0),
  ]);
  return (
    <Shell user={user} accountType={accountType} email={email} newIntros={newIntros}>
      {children}
    </Shell>
  );
}
