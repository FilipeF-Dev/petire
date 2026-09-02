import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function EntrarPage({
  searchParams,
}: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/gerente";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Petire</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Painel do lojista
        </p>
      </div>

      <LoginForm next={next} />

      <p className="mt-8 text-xs text-neutral-500 dark:text-neutral-400">
        Ainda não tem loja no Petire? Fale com a gente pelo WhatsApp para
        cadastrar a sua.
      </p>
    </main>
  );
}
