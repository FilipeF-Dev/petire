import Link from "next/link";

import { CartLink } from "@/components/cart-link";
import { PageTransition } from "@/components/page-transition";
import { LocationBar } from "@/components/location-bar";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-neutral-200 bg-surface dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Petire
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/lojas"
              className="text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
            >
              Lojas
            </Link>
            <CartLink />
          </div>
          {/* Ocupa a linha inteira no celular. Na home ela se cala enquanto
              não há CEP — lá o campo grande faz a pergunta — e o `empty:hidden`
              tira o espaço que a linha vazia deixaria. */}
          <div className="order-last min-w-0 basis-full empty:hidden">
            <LocationBar />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <PageTransition>{children}</PageTransition>
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-neutral-500 sm:px-6 dark:text-neutral-400">
          <p>Petire · peça direto da loja, sem taxa de serviço.</p>
          <span className="flex gap-4">
            <Link
              href="/cadastrar"
              className="underline-offset-4 hover:underline"
            >
              Cadastrar minha loja
            </Link>
            <Link href="/entrar" className="underline-offset-4 hover:underline">
              Sou lojista
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
