import Link from "next/link";

import { signOut } from "@/app/entrar/actions";
import { requireManager } from "@/lib/auth";

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
      <header className="border-b border-neutral-200 dark:border-neutral-800">
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

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
