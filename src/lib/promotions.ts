export type Promotion = {
  product_id: string | null;
  kind: "percent" | "fixed";
  value: number;
  starts_at: string;
  ends_at: string | null;
};

export type Price = {
  /** O que o cliente paga. */
  cents: number;
  /** Preço de tabela, presente só quando há desconto. */
  originalCents: number | null;
  /** "10% OFF" ou "R$ 5,00 OFF", para o selo. */
  label: string | null;
};

function isLive(promotion: Promotion, now: Date): boolean {
  if (new Date(promotion.starts_at) > now) return false;
  if (promotion.ends_at && new Date(promotion.ends_at) <= now) return false;
  return true;
}

/**
 * Aplica a promoção mais específica que valer agora.
 *
 * Promoção de produto ganha da promoção da loja inteira — elas não somam. Duas
 * promoções empilhando é como se zera uma margem sem perceber, e o lojista não
 * tem como auditar isso pelo painel.
 */
export function priceOf(
  priceCents: number,
  productId: string,
  promotions: Promotion[],
  now: Date = new Date(),
): Price {
  const live = promotions.filter((p) => isLive(p, now));
  const promotion =
    live.find((p) => p.product_id === productId) ??
    live.find((p) => p.product_id === null);

  if (!promotion) {
    return { cents: priceCents, originalCents: null, label: null };
  }

  const discount =
    promotion.kind === "percent"
      ? Math.round((priceCents * promotion.value) / 100)
      : promotion.value;

  const cents = Math.max(0, priceCents - discount);
  if (cents === priceCents) {
    return { cents: priceCents, originalCents: null, label: null };
  }

  return {
    cents,
    originalCents: priceCents,
    label:
      promotion.kind === "percent"
        ? `${promotion.value}% OFF`
        : `${(promotion.value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} OFF`,
  };
}
