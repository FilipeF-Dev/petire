/**
 * Há quanto tempo ninguém mexe no cardápio.
 *
 * Cardápio desatualizado é o risco número dois do próprio MVP, e a mitigação
 * até aqui era "esgotado em um toque" — que depende de o lojista lembrar. Nada
 * envelhecia sozinho: uma loja abandonada seguia no ar com preço de seis meses
 * atrás, e quem descobria era o cliente, no meio do pedido.
 *
 * Os dois lados usam a mesma régua de propósito. O admin vê para saber com quem
 * falar; o lojista vê para agir antes de alguém precisar falar com ele.
 */

/** A partir de quantos dias parado o cardápio merece um empurrão. */
export const STALE_DAYS = 45;

/** Dias inteiros desde `iso`. Nulo quando não há data. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** A edição mais recente de um conjunto de itens. */
export function lastEditedAt(
  items: { updated_at: string }[],
): string | null {
  if (items.length === 0) return null;

  return items.reduce(
    (newest, item) => (item.updated_at > newest ? item.updated_at : newest),
    items[0].updated_at,
  );
}
