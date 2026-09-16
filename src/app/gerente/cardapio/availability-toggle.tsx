"use client";

import { useState, useTransition } from "react";

import { estadoDoToggle, proximoValor } from "@/lib/optimistic-toggle";

/**
 * "Esgotado" em um toque.
 *
 * É a ação mais frequente do painel e acontece no meio do movimento, então o
 * botão responde na hora e a ida ao servidor fica por baixo.
 *
 * Usava `useOptimistic`, e não usa mais. O motivo está escrito em
 * src/lib/optimistic-toggle.ts, com a sequência que quebrava: ele devolve o
 * valor do servidor assim que a transição termina, e o valor novo só chega
 * depois, quando a revalidação renderiza a página de novo. No intervalo o
 * botão piscava de volta, o lojista tocava outra vez achando que tinha
 * falhado, e o segundo toque repetia o mesmo comando em vez de desfazer.
 *
 * Quem quiser "simplificar" isto de volta para `useOptimistic` vai reintroduzir
 * o bug, e ele só aparece em máquina ou conexão lenta.
 */
export function AvailabilityToggle({
  id,
  idFieldName,
  isAvailable,
  action,
  extraFields,
}: {
  id: string;
  idFieldName: "productId" | "optionId";
  isAvailable: boolean;
  action: (formData: FormData) => Promise<void>;
  extraFields?: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [pedido, setPedido] = useState<boolean | null>(null);

  const estado = estadoDoToggle(isAvailable, pedido);

  return (
    <button
      type="button"
      aria-pressed={estado.mostrando}
      // Desabilitado durante a ida ao servidor para as escritas não se
      // atropelarem: cada toque parte do que o anterior pediu.
      disabled={isPending}
      onClick={() => {
        const next = proximoValor(estado);
        const formData = new FormData();
        formData.set(idFieldName, id);
        formData.set("isAvailable", String(next));
        for (const [key, value] of Object.entries(extraFields ?? {})) {
          formData.set(key, value);
        }

        setPedido(next);
        startTransition(async () => {
          await action(formData);
        });
      }}
      className={
        estado.mostrando
          ? "shrink-0 rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 transition dark:border-green-900 dark:bg-green-950 dark:text-green-300"
          : "shrink-0 rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-500 transition dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
      }
    >
      {estado.mostrando ? "Disponível" : "Esgotado"}
    </button>
  );
}
