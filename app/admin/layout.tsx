import { requireAdmin } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { getEmailStatus } from "@/lib/email-confirm";
import Shell from "@/components/Shell";
import NavLinks from "@/components/NavLinks";
import { newIntroCount } from "@/lib/onboarding";
import { pendingApprovals } from "@/lib/approval";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  const user = await requireAdmin();
  const [email, newIntros, waiting] = await Promise.all([getEmailStatus(user.userId), newIntroCount(), pendingApprovals()]);
  return (
    <Shell user={user} email={email} newIntros={newIntros + waiting}>
      <nav className="subnav" aria-label="Admin">
        <NavLinks
          links={[
            { href: "/admin", label: "Overview" },
            { href: "/admin/members", label: "Members", count: waiting },
            ...(user.isOwner ? [{ href: "/admin/invites", label: "Invite codes" }] : []),
            { href: "/admin/creators", label: "Creators" },
            { href: "/admin/intros", label: "Intros", count: newIntros },
            { href: "/admin/insights", label: "Insights" },
          ]}
        />
      </nav>
      {children}
    </Shell>
  );
}
