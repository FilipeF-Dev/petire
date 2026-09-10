import { beforeEach, describe, expect, it } from "vitest";

import { clientIp, excedeuLimite, limparLimites } from "./rate-limit";

describe("excedeuLimite", () => {
  beforeEach(() => limparLimites());

  it("deixa passar o uso normal e barra o excesso", () => {
    const agora = Date.now();

    // Trinta cabem na janela; a trigésima primeira não.
    for (let i = 0; i < 30; i += 1) {
      expect(excedeuLimite("demanda:1.2.3.4", agora)).toBe(false);
    }

    expect(excedeuLimite("demanda:1.2.3.4", agora)).toBe(true);
  });

  it("solta de novo na janela seguinte", () => {
    const agora = Date.now();
    for (let i = 0; i < 31; i += 1) excedeuLimite("demanda:1.2.3.4", agora);

    expect(excedeuLimite("demanda:1.2.3.4", agora + 60_001)).toBe(false);
  });

  // O balde é por IP e por rota: quem passou do limite na demanda não pode
  // levar junto o registro de evento de outra pessoa.
  it("conta separado por chave", () => {
    const agora = Date.now();
    for (let i = 0; i < 31; i += 1) excedeuLimite("demanda:1.2.3.4", agora);

    expect(excedeuLimite("demanda:5.6.7.8", agora)).toBe(false);
    expect(excedeuLimite("evento:1.2.3.4", agora)).toBe(false);
  });
});

describe("clientIp", () => {
  it("pega o cliente, e não o proxy do meio do caminho", () => {
    const request = new Request("https://petire.com.br/api/demand", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178",
      },
    });

    expect(clientIp(request)).toBe("203.0.113.7");
  });

  // Sem cabeçalho todo mundo cai no mesmo balde. É conservador na direção
  // certa: no máximo limita demais, nunca de menos.
  it("não fica sem chave quando o cabeçalho não vem", () => {
    const request = new Request("https://petire.com.br/api/demand");
    expect(clientIp(request)).toBe("desconhecido");
  });
});
