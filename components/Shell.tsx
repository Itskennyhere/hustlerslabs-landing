import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/auth";
import type { AccountType } from "@/lib/onboarding";
import { Logo } from "./ui";
import NavLinks from "./NavLinks";

export default function Shell({
  user,
  accountType = null,
  children,
}: {
  user: SessionUser;
  accountType?: AccountType | null;
  children: React.ReactNode;
}) {
  const links = [
    { href: "/members", label: "Home" },
    ...(accountType === "creator" ? [{ href: "/members/profile", label: "Profile" }] : []),
    ...(accountType === "project" ? [{ href: "/members/workspace", label: "Workspace" }] : []),
    { href: "/members/tools", label: "Tools" },
    { href: "/members/account", label: "Account" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <>
      <nav className="shell-nav">
        <Logo href="/members" />
        <NavLinks links={links} />
        <div className="shell-user">
          <span className="mono">@{user.username}</span>
          <form action={logout}>
            <button type="submit" className="btn ghost small">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="page">{children}</main>
    </>
  );
}
