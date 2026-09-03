import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/entrar/actions";

export const metadata: Metadata = {
  title: "Sem acesso",
  robots: { index: false, follow: false },
};

/**
 * Conta autenticada no Supabase que não tem linha em `managers`. Sem loja
 * associada não há o que mostrar no painel.
 */
export default function SemAcessoPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">
        Esta conta não tem loja
      </h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        O login funcionou, mas não está vinculado a nenhuma loja. Fale com a
        gente para concluir o cadastro.
      </p>

      <Link
        href="/"
        className="mt-4 text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        ← Voltar para as lojas
      </Link>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
