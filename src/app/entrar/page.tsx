import type { Metadata } from "next";
import Link from "next/link";

import { supportWhatsapp } from "@/lib/env";

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

      {/*
        Esta página recebe dois tipos de gente perdida: quem tem conta e não
        entra, e quem nunca teve. A frase antiga falava com os dois e não
        oferecia saída para nenhum — prometia um WhatsApp que não era link e
        ignorava que o autocadastro existe.
      */}
      <div className="mt-8 flex flex-col gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <p>
          Ainda não tem loja aqui?{" "}
          <Link href="/cadastrar" className="underline underline-offset-4">
            Cadastre a sua
          </Link>
          , leva um minuto.
        </p>

        {/* Sem número configurado o convite some, em vez de virar um link que
            não vai a lugar nenhum — foi assim que ele nasceu quebrado. */}
        {supportWhatsapp ? (
          <p>
            Perdeu o acesso?{" "}
            <a
              href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                "Olá! Não estou conseguindo entrar no painel do Petire.",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Fale com a gente no WhatsApp
            </a>
            .
          </p>
        ) : null}
      </div>

      <Link
        href="/"
        className="mt-6 text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        ← Voltar para as lojas
      </Link>
    </main>
  );
}
