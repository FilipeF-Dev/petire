/**
 * O preço que o cardápio mostra quando escolher é obrigatório.
 *
 * Nasceu de um cardápio de verdade: a Batata Frita da Rick Lanches está
 * cadastrada a R$ 0,00 com um grupo obrigatório "Tamanho" — pequena +R$ 12,50,
 * média +R$ 24,50. O lojista modelou certo, porque o preço realmente mora no
 * tamanho. Mas o card mostrava **R$ 0,00**, e "Batata Frita — R$ 0,00" não é
 * lido como "escolha o tamanho": é lido como erro, ou como pegadinha.
 *
 * A regra é a que o cliente já conhece de qualquer aplicativo de comida:
 * quando o item obriga a escolher e a escolha mais barata custa alguma coisa,
 * o preço vira "a partir de".
 *
 * Só grupo **obrigatório** conta. Adicional opcional não muda o preço de
 * entrada — quem não marca nada paga o que está no card.
 */

export type PriceGroup = {
  min_select: number;
  options: { price_delta_cents: number; is_available: boolean }[];
};

/**
 * Quanto custa, no mínimo, atender ao que o item obriga.
 *
 * Zero quando não há grupo obrigatório, quando a opção mais barata é de graça,
 * ou quando ela é um desconto — "sem cebola, −R$ 2,00" não faz o item começar
 * mais barato do que o preço anunciado, porque o cliente pode não escolher a
 * opção que abate.
 */
export function requiredExtraCents(groups: PriceGroup[]): number {
  let total = 0;

  for (const group of groups) {
    if (group.min_select < 1) continue;

    const disponiveis = group.options.filter((option) => option.is_available);
    if (disponiveis.length === 0) continue;

    const maisBarata = Math.min(
      ...disponiveis.map((option) => option.price_delta_cents),
    );

    // O grupo pode obrigar mais de uma escolha; a conta usa a mais barata
    // repetida, que é o piso real do que o cliente vai pagar.
    total += Math.max(0, maisBarata) * group.min_select;
  }

  return total;
}

export type StartingPrice = {
  /** O que o card mostra. */
  cents: number;
  /** Verdadeiro quando esse valor é um piso, e não o preço final. */
  isFrom: boolean;
};

/**
 * O item ainda não tem preço que se possa mostrar.
 *
 * Zero aqui quase nunca é "de graça": é cadastro pela metade. Acontece de
 * verdade — uma lanchonete em produção subiu cinco itens a R$ 0,00 porque a
 * regra de "escolha o tamanho" ia entrar depois. Enquanto não entra, o cardápio
 * anuncia comida de graça, e o Google recebe "a partir de R$ 0,00" nos dados
 * estruturados da loja.
 *
 * É a mesma leitura que `formatDeliveryFee` já faz da taxa zerada, e pelo mesmo
 * motivo: o site não pode prometer, em nome da loja, o que ela não prometeu.
 *
 * O item continua no cardápio e continua pedível — quem quer o X-Tudo não
 * deveria perder o item porque o preço não foi digitado. O que muda é o que
 * está escrito no lugar do número.
 */
export function precoACombinar(price: StartingPrice): boolean {
  return price.cents === 0;
}

/** O preço de entrada do item, já somado ao que ele obriga escolher. */
export function startingPrice(
  priceCents: number,
  groups: PriceGroup[],
): StartingPrice {
  const extra = requiredExtraCents(groups);
  return { cents: priceCents + extra, isFrom: extra > 0 };
}
