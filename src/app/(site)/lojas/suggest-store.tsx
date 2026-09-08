"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { emptyFormState } from "@/lib/validation";

import { suggestStore } from "./actions";

/**
 * O que fazer com quem não encontrou nada.
 *
 * "Nenhuma loja com esses filtros" é um beco sem saída: o cliente sai e não
 * volta, e o Petire não fica sabendo de nada. Mas essa pessoa tem exatamente a
 * informação que falta para o próximo bairro existir — ela sabe o nome da
 * lanchonete que queria, e provavelmente segue no Instagram.
 *
 * Perguntar aqui transforma a frustração em fila de prospecção, e a abordagem
 * deixa de ser fria: "um cliente seu pediu que a gente falasse com você" é uma
 * conversa completamente diferente de uma mensagem de vendas.
 *
 * Nada é pedido sobre quem indicou. O contato é o da loja, e é público.
 */
export function SuggestStore({
  reason,
  term,
  place,
  citySlug,
  neighborhoodSlug,
}: {
  /**
   * Por que a lista veio vazia. As duas causas pedem frases diferentes: dizer
   * "ainda não chegamos aqui" a quem procurou "hambúrguer" numa cidade que tem
   * lanchonete é informação errada — e o cliente vai embora achando que o
   * Petire não atende ali.
   */
  reason: "search_empty" | "area_uncovered";
  /** O que a pessoa procurou. Só em `search_empty`. */
  term: string | null;
  /** Nome da cidade como o cliente leu na página. Nulo quando não veio na URL. */
  place: string | null;
  citySlug: string | null;
  neighborhoodSlug: string | null;
}) {
  const [state, formAction] = useActionState(suggestStore, emptyFormState);

  const field =
    "w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300";

  if (state.savedAt && !state.error) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-surface p-5 dark:border-neutral-800">
        <p className="font-medium">Anotado. Obrigado!</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Vamos falar com essa loja. Se ela entrar, ela vai estar aqui da
          próxima vez que você abrir o Petire.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-surface p-5 dark:border-neutral-800">
      <h2 className="font-medium">
        {reason === "search_empty"
          ? term
            ? `Nenhuma loja com “${term}”.`
            : "Nenhuma loja com esse termo."
          : place
            ? `Ainda não chegamos em ${place}.`
            : "Ainda não chegamos aqui."}
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {reason === "search_empty"
          ? "Qual loja você queria pedir? A gente fala com ela."
          : "O Petire abre um bairro por vez. Qual loja você queria pedir daqui? A gente fala com ela."}
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="citySlug" value={citySlug ?? ""} />
        <input
          type="hidden"
          name="neighborhoodSlug"
          value={neighborhoodSlug ?? ""}
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nome da loja</span>
          <input
            name="storeName"
            defaultValue={state.values?.storeName ?? ""}
            maxLength={80}
            placeholder="Lanchonete do Zé"
            className={field}
          />
          {state.fieldErrors?.storeName ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.storeName}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            Instagram ou telefone dela{" "}
            <span className="font-normal text-neutral-500 dark:text-neutral-400">
              (se você souber)
            </span>
          </span>
          <input
            name="contact"
            defaultValue={state.values?.contact ?? ""}
            maxLength={80}
            placeholder="@lanchonetedoze"
            className={field}
          />
        </label>

        <Submit />

        {state.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}
      </form>
    </section>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
    >
      {pending ? "Enviando…" : "Indicar essa loja"}
    </button>
  );
}
