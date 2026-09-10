import type { Database } from "./supabase/database.types";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

/**
 * O Postgres não propaga NOT NULL através de uma view, então `supabase gen
 * types` marca toda coluna de `stores_public` como anulável — inclusive `name`
 * e `slug`, que a tabela garante que existem.
 *
 * Em vez de espalhar `!` por toda a vitrine, a nulabilidade correta é
 * recuperada aqui, uma vez, a partir da própria tabela. `asView` é a única
 * asserção do arquivo e o comentário acima é a justificativa dela.
 */
function asView<T>(row: unknown): T {
  return row as T;
}

export function viewRow<T>(row: unknown | null): T | null {
  return row === null || row === undefined ? null : asView<T>(row);
}

export function viewRows<T>(rows: unknown[] | null): T[] {
  return (rows ?? []).map((row) => asView<T>(row));
}

const CARD_COLUMNS = [
  "id",
  "slug",
  "name",
  "description",
  "logo_url",
  "neighborhood",
  "neighborhood_slug",
  "city",
  "city_slug",
  "state_uf",
  // O CEP da loja ordena a lista pela distância até o CEP do cliente.
  // Ver src/lib/proximity.ts.
  "cep",
  "cuisine_tags",
  "delivery_fee_cents",
  "delivery_minutes",
  "min_order_cents",
] as const;

const DETAIL_COLUMNS = [
  ...CARD_COLUMNS,
  "cover_url",
  "whatsapp_e164",
  "address",
  // Coordenadas: entram no schema.org da loja, que é de onde o Google tira o
  // mapa do resultado. Só no detalhe — a listagem não desenha mapa nenhum.
  "lat",
  "lng",
] as const;

/** Loja na listagem de `/lojas`. */
export type PublicStoreCard = Pick<StoreRow, (typeof CARD_COLUMNS)[number]> & {
  is_open_now: boolean;
};

/** Loja na página `/loja/[slug]`. */
export type PublicStoreDetail = Pick<
  StoreRow,
  (typeof DETAIL_COLUMNS)[number]
> & { is_open_now: boolean };

/** Só o que o sitemap precisa. */
export type PublicStoreLocation = Pick<
  StoreRow,
  "slug" | "city" | "city_slug" | "neighborhood" | "neighborhood_slug"
>;

export type PublicPlace = {
  city: string;
  city_slug: string;
  neighborhood: string;
  neighborhood_slug: string;
  state_uf: string | null;
  store_count: number;
};

/** As listas de colunas viram a string do `.select()`, para não divergirem. */
export const CARD_SELECT = [...CARD_COLUMNS, "is_open_now"].join(", ");
export const DETAIL_SELECT = [...DETAIL_COLUMNS, "is_open_now"].join(", ");

/**
 * O PostgREST devolve no máximo `max_rows` linhas por requisição — mil, tanto
 * na nuvem quanto no config local. Acima disso ele corta **em silêncio**: não é
 * erro, é uma resposta curta que parece completa.
 */
const PAGE_SIZE = 1000;

/**
 * Teto de segurança. Existe para um bug daqui virar uma lista truncada em vez
 * de um laço infinito batendo no banco.
 */
const MAX_PAGES = 50;

/**
 * Lê uma listagem inteira, em páginas.
 *
 * Para o sitemap e para o `generateStaticParams`, "inteira" é o requisito: os
 * dois existem para dizer ao Google **todas** as páginas que o Petire tem, e
 * busca orgânica é o canal de aquisição que o produto tem de graça. Uma loja
 * cortada aqui é uma loja que não é indexada — e ninguém percebe, porque a
 * página dela continua abrindo normalmente para quem tem o link.
 *
 * **A consulta precisa vir ordenada.** Sem `ORDER BY`, o Postgres não promete
 * ordem estável entre requisições, e paginar por deslocamento passa a repetir
 * uma loja e pular outra. É o tipo de defeito que só aparece quando o catálogo
 * cresce, que é exatamente quando ninguém está olhando para isto.
 */
export async function fetchAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];

  for (let index = 0; index < MAX_PAGES; index += 1) {
    const from = index * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);

    // Metade de um sitemap é pior do que um sitemap velho: o Google trata a
    // ausência como remoção. Melhor devolver o que já veio e deixar o
    // `revalidate` tentar de novo do que publicar uma lista incompleta como se
    // fosse a lista.
    if (error || !data) break;

    all.push(...viewRows<T>(data));
    if (data.length < PAGE_SIZE) break;
  }

  return all;
}
