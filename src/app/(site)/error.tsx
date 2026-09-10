"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Quando algo quebra no meio do caminho.
 *
 * Diferente do 404: aqui o endereço existe e foi o Petire que falhou —
 * Supabase fora do ar por um minuto, uma consulta que estourou. A pessoa não
 * tem culpa e não tem o que corrigir, então a tela oferece as duas únicas
 * coisas úteis: tentar de novo, que resolve a falha passageira, e o caminho de
 * volta para o catálogo.
 *
 * Sem detalhe técnico na tela. A mensagem de erro do banco não ajuda quem quer
 * jantar, e às vezes conta mais do que deveria sobre o que existe do lado de
 * dentro.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vai para o log da Vercel, que é onde hoje se descobre que algo quebrou.
    // O `digest` é o que liga esta tela à linha de erro do servidor.
    console.error("Erro na vitrine:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Alguma coisa quebrou aqui do nosso lado.
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Não foi você. Tente de novo em alguns segundos — costuma ser
          passageiro.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:bg-surface-hover dark:border-neutral-700"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
