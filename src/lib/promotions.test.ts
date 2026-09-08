import { describe, expect, it } from "vitest";

import {
  brazilWeekday,
  dayEndsAt,
  dayStartsAt,
  endsAtToDay,
  parseWeekdays,
  priceOf,
  promotionStatus,
  startsAtToDay,
  weekdaysLabel,
  type Promotion,
} from "./promotions";

const PRODUCT = "d1111111-1111-4111-8111-111111111111";
const OTHER = "d2222222-2222-4222-8222-222222222222";
/** Quarta-feira, 09:00 em Brasília. */
const NOW = new Date("2026-09-02T12:00:00Z");
const QUARTA = 3;
const QUINTA = 4;

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    product_id: PRODUCT,
    kind: "percent",
    value: 10,
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: null,
    weekdays: null,
    ...overrides,
  };
}

describe("priceOf", () => {
  it("devolve o preço cheio quando não há promoção", () => {
    expect(priceOf(2890, PRODUCT, [], NOW)).toEqual({
      cents: 2890,
      originalCents: null,
      label: null,
    });
  });

  it("aplica desconto percentual e guarda o preço de tabela", () => {
    expect(priceOf(2890, PRODUCT, [promo()], NOW)).toEqual({
      cents: 2601,
      originalCents: 2890,
      label: "10% OFF",
    });
  });

  it("aplica desconto em valor fixo", () => {
    const price = priceOf(2890, PRODUCT, [promo({ kind: "fixed", value: 500 })], NOW);

    expect(price.cents).toBe(2390);
    // O Intl usa espaço não separável (U+00A0) entre "R$" e o número.
    expect(price.label?.replace(/ /g, " ")).toBe("R$ 5,00 OFF");
  });

  it("ignora promoção de outro produto", () => {
    const price = priceOf(2890, OTHER, [promo()], NOW);
    expect(price.cents).toBe(2890);
  });

  it("aplica promoção da loja inteira quando product_id é nulo", () => {
    const price = priceOf(2890, OTHER, [promo({ product_id: null })], NOW);
    expect(price.cents).toBe(2601);
  });

  it("a promoção do produto ganha da promoção da loja, sem somar", () => {
    // Duas promoções empilhando zeram a margem sem o lojista perceber, e o
    // painel não dá como auditar isso.
    const price = priceOf(
      1000,
      PRODUCT,
      [promo({ value: 10 }), promo({ product_id: null, value: 50 })],
      NOW,
    );

    expect(price.cents).toBe(900);
  });

  it("ignora promoção que ainda não começou", () => {
    const price = priceOf(
      2890,
      PRODUCT,
      [promo({ starts_at: "2026-12-01T00:00:00Z" })],
      NOW,
    );
    expect(price.cents).toBe(2890);
  });

  it("ignora promoção vencida", () => {
    const price = priceOf(
      2890,
      PRODUCT,
      [promo({ ends_at: "2026-08-31T00:00:00Z" })],
      NOW,
    );
    expect(price.cents).toBe(2890);
  });

  it("não deixa o preço ficar negativo", () => {
    const price = priceOf(
      500,
      PRODUCT,
      [promo({ kind: "fixed", value: 900 })],
      NOW,
    );
    expect(price.cents).toBe(0);
  });
});

describe("janela da promoção", () => {
  it("começa o dia às 00:00 do horário de Brasília", () => {
    expect(dayStartsAt("2026-09-30")).toBe("2026-09-30T00:00:00-03:00");
  });

  it("termina o dia informado por inteiro", () => {
    // "até dia 30" precisa cobrir o jantar do dia 30.
    const ends = new Date(dayEndsAt("2026-09-30"));

    expect(ends > new Date("2026-09-30T23:00:00-03:00")).toBe(true);
    expect(ends > new Date("2026-10-01T00:01:00-03:00")).toBe(false);
  });

  it("vira o mês sem estragar a data", () => {
    expect(dayEndsAt("2026-01-31")).toBe("2026-02-01T00:00:00-03:00");
  });

  it("volta para as datas que o lojista digitou", () => {
    expect(startsAtToDay(dayStartsAt("2026-09-30"))).toBe("2026-09-30");
    expect(endsAtToDay(dayEndsAt("2026-09-30"))).toBe("2026-09-30");
    expect(endsAtToDay(null)).toBe("");
  });
});

describe("promotionStatus", () => {
  const janela = { is_active: true, ...promo({ ends_at: "2026-09-30T00:00:00Z" }) };

  it("chama de pausada a que o lojista desligou", () => {
    expect(promotionStatus({ ...janela, is_active: false }, NOW)).toBe("pausada");
  });

  it("chama de agendada a que ainda não começou", () => {
    expect(
      promotionStatus({ ...janela, starts_at: "2026-10-01T00:00:00Z" }, NOW),
    ).toBe("agendada");
  });

  it("chama de encerrada a que já passou do fim", () => {
    expect(
      promotionStatus({ ...janela, ends_at: "2026-09-01T00:00:00Z" }, NOW),
    ).toBe("encerrada");
  });

  it("chama de ativa a que está valendo agora", () => {
    expect(promotionStatus(janela, NOW)).toBe("ativa");
  });
});

describe("dias da semana", () => {
  it("aplica no dia marcado", () => {
    const price = priceOf(
      1000,
      PRODUCT,
      [promo({ weekdays: [QUARTA] })],
      NOW,
    );

    expect(price.cents).toBe(900);
  });

  it("nao aplica fora do dia marcado", () => {
    const price = priceOf(
      1000,
      PRODUCT,
      [promo({ weekdays: [QUINTA] })],
      NOW,
    );

    expect(price.cents).toBe(1000);
    expect(price.label).toBeNull();
  });

  it("sem dias marcados, vale todo dia", () => {
    expect(priceOf(1000, PRODUCT, [promo({ weekdays: null })], NOW).cents).toBe(
      900,
    );
    expect(priceOf(1000, PRODUCT, [promo({ weekdays: [] })], NOW).cents).toBe(
      900,
    );
  });

  it("deixa a promocao do cardapio valer quando a do item nao e de hoje", () => {
    // A do item continua sendo a mais especifica, mas hoje ela nao existe —
    // entao quem vale e a da loja, e nao "nenhuma".
    const price = priceOf(
      1000,
      PRODUCT,
      [
        promo({ weekdays: [QUINTA], value: 50 }),
        promo({ product_id: null, value: 10 }),
      ],
      NOW,
    );

    expect(price.cents).toBe(900);
  });
});

describe("brazilWeekday", () => {
  it("conta o dia pelo relogio de Brasilia, e nao pelo UTC", () => {
    // 22h de sexta em Brasilia ja e sabado em UTC. Sem o fuso, quem abre o
    // cardapio nesse horario veria o desconto do dia seguinte.
    expect(brazilWeekday(new Date("2026-09-05T01:00:00Z"))).toBe(5);
  });
});

describe("parseWeekdays", () => {
  it("ordena e tira repetido", () => {
    expect(parseWeekdays(["6", "5", "5"])).toEqual([5, 6]);
  });

  it("trata nenhum e todos como sem restricao", () => {
    expect(parseWeekdays([])).toBeNull();
    expect(parseWeekdays(["0", "1", "2", "3", "4", "5", "6"])).toBeNull();
  });

  it("descarta o que nao e dia da semana", () => {
    expect(parseWeekdays(["7", "-1", "abc", "2"])).toEqual([2]);
  });
});

describe("weekdaysLabel", () => {
  it("junta os dias com virgula e 'e'", () => {
    expect(weekdaysLabel([5, 6])).toBe("sexta e sábado");
    expect(weekdaysLabel([1, 3, 5])).toBe("segunda, quarta e sexta");
  });

  it("se cala quando nao ha restricao de dia", () => {
    expect(weekdaysLabel(null)).toBeNull();
    expect(weekdaysLabel([])).toBeNull();
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBeNull();
  });
});

describe("promotionStatus com dia da semana", () => {
  it("chama de agendada a que esta no prazo mas nao e de hoje", () => {
    const status = promotionStatus(
      { ...promo({ weekdays: [QUINTA] }), is_active: true },
      NOW,
    );

    expect(status).toBe("agendada");
  });

  it("chama de ativa a que e de hoje", () => {
    const status = promotionStatus(
      { ...promo({ weekdays: [QUARTA] }), is_active: true },
      NOW,
    );

    expect(status).toBe("ativa");
  });

  it("pausada ganha do dia da semana", () => {
    const status = promotionStatus(
      { ...promo({ weekdays: [QUARTA] }), is_active: false },
      NOW,
    );

    expect(status).toBe("pausada");
  });
});
