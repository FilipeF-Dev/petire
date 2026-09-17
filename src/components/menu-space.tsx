/**
 * Quanto ainda cabe no cardápio.
 *
 * Nasceu de um relato do suporte: colou 88 itens e recebeu de volta "Seu plano
 * permite 100 itens". A conta estava certa — a loja já tinha 85 de uma colagem
 * anterior — mas a recusa vinha depois de montar o JSON, pedir à IA, colar e
 * conferir. Todo esse trabalho para descobrir no último clique.
 *
 * A informação existia o tempo todo. Ela só não estava na tela.
 */

export type EspacoNoCardapio = {
  /** Quantos itens a loja já tem. */
  usados: number;
  /** Quantos o plano dela permite. */
  teto: number;
};

/**
 * Cabe?
 *
 * O banco recusa quando **passa** do teto, não quando iguala — ver
 * enforce_item_limit. As duas contas precisam concordar, senão a tela bloqueia
 * uma colagem que entraria, ou deixa passar uma que vai ser recusada.
 */
export function cabe(espaco: EspacoNoCardapio, entrando: number): boolean {
  return espaco.usados + entrando <= espaco.teto;
}

export function MenuSpace({
  espaco,
  entrando,
}: {
  espaco: EspacoNoCardapio;
  /** Quantos itens a colagem traria. Zero enquanto nada foi colado. */
  entrando: number;
}) {
  const sobrando = espaco.teto - espaco.usados;
  const estoura = !cabe(espaco, entrando);

  if (estoura) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        A loja já tem {espaco.usados} {espaco.usados === 1 ? "item" : "itens"} e
        o plano permite {espaco.teto}. Esta colagem traria mais {entrando} —
        daria {espaco.usados + entrando}.{" "}
        {/*
          A saída certa quase nunca é colar em duas partes: um cardápio que
          estoura o teto costuma ser um cardápio com os sabores listados um a
          um. Agrupar resolve o teto e melhora o cardápio ao mesmo tempo.
        */}
        Agrupe as variações do mesmo produto, ou apague o que já está lá antes
        de colar de novo.
      </p>
    );
  }

  return (
    <p className="text-xs text-neutral-500 dark:text-neutral-400">
      A loja tem {espaco.usados} de {espaco.teto} itens
      {entrando > 0
        ? ` — esta colagem deixaria ${espaco.usados + entrando}`
        : `, então cabem mais ${sobrando}`}
      .
    </p>
  );
}
