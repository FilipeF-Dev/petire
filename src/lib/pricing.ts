/**
 * O preço da mensalidade, e a conta que abre a conversa com o lojista.
 *
 * Os números moram aqui, num lugar só, porque eles aparecem na vitrine, no
 * material de venda e no doc de decisão ao mesmo tempo — três cópias que
 * divergem é a forma mais barata de anunciar um preço e cobrar outro.
 *
 * A decisão e o porquê de cada valor estão em `docs/precos.md`.
 */

/** Mensalidade do plano Básico, em centavos. */
export const BASIC_PRICE_CENTS = 4900;

/** Mensalidade do plano Plus, em centavos. */
export const PLUS_PRICE_CENTS = 7900;

/**
 * Preço travado das primeiras lojas de cada bairro.
 *
 * Não é desconto de lançamento: é o que paga o risco de entrar num catálogo
 * que ainda não tem movimento. Por isso ele não expira junto com o teste.
 */
export const FOUNDER_PRICE_CENTS = 2900;

/**
 * Quantas lojas por bairro entram pelo preço de fundador.
 *
 * Gêmea de `public.founder_slots()` no banco, e as duas **precisam** concordar:
 * esta é a que aparece na vitrine e no material de venda, aquela é a que recusa
 * a fundadora número onze. Mesma relação de `slugify()`.
 */
export const FOUNDER_SLOTS = 10;

/**
 * Quanto a fundadora economiza, em pontos percentuais inteiros.
 *
 * Calculado, e não escrito à mão na tela: é a mesma razão de os preços morarem
 * aqui. No dia em que o Básico ou o preço travado mudar, um número escrito na
 * vitrine continuaria anunciando o desconto antigo — e ninguém lembraria de
 * procurá-lo.
 */
export function founderDiscountPercent(): number {
  return Math.round(
    ((BASIC_PRICE_CENTS - FOUNDER_PRICE_CENTS) / BASIC_PRICE_CENTS) * 100,
  );
}

/**
 * Em que mês cai a primeira cobrança da fundadora.
 *
 * Os dias grátis são contados da publicação, então noventa dias são três meses
 * inteiros e a conta chega no quarto. Sai daqui pelo mesmo motivo do
 * percentual: mudar o teste sem mudar o texto anunciaria a data errada.
 */
export function founderFirstBillingMonth(): number {
  return Math.floor(FOUNDER_TRIAL_DAYS / 30) + 1;
}

export type StorePricing = {
  plan: "basico" | "plus";
  isFounder: boolean;
};

/**
 * O que esta loja paga por mês.
 *
 * O plano é conferido **antes** do preço de fundador, e a ordem é a decisão:
 * o preço travado é do Básico, que é o que foi prometido às dez primeiras. A
 * fundadora que sobe para o Plus está comprando recurso novo, e paga por ele —
 * o que ela não perde é o direito de voltar ao Básico pelos mesmos R$ 29.
 */
export function monthlyPriceCents({ plan, isFounder }: StorePricing): number {
  if (plan === "plus") return PLUS_PRICE_CENTS;
  return isFounder ? FOUNDER_PRICE_CENTS : BASIC_PRICE_CENTS;
}

/**
 * Dias grátis das primeiras lojas do bairro.
 *
 * Contados de quando a loja **entra no ar**, não de quando ela se cadastra —
 * ver `docs/precos.md`. Cadastro sem cardápio não recebe pedido, e queimar o
 * teste esperando o cardápio faz a loja chegar na primeira cobrança sem
 * nenhum número para justificar a renovação.
 */
export const FOUNDER_TRIAL_DAYS = 90;

export type Savings = {
  /** O que o aplicativo leva de comissão no mês. */
  commissionCents: number;
  /** O que o Petire cobra no mesmo mês. */
  petireCents: number;
  /** A diferença entre os dois, no mês. */
  monthlyCents: number;
  /** A mesma diferença, no ano — é o número que o lojista repete depois. */
  yearlyCents: number;
};

/**
 * Quanto sobra ao mover um faturamento de comissão para mensalidade fixa.
 *
 * A comissão **não** é chutada pelo Petire: o lojista informa a dele, porque
 * a taxa varia com o plano, com a entrega ser do app ou da loja, e com o que
 * cada um negociou. Anunciar um percentual como se fosse o dele é a maneira
 * mais rápida de perder a conversa — ele confere no extrato e a conta não
 * bate.
 *
 * Devolve `null` enquanto os dados não fecham uma conta possível, para a tela
 * ficar calada em vez de mostrar zero enquanto o lojista ainda digita.
 */
export function monthlySavings({
  revenueCents,
  commissionPercent,
  priceCents,
}: {
  revenueCents: number;
  commissionPercent: number;
  priceCents: number;
}): Savings | null {
  if (!Number.isFinite(revenueCents) || revenueCents <= 0) return null;
  if (!Number.isFinite(commissionPercent)) return null;
  if (commissionPercent <= 0 || commissionPercent > 100) return null;

  const commissionCents = Math.round((revenueCents * commissionPercent) / 100);
  const monthlyCents = commissionCents - priceCents;

  return {
    commissionCents,
    petireCents: priceCents,
    monthlyCents,
    yearlyCents: monthlyCents * 12,
  };
}

/**
 * A mensalidade dividida por dia.
 *
 * Para a loja que não está em aplicativo nenhum a conta da comissão não diz
 * nada — ela não paga comissão. O que responde a pergunta dela ("R$ 49 é
 * caro?") é o valor por dia, que é a régua com que ela já pensa o gás, o
 * ponto e o refrigerante.
 *
 * Trinta dias, sempre: variar com o calendário mudaria o número de mês para
 * mês sem mudar nada da decisão.
 */
export function dailyCents(priceCents: number): number {
  return Math.round(priceCents / 30);
}
