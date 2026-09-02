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
  "city",
  "cuisine_tags",
  "delivery_fee_cents",
  "min_order_cents",
] as const;

const DETAIL_COLUMNS = [
  ...CARD_COLUMNS,
  "cover_url",
  "whatsapp_e164",
  "address",
] as const;

/** Loja na listagem de `/lojas`. */
export type PublicStoreCard = Pick<
  StoreRow,
  (typeof CARD_COLUMNS)[number]
> & { is_open_now: boolean };

/** Loja na página `/loja/[slug]`. */
export type PublicStoreDetail = Pick<
  StoreRow,
  (typeof DETAIL_COLUMNS)[number]
> & { is_open_now: boolean };

/** Só o que o sitemap precisa. */
export type PublicStoreLocation = Pick<
  StoreRow,
  "slug" | "city" | "neighborhood"
>;

export type PublicPlace = {
  city: string;
  neighborhood: string;
  store_count: number;
};

/** As listas de colunas viram a string do `.select()`, para não divergirem. */
export const CARD_SELECT = [...CARD_COLUMNS, "is_open_now"].join(", ");
export const DETAIL_SELECT = [...DETAIL_COLUMNS, "is_open_now"].join(", ");
