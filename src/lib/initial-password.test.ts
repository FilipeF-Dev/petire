import { describe, expect, it } from "vitest";

import { initialPassword } from "./initial-password";

describe("initialPassword", () => {
  it("sai no formato que dá para ditar por telefone", () => {
    expect(initialPassword()).toMatch(/^petire-[a-z]+-[a-z]+-[a-z]+-[0-9]{4}$/);
  });

  /*
    Não prova aleatoriedade — nenhum teste prova. Prova o erro que já existiu
    aqui: uma senha fixa, ou um sorteio tão estreito que o mesmo valor volta
    o tempo todo. Com ~300 milhões de combinações, duas iguais em mil sorteios
    seriam um defeito, não azar.
  */
  it("não repete a senha entre convites", () => {
    const senhas = new Set(
      Array.from({ length: 1000 }, () => initialPassword()),
    );

    expect(senhas.size).toBe(1000);
  });
});
