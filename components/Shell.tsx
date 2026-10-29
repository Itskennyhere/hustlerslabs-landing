import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/auth";
import type { AccountType } from "@/lib/onboarding";
import type { EmailStatus } from "@/lib/email-confirm";
import { Logo } from "./ui";
import { mailConfigured } from "@/lib/mail";
import NavLinks from "./NavLinks";

export default function Shell({
  user,
  accountType = null,
  email = null,
  newIntros = 0,
  children,
}: {
  user: SessionUser;
  accountType?: AccountType | null;
  email?: EmailStatus | null;
  newIntros?: number;
  children: React.ReactNode;
}) {
  const links = [
    { href: "/members", label: "Home" },
    ...(accountType === "creator" ? [{ href: "/members/profile", label: "Profile" }] : []),
    ...(accountType === "project"
      ? [
          { href: "/members/workspace", label: "Workspace" },
          { href: "/members/creators", label: "Creators" },
        ]
      : []),
    { href: "/members/tools", label: "Tools" },
    { href: "/members/account", label: "Account" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin", count: newIntros }] : []),
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
      {user.role === "admin" && !mailConfigured() && (
        <div className="banner" role="status">
          <span>Email is not set up. Add SMTP_USER and SMTP_PASS in Vercel to turn on email codes and password resets.</span>
        </div>
      )}
      {mailConfigured() && email && !email.confirmed && (
        <div className="banner" role="status">
          <span>
            {user.role === "admin"
              ? "Confirm your email. Admin sign-ins will then also need a code sent to it."
              : "Confirm your email so you can reset your password if you forget it."}
            {email.pending ? (
              <>
                {" "}We sent a link to <span className="mono">{email.pending}</span>.
              </>
            ) : null}
          </span>
          <a href="/members/account/email">{email.pending ? "Resend or change" : "Add email"}</a>
        </div>
      )}
      <main className="page">{children}</main>
    </>
  );
}
