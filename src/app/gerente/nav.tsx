"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/gerente", label: "Início" },
  { href: "/gerente/cardapio", label: "Cardápio" },
  { href: "/gerente/loja", label: "Minha loja" },
] as const;

export function GerenteNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
      {LINKS.map(({ href, label }) => {
        const isActive =
          href === "/gerente" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "-mb-px border-b-2 border-neutral-900 px-3 py-3 text-sm font-medium whitespace-nowrap dark:border-neutral-100"
                : "-mb-px border-b-2 border-transparent px-3 py-3 text-sm text-neutral-500 whitespace-nowrap transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
