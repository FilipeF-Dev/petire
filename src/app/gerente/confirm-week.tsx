"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, inputClass } from "@/components/ui";
import { emptyFormState } from "@/lib/validation";

import { confirmOrders } from "./actions";

/**
 * A pergunta da semana.
 *
 * O painel diz quantos pedidos **saíram** daqui. Só a loja sabe quantos
 * chegaram — e sem esse número, a conversa de renovação trava em "mas eu não
 * recebi 84". Uma pergunta por semana, sobre a semana que acabou de fechar.
 *
 * Some depois de respondida, e nem chega a aparecer quando não saiu pedido
 * nenhum: nesse caso não há o que calibrar, e a pergunta só serviria para
 * lembrar o lojista de que a semana foi fraca.
 */
function brDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Responder"}
    </Button>
  );
}

export function ConfirmWeek({
  weekStart,
  weekEnd,
  opened,
}: {
  weekStart: string;
  weekEnd: string;
  opened: number;
}) {
  const [state, formAction] = useActionState(confirmOrders, emptyFormState);

  if (state.savedAt && !state.error) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-surface p-4 text-sm dark:border-neutral-800">
        <p className="font-medium">Obrigado.</p>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Com isso a gente sabe quantos dos pedidos que saem daqui realmente
          chegam até você.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-surface p-4 dark:border-neutral-800">
      <p className="font-medium">
        Semana de {brDate(weekStart)} a {brDate(weekEnd)}
      </p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {opened} {opened === 1 ? "cliente saiu" : "clientes saíram"} daqui com o
        pedido escrito para o seu WhatsApp. Quantos você recebeu de verdade?
      </p>

      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="weekStart" value={weekStart} />

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Pedidos recebidos
          </span>
          <input
            name="confirmed"
            inputMode="numeric"
            defaultValue={state.values?.confirmed ?? ""}
            placeholder={String(opened)}
            className={`${inputClass} w-28 py-2 text-sm`}
          />
        </label>

        <Submit />

        {state.fieldErrors?.confirmed ? (
          <span className="pb-2.5 text-sm text-red-600 dark:text-red-400">
            {state.fieldErrors.confirmed}
          </span>
        ) : null}
        {state.error ? (
          <span className="pb-2.5 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : null}
      </form>

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Chute redondo serve. É para saber a proporção, não para bater centavo.
      </p>
    </div>
  );
}
