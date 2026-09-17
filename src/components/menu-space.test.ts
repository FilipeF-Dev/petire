import { describe, expect, it } from "vitest";

import { cabe } from "./menu-space";

describe("cabe", () => {
  /*
    O caso relatado pelo suporte: a loja tinha 85 itens de uma colagem
    anterior e ele colou mais 88. A conta do banco estava certa; o que faltava
    era alguém dizer isso antes de ele montar o cardápio inteiro.
  */
  it("85 na loja mais 88 colados não cabem em 100", () => {
    expect(cabe({ usados: 85, teto: 100 }, 88)).toBe(false);
  });

  it("88 numa loja vazia cabem", () => {
    expect(cabe({ usados: 0, teto: 100 }, 88)).toBe(true);
  });

  it("encostar no teto ainda cabe", () => {
    // O banco recusa quando **passa**, não quando iguala. As duas contas
    // precisam concordar, senão a tela bloqueia uma colagem que entraria.
    expect(cabe({ usados: 12, teto: 100 }, 88)).toBe(true);
    expect(cabe({ usados: 13, teto: 100 }, 88)).toBe(false);
  });

  it("no plano de cima o mesmo cardápio cabe", () => {
    expect(cabe({ usados: 85, teto: 1000 }, 88)).toBe(true);
  });
});
