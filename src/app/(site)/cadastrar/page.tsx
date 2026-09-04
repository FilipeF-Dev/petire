import type { Metadata } from "next";

import { ApplicationForm } from "./application-form";

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
 */
export default function CadastrarPage() {
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Seu cardápio no Petire.
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Mensalidade fixa, sem comissão por pedido. O cliente monta o pedido e
          ele chega pronto no seu WhatsApp — você não muda nada de como já
          trabalha.
        </p>
      </section>

      <ul className="flex flex-col gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <li>· Você mesmo edita cardápio, preço e promoção, pelo celular.</li>
        <li>· Dá para colar o cardápio pronto, em texto, de uma vez.</li>
        <li>· O Petire não vê seu dinheiro: pagamento é você quem combina.</li>
      </ul>

      <ApplicationForm />

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        A gente confere os dados antes de publicar. Sua loja entra no ar depois
        que o cardápio estiver de pé.
      </p>
    </div>
  );
}
