import { describe, expect, it } from "vitest";

import {
  buildOrderMessage,
  whatsappUrl,
  type Order,
  type OrderLine,
} from "./order-message";

/**
 * O Intl separa "R$" do número com espaço não separável (U+00A0). É o correto,
 * mas ninguém digita isso numa asserção — então o texto é normalizado antes de
 * comparar.
 */
function normalize(text: string): string {
  return text.replace(/ /g, " ");
}

function line(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    name: "X-Salada",
    quantity: 2,
    totalCents: 5980,
    options: [
      { groupName: "Ponto da carne", name: "Ao ponto", priceDeltaCents: 0 },
      { groupName: "Adicionais", name: "Bacon", priceDeltaCents: 500 },
    ],
    note: "Capricha na maionese",
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  const lines = overrides.lines ?? [line()];
  const subtotalCents = lines.reduce((total, l) => total + l.totalCents, 0);

  return {
    storeName: "Lanchonete do Zé",
    lines,
    subtotalCents,
    deliveryFeeCents: 700,
    totalCents: subtotalCents + 700,
    ...overrides,
  };
}

describe("buildOrderMessage", () => {
  it("escreve item, opções, observação e totais", () => {
    const text = normalize(buildOrderMessage(order()));

    expect(text).toContain("*Pedido via Petire*");
    expect(text).toContain("2x X-Salada — R$ 59,80");
    expect(text).toContain("• Ponto da carne: Ao ponto");
    expect(text).toContain("• Adicionais: Bacon");
    expect(text).toContain("• Obs: Capricha na maionese");
    expect(text).toContain("Subtotal: R$ 59,80");
    expect(text).toContain("Entrega: R$ 7,00");
    expect(text).toContain("*Total: R$ 66,80*");
  });

  it("deixa os campos que o cliente completa no WhatsApp", () => {
    const text = normalize(buildOrderMessage(order()));

    expect(text).toContain("Nome:");
    expect(text).toContain("Endereço:");
    expect(text).toContain("Pagamento:");
  });

  it("diz 'a combinar' quando não há taxa de entrega cadastrada", () => {
    const text = normalize(
      buildOrderMessage(order({ deliveryFeeCents: 0, totalCents: 5980 })),
    );

    expect(text).toContain("Entrega: a combinar");
    expect(text).not.toContain("Entrega: R$ 0,00");
  });

  describe("pedidos longos", () => {
    // Estourar o limite do wa.me não dá erro: o WhatsApp abre com o texto
    // cortado no meio e a loja recebe meio pedido. Cada degrau abaixo é uma
    // perda de detalhe deliberada para o pedido chegar inteiro.
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        line({ name: `Item número ${index + 1} do cardápio` }),
      );

    it("cabe no limite mesmo com 60 itens detalhados", () => {
      const text = normalize(buildOrderMessage(order({ lines: many(60) })));
      expect(text.length).toBeLessThanOrEqual(1500);
    });

    it("larga os detalhes das opções antes de largar itens", () => {
      const text = normalize(buildOrderMessage(order({ lines: many(30) })));

      expect(text).not.toContain("• Adicionais: Bacon");
      expect(text).toContain("Item número 30 do cardápio");
    });

    it("avisa quantos itens ficaram de fora quando precisa cortar", () => {
      const text = normalize(buildOrderMessage(order({ lines: many(60) })));
      expect(text).toMatch(/… e mais \d+ itens/);
    });

    it("nunca corta o total, que é o que a loja confere", () => {
      const text = normalize(buildOrderMessage(order({ lines: many(60) })));
      expect(text).toContain("*Total:");
    });
  });
});

describe("whatsappUrl", () => {
  it("monta o deep link com a mensagem escapada", () => {
    const url = whatsappUrl("5511987654321", "Pedido: 2x X-Salada & batata");

    expect(url.startsWith("https://wa.me/5511987654321?text=")).toBe(true);
    expect(url).toContain("%26"); // o & vira escape, senão corta a query
    expect(url).not.toContain(" ");
  });

  it("sobrevive a acento e quebra de linha", () => {
    const url = whatsappUrl("5511987654321", "Endereço:\nRua Aspicuelta");
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Endereço:\nRua Aspicuelta",
    );
  });
});
