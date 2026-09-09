import { describe, expect, it } from "vitest";

import {
  founderDiscountPercent,
  founderFirstBillingMonth,
  BASIC_PRICE_CENTS,
  FOUNDER_PRICE_CENTS,
  monthlyPriceCents,
  PLUS_PRICE_CENTS,
  dailyCents,
  monthlySavings,
  type Savings,
} from "./pricing";

function savings(overrides: Partial<Parameters<typeof monthlySavings>[0]> = {}) {
  return monthlySavings({
    revenueCents: 500_000,
    commissionPercent: 23,
    priceCents: BASIC_PRICE_CENTS,
    ...overrides,
  });
}

describe("monthlySavings", () => {
  it("desconta a mensalidade da comissão do mês", () => {
    const result = savings() as Savings;

    expect(result.commissionCents).toBe(115_000);
    expect(result.petireCents).toBe(BASIC_PRICE_CENTS);
    expect(result.monthlyCents).toBe(115_000 - BASIC_PRICE_CENTS);
  });

  it("projeta doze meses a partir da diferença mensal", () => {
    const result = savings() as Savings;

    expect(result.yearlyCents).toBe(result.monthlyCents * 12);
  });

  it("fica em centavos inteiros mesmo com percentual quebrado", () => {
    const result = savings({ commissionPercent: 12.5 }) as Savings;

    expect(Number.isInteger(result.commissionCents)).toBe(true);
    expect(result.commissionCents).toBe(62_500);
  });

  it("se cala enquanto não há faturamento para comparar", () => {
    expect(savings({ revenueCents: 0 })).toBeNull();
    expect(savings({ revenueCents: -1 })).toBeNull();
    expect(savings({ revenueCents: Number.NaN })).toBeNull();
  });

  it("se cala com percentual fora do que existe", () => {
    expect(savings({ commissionPercent: 0 })).toBeNull();
    expect(savings({ commissionPercent: 101 })).toBeNull();
    expect(savings({ commissionPercent: Number.NaN })).toBeNull();
  });

  it("admite o resultado negativo em vez de esconder", () => {
    // Faturamento baixo demais: a comissão do mês não chega à mensalidade, e
    // trocar de modelo custa dinheiro. A tela precisa saber disso para não
    // prometer economia a quem não teria.
    const result = savings({ revenueCents: 10_000 }) as Savings;

    expect(result.monthlyCents).toBeLessThan(0);
  });
});

describe("dailyCents", () => {
  it("divide a mensalidade por trinta dias", () => {
    expect(dailyCents(4900)).toBe(163);
  });
});

describe("monthlyPriceCents", () => {
  it("cobra o preço travado da fundadora no básico", () => {
    expect(monthlyPriceCents({ plan: "basico", isFounder: true })).toBe(
      FOUNDER_PRICE_CENTS,
    );
  });

  it("cobra o básico cheio de quem chegou depois", () => {
    expect(monthlyPriceCents({ plan: "basico", isFounder: false })).toBe(
      BASIC_PRICE_CENTS,
    );
  });

  it("a fundadora que sobe para o Plus paga o Plus", () => {
    // O preço travado é do Básico — foi o que a venda prometeu. Subir de plano
    // é comprar recurso novo, e ela pode voltar aos R$ 29 quando quiser.
    expect(monthlyPriceCents({ plan: "plus", isFounder: true })).toBe(
      PLUS_PRICE_CENTS,
    );
  });
});

describe("founderDiscountPercent", () => {
  it("sai da diferença entre o Básico e o preço travado", () => {
    // R$ 49 → R$ 29 são 40,8%, que arredondam para 41.
    expect(founderDiscountPercent()).toBe(41);
  });

  it("é inteiro, porque é isso que a vitrine mostra", () => {
    expect(Number.isInteger(founderDiscountPercent())).toBe(true);
  });
});

describe("founderFirstBillingMonth", () => {
  it("noventa dias grátis põem a primeira conta no quarto mês", () => {
    expect(founderFirstBillingMonth()).toBe(4);
  });
});
