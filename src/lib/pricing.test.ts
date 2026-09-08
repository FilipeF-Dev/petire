import { describe, expect, it } from "vitest";

import {
  BASIC_PRICE_CENTS,
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
