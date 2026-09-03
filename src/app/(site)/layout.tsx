import Link from "next/link";

import { CartLink } from "@/components/cart-link";
import { LocationBar } from "@/components/location-bar";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
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
          {/* Ocupa a linha inteira no celular: é a porta de entrada do site. */}
          <div className="order-last min-w-0 basis-full">
            <LocationBar />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-neutral-500 sm:px-6 dark:text-neutral-400">
          <p>Petire · peça direto da loja, sem taxa de serviço.</p>
          <Link href="/entrar" className="underline-offset-4 hover:underline">
            Sou lojista
          </Link>
        </div>
      </footer>
    </div>
  );
}
