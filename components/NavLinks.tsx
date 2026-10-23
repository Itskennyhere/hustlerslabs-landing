"use client";

import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <ul className="shell-links">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} aria-current={path === l.href ? "page" : undefined}>
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
