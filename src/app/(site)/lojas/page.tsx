import type { Metadata } from "next";
import Link from "next/link";

import { humanizePlace, slugify } from "@/lib/slug";
import {
  CARD_SELECT,
  viewRows,
  type PublicStoreCard,
} from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

import { StoreFilters } from "./filters";
import { StoreList } from "./store-list";

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
  //
  // Esta é a ordem da primeira pintura e a que vale sem JavaScript. Com o CEP
  // guardado no browser, StoreList refina para a distância real estimada.
  const near = first(params.perto);
  const nearSlug = near ? slugify(near) : null;

  const stores = nearSlug
    ? [...allStores].sort((a, b) => {
        const rank = (store: PublicStoreCard) =>
          store.neighborhood_slug === nearSlug ? 0 : 1;
        return rank(a) - rank(b);
      })
    : allStores;

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

      <StoreList stores={stores} nearSlug={nearSlug} />
    </div>
  );
}
