"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { useCustomerLocation } from "@/components/location-bar";
import { formatCep } from "@/lib/customer-location";
import { formatCents, formatDeliveryFee } from "@/lib/money";
import { sortByProximity, type CustomerPlace } from "@/lib/proximity";
import { slugify } from "@/lib/slug";
import type { PublicStoreCard } from "@/lib/storefront";

/**
 * A lista de lojas, ordenada da mais perto para a mais distante.
 *
 * A ordenação é feita **no browser** de propósito: o CEP do cliente mora só no
 * localStorage dele (ver src/lib/customer-location.ts) e mandar isso para o
 * servidor — ou pior, para a query string, que é compartilhável e indexável —
 * transformaria em dado de cadastro o que hoje não sai do aparelho.
 *
 * O servidor já entrega a lista numa ordem que serve sozinha: abertas antes de
 * fechadas e, quando a URL traz `perto`, as do bairro primeiro. Isso é o que
 * aparece na primeira pintura e o que vale sem JavaScript; a proximidade pelo
 * CEP refina depois da hidratação.
 */
export function StoreList({
  stores,
  nearSlug,
}: {
  stores: PublicStoreCard[];
  nearSlug: string | null;
}) {
  const location = useCustomerLocation();

  const customer = useMemo<CustomerPlace | null>(() => {
    if (!location) return null;

    // Cidade pequena tem CEP único e volta sem bairro do ViaCEP. Nesse caso o
    // `perto` da URL é o que sobra — ele veio do bairro escolhido na home.
    const neighborhood = location.neighborhood
      ? slugify(location.neighborhood)
      : nearSlug;

    return { cep: location.cep, neighborhoodSlug: neighborhood || null };
  }, [location, nearSlug]);

  const ordered = useMemo(
    () => sortByProximity(stores, customer),
    [stores, customer],
  );

  const nearCount = nearSlug
    ? stores.filter((store) => store.neighborhood_slug === nearSlug).length
    : 0;
  const nearName = nearSlug
    ? stores.find((store) => store.neighborhood_slug === nearSlug)?.neighborhood
    : null;

  return (
    <div className="flex flex-col gap-4">
      {customer ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Da mais perto para a mais distante do CEP {formatCep(customer.cep)}. A
          distância é uma estimativa pela numeração do CEP — confirme a entrega
          com a loja no WhatsApp.
        </p>
      ) : nearName && nearCount > 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {nearCount === 1
            ? `1 loja no ${nearName}, mostrada primeiro.`
            : `${nearCount} lojas no ${nearName}, mostradas primeiro.`}{" "}
          As outras entregam na cidade toda ou em parte dela — confirme com a
          loja no WhatsApp.
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Nenhuma loja com esses filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((store) => (
            <li key={store.id}>
              <Link
                href={`/loja/${store.slug}`}
                className="flex gap-4 rounded-xl border border-neutral-200 p-4 transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                  {store.logo_url ? (
                    <Image
                      src={store.logo_url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xl font-semibold text-neutral-300 dark:text-neutral-700">
                      {store.name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{store.name}</h2>
                    {store.is_open_now ? null : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        fechada
                      </span>
                    )}
                  </div>

                  {store.description ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                      {store.description}
                    </p>
                  ) : null}

                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {store.neighborhood}
                    {" · entrega "}
                    {formatDeliveryFee(store.delivery_fee_cents)}
                    {store.min_order_cents > 0
                      ? ` · mín. ${formatCents(store.min_order_cents)}`
                      : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
