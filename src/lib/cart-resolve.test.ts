import { describe, expect, it } from "vitest";

import {
  assembleCart,
  type CartLine,
  type Catalog,
  type CatalogProduct,
  type CartStore,
} from "./cart-resolve";

/**
 * O carrinho é o único lugar do Petire onde um erro apaga algo do cliente.
 *
 * Estes testes existem por causa de um incidente real: uma coluna que ainda
 * não existia no banco de produção fez a consulta falhar, a lista de produtos
 * voltou vazia, e a montagem concluiu — corretamente, para o que ela sabia —
 * que todos os itens tinham sumido do cardápio. Quem lê `dropped` apaga do
 * aparelho.
 */

const ZE: CartStore = {
  id: "loja-ze",
  slug: "lanchonete-do-ze",
  name: "Lanchonete do Zé",
  is_open_now: true,
  is_open_manual: null,
  delivery_fee_cents: 700,
  min_order_cents: 2000,
  whatsapp_e164: "5511987654321",
};

const XSALADA: CatalogProduct = {
  id: "x-salada",
  store_id: "loja-ze",
  name: "X-Salada",
  price_cents: 2490,
  image_url: null,
  is_available: true,
  product_option_groups: [
    {
      option_groups: {
        name: "Adicionais",
        options: [
          {
            id: "bacon",
            name: "Bacon",
            price_delta_cents: 500,
            is_available: true,
          },
          {
            id: "ovo",
            name: "Ovo",
            price_delta_cents: 300,
            is_available: false,
          },
        ],
      },
    },
  ],
};

function linha(sobrescreve: Partial<CartLine> = {}): CartLine {
  return {
    id: "linha-1",
    storeId: "loja-ze",
    productId: "x-salada",
    optionIds: [],
    quantity: 1,
    note: null,
    ...sobrescreve,
  };
}

function catalogo(sobrescreve: Partial<Catalog> = {}): Catalog {
  return {
    stores: [ZE],
    products: [XSALADA],
    promotions: [],
    hours: [],
    ...sobrescreve,
  };
}

describe("assembleCart", () => {
  it("monta a linha com preço, taxa e mínimo da loja", () => {
    const { stores, dropped } = assembleCart([linha({ quantity: 2 })], catalogo());

    expect(dropped).toEqual([]);
    expect(stores).toHaveLength(1);

    const loja = stores[0];
    expect(loja.lines[0].unitCents).toBe(2490);
    expect(loja.lines[0].totalCents).toBe(4980);
    expect(loja.subtotalCents).toBe(4980);
    expect(loja.totalCents).toBe(5680); // com a entrega
    expect(loja.meetsMinimum).toBe(true);
  });

  /*
    O caso do incidente, do outro lado.

    Quando a consulta falha, quem chama devolve `failed` e **não** chama esta
    função — é o contrato. O que se testa aqui é a metade que existe: catálogo
    vazio significa mesmo que o item sumiu, e aí descartar é o certo. As duas
    coisas juntas são a distinção que faltava.
  */
  it("descarta o item que sumiu do cardápio", () => {
    const { stores, dropped } = assembleCart(
      [linha()],
      catalogo({ products: [] }),
    );

    expect(dropped).toEqual(["linha-1"]);
    expect(stores).toEqual([]);
  });

  it("descarta o item esgotado", () => {
    const { dropped } = assembleCart(
      [linha()],
      catalogo({ products: [{ ...XSALADA, is_available: false }] }),
    );

    expect(dropped).toEqual(["linha-1"]);
  });

  // O localStorage é editável: uma linha adulterada não pode misturar
  // cardápios de lojas diferentes.
  it("descarta a linha que aponta o produto para outra loja", () => {
    const { dropped } = assembleCart(
      [linha({ storeId: "loja-vizinha" })],
      catalogo({ stores: [ZE, { ...ZE, id: "loja-vizinha" }] }),
    );

    expect(dropped).toEqual(["linha-1"]);
  });

  it("soma a opção escolhida e ignora a que esgotou", () => {
    const { stores } = assembleCart(
      [linha({ optionIds: ["bacon", "ovo"] })],
      catalogo(),
    );

    const item = stores[0].lines[0];
    expect(item.unitCents).toBe(2990); // 24,90 + 5,00 do bacon
    expect(item.options.map((o) => o.name)).toEqual(["Bacon"]);
    expect(item.optionIds).toEqual(["bacon"]);
  });

  // Opção que não pertence a nenhum grupo deste item não entra na conta, mesmo
  // que o id venha na linha guardada.
  it("ignora id de opção que não é deste item", () => {
    const { stores } = assembleCart(
      [linha({ optionIds: ["queijo-de-outro-produto"] })],
      catalogo(),
    );

    expect(stores[0].lines[0].unitCents).toBe(2490);
    expect(stores[0].lines[0].options).toEqual([]);
  });

  /*
    O preço é recalculado agora, não guardado no aparelho: um carrinho de
    ontem não pode cobrar o preço de ontem na mensagem que chega à loja.
  */
  it("aplica a promoção que estiver valendo, e mostra o preço de tabela", () => {
    const { stores } = assembleCart(
      [linha({ optionIds: ["bacon"] })],
      catalogo({
        promotions: [
          {
            store_id: "loja-ze",
            product_id: "x-salada",
            kind: "percent",
            value: 10,
            starts_at: "2020-01-01T00:00:00-03:00",
            ends_at: null,
            weekdays: null,
          },
        ],
      }),
    );

    const item = stores[0].lines[0];
    // 10% sobre 24,90 = 22,41, e o adicional entra depois do desconto.
    expect(item.unitCents).toBe(2741);
    expect(item.originalUnitCents).toBe(2990);
  });

  it("não deixa o pedido passar quando não alcança o mínimo", () => {
    const { stores } = assembleCart(
      [linha()],
      catalogo({ stores: [{ ...ZE, min_order_cents: 3000 }] }),
    );

    expect(stores[0].meetsMinimum).toBe(false);
  });

  // Loja fechada continua no carrinho — o cliente decide esperar ou não —, mas
  // com a hora em que ela abre, que é o que sustenta essa decisão.
  it("diz quando a loja fechada abre", () => {
    const { stores } = assembleCart(
      [linha()],
      catalogo({
        stores: [{ ...ZE, is_open_now: false }],
        hours: [{ store_id: "loja-ze", weekday: 3, opens_at: "18:00:00" }],
      }),
      // Uma quarta-feira, 10:00 em Brasília.
      new Date("2026-09-16T13:00:00Z"),
    );

    expect(stores[0].isOpenNow).toBe(false);
    expect(stores[0].opensLabel).toContain("18:00");
  });

  it("separa por loja e ordena por nome", () => {
    const outra: CartStore = {
      ...ZE,
      id: "loja-a",
      slug: "acai-da-esquina",
      name: "Açaí da Esquina",
    };
    const acai: CatalogProduct = {
      ...XSALADA,
      id: "acai-500",
      store_id: "loja-a",
      name: "Açaí 500ml",
      product_option_groups: [],
    };

    const { stores } = assembleCart(
      [
        linha(),
        linha({ id: "linha-2", storeId: "loja-a", productId: "acai-500" }),
      ],
      catalogo({ stores: [ZE, outra], products: [XSALADA, acai] }),
    );

    expect(stores.map((s) => s.name)).toEqual([
      "Açaí da Esquina",
      "Lanchonete do Zé",
    ]);
  });
});
