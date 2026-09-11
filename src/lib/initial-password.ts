import { randomInt } from "node:crypto";

/**
 * A senha que o lojista recebe por telefone.
 *
 * Ela precisa ser ditada: quem abre a loja está no balcão, e "soletra o hexa"
 * não acontece. Daí as palavras. O problema é que a versão anterior sorteava
 * com `Math.random()`, que não é feito para segredo — é um gerador rápido e
 * previsível, e o do V8 é reversível: com algumas senhas observadas dá para
 * reconstruir o estado e prever as próximas. Como a loja já sabe o e-mail
 * convidado (é ela quem convida), isso bastava.
 *
 * `randomInt` do node:crypto resolve a parte previsível. O resto é tamanho:
 * três palavras de uma lista de 32 e quatro dígitos dão cerca de 300 milhões
 * de combinações — o suficiente para ninguém acertar por tentativa contra o
 * limite de login do Supabase, e ainda assim algo que cabe num recado de voz.
 *
 * Continua sendo senha **temporária**: quem entra troca, e o admin sabe gerar
 * outra. Ela não foi feita para durar um ano.
 */
const PALAVRAS = [
  "pao",
  "mesa",
  "gelo",
  "forno",
  "balcao",
  "copo",
  "brasa",
  "queijo",
  "molho",
  "prato",
  "garfo",
  "chapa",
  "grelha",
  "cebola",
  "tomate",
  "farinha",
  "panela",
  "bandeja",
  "porta",
  "janela",
  "toalha",
  "guarda",
  "caixa",
  "troco",
  "moeda",
  "entrega",
  "esquina",
  "bairro",
  "manha",
  "tarde",
  "noite",
  "sabado",
];

export function initialPassword(): string {
  const palavra = () => PALAVRAS[randomInt(PALAVRAS.length)];
  return `petire-${palavra()}-${palavra()}-${palavra()}-${randomInt(1000, 10000)}`;
}
