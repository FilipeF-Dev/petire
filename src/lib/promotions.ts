import { formatCents } from "./money";
import { WEEKDAYS } from "./weekdays";

export type Promotion = {
  product_id: string | null;
  kind: "percent" | "fixed";
  value: number;
  starts_at: string;
  ends_at: string | null;
  /**
   * Dias da semana em que ela vale, 0 = domingo. Nulo é todos os dias.
   *
   * Nulo e a coluna ausente caem no mesmo lugar de propósito: uma consulta que
   * esquecer de pedir `weekdays` volta ao comportamento antigo — a promoção
   * vale todo dia — em vez de sumir do cardápio sem ninguém entender por quê.
   */
  weekdays: number[] | null;
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
  if (!appliesToday(promotion.weekdays, now)) return false;
  return true;
}

/**
 * A loja tem alguma promoção valendo agora?
 *
 * É o que o chip "Com desconto" da lista precisa saber. Vale a mesma régua do
 * cardápio — janela de datas e dia da semana — porque uma loja que aparece com
 * desconto na lista e sem desconto no cardápio é pior do que não ter o filtro.
 */
export function hasLivePromotion(
  promotions: Promotion[],
  now: Date = new Date(),
): boolean {
  return promotions.some((promotion) => isLive(promotion, now));
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

/**
 * O dia da semana no fuso de Brasília, 0 = domingo.
 *
 * O mesmo fuso fixo do resto do arquivo. Sem ele, quem abre o cardápio às 22h
 * de sexta veria o desconto de sábado, porque para o relógio em UTC o sábado
 * já começou.
 */
export function brazilWeekday(now: Date): number {
  return new Date(now.getTime() - BRAZIL_OFFSET_MS).getUTCDay();
}

/** Nulo, ausente ou vazio: vale todo dia. */
function appliesToday(
  weekdays: number[] | null | undefined,
  now: Date,
): boolean {
  if (!weekdays || weekdays.length === 0) return true;
  return weekdays.includes(brazilWeekday(now));
}

/**
 * "sexta e sábado", para o painel. Nulo quando ela vale todo dia.
 *
 * Sem artigo antes dos dias, e isso é de propósito: "toda sexta" e "todo
 * sábado" não concordam entre si, e uma lista misturando os dois não tem
 * artigo que sirva para a frase inteira. Quem põe o contexto é a tela.
 */
export function weekdaysLabel(weekdays: number[] | null): string | null {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return null;

  const names = [...weekdays]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAYS[day]?.toLowerCase())
    .filter(Boolean);

  if (names.length === 0) return null;
  if (names.length === 1) return names[0];

  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * Os checkboxes do formulário viram dias, ou nulo para "todos os dias".
 *
 * Nenhum marcado e os sete marcados caem no mesmo lugar: os dois querem dizer
 * que não há restrição de dia. Guardar os sete faria o painel anunciar uma
 * repetição que não repete nada, e o banco recusa array vazio justamente para
 * essa ambiguidade não existir em duas formas.
 */
export function parseWeekdays(values: string[]): number[] | null {
  const days = [
    ...new Set(
      values
        .map((value) => Number.parseInt(value, 10))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ].sort((a, b) => a - b);

  return days.length === 0 || days.length === 7 ? null : days;
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
  // Dentro do prazo, mas hoje não é dia dela. "Agendada" é o que ela é: volta
  // sozinha, e o rótulo dos dias ao lado diz quando. Chamar de "ativa" o que
  // não está descontando nada agora é a única leitura que faria o lojista
  // desconfiar do painel.
  if (!appliesToday(promotion.weekdays, now)) return "agendada";
  return "ativa";
}
