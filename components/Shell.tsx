import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/auth";
import { Logo } from "./ui";
import NavLinks from "./NavLinks";

export default function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const links = [
    { href: "/members", label: "Home" },
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
