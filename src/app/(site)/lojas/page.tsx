import type { Metadata } from "next";
import Link from "next/link";

import { TrackDemand } from "@/components/track-demand";
import { sortByPopularity } from "@/lib/cuisines";
import { hasLivePromotion, priceOf, type Promotion } from "@/lib/promotions";
import {
  humanizePlace,
  matchesTerms,
  relevance,
  searchTerms,
  slugify,
} from "@/lib/slug";
import { CARD_SELECT, viewRows, type PublicStoreCard } from "@/lib/storefront";
import { createPublicClient } from "@/lib/supabase/public";

import { StoreFilters } from "./filters";
import { ItemList, type MatchedItem } from "./item-list";
import { StoreList } from "./store-list";
import { SuggestStore } from "./suggest-store";

/**
 * Uma página só, e não uma para cada combinação de filtro.
 *
 * Tipo, culinária, aberta, frete, desconto, ordenação e busca se combinam em
 * centenas de endereços com o mesmo conteúdo. Nenhum deles está linkado — os
 * chips reescrevem a URL no navegador —, mas basta um ser descoberto para o
 * Google gastar rastreio neles e diluir o sinal entre variantes que ninguém
 * procurou.
 *
 * Com filtro na URL: `noindex, follow`. O "follow" importa tanto quanto o
 * "noindex" — a página filtrada continua levando às lojas, e é por esses links
 * que o rastreador chega nelas.
 *
 * Sem filtro: indexável, com canonical apontando para si mesma. Quem responde
 * "lanchonete em Bandeirantes" não é esta tela, e sim
 * /lojas/[cidade]/[bairro] — esta é a de filtrar e buscar.
 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/lojas">): Promise<Metadata> {
  const params = await searchParams;

  const comFiltro = FILTROS.some((chave) => first(params[chave]) !== null);

  return {
    title: "Lojas perto de você",
    description:
      "Lanchonetes, distribuidoras e restaurantes do seu bairro no Petire. Peça direto no WhatsApp da loja, sem taxa de serviço.",
    alternates: comFiltro ? undefined : { canonical: "/lojas" },
    robots: comFiltro ? { index: false, follow: true } : undefined,
  };
}

/** O que transforma esta página numa variante que não merece índice próprio. */
const FILTROS = [
  "q",
  "tipo",
  "tag",
  "aberto",
  "frete",
  "promo",
  "ordem",
  "cidade",
  "bairro",
  "perto",
] as const;

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Uma palavra digitada, nas duas colunas em que ela pode aparecer.
 *
 * `name_slug` guarda "x-tudo" e `name_compact` guarda "xtudo": a primeira
 * responde a quem separa as palavras, a segunda a quem cola tudo. Como o
 * PostgREST junta com **E** cada `.or()` encadeado, uma chamada por palavra dá
 * exatamente a regra que se quer — toda palavra precisa bater, em qualquer uma
 * das duas formas.
 *
 * O termo aqui já passou por `slugify`, então sobrou `[a-z0-9]`: não há `%`,
 * `_` nem vírgula para virar curinga do LIKE ou separador de filtro.
 */
function matchTerm(term: string): string {
  return `name_slug.like.%${term}%,name_compact.like.%${term}%`;
}

/**
 * Quanto a seção de itens mostra antes de parar.
 *
 * Uma busca larga — "x" — casa com o cardápio inteiro do bairro. Rolar
 * duzentos itens não é resultado, é lista telefônica: quem chegou ao fim já
 * teria refinado a busca. Os melhores já estão em cima pela ordenação.
 */
const ITEM_LIMIT = 24;

/** Quanto este item está mais barato do que o preço de tabela, de 0 a 1. */
function desconto(item: MatchedItem): number {
  if (item.originalCents === null) return 0;
  return (item.originalCents - item.priceCents) / item.originalCents;
}

export default async function LojasPage({ searchParams }: PageProps<"/lojas">) {
  const params = await searchParams;

  const city = first(params.cidade);
  const neighborhood = first(params.bairro);
  const search = first(params.q);
  const kind = first(params.tipo);
  const tag = first(params.tag);
  const onlyOpen = first(params.aberto) === "1";
  const onlyFreeDelivery = first(params.frete) === "1";
  const onlyPromo = first(params.promo) === "1";
  const order = first(params.ordem);

  const supabase = createPublicClient();

  let query = supabase.from("stores_public").select(CARD_SELECT);

  // Filtra pelas colunas normalizadas, não pelo texto digitado: uma loja
  // cadastrada como "vila madalena" tem de aparecer junto com as de
  // "Vila Madalena".
  if (city) query = query.eq("city_slug", slugify(city));
  if (neighborhood) {
    query = query.eq("neighborhood_slug", slugify(neighborhood));
  }
  if (tag) query = query.contains("cuisine_tags", [tag]);
  if (onlyOpen) query = query.eq("is_open_now", true);
  // Coluna declarada pela loja, nao a taxa zerada: zero e "nao informei".
  if (onlyFreeDelivery) query = query.eq("free_delivery", true);

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
  //
  // O preço e o id vêm junto porque a ordenação por menor preço precisa deles:
  // o preço da loja é o do item mais barato que casou com a busca.
  //
  // E cada palavra vale de duas formas, com separador e sem: é o que faz
  // "xtudo" achar o X-Tudo, "cocacola" achar a Coca-Cola e "paodequeijo" achar
  // o pão de queijo. Quem digita colado é quem digita rápido, no celular, com
  // fome — e recebia uma tela vazia sobre um cardápio que tinha o item.
  // `matchesTerms` em src/lib/slug.ts é esta mesma frase, do lado do
  // navegador, para a busca de dentro do cardápio.
  const terms = search ? searchTerms(search) : [];
  let productMatches: {
    id: string;
    store_id: string;
    name: string;
    price_cents: number;
    image_url: string | null;
  }[] = [];

  if (terms.length > 0) {
    let hitsQuery = supabase
      .from("products")
      .select("id, store_id, name, price_cents, image_url");
    for (const term of terms) {
      hitsQuery = hitsQuery.or(matchTerm(term));
    }

    const { data: hits } = await hitsQuery.limit(200);

    // O RLS de products já limita a lojas públicas, então o que volta aqui é o
    // mesmo universo da vitrine.
    productMatches = hits ?? [];

    const storeIds = [...new Set(productMatches.map((hit) => hit.store_id))];

    // `and(...)` dentro do `or`: a loja entra se o **nome dela** casar com
    // todas as palavras, ou se algum item do cardápio dela tiver casado acima.
    const byName = `and(${terms.map((term) => `or(${matchTerm(term)})`).join(",")})`;

    if (storeIds.length) {
      query = query.or(`${byName},id.in.(${storeIds.join(",")})`);
    } else {
      for (const term of terms) {
        query = query.or(matchTerm(term));
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

  const nearby = nearSlug
    ? [...allStores].sort((a, b) => {
        const rank = (store: PublicStoreCard) =>
          store.neighborhood_slug === nearSlug ? 0 : 1;
        return rank(a) - rank(b);
      })
    : allStores;

  /**
   * Desconto e preço só são lidos quando alguém pediu por eles.
   *
   * As promoções de uma loja não cabem na view da vitrine — elas dependem da
   * hora e do dia da semana — então a conta é aqui, e só para as lojas que já
   * passaram pelos outros filtros. Sem chip de desconto e sem ordenação, esta
   * consulta nem sai.
   */
  // Ordenar por preço também precisa delas: o preço que ordena é o que o
  // cliente vê no card, já com o desconto aplicado.
  // E a seção de itens sempre precisa: ela mostra preço, e preço sem promoção
  // aplicada é mais caro do que o que está no cardápio.
  const needsPromotions =
    onlyPromo || Boolean(order) || productMatches.length > 0;

  const livePromotions = new Map<string, Promotion[]>();
  if (needsPromotions && nearby.length > 0) {
    const { data: rows } = await supabase
      .from("promotions")
      .select("store_id, product_id, kind, value, starts_at, ends_at, weekdays")
      .in(
        "store_id",
        nearby.map((store) => store.id),
      )
      .eq("is_active", true);

    for (const row of rows ?? []) {
      const list = livePromotions.get(row.store_id) ?? [];
      livePromotions.set(row.store_id, [...list, row as Promotion]);
    }
  }

  const withPromo = onlyPromo
    ? nearby.filter((store) =>
        hasLivePromotion(livePromotions.get(store.id) ?? []),
      )
    : nearby;

  /**
   * O preço da loja, para ordenar, é o do **item mais barato que casou com a
   * busca** — já com a promoção aplicada, que é o preço que o cliente vê no
   * card. Loja não tem um preço só, e inventar uma média seria ordenar por um
   * número que não aparece em lugar nenhum da tela.
   *
   * Por isso a ordenação por preço só existe junto de uma busca: sem item que
   * casou, não há o que comparar.
   */
  const priced = new Map<string, { cheapest: number; bestOff: number }>();
  for (const hit of productMatches) {
    const promotions = livePromotions.get(hit.store_id) ?? [];
    const price = priceOf(hit.price_cents, hit.id, promotions);

    const off =
      price.originalCents === null
        ? 0
        : (price.originalCents - price.cents) / price.originalCents;

    const current = priced.get(hit.store_id);
    priced.set(hit.store_id, {
      cheapest: Math.min(current?.cheapest ?? Infinity, price.cents),
      bestOff: Math.max(current?.bestOff ?? 0, off),
    });
  }

  const stores =
    order === "preco-asc" || order === "preco-desc" || order === "desconto"
      ? [...withPromo].sort((a, b) => {
          const left = priced.get(a.id);
          const right = priced.get(b.id);

          // Loja sem item que casou fica no fim em qualquer ordenação: ela
          // entrou pelo nome, e não tem preço nem desconto para comparar.
          if (!left && !right) return 0;
          if (!left) return 1;
          if (!right) return -1;

          if (order === "desconto") return right.bestOff - left.bestOff;
          return order === "preco-asc"
            ? left.cheapest - right.cheapest
            : right.cheapest - left.cheapest;
        })
      : withPromo;

  // Só os tipos que existem entre as lojas encontradas — um chip que não
  // devolve nada é uma promessa quebrada. A ordem é a do catálogo, que é a de
  // quanto cada tipo aparece num bairro: no celular a fila é horizontal, e o
  // que fica no fim dela quase não é visto.
  const tags = sortByPopularity([
    ...new Set(stores.flatMap((store) => store.cuisine_tags ?? [])),
  ]).slice(0, 18);

  /*
    Duas seções, e não uma lista misturada.

    Antes, procurar "picanha" devolvia lojas — inclusive as que só entraram por
    causa de um item — com um "tem Picanha" em letra pequena embaixo do nome.
    Quem procura um prato quer o prato: nome, preço, e o caminho até ele. Então
    a lista de cima passa a ser só das lojas cujo **nome** casou, e o que casou
    por item vira a lista de baixo, com a loja escrita no card.

    Sem busca nada disso existe: a página volta a ser a lista de lojas perto,
    que é o que ela é a maior parte do tempo.
  */
  const byName =
    terms.length > 0
      ? stores.filter((store) => matchesTerms(slugify(store.name), terms))
      : stores;

  const storeById = new Map(stores.map((store) => [store.id, store]));

  const items: MatchedItem[] = productMatches
    .map((hit) => {
      const store = storeById.get(hit.store_id);
      if (!store) return null;

      const price = priceOf(
        hit.price_cents,
        hit.id,
        livePromotions.get(hit.store_id) ?? [],
      );

      return {
        id: hit.id,
        name: hit.name,
        priceCents: price.cents,
        originalCents: price.originalCents,
        discountLabel: price.label,
        storeSlug: store.slug,
        storeName: store.name,
        storeNeighborhood: store.neighborhood,
        storeIsOpen: store.is_open_now,
        imageUrl: hit.image_url,
        storeLogoUrl: store.logo_url,
      };
    })
    .filter((item): item is MatchedItem => item !== null)
    .sort((a, b) => {
      // O que o cliente pediu na tela ganha do padrão.
      if (order === "preco-asc") return a.priceCents - b.priceCents;
      if (order === "preco-desc") return b.priceCents - a.priceCents;
      if (order === "desconto") return desconto(b) - desconto(a);

      // Padrão: o nome mais próximo do que se digitou primeiro, e o mais
      // barato desempatando — entre dois "X-Tudo", ninguém prefere o caro.
      const rank =
        relevance(slugify(a.name), terms) - relevance(slugify(b.name), terms);
      return rank !== 0 ? rank : a.priceCents - b.priceCents;
    })
    .slice(0, ITEM_LIMIT);

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
  const hasChips =
    Boolean(tag) || Boolean(kind) || onlyOpen || onlyFreeDelivery || onlyPromo;

  const achou = byName.length > 0 || items.length > 0;

  const unmet: "search_empty" | "area_uncovered" | null =
    achou || hasChips
      ? null
      : terms.length > 0
        ? "search_empty"
        : city
          ? "area_uncovered"
          : null;

  /*
    O que se procura aqui, tendo achado ou não.

    A busca que **deu certo** é o dado que faltava, e ela responde a pergunta
    mais valiosa que o Petire pode fazer ao lojista: o que as pessoas procuram
    no seu bairro e o seu cardápio não tem. Se o vizinho vende açaí, a busca
    por açaí funciona e nada era registrado — mas para a loja ao lado aquilo
    foi uma venda que passou na frente dela.

    Com chip marcado ninguém registra nada, e vale para os dois casos: o
    conjunto precisa ser comparável, e uma busca filtrada diz mais sobre o
    filtro do que sobre o bairro.
  */
  const signal: "search_empty" | "area_uncovered" | "search_hit" | null =
    hasChips
      ? null
      : (unmet ?? (terms.length > 0 && achou ? "search_hit" : null));

  return (
    <div className="flex flex-col gap-6">
      {signal ? (
        <TrackDemand
          kind={signal}
          citySlug={city ? slugify(city) : null}
          neighborhoodSlug={
            nearSlug ?? (neighborhood ? slugify(neighborhood) : null)
          }
          term={signal === "area_uncovered" ? null : terms.join(" ")}
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

      {/*
        Com busca no ar a lista ganha um rótulo, porque deixou de ser "as lojas
        daqui" e passou a ser "as lojas cujo nome casa". Sem busca ela continua
        sendo a página inteira, e um título ali só repetiria o `h1`.
      */}
      {terms.length > 0 && byName.length > 0 ? (
        <h2 className="-mb-1 text-sm font-semibold tracking-wide uppercase">
          Lojas
        </h2>
      ) : null}

      <StoreList
        stores={byName}
        nearSlug={nearSlug}
        showEmptyMessage={!unmet && items.length === 0}
      />

      <ItemList items={items} term={search ?? ""} />

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
