import Link from "next/link";

/**
 * Placeholder. A vitrine de verdade (seletor de bairro + lista de lojas) é a
 * fase 2 do MVP.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Petire</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Peça direto da loja do seu bairro. Sem taxa, sem cadastro.
        </p>
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        A vitrine de lojas está em construção.
      </p>

      <Link
        href="/entrar"
        className="w-fit rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        Sou lojista
      </Link>
    </main>
  );
}
