"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Field, FormError, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { deleteStore } from "../../actions";

function Submit({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-600/40"
    >
      {pending ? "Apagando…" : "Apagar esta loja para sempre"}
    </button>
  );
}

/**
 * Exclusão com confirmação por digitação.
 *
 * O botão só libera quando o apelido é digitado exatamente. Não é segurança —
 * o servidor confere de novo — é fricção deliberada: apagar aqui não tem
 * desfazer, e um clique errado na lista custaria o cardápio inteiro do
 * lojista.
 */
export function DeleteStore({
  storeId,
  slug,
  counts,
}: {
  storeId: string;
  slug: string;
  counts: { products: number; orders: number };
}) {
  const [state, formAction] = useActionState(deleteStore, emptyFormState);
  const [typed, setTyped] = useState("");

  return (
    <section className="max-w-lg rounded-xl border border-red-300 p-5 dark:border-red-900">
      <h2 className="font-medium text-red-700 dark:text-red-400">
        Apagar a loja
      </h2>

      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Some para sempre, sem desfazer:
      </p>
      <ul className="mt-2 list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-400">
        <li>
          o cardápio inteiro
          {counts.products > 0 ? ` — ${counts.products} ${counts.products === 1 ? "item" : "itens"}` : null}
          , com opções, promoções e fotos
        </li>
        <li>
          o histórico de métricas
          {counts.orders > 0
            ? ` — ${counts.orders} ${counts.orders === 1 ? "pedido enviado" : "pedidos enviados"}`
            : null}
        </li>
        <li>o login do lojista</li>
      </ul>

      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        Se a intenção é só tirar do catálogo, use{" "}
        <strong>Tirar do ar</strong> ou marque a assinatura como{" "}
        <strong>Suspensa</strong> — os dois são reversíveis.
      </p>

      <form action={formAction} className="mt-5 flex flex-col gap-3">
        <input type="hidden" name="storeId" value={storeId} />

        <Field
          label={`Digite ${slug} para confirmar`}
          error={state.fieldErrors?.confirm}
        >
          <input
            name="confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <FormError message={state.error} />

        <div>
          <Submit enabled={typed.trim() === slug} />
        </div>
      </form>
    </section>
  );
}
