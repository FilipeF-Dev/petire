import { describe, expect, it } from "vitest";

import {
  escolhaPadrao,
  fazEntrega,
  fazRetirada,
  precisaEscolher,
  taxaDaEscolha,
  type ServiceMode,
} from "./service-mode";

const MODOS: ServiceMode[] = ["delivery", "pickup", "both"];

describe("modo de atendimento", () => {
  it("toda loja atende de pelo menos um jeito", () => {
    // Não é filosofia: é a checagem de que nenhum dos três valores produz uma
    // loja que não aceita pedido nenhum.
    for (const modo of MODOS) {
      expect(fazEntrega(modo) || fazRetirada(modo)).toBe(true);
    }
  });

  it("só pergunta quando há o que perguntar", () => {
    expect(precisaEscolher("both")).toBe(true);
    expect(precisaEscolher("delivery")).toBe(false);
    expect(precisaEscolher("pickup")).toBe(false);
  });

  it("a escolha que vem marcada é sempre uma que a loja faz", () => {
    for (const modo of MODOS) {
      const padrao = escolhaPadrao(modo);
      expect(padrao === "pickup" ? fazRetirada(modo) : fazEntrega(modo)).toBe(
        true,
      );
    }
  });

  it("quem busca não paga entrega", () => {
    expect(taxaDaEscolha("pickup", 700)).toBe(0);
    expect(taxaDaEscolha("delivery", 700)).toBe(700);
  });
});
