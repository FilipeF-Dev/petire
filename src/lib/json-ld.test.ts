import { describe, expect, it } from "vitest";

import { jsonLdScript } from "./json-ld";

describe("jsonLdScript", () => {
  /*
    O caso real, e não um inventado: até esta correção, uma loja com isto na
    descrição executava script na origem do Petire, para todo cliente que
    abrisse a página dela.

    A sequência escapada é procurada como "u003c", sem a barra invertida na
    frente: escrever a barra aqui exigiria escapá-la também, e um teste que
    erra o próprio escape testa a si mesmo, não o código.
  */
  it("não deixa o texto da loja fechar a tag script", () => {
    const saida = jsonLdScript({
      description: "Lanches</script><script>alert(1)</script>",
    });

    expect(saida).not.toContain("</script");
    expect(saida).toContain("u003c/script");
  });

  it("continua sendo o mesmo JSON depois do parse", () => {
    const dados = {
      name: "Lanchonete do Zé",
      description: "Pão < queijo & cia",
      menu: { url: "https://petire.com.br/loja/ze" },
    };

    // Escapar não pode alterar o dado: o que a loja escreveu é o que o Google lê.
    expect(JSON.parse(jsonLdScript(dados))).toEqual(dados);
  });

  it("escapa todo `<`, não só o que abre tag", () => {
    expect(jsonLdScript({ a: "1 < 2 < 3" })).not.toContain("<");
  });
});
