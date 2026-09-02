import { describe, expect, it } from "vitest";

import { normalizeWhatsapp, slugify } from "./validation";

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
