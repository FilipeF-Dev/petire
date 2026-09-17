import { describe, expect, it } from "vitest";

import { parseMenu, parseMenuInput } from "./menu-import";

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

describe("cardápio estruturado", () => {
  /*
    O segundo formato do colar. Quem escreve não é o lojista: é o suporte, com
    um cardápio que uma IA leu de uma foto. O que se testa aqui é o que essa
    troca de autor exige — precisão em vez de generosidade.
  */
  const fanta = {
    secoes: [
      {
        nome: "Bebidas",
        itens: [
          {
            nome: "Fanta",
            preco: 0,
            grupos: [
              {
                nome: "Sabor",
                min: 1,
                max: 1,
                opcoes: [
                  { nome: "Guaraná", mais: 8 },
                  { nome: "Laranja", mais: 8 },
                  { nome: "Uva", mais: 8.5 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it("lê os grupos e as opções do item", () => {
    const { menu, erro, estruturado } = parseMenuInput(JSON.stringify(fanta));

    expect(erro).toBeNull();
    expect(estruturado).toBe(true);

    const item = menu.sections[0].items[0];
    expect(item.name).toBe("Fanta");
    expect(item.priceCents).toBe(0);
    expect(item.groups?.[0]).toEqual({
      name: "Sabor",
      min: 1,
      max: 1,
      options: [
        { name: "Guaraná", plusCents: 800 },
        { name: "Laranja", plusCents: 800 },
        { name: "Uva", plusCents: 850 },
      ],
    });
  });

  it("preço vem em reais, e vira centavos sem erro de arredondamento", () => {
    // 19.99 * 100 dá 1998.9999... em ponto flutuante. Sem o arredondamento,
    // o item entraria a R$ 19,98.
    const { menu } = parseMenuInput(
      JSON.stringify({
        secoes: [{ nome: "X", itens: [{ nome: "Item", preco: 19.99 }] }],
      }),
    );

    expect(menu.sections[0].items[0].priceCents).toBe(1999);
  });

  it("um array sozinho é entendido como a lista de seções", () => {
    // É o que uma IA devolve quando alguém pede "só as seções".
    const { menu, erro } = parseMenuInput(JSON.stringify(fanta.secoes));

    expect(erro).toBeNull();
    expect(menu.total).toBe(1);
  });

  it("diz qual campo está errado, e não só que deu errado", () => {
    const { erro } = parseMenuInput(
      JSON.stringify({
        secoes: [
          { nome: "Bebidas", itens: [{ nome: "Fanta", preco: "oito reais" }] },
        ],
      }),
    );

    expect(erro).toContain("secoes[0].itens[0].preco");
  });

  it("grupo sem opção nenhuma não passa", () => {
    const { erro } = parseMenuInput(
      JSON.stringify({
        secoes: [
          {
            nome: "X",
            itens: [
              { nome: "Item", preco: 10, grupos: [{ nome: "Vazio", opcoes: [] }] },
            ],
          },
        ],
      }),
    );

    expect(erro).toContain("Grupo sem nenhuma opção");
  });

  it("máximo menor que o mínimo não passa", () => {
    // Obrigar a escolher duas e permitir escolher uma é um item que ninguém
    // consegue pedir.
    const { erro } = parseMenuInput(
      JSON.stringify({
        secoes: [
          {
            nome: "X",
            itens: [
              {
                nome: "Item",
                preco: 10,
                grupos: [
                  { nome: "Tamanho", min: 2, max: 1, opcoes: [{ nome: "P" }] },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(erro).toContain("menor que o mínimo");
  });

  it("JSON quebrado avisa que é JSON quebrado", () => {
    const { erro } = parseMenuInput('{"secoes": [');
    expect(erro).toContain("não é um JSON válido");
  });

  it("cardápio de texto continua entrando pelo mesmo lugar", () => {
    const { menu, erro, estruturado } = parseMenuInput(
      "LANCHES\nX-Salada 24,90",
    );

    expect(erro).toBeNull();
    expect(estruturado).toBe(false);
    expect(menu.sections[0].items[0]).toEqual({
      name: "X-Salada",
      priceCents: 2490,
    });
  });
});

describe("grupos reusados entre itens", () => {
  /*
    A razão de o formato ter um dicionário no topo, e não só grupos dentro do
    item: "Adicionais" nos doze hambúrgueres da casa tem de virar UM grupo
    ligado a doze produtos. Repetido dentro de cada item viraria doze grupos
    iguais, e o lojista mudaria o preço do bacon num deles e continuaria errado
    nos outros onze.
  */
  const doisLanches = {
    grupos: {
      adicionais: {
        nome: "Adicionais",
        min: 0,
        max: 4,
        opcoes: [{ nome: "Bacon", mais: 5 }],
      },
    },
    secoes: [
      {
        nome: "Lanches",
        itens: [
          { nome: "X-Salada", preco: 24.9, usa: ["adicionais"] },
          { nome: "X-Bacon", preco: 28.9, usa: ["adicionais"] },
        ],
      },
    ],
  };

  it("declara o grupo uma vez e os itens apenas o citam", () => {
    const { menu, erro } = parseMenuInput(JSON.stringify(doisLanches));

    expect(erro).toBeNull();
    expect(menu.shared?.adicionais).toEqual({
      name: "Adicionais",
      min: 0,
      max: 4,
      options: [{ name: "Bacon", plusCents: 500 }],
    });

    const [salada, bacon] = menu.sections[0].items;
    expect(salada.uses).toEqual(["adicionais"]);
    expect(bacon.uses).toEqual(["adicionais"]);
    // Nenhum dos dois carrega uma cópia do grupo.
    expect(salada.groups).toBeUndefined();
  });

  it("um item pode ter grupo próprio e citado ao mesmo tempo", () => {
    const { menu, erro } = parseMenuInput(
      JSON.stringify({
        grupos: doisLanches.grupos,
        secoes: [
          {
            nome: "Lanches",
            itens: [
              {
                nome: "X-Salada",
                preco: 24.9,
                usa: ["adicionais"],
                grupos: [
                  {
                    nome: "Ponto da carne",
                    min: 1,
                    max: 1,
                    opcoes: [{ nome: "Ao ponto" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(erro).toBeNull();
    const item = menu.sections[0].items[0];
    expect(item.groups?.[0].name).toBe("Ponto da carne");
    expect(item.uses).toEqual(["adicionais"]);
  });

  it("apelido que ninguém declarou é erro, e diz qual é", () => {
    /*
      O engano mais provável de uma transcrição feita por IA: ela cita o grupo
      e esquece de declarar. Sem esta checagem o item chegaria ao cardápio sem
      as opções, e ninguém saberia até um cliente pedir.
    */
    const { erro } = parseMenuInput(
      JSON.stringify({
        secoes: [
          {
            nome: "Lanches",
            itens: [{ nome: "X-Salada", preco: 24.9, usa: ["adicionais"] }],
          },
        ],
      }),
    );

    expect(erro).toContain("adicionais");
    expect(erro).toContain("X-Salada");
  });
});

describe("teto de itens", () => {
  const muitos = (quantos: number) => ({
    secoes: [
      {
        nome: "Tudo",
        itens: Array.from({ length: quantos }, (_, i) => ({
          nome: `Item ${i}`,
          preco: 10,
        })),
      },
    ],
  });

  it("o JSON acima do teto é recusado, e não cortado em silêncio", () => {
    /*
      Diferente do texto colado, que manda o excedente para "fora da
      importação": aqui o JSON foi construído de propósito, e sumir com os
      últimos em silêncio entregaria um cardápio pela metade a quem acha que
      entregou inteiro.
    */
    const { erro, menu } = parseMenuInput(JSON.stringify(muitos(201)));

    expect(erro).toContain("mais de 200 itens");
    // E a mensagem aponta a saída, que é agrupar — não colar em duas partes.
    expect(erro).toContain("Agrupe as variações");
    expect(menu.total).toBe(0);
  });

  it("exatamente no teto passa", () => {
    const { erro, menu } = parseMenuInput(JSON.stringify(muitos(200)));

    expect(erro).toBeNull();
    expect(menu.total).toBe(200);
  });
});
