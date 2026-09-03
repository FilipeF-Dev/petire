import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { formatCents } from "@/lib/money";
import { humanizePlace, slugify } from "@/lib/slug";
import {
  CARD_SELECT,
  viewRows,
  type PublicStoreCard,
} from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

import { StoreFilters } from "./filters";

export const metadata: Metadata = {
  title: "Lojas perto de você",
  description:
    "Lanchonetes, distribuidoras e restaurantes do seu bairro no Petire. Peça direto no WhatsApp da loja, sem taxa de serviço.",
};

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/**
 * `%` e `_` são curingas do LIKE e `,` separa filtros no PostgREST. Sem tirar
 * esses caracteres, uma busca por "50%" vira um filtro malformado.
 */
function sanitizeSearch(value: string): string {
  return value.replace(/[%_,()*\\]/g, " ").trim();
}

export default async function LojasPage({
  searchParams,
}: PageProps<"/lojas">) {
  const params = await searchParams;

  const city = first(params.cidade);
  const neighborhood = first(params.bairro);
  const search = first(params.q);
  const kind = first(params.tipo);
  const tag = first(params.tag);
  const onlyOpen = first(params.aberto) === "1";

  const supabase = createPublicClient();

  let query = supabase
    .from("stores_public")
    .select(CARD_SELECT);

  // Filtra pelas colunas normalizadas, não pelo texto digitado: uma loja
  // cadastrada como "vila madalena" tem de aparecer junto com as de
  // "Vila Madalena".
  if (city) query = query.eq("city_slug", slugify(city));
  if (neighborhood) {
    query = query.eq("neighborhood_slug", slugify(neighborhood));
  }
  if (tag) query = query.contains("cuisine_tags", [tag]);
  if (onlyOpen) query = query.eq("is_open_now", true);

  if (kind === "food") query = query.in("kind", ["food", "both"]);
  if (kind === "drinks") query = query.in("kind", ["drinks", "both"]);

  if (search) {
    const clean = sanitizeSearch(search);
    if (clean) query = query.ilike("name", `%${clean}%`);
  }

  // Loja fechada continua na lista — o cliente quer ver o cardápio e o
  // horário — mas depois das abertas.
  const { data } = await query
    .order("is_open_now", { ascending: false })
    .order("name");

  const allStores = viewRows<PublicStoreCard>(data);

  // `perto` vem do CEP do cliente e só **ordena** — filtrar por bairro exato
  // esconderia a lanchonete do Centro que entrega no bairro inteiro, e o
  // cliente veria "nenhuma loja" numa cidade que tem lojas.
  const near = first(params.perto);
  const nearSlug = near ? slugify(near) : null;

  const stores = nearSlug
    ? [...allStores].sort((a, b) => {
        const rank = (store: PublicStoreCard) =>
          store.neighborhood_slug === nearSlug ? 0 : 1;
        return rank(a) - rank(b);
      })
    : allStores;

  const nearCount = nearSlug
    ? stores.filter((store) => store.neighborhood_slug === nearSlug).length
    : 0;
  const nearName = nearSlug
    ? stores.find((store) => store.neighborhood_slug === nearSlug)?.neighborhood
    : null;

  const tags = [
    ...new Set(stores.flatMap((store) => store.cuisine_tags ?? [])),
  ]
    .sort()
    .slice(0, 12);

  // O rótulo vem das lojas encontradas, não do que veio na URL: assim o título
  // mostra a grafia oficial mesmo se o link trouxer "vila madalena". Sem loja
  // no resultado não há grafia oficial para usar, e aí o slug da URL é
  // remontado — senão o título viraria "Lojas em juiz-de-fora".
  const place = neighborhood
    ? (stores[0]?.neighborhood ?? humanizePlace(slugify(neighborhood)))
    : (stores[0]?.city ?? (city ? humanizePlace(slugify(city)) : null));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {place ? `Lojas em ${place}` : "Lojas"}
        </h1>
        {nearName && nearCount > 0 ? (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {nearCount === 1
              ? `1 loja no ${nearName}, mostrada primeiro.`
              : `${nearCount} lojas no ${nearName}, mostradas primeiro.`}{" "}
            As outras entregam na cidade toda ou em parte dela — confirme com a
            loja no WhatsApp.
          </p>
        ) : null}

        {place ? (
          <Link
            href="/lojas"
            className="mt-1 inline-block text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
          >
            ver todos os bairros
          </Link>
        ) : null}
      </div>

      <StoreFilters tags={tags} />

      {stores.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Nenhuma loja com esses filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stores.map((store) => (
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
                    {store.delivery_fee_cents === 0
                      ? "grátis"
                      : formatCents(store.delivery_fee_cents)}
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
