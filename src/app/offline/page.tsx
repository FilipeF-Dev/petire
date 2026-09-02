import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sem conexão",
  robots: { index: false, follow: false },
};

/**
 * Servida pelo service worker quando a navegação falha.
 *
 * Não mostramos um cardápio guardado de propósito: item esgotado há duas horas
 * apareceria como disponível, e o cliente só descobriria ao falar com a loja.
 * Sem internet também não dá para mandar o pedido pelo WhatsApp, então não há
 * o que salvar aqui.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Sem conexão</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        O Petire precisa de internet para mostrar o cardápio atualizado. Os
        preços e o que está disponível mudam durante o dia, e um cardápio velho
        levaria você a pedir algo que já acabou.
      </p>
      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
        Seu carrinho continua salvo neste aparelho.
      </p>
    </main>
  );
}
