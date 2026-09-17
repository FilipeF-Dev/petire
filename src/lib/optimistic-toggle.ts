/**
 * O que um botão de liga-desliga mostra enquanto o servidor não responde.
 *
 * Parece detalhe e não é. O "Esgotado" do painel usava `useOptimistic`, que
 * mostra o valor pedido durante a transição e **volta ao valor do servidor**
 * quando ela termina. O problema é o intervalo entre as duas coisas: a
 * transição acaba quando a Server Action responde, e o valor novo só chega
 * depois, quando a revalidação renderiza a página de novo.
 *
 * Nesse intervalo o botão pisca de volta para o estado antigo. Numa máquina
 * rápida ele é invisível; numa conexão de celular no balcão, não. E o que o
 * lojista faz ao ver o botão voltar é o que qualquer um faria: toca outra vez.
 * Esse segundo toque, calculado a partir do valor velho, manda **o mesmo
 * comando de novo** — e o item fica esgotado quando ele acabou de mandar o
 * contrário duas vezes.
 *
 * Encontrado pelo CI, que roda numa máquina mais lenta que a de quem
 * desenvolve: o teste de dois toques falhou lá e passava aqui, oito de oito.
 *
 * A correção é lembrar o que foi **pedido**, e não só o que o servidor diz. O
 * pedido vale até o servidor concordar com ele; a partir daí quem manda é o
 * servidor de novo — assim uma mudança feita em outro lugar não fica presa
 * atrás de um pedido antigo.
 */

export type EstadoDoToggle = {
  /** O que o botão mostra agora. */
  mostrando: boolean;
  /** Verdadeiro enquanto o servidor ainda não confirmou o último pedido. */
  pendente: boolean;
};

export function estadoDoToggle(
  /** O valor que veio do servidor no último render. */
  servidor: boolean,
  /** O último valor pedido nesta tela, ou nulo se nada foi pedido ainda. */
  pedido: boolean | null,
): EstadoDoToggle {
  const pendente = pedido !== null && pedido !== servidor;

  return { mostrando: pendente ? pedido : servidor, pendente };
}

/**
 * O valor que o próximo toque manda.
 *
 * Sai do que está na tela, e não do que o servidor disse: é o que faz dois
 * toques seguidos se anularem em vez de repetirem o mesmo comando.
 */
export function proximoValor(estado: EstadoDoToggle): boolean {
  return !estado.mostrando;
}
