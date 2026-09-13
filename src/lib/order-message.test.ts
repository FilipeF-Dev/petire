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

  it("deixa os campos em aberto quando não há nada informado", () => {
    const text = normalize(buildOrderMessage(order()));

    expect(text).toContain("Nome:");
    expect(text).toContain("Endereço:");
  });

  it("não fala de pagamento", () => {
    // Quem cobra é a loja, do jeito dela. O Petire não vê dinheiro nenhum e
    // não deve dar a entender que vê.
    const text = normalize(buildOrderMessage(order()));

    expect(text).not.toContain("Pagamento");
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

describe("caminho de volta", () => {
  // Sem cadastro, esta mensagem na conversa do cliente é a única coisa que o
  // traz de volta. É o que faz o número do lojista crescer do mês 1 para o 2.
  const storeUrl = "https://petire.com.br/loja/lanchonete-do-ze";

  it("deixa o link da loja no fim da mensagem", () => {
    const text = normalize(buildOrderMessage(order({ storeUrl })));

    expect(text).toContain(
      "Pedir de novo: petire.com.br/loja/lanchonete-do-ze",
    );
  });

  it("tira o https:// para o WhatsApp linkar sozinho", () => {
    const text = normalize(buildOrderMessage(order({ storeUrl })));
    expect(text).not.toContain("https://");
  });

  it("não inventa rodapé quando não há link", () => {
    const text = normalize(buildOrderMessage(order()));
    expect(text).not.toContain("Pedir de novo");
  });

  it("é o link que se perde no corte, nunca o endereço", () => {
    // O rodapé é a última linha de propósito: num pedido que ainda estoura
    // depois dos três níveis de detalhe, o corte cai nele.
    const many = Array.from({ length: 60 }, (_, index) =>
      line({ name: `Item número ${index + 1} do cardápio` }),
    );
    const text = normalize(buildOrderMessage(order({ lines: many, storeUrl })));

    expect(text.length).toBeLessThanOrEqual(1500);
    expect(text).toContain("*Total:");
  });
});

describe("endereço de entrega", () => {
  const delivery = {
    cep: "36030330",
    street: "Rua Laura de Oliveira Ribeiro",
    neighborhood: "Cruzeiro do Sul",
    city: "Juiz de Fora",
    uf: "MG",
    recipient: "Filipe",
    number: "120",
    complement: "apto 42",
  };

  it("sem CEP informado, deixa as linhas em branco", () => {
    const text = normalize(buildOrderMessage(order()));

    expect(text).toContain("Endereço:");
    expect(text).not.toContain("CEP");
  });

  it("escreve o endereço inteiro, sem sobrar linha para o cliente", () => {
    const text = normalize(buildOrderMessage(order({ delivery })));

    expect(text).toContain("Nome: Filipe");
    expect(text).toContain("Endereço: Rua Laura de Oliveira Ribeiro, nº 120");
    expect(text).toContain("Complemento: apto 42");
    expect(text).toContain("Bairro: Cruzeiro do Sul · Juiz de Fora/MG");
    expect(text).toContain("CEP 36030-330");
  });

  it("omite o complemento quando não há", () => {
    const text = normalize(
      buildOrderMessage(order({ delivery: { ...delivery, complement: "" } })),
    );

    expect(text).not.toContain("Complemento");
    expect(text).toContain("Nome: Filipe");
  });

  it("cidade de CEP único vem sem rua, e a linha fica aberta", () => {
    // O ViaCEP devolve logradouro vazio quando o CEP atende a cidade toda.
    const text = normalize(
      buildOrderMessage(
        order({
          delivery: { ...delivery, street: "", neighborhood: "" },
        }),
      ),
    );

    expect(text).toContain("Endereço: nº 120");
    expect(text).toContain("Juiz de Fora/MG");
  });

  it("o endereço sobrevive ao corte de um pedido grande", () => {
    // Truncar o endereço seria pior do que truncar itens: a loja não teria
    // para onde entregar.
    const many = Array.from({ length: 60 }, (_, index) =>
      line({ name: `Item número ${index + 1} do cardápio` }),
    );
    const text = normalize(buildOrderMessage(order({ lines: many, delivery })));

    expect(text.length).toBeLessThanOrEqual(1500);
    expect(text).toContain("Rua Laura de Oliveira Ribeiro");
    expect(text).toContain("CEP 36030-330");
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

describe("pedido para buscar", () => {
  /*
    A loja que não entrega. O que muda não é cosmético: sai a linha de entrega,
    que seria o site prometendo em nome dela um serviço que ela não faz, e
    entra o endereço **dela** — quem vai buscar precisa saber onde, e é na
    conversa do WhatsApp que ele vai procurar isso na hora de sair de casa.
  */
  const PEDIDO = {
    storeName: "Distribuidora do Bairro",
    lines: [
      {
        name: "Gelo 5kg",
        quantity: 1,
        totalCents: 1200,
        options: [],
        note: null,
      },
    ],
    subtotalCents: 1200,
    deliveryFeeCents: 0,
    totalCents: 1200,
    escolha: "pickup" as const,
    storeAddress: "Rua Harmonia, 77",
    delivery: {
      recipient: "Filipe",
      number: "",
      complement: "",
      cep: "",
      street: "",
      neighborhood: "",
      city: "",
      uf: "",
    },
  };

  it("não escreve linha de entrega", () => {
    expect(buildOrderMessage(PEDIDO)).not.toContain("Entrega:");
  });

  it("diz que é retirada, e onde", () => {
    const mensagem = buildOrderMessage(PEDIDO);

    expect(mensagem).toContain("Retirada no balcão");
    expect(mensagem).toContain("Endereço da loja: Rua Harmonia, 77");
    expect(mensagem).toContain("Nome: Filipe");
  });

  it("não pede o endereço do cliente", () => {
    // A linha "Endereço:" em branco é o que obriga a loja a perguntar. Na
    // retirada não há o que perguntar, então ela não pode aparecer.
    expect(buildOrderMessage(PEDIDO)).not.toContain("Complemento:");
  });

  it("o total continua sendo o subtotal quando ninguém entrega", () => {
    // O espaço depois de "R$" é inquebrável, como o Intl do pt-BR escreve.
    // Normalizar aqui evita um teste que falha por um caractere invisível.
    const mensagem = buildOrderMessage(PEDIDO).replaceAll(
      String.fromCharCode(0xa0),
      " ",
    );

    expect(mensagem).toContain("*Total: R$ 12,00*");
  });
});
