import { formatCents } from "./money";

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

/** "10% OFF" ou "R$ 5,00 OFF" — o selo do cardápio e o rótulo do painel. */
export function discountLabel(kind: Promotion["kind"], value: number): string {
  return kind === "percent" ? `${value}% OFF` : `${formatCents(value)} OFF`;
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
    label: discountLabel(promotion.kind, promotion.value),
  };
}

// -----------------------------------------------------------------------------
// A janela da promoção, do jeito que o lojista informa
// -----------------------------------------------------------------------------

/**
 * Horário de Brasília, o mesmo de `store_is_open()` no banco. Revisar quando o
 * Petire sair de um único fuso.
 *
 * Sem fixar o fuso, `new Date("2026-09-30")` seria meia-noite em UTC — e uma
 * promoção marcada para o dia 30 começaria às 21h do dia 29 no Brasil.
 */
const BRAZIL_OFFSET = "-03:00";
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2026-09-30" → o instante em que o dia 30 começa no Brasil. */
export function dayStartsAt(day: string): string {
  return `${day}T00:00:00${BRAZIL_OFFSET}`;
}

/**
 * "2026-09-30" → o instante em que o dia 30 acaba no Brasil.
 *
 * O lojista lê "até dia 30" como o dia 30 inteiro, mas `isLive` trata
 * `ends_at` como exclusivo. A data vira a meia-noite do dia seguinte.
 */
export function dayEndsAt(day: string): string {
  return `${addDays(day, 1)}T00:00:00${BRAZIL_OFFSET}`;
}

/** O caminho de volta, para o formulário mostrar o que foi digitado. */
export function startsAtToDay(startsAt: string): string {
  return new Date(new Date(startsAt).getTime() - BRAZIL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** Desconta 1ms para cair no último dia válido, e não no dia seguinte. */
export function endsAtToDay(endsAt: string | null): string {
  if (!endsAt) return "";
  return new Date(new Date(endsAt).getTime() - BRAZIL_OFFSET_MS - 1)
    .toISOString()
    .slice(0, 10);
}

export type PromotionStatus = "ativa" | "agendada" | "encerrada" | "pausada";

/**
 * O estado da promoção para quem administra.
 *
 * `is_active` não entra em `isLive` porque a vitrine já filtra por ele na
 * consulta; aqui o painel precisa justamente enxergar as pausadas.
 */
export function promotionStatus(
  promotion: Promotion & { is_active: boolean },
  now: Date = new Date(),
): PromotionStatus {
  if (!promotion.is_active) return "pausada";
  if (new Date(promotion.starts_at) > now) return "agendada";
  if (promotion.ends_at && new Date(promotion.ends_at) <= now) {
    return "encerrada";
  }
  return "ativa";
}
