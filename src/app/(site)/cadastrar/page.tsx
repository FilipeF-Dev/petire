import type { Metadata } from "next";

import { formatCents } from "@/lib/money";
import {
  BASIC_PRICE_CENTS,
  FOUNDER_PRICE_CENTS,
  FOUNDER_SLOTS,
  FOUNDER_TRIAL_DAYS,
  founderDiscountPercent,
  founderFirstBillingMonth,
} from "@/lib/pricing";

import { ApplicationForm } from "./application-form";
import { SavingsCalculator } from "./savings";

export const metadata: Metadata = {
  title: "Cadastre sua loja",
  description:
    "Coloque o cardápio da sua lanchonete ou distribuidora no Petire. Mensalidade fixa, sem comissão por pedido, e o cliente fala direto no seu WhatsApp.",
  alternates: { canonical: "/cadastrar" },
};

/**
 * A porta de entrada do lojista.
 *
 * Antes, entrar no Petire passava por uma conversa de WhatsApp com o admin, que
 * digitava tudo. Isso funciona nas dez primeiras lojas e vira o gargalo do
 * go-to-market — e é trabalho do fundador, não do produto.
 *
 * A página é pública e indexável de propósito: "colocar meu cardápio online" é
 * uma coisa que lojista procura no Google, e busca é o canal de aquisição que o
 * Petire tem de graça — dos dois lados do balcão.
 *
 * Ela também é a página que o vendedor manda no WhatsApp ao sair da loja, e é
 * por isso que ela precisa fechar sozinha: o preço, a conta da comissão e as
 * três dúvidas que sempre aparecem estão aqui porque, na hora em que o dono
 * abre o link, já não há ninguém do lado dele para responder.
 */

const STEPS = [
  {
    title: "Você manda o cardápio como ele já existe",
    body: "Bloco de notas, PDF, foto, ou a mensagem que você já manda no WhatsApp. Ou, se preferir, você mesmo cadastra os produtos um a um.",
  },
  {
    title: "A gente confere e coloca no ar",
    body: "Loja vazia no catálogo não ajuda ninguém, então sua página só é publicada com o cardápio de pé e o WhatsApp testado.",
  },
  {
    title: "O pedido chega pronto no seu WhatsApp",
    body: "O cliente monta o pedido na sua página e cai na sua conversa, com itens, endereço e total escritos. Pagamento e entrega você combina como sempre fez.",
  },
];

const QUESTIONS = [
  {
    q: "Já estou no iFood. Preciso sair?",
    a: "Não. A maior parte das lojas usa os dois. O Petire é para o cliente que já é seu — o do bairro, o do cartaz no balcão, o que te chama no WhatsApp. Nesse pedido não entra comissão.",
  },
  {
    q: "Dá trabalho para manter?",
    a: "Preço, promoção e “esgotado” você mexe pelo celular, num toque. Quem edita é você, na hora, sem pedir para ninguém.",
  },
  {
    q: "O Petire fica com parte do meu dinheiro?",
    a: "Nenhuma. O pagamento não passa por aqui: quem cobra é você, do jeito que você cobra hoje. O Petire só cobra a mensalidade.",
  },
  {
    q: "E se eu quiser sair?",
    a: "Você para de pagar e sua loja sai do catálogo. Não há fidelidade, multa nem contrato de permanência.",
  },
];

export default function CadastrarPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Seu cardápio online por {formatCents(BASIC_PRICE_CENTS)} por mês. Sem
          comissão por pedido.
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          O cliente monta o pedido e ele chega pronto no seu WhatsApp. Você não
          muda nada de como já trabalha — e o que você recebe pelo pedido
          continua inteiro.
        </p>

        <div className="mt-5 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium">
            As {FOUNDER_SLOTS} primeiras lojas de cada bairro entram com{" "}
            {FOUNDER_TRIAL_DAYS} dias grátis, e a partir do{" "}
            {founderFirstBillingMonth()}º mês a mensalidade é de apenas{" "}
            {formatCents(FOUNDER_PRICE_CENTS)}.
          </p>
          <p className="mt-1 text-sm font-medium text-brand">
            Ou seja, {founderDiscountPercent()}% de desconto — para sempre.
          </p>
        </div>
      </section>

      <SavingsCalculator />

      <section>
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Como funciona
        </h2>
        <ol className="mt-3 flex flex-col gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {index + 1}
              </span>
              <span>
                <span className="text-sm font-medium">{step.title}</span>
                <span className="mt-0.5 block text-sm text-neutral-600 dark:text-neutral-400">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          O que sempre perguntam
        </h2>
        <dl className="mt-3 flex flex-col gap-4">
          {QUESTIONS.map((item) => (
            <div key={item.q}>
              <dt className="text-sm font-medium">{item.q}</dt>
              <dd className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Cadastrar minha loja
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Leva dois minutos. O cardápio vem depois, no painel.
          </p>
        </div>

        <ApplicationForm />

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          A gente confere os dados antes de publicar. Sua loja entra no ar
          depois que o cardápio estiver de pé, e os {FOUNDER_TRIAL_DAYS} dias
          grátis começam a contar aí — não agora.
        </p>
      </section>
    </div>
  );
}
