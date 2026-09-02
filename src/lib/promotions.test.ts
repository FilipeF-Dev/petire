import { describe, expect, it } from "vitest";

import { priceOf, type Promotion } from "./promotions";

const PRODUCT = "d1111111-1111-4111-8111-111111111111";
const OTHER = "d2222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-09-02T12:00:00Z");

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    product_id: PRODUCT,
    kind: "percent",
    value: 10,
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: null,
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
