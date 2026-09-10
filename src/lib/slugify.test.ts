import { describe, expect, it } from "vitest";

import {
  humanizePlace,
  matchesTerms,
  relevance,
  searchTerms,
  slugify,
} from "./slug";
import { normalizeWhatsapp } from "./validation";

describe("slugify", () => {
  it("tira acento e caixa", () => {
    expect(slugify("Lanchonete do Zé")).toBe("lanchonete-do-ze");
    expect(slugify("Açaí & Cia")).toBe("acai-cia");
  });

  it("colapsa separadores e não deixa hífen nas pontas", () => {
    expect(slugify("  Bar  do   João!! ")).toBe("bar-do-joao");
  });

  it("produz algo que passa no CHECK de stores.slug", () => {
    const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const name of [
      "Padaria São José",
      "Pizzaria 100% Massa",
      "Empório D'Itália",
    ]) {
      expect(slugify(name)).toMatch(pattern);
    }
  });
});

describe("humanizePlace", () => {
  it("remonta o nome a partir do slug", () => {
    expect(humanizePlace("juiz-de-fora")).toBe("Juiz de Fora");
    expect(humanizePlace("vila-madalena")).toBe("Vila Madalena");
    expect(humanizePlace("centro")).toBe("Centro");
  });

  it("mantém as preposições minúsculas, menos na primeira palavra", () => {
    expect(humanizePlace("sao-joao-da-boa-vista")).toBe(
      "Sao Joao da Boa Vista",
    );
    expect(humanizePlace("do-carmo")).toBe("Do Carmo");
  });

  it("é o que evita o título 'Lojas em juiz-de-fora'", () => {
    // Só entra em cena quando não há loja no resultado — que é o estado de
    // toda cidade antes da primeira loja entrar.
    expect(humanizePlace(slugify("Juiz de Fora"))).toBe("Juiz de Fora");
  });
});

describe("normalizeWhatsapp", () => {
  it("completa o 55 quando o lojista digita só DDD + número", () => {
    expect(normalizeWhatsapp("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizeWhatsapp("11 3456-7890")).toBe("551134567890");
  });

  it("aceita número que já vem com código do país", () => {
    expect(normalizeWhatsapp("+55 11 98765-4321")).toBe("5511987654321");
  });

  it("recusa o que não dá para interpretar", () => {
    // Melhor recusar do que gravar um número para onde o pedido nunca chega.
    expect(normalizeWhatsapp("98765-4321")).toBeNull();
    expect(normalizeWhatsapp("")).toBeNull();
    expect(normalizeWhatsapp("11 9876543210987")).toBeNull();
  });
});

describe("searchTerms", () => {
  it("quebra a busca em palavras", () => {
    expect(searchTerms("suco laranja")).toEqual(["suco", "laranja"]);
  });

  it("é o que faz 'suco laranja' achar 'Suco de laranja 500ml'", () => {
    // Com o slug inteiro, "suco-laranja" não casa com "suco-de-laranja-500ml":
    // o "de" no meio quebra a sequência. Palavra por palavra, casa.
    const alvo = slugify("Suco de laranja 500ml");
    const termos = searchTerms("suco laranja");

    expect(alvo.includes("suco-laranja")).toBe(false);
    expect(termos.every((termo) => alvo.includes(termo))).toBe(true);
  });

  it("continua achando o que já achava, com hífen no nome", () => {
    const alvo = slugify("Coca-Cola lata 350ml");

    expect(searchTerms("coca cola").every((t) => alvo.includes(t))).toBe(true);
    expect(searchTerms("coca lata").every((t) => alvo.includes(t))).toBe(true);
    expect(searchTerms("Coca-Cola").every((t) => alvo.includes(t))).toBe(true);
  });

  it("mais palavras estreitam, não afrouxam", () => {
    // O risco de quebrar em palavras seria virar OR e trazer lixo. É AND.
    const alvo = slugify("X-Salada");

    expect(searchTerms("x salada").every((t) => alvo.includes(t))).toBe(true);
    expect(searchTerms("x salada bacon").every((t) => alvo.includes(t))).toBe(
      false,
    );
  });

  it("derruba acento e pontuação, como o slug", () => {
    expect(searchTerms("Açaí, 500ml!")).toEqual(["acai", "500ml"]);
  });

  it("busca vazia não vira filtro nenhum", () => {
    // Sem isto, "!!!" viraria uma lista vazia de termos que casa com tudo —
    // ou pior, um `%%` que devolve o catálogo inteiro.
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms("   ")).toEqual([]);
    expect(searchTerms("!!!")).toEqual([]);
  });

  it("não deixa a frase virar uma consulta sem fim", () => {
    expect(
      searchTerms("um dois tres quatro cinco seis sete oito"),
    ).toHaveLength(6);
  });
});

describe("matchesTerms", () => {
  // O caso que originou tudo: "x-tudo" e "x tudo" achavam, "xtudo" não.
  it("acha o nome mesmo com as palavras coladas", () => {
    expect(matchesTerms(slugify("X-Tudo"), searchTerms("xtudo"))).toBe(true);
    expect(matchesTerms(slugify("Coca-Cola 2L"), searchTerms("cocacola"))).toBe(
      true,
    );
    expect(
      matchesTerms(slugify("Pão de queijo"), searchTerms("paodequeijo")),
    ).toBe(true);
  });

  it("não desfaz o que já funcionava", () => {
    expect(matchesTerms(slugify("X-Tudo"), searchTerms("x tudo"))).toBe(true);
    expect(matchesTerms(slugify("X-Tudo"), searchTerms("x-tudo"))).toBe(true);
    expect(
      matchesTerms(
        slugify("Suco de laranja 500ml"),
        searchTerms("suco laranja"),
      ),
    ).toBe(true);
  });

  // Colar não pode virar um curinga que aproxima o que não tem relação: quem
  // procura "xtudo" não quer o X-Salada só porque os dois começam com x.
  // Colar junta o que o hífen separava, mas não apaga palavra: 'Suco de
  // laranja' colado é 'sucodelaranja', e quem digita 'sucolaranja' pulou o
  // 'de'. Fica registrado como limite conhecido, e não como esquecimento —
  // resolver isso pede busca aproximada, que é outro assunto.
  it("não adivinha a palavra que o cliente pulou", () => {
    expect(
      matchesTerms(
        slugify("Suco de laranja 500ml"),
        searchTerms("sucolaranja"),
      ),
    ).toBe(false);
  });

  it("continua exigindo todas as palavras", () => {
    expect(matchesTerms(slugify("X-Salada"), searchTerms("xtudo"))).toBe(false);
    expect(matchesTerms(slugify("Coca-Cola 2L"), searchTerms("suco"))).toBe(
      false,
    );
    expect(
      matchesTerms(slugify("Batata frita"), searchTerms("batata doce")),
    ).toBe(false);
  });
});

describe("relevance", () => {
  it("põe o nome exato na frente do que só contém", () => {
    const terms = searchTerms("coca");
    expect(relevance(slugify("Coca"), terms)).toBe(0);
    expect(relevance(slugify("Coca-Cola 2L"), terms)).toBe(1);
    expect(relevance(slugify("Bolo de fubá com coca"), terms)).toBe(2);
  });

  it("vale também para quem digita colado", () => {
    const terms = searchTerms("xtudo");
    expect(relevance(slugify("X-Tudo"), terms)).toBe(0);
    expect(relevance(slugify("X-Tudo Duplo"), terms)).toBe(1);
  });

  it("sem busca, tudo empata", () => {
    expect(relevance(slugify("X-Salada"), [])).toBe(2);
  });
});
