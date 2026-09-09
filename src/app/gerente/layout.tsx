import Link from "next/link";

import { signOut } from "@/app/entrar/actions";
import { requireManager } from "@/lib/auth";
import { supportWhatsapp } from "@/lib/env";

import { GerenteNav } from "./nav";

/**
 * Todo o /gerente passa por aqui. O proxy já redireciona quem não tem sessão,
 * mas a checagem que vale é esta — o proxy é otimista por natureza.
 */
export default async function GerenteLayout({
  children,
}: LayoutProps<"/gerente">) {
  const session = await requireManager();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-neutral-200 bg-surface dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/gerente" className="font-semibold tracking-tight">
            Petire
            <span className="ml-2 text-xs font-normal text-neutral-500">
              painel
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-neutral-500 sm:inline dark:text-neutral-400">
              {session.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <GerenteNav />
      </div>

      {/*
        Sem a animação de entrada aqui, e de propósito — ela continua na
        vitrine. Ela roda *depois* de o dado chegar, então no painel, onde o
        lojista troca de aba o dia inteiro, seriam 320ms somados a cada troca
        para anunciar uma mudança que o esqueleto de carregamento já anunciou.
        Na vitrine ela paga o próprio custo: lá a troca de tela é rara e o
        movimento é o que diz ao cliente que a página é outra.
      */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>

      {/*
        Suporte no rodapé de toda página do painel, não numa página de ajuda.
        Quem trava não vai procurar onde reclamar — ou o caminho está na tela em
        que ele travou, ou ele fecha o painel e não volta.

        A mensagem já vem escrita com o apelido da loja: sem isso a conversa
        começa com "qual loja é a sua?", que é a pergunta que o Petire já sabe
        responder sozinho.
      */}
      {supportWhatsapp ? (
        <footer className="border-t border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-neutral-500 sm:px-6 dark:text-neutral-400">
            <p>Travou em alguma coisa? A gente resolve junto.</p>
            <a
              href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                `Olá! Preciso de ajuda com o painel do Petire${
                  session.storeSlug ? ` (loja ${session.storeSlug})` : ""
                }.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Falar com o Petire no WhatsApp
            </a>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
