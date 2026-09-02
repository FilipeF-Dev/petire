"use client";

import Link from "next/link";

import { useCart } from "@/components/use-cart";
import { countItems } from "@/lib/cart";

/**
 * Barra fixa no rodapé do cardápio.
 *
 * Mostra o carrinho inteiro, não só o desta loja: o cliente pode ter itens da
 * distribuidora ao lado, e sumir com eles da vista é a forma mais fácil de
 * fazer alguém esquecer metade do pedido.
 */
export function CartBar() {
  const lines = useCart();
  const total = countItems(lines);

  if (total === 0) return null;

  return (
    <div className="sticky bottom-4 z-40 mt-4 flex justify-center px-4">
      <Link
        href="/carrinho"
        className="flex w-full max-w-md items-center justify-between gap-4 rounded-xl bg-neutral-900 px-5 py-3.5 text-white shadow-lg transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        <span className="text-sm font-medium">Ver carrinho</span>
        <span className="text-sm tabular-nums">
          {total} {total === 1 ? "item" : "itens"}
        </span>
      </Link>
    </div>
  );
}
