"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/recent-orders";

/**
 * O atalho de volta, no topo da home.
 *
 * Quem já pediu uma vez não quer refazer o caminho — CEP, lista, cardápio —
 * para pedir a mesma coisa da mesma loja. E a recompra é o que faz o número
 * que o lojista vê crescer do primeiro mês para o segundo, que é quando ele
 * decide renovar.
 *
 * A lista mora no browser do cliente (ver src/lib/recent-orders.ts), então não
 * existe no HTML estático da home: ela aparece depois da hidratação, e some
 * inteira para quem nunca pediu — uma seção vazia no lugar mais visível da
 * página só atrapalharia quem está chegando agora.
 */
export function OrderAgain() {
  const stores = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (stores.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
        Peça novamente
      </h2>

      <ul className="flex flex-col gap-2">
        {stores.map((store) => (
          <li key={store.slug}>
            <Link
              href={`/loja/${store.slug}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-sm transition hover:bg-surface-hover dark:border-neutral-800"
            >
              <span className="flex min-w-0 items-center gap-3">
                {/* A logo não é guardada: a URL do Storage expira e uma foto
                    quebrada é pior do que a inicial do nome. */}
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 font-semibold text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
                >
                  {store.name.charAt(0)}
                </span>
                <span className="truncate font-medium">{store.name}</span>
              </span>
              <span className="shrink-0 text-neutral-500 dark:text-neutral-400">
                ver cardápio
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
