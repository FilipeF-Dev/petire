"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { addToCart } from "@/lib/cart";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type RecentStore,
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
  const router = useRouter();
  const stores = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (stores.length === 0) return null;

  /**
   * Repete o pedido inteiro num toque.
   *
   * Só a identidade dos itens é remontada — preço, disponibilidade e o número
   * do WhatsApp são relidos do banco quando o carrinho abre. Item que saiu do
   * cardápio some lá, com o aviso que já existe; deixá-lo passar produziria um
   * pedido que a loja não consegue atender.
   */
  function repeat(store: RecentStore) {
    if (!store.storeId || !store.lines?.length) return;

    for (const line of store.lines) {
      addToCart({
        storeId: store.storeId,
        productId: line.productId,
        optionIds: line.optionIds,
        quantity: line.quantity,
        note: line.note,
      });
    }

    router.push("/carrinho");
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
        Peça novamente
      </h2>

      <ul className="flex flex-col gap-2">
        {stores.map((store) => {
          const canRepeat = Boolean(store.storeId && store.lines?.length);
          const items = store.lines?.length ?? 0;

          return (
            <li
              key={store.slug}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-sm dark:border-neutral-800"
            >
              <Link
                href={`/loja/${store.slug}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                {/* A logo não é guardada: a URL do Storage expira e uma foto
                    quebrada é pior do que a inicial do nome. */}
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 font-semibold text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
                >
                  {store.name.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {store.name}
                  </span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                    {canRepeat
                      ? `último pedido · ${items} ${items === 1 ? "item" : "itens"}`
                      : "ver cardápio"}
                  </span>
                </span>
              </Link>

              {canRepeat ? (
                <button
                  type="button"
                  onClick={() => repeat(store)}
                  className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-surface-hover dark:border-neutral-700"
                >
                  Repetir
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
