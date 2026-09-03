import { describe, expect, it } from "vitest";

import { humanizePlace, slugify } from "./slug";
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
    expect(humanizePlace("sao-joao-da-boa-vista")).toBe("Sao Joao da Boa Vista");
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
