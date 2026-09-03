import { describe, expect, it } from "vitest";

import { parseMenu } from "./menu-import";

describe("parseMenu", () => {
  it("lê um cardápio como o lojista escreve", () => {
    const menu = parseMenu(`
LANCHES
X-Salada 24,90
X-Bacon - R$ 28,90

BEBIDAS
Coca-Cola lata 7,00
    `);

    expect(menu.sections).toEqual([
      {
        category: "LANCHES",
        items: [
          { name: "X-Salada", priceCents: 2490 },
          { name: "X-Bacon", priceCents: 2890 },
        ],
      },
      {
        category: "BEBIDAS",
        items: [{ name: "Coca-Cola lata", priceCents: 700 }],
      },
    ]);
    expect(menu.total).toBe(3);
  });

  it("aceita o item antes de qualquer título", () => {
    const menu = parseMenu("Marmita 22,00");

    expect(menu.sections).toEqual([
      { category: null, items: [{ name: "Marmita", priceCents: 2200 }] },
    ]);
  });

  it("tira marcador de lista e pontilhado", () => {
    const menu = parseMenu(
      ["- Batata frita ....... 18,90", "2) Calabresa • 24,00"].join("\n"),
    );

    expect(menu.sections[0].items).toEqual([
      { name: "Batata frita", priceCents: 1890 },
      { name: "Calabresa", priceCents: 2400 },
    ]);
  });

  it("não confunde o tamanho do item com o preço", () => {
    const menu = parseMenu("Coca-Cola 2L 14,00\nX-Burger 180g 26,00");

    expect(menu.sections[0].items).toEqual([
      { name: "Coca-Cola 2L", priceCents: 1400 },
      { name: "X-Burger 180g", priceCents: 2600 },
    ]);
  });

  it("exige duas casas nos centavos", () => {
    // "Pizza 4 queijos" não pode virar uma pizza de R$ 0,40.
    const menu = parseMenu("Pizza 4 queijos\nMussarela 45,00");

    expect(menu.sections).toEqual([
      {
        category: "Pizza 4 queijos",
        items: [{ name: "Mussarela", priceCents: 4500 }],
      },
    ]);
  });

  it("entende preço inteiro e ponto como decimal", () => {
    const menu = parseMenu("Água 3\nSuco 8.50");

    expect(menu.sections[0].items).toEqual([
      { name: "Água", priceCents: 300 },
      { name: "Suco", priceCents: 850 },
    ]);
  });

  it("entende o ponto de milhar", () => {
    const menu = parseMenu("Rodízio 1.200,00");

    expect(menu.sections[0].items[0].priceCents).toBe(120000);
  });

  it("devolve as linhas que não viraram nada", () => {
    const menu = parseMenu(
      ["Entregamos até 23h", "LANCHES", "X-Salada 24,90", "R$ 10,00"].join("\n"),
    );

    expect(menu.sections).toEqual([
      { category: "LANCHES", items: [{ name: "X-Salada", priceCents: 2490 }] },
    ]);
    expect(menu.ignored).toContain("Entregamos até 23h");
    expect(menu.ignored).toContain("R$ 10,00");
  });

  it("não cria categoria vazia no fim do texto", () => {
    const menu = parseMenu("LANCHES\nX-Salada 24,90\nQualquer observação");

    expect(menu.sections).toHaveLength(1);
    expect(menu.ignored).toEqual(["Qualquer observação"]);
  });

  it("para de importar depois do teto e não perde a conta", () => {
    const lines = Array.from({ length: 220 }, (_, i) => `Item ${i} 10,00`);
    const menu = parseMenu(lines.join("\n"));

    expect(menu.total).toBe(200);
    expect(menu.ignored).toHaveLength(20);
  });

  it("devolve vazio para texto em branco", () => {
    expect(parseMenu("   \n\n  ")).toEqual({
      sections: [],
      ignored: [],
      total: 0,
    });
  });
});
