"use client";

import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string; count?: number }[] }) {
  const path = usePathname();
  return (
    <ul className="shell-links">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} aria-current={path === l.href || (l.href.split("/").length > 2 && path.startsWith(l.href + "/")) ? "page" : undefined}>
            {l.label}
            {l.count ? (
              <span className="nav-count" aria-label={`${l.count} new`}>
                {l.count}
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
