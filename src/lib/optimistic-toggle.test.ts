import { describe, expect, it } from "vitest";

import { estadoDoToggle, proximoValor } from "./optimistic-toggle";

describe("estadoDoToggle", () => {
  it("sem nada pedido, quem manda é o servidor", () => {
    expect(estadoDoToggle(true, null)).toEqual({
      mostrando: true,
      pendente: false,
    });
  });

  it("o pedido vale enquanto o servidor não alcança", () => {
    expect(estadoDoToggle(true, false)).toEqual({
      mostrando: false,
      pendente: true,
    });
  });

  it("quando o servidor concorda, o pedido sai de cena", () => {
    // Importa porque uma mudança feita em outro lugar — outra aba, o suporte —
    // não pode ficar presa atrás de um pedido antigo desta tela.
    expect(estadoDoToggle(false, false)).toEqual({
      mostrando: false,
      pendente: false,
    });
  });
});

describe("dois toques seguidos, com o servidor devagar", () => {
  /*
    A sequência que quebrou em produção — e que o CI, numa máquina mais lenta
    que a de quem desenvolve, pegou antes de chegar a alguém.

    O intervalo é este: a Server Action responde (a transição acaba) e o valor
    novo só chega quando a revalidação renderiza a página de novo. Com
    `useOptimistic`, o botão voltava ao valor antigo nesse intervalo, e o
    segundo toque mandava o mesmo comando outra vez.
  */
  it("os dois toques se anulam mesmo sem o servidor ter respondido", () => {
    const servidor = true; // o que a página ainda mostra: disponível
    let pedido: boolean | null = null;

    // Primeiro toque: esgota.
    const primeiro = proximoValor(estadoDoToggle(servidor, pedido));
    expect(primeiro).toBe(false);
    pedido = primeiro;

    // O servidor ainda não alcançou — mas o botão continua dizendo "Esgotado",
    // que é o que o lojista acabou de pedir.
    expect(estadoDoToggle(servidor, pedido).mostrando).toBe(false);

    // Segundo toque, no mesmo intervalo: tem de desfazer, e não repetir.
    const segundo = proximoValor(estadoDoToggle(servidor, pedido));
    expect(segundo).toBe(true);
  });

  it("o comportamento antigo repetia o comando, e é isso que não pode voltar", () => {
    // Sem a memória do pedido, o segundo toque lê o valor velho do servidor e
    // manda `false` de novo — o item termina esgotado depois de dois toques.
    const servidor = true;
    const comMemoria = proximoValor(estadoDoToggle(servidor, false));
    const semMemoria = !servidor;

    expect(semMemoria).toBe(false);
    expect(comMemoria).toBe(true);
  });
});
