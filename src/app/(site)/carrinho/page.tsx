import type { Metadata } from "next";

import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Carrinho",
  // O carrinho é do visitante e não tem conteúdo próprio para indexar.
  robots: { index: false, follow: true },
};

export default function CarrinhoPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Seu pedido</h1>
      <CartView />
    </div>
  );
}
