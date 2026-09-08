import { FOUNDER_SLOTS } from "./pricing";

/**
 * O levantamento de rua, transformado em ordem de visita e em argumento.
 *
 * As três colunas anotadas na calçada não são estatística: cada combinação
 * delas responde uma pergunta diferente — por onde começar a conversa, e com
 * quem começar. É isso que esta lib calcula, e é por isso que ela é testada:
 * errar aqui manda o fundador bater na porta certa com a frase errada.
 *
 * O critério está escrito em `docs/bairro-de-estreia.md`.
 */

export type Survey = {
  /** Cardápio visível na fachada ou na vitrine. */
  has_menu: boolean;
  /** WhatsApp anunciado na fachada. */
  has_whatsapp: boolean;
  /** Encontrada em aplicativo de delivery. */
  on_app: boolean;
};

/**
 * Quantas candidatas o bairro precisa ter antes de valer a pena abrir.
 *
 * Quinze, e não as dez da meta, porque nem toda visita fecha — e um bairro em
 * que é preciso converter 100% para bater a meta é um bairro que não bate.
 */
export const SURVEY_TARGET = 15;

/** A meta de lojas no ar, a mesma do preço de fundador. */
export const LAUNCH_TARGET = FOUNDER_SLOTS;

export type Approach = {
  /** Rótulo curto, para a lista. */
  label: string;
  /** O que fazer na porta. */
  line: string;
};

/**
 * Por onde abrir a conversa nesta loja.
 *
 * A ordem das perguntas importa. Quem está no aplicativo tem uma dor que fecha
 * sozinha numa conta, e ela ganha de qualquer outra — inclusive de não ter
 * cardápio online, porque ele tem: o do aplicativo.
 */
export function approachFor(survey: Survey): Approach {
  if (survey.on_app) {
    return {
      label: "comissão",
      line: "Abra a conta em /cadastrar com o faturamento dele. A dor já tem número.",
    };
  }

  if (!survey.has_menu) {
    return {
      label: "vitrine",
      line: "Mostre a página de outra loja no celular: o cardápio dele hoje é uma foto que ele reenvia o dia inteiro.",
    };
  }

  if (survey.has_whatsapp) {
    return {
      label: "pedido pronto",
      line: "Ele já vende por WhatsApp. O ganho é o pedido chegar escrito, com endereço, sem ida e volta.",
    };
  }

  return {
    label: "confirmar encaixe",
    line: "Sem WhatsApp na fachada, o encaixe é menor. Pergunte como o cliente pede hoje antes de gastar a visita.",
  };
}

/**
 * A ordem da visita. Menor vem primeiro.
 *
 * Quem está no aplicativo **e** anuncia WhatsApp é o encaixe perfeito: paga
 * comissão hoje e já atende no canal para onde o pedido vai. Quem não tem
 * cardápio à vista vem logo atrás, porque a dor é visível da calçada. No fim
 * fica quem só se sabe que existe.
 */
export function fitRank(survey: Survey): number {
  if (survey.on_app && survey.has_whatsapp) return 0;
  if (survey.on_app) return 1;
  if (!survey.has_menu && survey.has_whatsapp) return 2;
  if (!survey.has_menu) return 3;
  if (survey.has_whatsapp) return 4;
  return 5;
}
