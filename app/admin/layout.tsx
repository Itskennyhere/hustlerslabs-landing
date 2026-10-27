import { requireAdmin } from "@/lib/auth";
import { ensureSchema } from "@/lib/migrate";
import { getEmailStatus } from "@/lib/email-confirm";
import Shell from "@/components/Shell";
import NavLinks from "@/components/NavLinks";
import { newIntroCount } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  const user = await requireAdmin();
  const [email, newIntros] = await Promise.all([getEmailStatus(user.userId), newIntroCount()]);
  return (
    <Shell user={user} email={email} newIntros={newIntros}>
      <nav className="subnav" aria-label="Admin">
        <NavLinks
          links={[
            { href: "/admin", label: "Overview" },
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
