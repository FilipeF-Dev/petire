/**
 * Entrega, retirada no balcão, ou os dois.
 *
 * Apareceu no cadastro de uma lanchonete de verdade: ela recebe o pedido pelo
 * WhatsApp e o cliente busca. Até então o site tratava entrega como fato — toda
 * loja tinha taxa, todo carrinho somava essa taxa, e o último passo pedia o
 * endereço de quem recebe. Para essa lanchonete, o endereço era um formulário
 * que não serve para nada e, pior, uma promessa de entrega que não vem.
 *
 * Três valores e não dois porque a rua tem três: quem só entrega, quem só
 * atende no balcão, e — a maioria — quem faz as duas coisas. Com dois valores
 * essa maioria teria de mentir num dos lados.
 *
 * A aritmética do pedido mora aqui, e não na tela, porque ela é a mesma em
 * dois lugares: na montagem do carrinho, que decide a conta padrão, e no
 * carrinho aberto, quando o cliente troca de ideia. Duas cópias da mesma conta
 * é como um total passa a discordar do outro.
 */

export type ServiceMode = "delivery" | "pickup" | "both";

/** O que vale para este pedido: ou entrega, ou retirada. Nunca "os dois". */
export type Escolha = "delivery" | "pickup";

export function fazEntrega(modo: ServiceMode): boolean {
  return modo !== "pickup";
}

export function fazRetirada(modo: ServiceMode): boolean {
  return modo !== "delivery";
}

/** Só quando a loja faz as duas coisas é que existe o que perguntar. */
export function precisaEscolher(modo: ServiceMode): boolean {
  return modo === "both";
}

/**
 * A escolha que já vem marcada.
 *
 * Entrega, sempre que ela existir: é o que a maior parte de quem pede quer, e
 * quem vai buscar sabe que vai buscar — troca em um toque.
 */
export function escolhaPadrao(modo: ServiceMode): Escolha {
  return modo === "pickup" ? "pickup" : "delivery";
}

/** Quem busca não paga entrega. */
export function taxaDaEscolha(
  escolha: Escolha,
  deliveryFeeCents: number,
): number {
  return escolha === "pickup" ? 0 : deliveryFeeCents;
}

/** Como a loja se descreve na vitrine. */
export function rotuloDoModo(modo: ServiceMode): string {
  if (modo === "pickup") return "Só retirada";
  if (modo === "both") return "Entrega e retirada";
  return "Entrega";
}
