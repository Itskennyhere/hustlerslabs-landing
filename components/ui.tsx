"use client";

import { useFormStatus } from "react-dom";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="hl-logo">
      <svg width="22" height="22" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="10" y="10" width="18" height="140" rx="3" fill="#0a0a0a" />
        <rect x="132" y="10" width="18" height="140" rx="3" fill="#0a0a0a" />
        <polygon points="28,68 150,50 150,72 28,90" fill="#5BDD2F" />
      </svg>
      Hustlers<span style={{ color: "#5BDD2F" }}>Labs</span>
    </a>
  );
}

export function SubmitButton({
  children,
  pending: pendingLabel = "Working...",
  className = "btn",
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <header className="auth-top">
        <Logo />
      </header>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
