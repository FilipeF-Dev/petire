import type { Metadata } from "next";
import Link from "next/link";

import { TrackDemand } from "@/components/track-demand";
import { sortByPopularity } from "@/lib/cuisines";
import { humanizePlace, searchTerms, slugify } from "@/lib/slug";
import {
  CARD_SELECT,
  viewRows,
  type PublicStoreCard,
} from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

import { StoreFilters } from "./filters";
import { StoreList } from "./store-list";
import { SuggestStore } from "./suggest-store";

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

  // A busca também acha a loja pelo que ela vende. Quem procura "coxinha" não
  // sabe o nome da lanchonete que faz coxinha — é justamente por isso que está
  // procurando. Os produtos vêm primeiro, numa consulta separada, porque o
  // PostgREST não filtra a tabela principal por uma condição da tabela
  // aninhada: o embed traria a loja inteira com a lista de produtos vazia.
  //
  // A comparação é slug com slug, dos dois lados: `slugify` derruba acento,
  // caixa e pontuação, e o banco guarda o resultado em `name_slug` — coluna
  // gerada, gêmea dela (ver 20260905120000_search_normalization.sql). É o que
  // faz "acai" achar "Açaí".
  //
  // E é **uma palavra, um filtro**, todas precisando bater. Comparar o slug
  // inteiro de uma vez casava só o que estivesse grudado: "suco laranja" não
  // achava "Suco de laranja 500ml" por causa do "de" no meio.
  //
  // As duas coisas juntas também são a defesa que o `sanitizeSearch` escrito a
  // mão era: o que sobra é `[a-z0-9]`, então um `%`, um `_` ou uma vírgula
  // digitados não viram curinga do LIKE nem separador de filtro do PostgREST.
  const terms = search ? searchTerms(search) : [];
  let productMatches: { store_id: string; name: string }[] = [];

  if (terms.length > 0) {
    let hitsQuery = supabase.from("products").select("store_id, name");
    for (const term of terms) {
      hitsQuery = hitsQuery.like("name_slug", `%${term}%`);
    }

    const { data: hits } = await hitsQuery.limit(200);

    // O RLS de products já limita a lojas públicas, então o que volta aqui é o
    // mesmo universo da vitrine.
    productMatches = hits ?? [];

    const storeIds = [...new Set(productMatches.map((hit) => hit.store_id))];

    // `and(...)` dentro do `or`: a loja entra se o **nome dela** casar com
    // todas as palavras, ou se algum item do cardápio dela tiver casado acima.
    const byName = `and(${terms
      .map((term) => `name_slug.like.%${term}%`)
      .join(",")})`;

    if (storeIds.length) {
      query = query.or(`${byName},id.in.(${storeIds.join(",")})`);
    } else {
      for (const term of terms) {
        query = query.like("name_slug", `%${term}%`);
      }
    }
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

  // Só os tipos que existem entre as lojas encontradas — um chip que não
  // devolve nada é uma promessa quebrada. A ordem é a do catálogo, que é a de
  // quanto cada tipo aparece num bairro: no celular a fila é horizontal, e o
  // que fica no fim dela quase não é visto.
  const tags = sortByPopularity([
    ...new Set(stores.flatMap((store) => store.cuisine_tags ?? [])),
  ]).slice(0, 18);

  // Por que esta loja apareceu, se o nome dela não tem nada a ver com a busca?
  // Sem dizer qual item casou, o resultado parece defeito.
  const matchedProducts = new Map<string, string[]>();
  for (const hit of productMatches) {
    const names = matchedProducts.get(hit.store_id) ?? [];
    if (names.length < 3 && !names.includes(hit.name)) {
      matchedProducts.set(hit.store_id, [...names, hit.name]);
    }
  }

  // O rótulo vem das lojas encontradas, não do que veio na URL: assim o título
  // mostra a grafia oficial mesmo se o link trouxer "vila madalena". Sem loja
  // no resultado não há grafia oficial para usar, e aí o slug da URL é
  // remontado — senão o título viraria "Lojas em juiz-de-fora".
  const place = neighborhood
    ? (stores[0]?.neighborhood ?? humanizePlace(slugify(neighborhood)))
    : (stores[0]?.city ?? (city ? humanizePlace(slugify(city)) : null));

  // A demanda que o catálogo não atendeu. Lista vazia por causa de um chip
  // marcado não é demanda descoberta — é filtro, e o cliente desmarca. O que
  // interessa é a busca que não achou nada e a cidade onde ainda não há loja.
  const hasChips = Boolean(tag) || Boolean(kind) || onlyOpen;

  const unmet: "search_empty" | "area_uncovered" | null =
    stores.length > 0 || hasChips
      ? null
      : terms.length > 0
        ? "search_empty"
        : city
          ? "area_uncovered"
          : null;

  return (
    <div className="flex flex-col gap-6">
      {unmet ? (
        <TrackDemand
          kind={unmet}
          citySlug={city ? slugify(city) : null}
          neighborhoodSlug={nearSlug ?? (neighborhood ? slugify(neighborhood) : null)}
          term={unmet === "search_empty" ? terms.join(" ") : null}
        />
      ) : null}

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

      <StoreList
        stores={stores}
        nearSlug={nearSlug}
        matchedProducts={Object.fromEntries(matchedProducts)}
        showEmptyMessage={!unmet}
      />

      {/*
        O mesmo momento que gera o sinal de demanda gera a melhor pergunta que
        o Petire tem para fazer. Quem acabou de não encontrar nada sabe o nome
        da loja que faltou.
      */}
      {unmet ? (
        <SuggestStore
          reason={unmet}
          term={unmet === "search_empty" ? (search?.trim() ?? null) : null}
          place={place}
          citySlug={city ? slugify(city) : null}
          neighborhoodSlug={
            nearSlug ?? (neighborhood ? slugify(neighborhood) : null)
          }
        />
      ) : null}
    </div>
  );
}
