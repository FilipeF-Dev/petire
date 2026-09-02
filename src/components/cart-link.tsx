"use client";

import Link from "next/link";

import { useCart } from "@/components/use-cart";
import { countItems } from "@/lib/cart";

export function CartLink() {
  const total = countItems(useCart());

  return (
    <Link
      href="/carrinho"
      className="flex items-center gap-2 text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
    >
      Carrinho
      {total > 0 ? (
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white tabular-nums dark:bg-white dark:text-neutral-900">
          {total}
        </span>
      ) : null}
    </Link>
  );
}
